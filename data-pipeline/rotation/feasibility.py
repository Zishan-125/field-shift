"""
FIELD SHIFT — cropping-pattern feasibility checker

A cropping pattern is an annual sequence written in the Bangladesh notation
Rabi crop - Kharif-1 crop - Kharif-2 crop (e.g. Boro-Fallow-T. Aman).
The three positions are an ordered sequence through the year; they are not
strict season slots (in Mustard-Boro-T. Aman, Boro is transplanted in
December although it sits in the second position).

A pattern is checked against the crop calendar (data-pipeline/reference/
crop_calendar.csv). Each crop may have several calendar variants (regional
DAE calendar, national BRRI/BARI recommendation, ...). The checker tries every
combination of variants and keeps the best one.

Rules
    1. A crop occupies the main field from its field start (transplanting or
       sowing) for field_days_min days, and never leaves the field before
       the earliest harvest date of its calendar (when the source gives one).
    2. Each crop must start inside its start window, and not before the
       previous crop has left the field (plus turnaround time).
    3. The sequence must close: the first crop of next year must still fit
       after the last crop of this year. Equivalently the whole sequence,
       including turnaround, must fit in 365 days.

Statuses
    feasible     fits with the assumed turnaround time between crops
    tight        fits only with less turnaround than assumed
    infeasible   does not fit even with zero turnaround (windows overlap or
                 the year is too short)
    unverified   at least one crop has no sourced calendar window

Hard rejection (infeasible) never depends on the turnaround assumption.
"""

from __future__ import annotations

import csv
from dataclasses import dataclass, field
from datetime import date, timedelta
from itertools import product
from pathlib import Path
from typing import Iterable, Mapping, Optional, Sequence


YEAR_DAYS = 365

# ASSUMPTION — not taken from a published source. Days needed between the
# harvest of one crop and the sowing/transplanting of the next (harvest,
# land preparation). Only separates "feasible" from "tight"; it never causes
# a rejection. Listed in docs/data-gaps.md for replacement by a sourced value.
ASSUMED_TURNAROUND_DAYS = 7

# Agricultural-year origin used to order dates: 1 July (start of Kharif-2,
# T. Aman transplanting). Day-of-year 182 in a non-leap year.
AGRI_YEAR_ORIGIN_DOY = 182

FALLOW = "fallow"

POSITIONS = ("rabi", "kharif1", "kharif2")


# ---------------------------------------------------------------------
# DATA CLASSES
# ---------------------------------------------------------------------

@dataclass(frozen=True)
class CalendarWindow:
    """One sourced calendar variant of one crop."""

    crop_id: str
    variant_id: str
    start_earliest: int  # day of year, 1..365
    start_latest: int
    field_days: int
    harvest_earliest: Optional[int] = None
    harvest_latest: Optional[int] = None
    source_id: str = ""


@dataclass
class ScheduledCrop:
    position: str
    crop_id: str
    variant_id: str
    start_doy: int
    end_doy: int
    field_days: int
    slack_days: int  # latest allowed start minus actual start

    def as_dict(self) -> dict:
        return {
            "position": self.position,
            "crop_id": self.crop_id,
            "variant_id": self.variant_id,
            "start": doy_to_mmdd(self.start_doy),
            "end": doy_to_mmdd(self.end_doy),
            "start_doy": self.start_doy,
            "end_doy": self.end_doy,
            "field_days": self.field_days,
            "slack_days": self.slack_days,
        }


@dataclass
class FeasibilityResult:
    status: str
    reasons: list[str] = field(default_factory=list)
    schedule: list[ScheduledCrop] = field(default_factory=list)
    min_gap_days: Optional[int] = None
    total_field_days: Optional[int] = None
    missing_crops: list[str] = field(default_factory=list)

    @property
    def is_feasible(self) -> bool:
        return self.status in ("feasible", "tight")


# ---------------------------------------------------------------------
# DATE HELPERS
# ---------------------------------------------------------------------

def mmdd_to_doy(value: str) -> int:
    """'07-15' -> day of year in a non-leap year (196)."""

    month, day = (int(part) for part in value.strip().split("-"))
    return date(2001, month, day).timetuple().tm_yday


def doy_to_mmdd(doy: int) -> str:
    """Day of year (any integer, wraps every 365 days) -> 'MM-DD'."""

    wrapped = (doy - 1) % YEAR_DAYS
    return (date(2001, 1, 1) + timedelta(days=wrapped)).strftime("%m-%d")


def to_agri_day(doy: int) -> int:
    """Day of year -> days since 1 July (0..364)."""

    return (doy - AGRI_YEAR_ORIGIN_DOY) % YEAR_DAYS


def from_agri_day(agri_day: int) -> int:
    """Days since 1 July (may exceed 364) -> day of year (1..365)."""

    return (agri_day + AGRI_YEAR_ORIGIN_DOY - 1) % YEAR_DAYS + 1


# ---------------------------------------------------------------------
# CALENDAR LOADING
# ---------------------------------------------------------------------

def load_calendar(path: Path | str) -> dict[str, list[CalendarWindow]]:
    """
    Read crop_calendar.csv.

    Rows without a start window or field duration are unsourced: the crop is
    returned with an empty variant list so callers can tell "unknown crop"
    from "crop without a sourced window".
    """

    calendar: dict[str, list[CalendarWindow]] = {}

    with open(path, newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            crop_id = row["crop_id"].strip()
            calendar.setdefault(crop_id, [])

            start_earliest = row.get("field_start_earliest", "").strip()
            start_latest = row.get("field_start_latest", "").strip()
            field_days = row.get("field_days_min", "").strip()

            if not (start_earliest and start_latest and field_days):
                continue

            harvest_earliest = row.get("harvest_earliest", "").strip()
            harvest_latest = row.get("harvest_latest", "").strip()

            calendar[crop_id].append(
                CalendarWindow(
                    crop_id=crop_id,
                    variant_id=row["variant_id"].strip(),
                    start_earliest=mmdd_to_doy(start_earliest),
                    start_latest=mmdd_to_doy(start_latest),
                    field_days=int(field_days),
                    harvest_earliest=(
                        mmdd_to_doy(harvest_earliest) if harvest_earliest else None
                    ),
                    harvest_latest=(
                        mmdd_to_doy(harvest_latest) if harvest_latest else None
                    ),
                    source_id=row.get("source_id", "").strip(),
                )
            )

    return calendar


# ---------------------------------------------------------------------
# SCHEDULING
# ---------------------------------------------------------------------

def _cyclic_order(pattern: Mapping[str, str]) -> list[tuple[str, str]]:
    """
    Non-fallow crops in agricultural-year order.

    The notation starts with Rabi, but the agricultural year used here starts
    on 1 July, so the Kharif-2 crop comes first: kharif2 -> rabi -> kharif1.
    """

    order = ("kharif2", "rabi", "kharif1")

    return [
        (position, pattern[position])
        for position in order
        if pattern.get(position) and pattern[position] != FALLOW
    ]


def _window_agri(window: CalendarWindow) -> tuple[int, int]:
    lo = to_agri_day(window.start_earliest)
    hi = to_agri_day(window.start_latest)

    if hi < lo:  # window crosses 1 July
        hi += YEAR_DAYS

    return lo, hi


def _schedule(
    crops: Sequence[tuple[str, CalendarWindow]],
    turnaround: int,
) -> tuple[Optional[list[tuple[int, int]]], list[str]]:
    """
    Earliest-start schedule for one variant combination.

    Returns ([(start, end)] in agricultural days, []) or (None, reasons).
    """

    windows = [_window_agri(window) for _, window in crops]
    durations = [window.field_days for _, window in crops]

    # Earliest harvest as an offset from the start of the start window.
    harvest_offsets = [
        (
            (to_agri_day(window.harvest_earliest) - to_agri_day(window.start_earliest))
            % YEAR_DAYS
            if window.harvest_earliest is not None
            else None
        )
        for _, window in crops
    ]

    # Each crop's window must come after the previous one in the year:
    # shift by whole years when the window lies before the previous start.
    shifted = []
    previous_lo = None

    for lo, hi in windows:
        if previous_lo is not None and lo < previous_lo:
            lo += YEAR_DAYS
            hi += YEAR_DAYS

        shifted.append((lo, hi))
        previous_lo = lo

    first_start = shifted[0][0]

    for _ in range(len(crops) + 2):
        times: list[tuple[int, int]] = []
        reasons: list[str] = []
        start = first_start

        for index, ((lo, hi), days, harvest_offset) in enumerate(
            zip(shifted, durations, harvest_offsets)
        ):
            if index > 0:
                previous_end = times[-1][1]
                start = max(lo, previous_end + turnaround)

            if start > hi:
                previous_crop = crops[index - 1][0]
                crop = crops[index][0]
                previous_end = times[-1][1]

                reasons.append(
                    f"{crop} must start by {doy_to_mmdd(from_agri_day(hi))}, "
                    f"but {previous_crop} occupies the field until "
                    f"{doy_to_mmdd(from_agri_day(previous_end))}"
                    + (
                        f" (+{turnaround} days turnaround)"
                        if turnaround
                        else ""
                    )
                    + f": {start - hi} days too late."
                )

                return None, reasons

            end = start + days

            if harvest_offset is not None:
                end = max(end, lo + harvest_offset)

            times.append((start, end))

        # Close the cycle: next year's first crop after this year's last.
        last_end = times[-1][1]
        needed_first_start = last_end + turnaround - YEAR_DAYS

        if needed_first_start <= times[0][0]:
            return times, []

        if needed_first_start > shifted[0][1]:
            last_crop = crops[-1][0]
            first_crop = crops[0][0]

            return None, [
                f"{first_crop} must start by "
                f"{doy_to_mmdd(from_agri_day(shifted[0][1]))} next year, "
                f"but {last_crop} occupies the field until "
                f"{doy_to_mmdd(from_agri_day(last_end))}"
                + (f" (+{turnaround} days turnaround)" if turnaround else "")
                + f": {needed_first_start - shifted[0][1]} days too late."
            ]

        first_start = needed_first_start

    return None, ["Schedule did not converge."]


def check_pattern(
    pattern: Mapping[str, str],
    calendar: Mapping[str, Sequence[CalendarWindow]],
    turnaround_days: int = ASSUMED_TURNAROUND_DAYS,
) -> FeasibilityResult:
    """
    Check one pattern, e.g. {"rabi": "rice_boro", "kharif1": "fallow",
    "kharif2": "rice_aman"}.
    """

    crops = _cyclic_order(pattern)

    if not crops:
        return FeasibilityResult(
            status="infeasible",
            reasons=["The pattern contains no crop."],
        )

    unknown = [crop for _, crop in crops if crop not in calendar]

    if unknown:
        return FeasibilityResult(
            status="unverified",
            reasons=[
                f"{crop} is not in the crop calendar." for crop in unknown
            ],
            missing_crops=unknown,
        )

    missing = [crop for _, crop in crops if not calendar[crop]]

    if missing:
        return FeasibilityResult(
            status="unverified",
            reasons=[
                f"No sourced sowing/harvest window for {crop} yet."
                for crop in missing
            ],
            missing_crops=missing,
        )

    best: Optional[FeasibilityResult] = None

    for combination in product(*(calendar[crop] for _, crop in crops)):
        result = _check_combination(crops, combination, turnaround_days)

        if best is None or _rank(result) > _rank(best):
            best = result

    assert best is not None
    return best


def _check_combination(
    crops: Sequence[tuple[str, str]],
    windows: Sequence[CalendarWindow],
    turnaround_days: int,
) -> FeasibilityResult:
    named = [(crop, window) for (_, crop), window in zip(crops, windows)]
    total_days = sum(window.field_days for window in windows)

    if total_days > YEAR_DAYS:
        return FeasibilityResult(
            status="infeasible",
            reasons=[
                f"The crops need {total_days} days in the field, "
                f"more than the {YEAR_DAYS} days in a year."
            ],
            total_field_days=total_days,
        )

    hard_times, hard_reasons = _schedule(named, turnaround=0)

    if hard_times is None:
        return FeasibilityResult(
            status="infeasible",
            reasons=hard_reasons,
            total_field_days=total_days,
        )

    times, soft_reasons = _schedule(named, turnaround=turnaround_days)
    status = "feasible"
    reasons: list[str] = []

    if times is None:
        status = "tight"
        times = hard_times
        reasons = [
            f"Fits only with less than the assumed {turnaround_days} days "
            f"between crops. " + soft_reasons[0]
        ]

    schedule = []

    for (position, crop), window, (start, end) in zip(crops, windows, times):
        _, hi = _window_agri(window)

        schedule.append(
            ScheduledCrop(
                position=position,
                crop_id=crop,
                variant_id=window.variant_id,
                start_doy=from_agri_day(start),
                end_doy=from_agri_day(end),
                field_days=end - start,
                slack_days=(hi - start) % YEAR_DAYS,
            )
        )

    gaps = [
        times[index + 1][0] - times[index][1]
        for index in range(len(times) - 1)
    ]
    gaps.append(times[0][0] + YEAR_DAYS - times[-1][1])

    # Present the schedule in pattern notation order (Rabi first).
    order = {position: index for index, position in enumerate(POSITIONS)}
    schedule.sort(key=lambda item: order[item.position])

    return FeasibilityResult(
        status=status,
        reasons=reasons,
        schedule=schedule,
        min_gap_days=min(gaps),
        total_field_days=total_days,
    )


_STATUS_RANK = {"infeasible": 0, "tight": 1, "feasible": 2}


def _rank(result: FeasibilityResult) -> tuple[int, int]:
    return (
        _STATUS_RANK.get(result.status, -1),
        result.min_gap_days if result.min_gap_days is not None else -YEAR_DAYS,
    )


# ---------------------------------------------------------------------
# PATTERN FILE
# ---------------------------------------------------------------------

def load_patterns(path: Path | str) -> list[dict]:
    with open(path, newline="", encoding="utf-8") as handle:
        return [dict(row) for row in csv.DictReader(handle)]


def pattern_crops(row: Mapping[str, str]) -> dict[str, str]:
    return {
        "rabi": row["rabi_crop"].strip(),
        "kharif1": row["kharif1_crop"].strip(),
        "kharif2": row["kharif2_crop"].strip(),
    }


def check_all(
    patterns: Iterable[Mapping[str, str]],
    calendar: Mapping[str, Sequence[CalendarWindow]],
    turnaround_days: int = ASSUMED_TURNAROUND_DAYS,
) -> dict[str, FeasibilityResult]:
    return {
        row["pattern_id"]: check_pattern(
            pattern_crops(row), calendar, turnaround_days
        )
        for row in patterns
    }


if __name__ == "__main__":
    reference = Path(__file__).resolve().parents[1] / "reference"
    calendar = load_calendar(reference / "crop_calendar.csv")
    patterns = load_patterns(reference / "cropping_patterns.csv")

    for pattern_id, result in check_all(patterns, calendar).items():
        print(f"{pattern_id:<26} {result.status:<11} {'; '.join(result.reasons)}")
