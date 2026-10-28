"""
Tests for rotation.feasibility.

Most tests use a small hand-made TEST calendar (crop names "a", "b", ...)
so they check the rules, not the sourced values. The last group checks the
real reference files for consistency.
"""

import csv
from pathlib import Path

import pytest

from rotation.feasibility import (
    ASSUMED_TURNAROUND_DAYS,
    CalendarWindow,
    check_all,
    check_pattern,
    doy_to_mmdd,
    load_calendar,
    load_patterns,
    mmdd_to_doy,
    pattern_crops,
)


REFERENCE = Path(__file__).resolve().parents[1] / "reference"


def window(crop, start_earliest, start_latest, days, variant="test", harvest=None):
    return CalendarWindow(
        crop_id=crop,
        variant_id=variant,
        start_earliest=mmdd_to_doy(start_earliest),
        start_latest=mmdd_to_doy(start_latest),
        field_days=days,
        harvest_earliest=mmdd_to_doy(harvest) if harvest else None,
    )


def pattern(rabi="fallow", kharif1="fallow", kharif2="fallow"):
    return {"rabi": rabi, "kharif1": kharif1, "kharif2": kharif2}


# ---------------------------------------------------------------------
# Date helpers
# ---------------------------------------------------------------------

def test_mmdd_round_trip():
    assert mmdd_to_doy("01-01") == 1
    assert mmdd_to_doy("12-31") == 365
    assert mmdd_to_doy("07-01") == 182
    assert doy_to_mmdd(mmdd_to_doy("10-08")) == "10-08"
    assert doy_to_mmdd(366) == "01-01"


# ---------------------------------------------------------------------
# Rules
# ---------------------------------------------------------------------

def test_two_crops_with_room_are_feasible():
    calendar = {
        "winter": [window("winter", "12-01", "12-20", 110)],
        "monsoon": [window("monsoon", "07-01", "07-31", 110)],
    }

    result = check_pattern(pattern(rabi="winter", kharif2="monsoon"), calendar)

    assert result.status == "feasible"
    assert result.reasons == []
    assert [item.crop_id for item in result.schedule] == ["winter", "monsoon"]
    assert result.min_gap_days >= ASSUMED_TURNAROUND_DAYS


def test_overlapping_windows_are_rejected_with_reason():
    # monsoon crop is in the field until late November,
    # but the winter crop must be sown by 1 November.
    calendar = {
        "winter": [window("winter", "10-15", "11-01", 100)],
        "monsoon": [window("monsoon", "07-15", "07-31", 120)],
    }

    result = check_pattern(pattern(rabi="winter", kharif2="monsoon"), calendar)

    assert result.status == "infeasible"
    assert result.schedule == []
    assert "winter must start by 11-01" in result.reasons[0]
    assert "monsoon occupies the field until" in result.reasons[0]


def test_sequence_longer_than_a_year_is_rejected():
    calendar = {
        "a": [window("a", "07-01", "07-10", 150)],
        "b": [window("b", "11-01", "12-31", 150)],
        "c": [window("c", "03-01", "05-31", 100)],
    }

    result = check_pattern(pattern(rabi="b", kharif1="c", kharif2="a"), calendar)

    assert result.status == "infeasible"
    assert "400 days" in result.reasons[0]


def test_year_must_close_with_next_years_first_crop():
    # Each step fits, but the last crop ends after the first crop's
    # latest start in the following year.
    # Total field time is only 300 days; the problem is the calendar.
    calendar = {
        "a": [window("a", "07-01", "07-05", 100)],   # in by 07-05
        "b": [window("b", "12-01", "12-31", 100)],   # until >= 03-11
        "c": [window("c", "04-01", "04-30", 100)],   # until >= 07-10
    }

    result = check_pattern(pattern(rabi="b", kharif1="c", kharif2="a"), calendar)

    assert result.status == "infeasible"
    assert "next year" in result.reasons[0]


def test_short_gap_is_tight_not_rejected():
    # 3 days between the crops: allowed with zero turnaround,
    # but less than the assumed turnaround.
    calendar = {
        "monsoon": [window("monsoon", "07-01", "07-01", 120)],  # ends 10-29
        "winter": [window("winter", "10-15", "11-01", 100)],
    }

    result = check_pattern(pattern(rabi="winter", kharif2="monsoon"), calendar)

    assert result.status == "tight"
    assert result.is_feasible
    assert result.min_gap_days == 0
    assert "assumed" in result.reasons[0]


def test_turnaround_zero_makes_tight_feasible():
    calendar = {
        "monsoon": [window("monsoon", "07-01", "07-01", 120)],
        "winter": [window("winter", "10-15", "11-01", 100)],
    }

    result = check_pattern(
        pattern(rabi="winter", kharif2="monsoon"), calendar, turnaround_days=0
    )

    assert result.status == "feasible"


def test_unsourced_crop_is_unverified_not_rejected():
    calendar = {
        "monsoon": [window("monsoon", "07-01", "07-31", 110)],
        "mystery": [],
    }

    result = check_pattern(pattern(rabi="mystery", kharif2="monsoon"), calendar)

    assert result.status == "unverified"
    assert result.missing_crops == ["mystery"]


def test_unknown_crop_is_unverified():
    calendar = {"monsoon": [window("monsoon", "07-01", "07-31", 110)]}

    result = check_pattern(pattern(rabi="nothing", kharif2="monsoon"), calendar)

    assert result.status == "unverified"
    assert "not in the crop calendar" in result.reasons[0]


def test_empty_pattern_is_rejected():
    assert check_pattern(pattern(), {}).status == "infeasible"


def test_best_variant_is_chosen():
    calendar = {
        "monsoon": [window("monsoon", "07-01", "07-15", 120)],  # ends >= 10-29
        "winter": [
            window("winter", "10-01", "10-10", 100, variant="early"),
            window("winter", "11-10", "11-30", 100, variant="late"),
        ],
    }

    result = check_pattern(pattern(rabi="winter", kharif2="monsoon"), calendar)

    assert result.status == "feasible"
    winter = next(item for item in result.schedule if item.crop_id == "winter")
    assert winter.variant_id == "late"


def test_crop_stays_until_its_earliest_harvest():
    # 60 field days would end in early February, but the source says
    # harvest does not start before 1 April, which blocks the next crop.
    calendar = {
        "winter": [window("winter", "12-01", "12-05", 60, harvest="04-01")],
        "spring": [window("spring", "03-01", "03-25", 90)],
    }

    result = check_pattern(pattern(rabi="winter", kharif1="spring"), calendar)

    assert result.status == "infeasible"
    assert "winter occupies the field until 04-01" in result.reasons[0]


def test_second_position_crop_may_start_in_winter():
    # Like Mustard-Boro-T. Aman: the second crop is transplanted in January,
    # i.e. positions are a sequence, not strict seasons.
    calendar = {
        "monsoon": [window("monsoon", "07-01", "07-10", 100)],
        "short": [window("short", "10-15", "11-10", 70)],
        "winter_rice": [window("winter_rice", "12-20", "01-31", 110)],
    }

    result = check_pattern(
        pattern(rabi="short", kharif1="winter_rice", kharif2="monsoon"), calendar
    )

    assert result.is_feasible
    assert [item.position for item in result.schedule] == ["rabi", "kharif1", "kharif2"]


def test_single_crop_pattern_is_feasible():
    calendar = {"monsoon": [window("monsoon", "07-01", "07-31", 120)]}

    result = check_pattern(pattern(kharif2="monsoon"), calendar)

    assert result.status == "feasible"
    assert result.min_gap_days == 365 - 120


# ---------------------------------------------------------------------
# Real reference files
# ---------------------------------------------------------------------

@pytest.fixture(scope="module")
def real_calendar():
    return load_calendar(REFERENCE / "crop_calendar.csv")


@pytest.fixture(scope="module")
def real_patterns():
    return load_patterns(REFERENCE / "cropping_patterns.csv")


def test_every_dated_calendar_row_has_a_source():
    with open(REFERENCE / "crop_calendar.csv", newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            if row["field_start_earliest"]:
                assert row["source_id"], row
                assert row["source_detail"], row
                assert row["field_days_basis"], row


def test_every_pattern_has_a_source_and_known_crops(real_calendar, real_patterns):
    for row in real_patterns:
        assert row["source_id"] and row["source_detail"], row

        for crop in pattern_crops(row).values():
            assert crop == "fallow" or crop in real_calendar, (row["pattern_id"], crop)


def test_default_current_pattern_is_feasible(real_calendar, real_patterns):
    row = next(r for r in real_patterns if r["pattern_id"] == "boro_fallow_taman")

    assert check_pattern(pattern_crops(row), real_calendar).status == "feasible"


def test_every_real_pattern_gets_a_known_status(real_calendar, real_patterns):
    results = check_all(real_patterns, real_calendar)

    assert len(results) == len(real_patterns)
    assert {r.status for r in results.values()} <= {
        "feasible", "tight", "infeasible", "unverified"
    }

    for result in results.values():
        if result.status != "feasible":
            assert result.reasons
