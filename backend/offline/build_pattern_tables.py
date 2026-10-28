"""
FIELD SHIFT — Cropping-pattern tables for the offline database

Adds season-aware cropping patterns to backend/offline/field_shift.db.
Unlike build_offline_database.py, this script needs only files that are in
the repository:

    data-pipeline/reference/crop_calendar.csv
    data-pipeline/reference/cropping_patterns.csv
    data-pipeline/reference/feni_upazila_patterns.csv
    field_shift.db tables crop_profiles, rotation_scenarios,
    evaluated_rotation_scenarios (read only)

Tables written (dropped and recreated):
    crop_calendar
    cropping_patterns
    feni_upazila_patterns

Indicator scores are PROVISIONAL. They reuse the hand-set crop parameters
in crop_profiles (profile_status = scenario_prior, not validated) and the
three historical context constants of the existing scoring. Patterns that
contain a crop without a crop profile get no score.

Run:
    python backend/offline/build_pattern_tables.py
"""

from __future__ import annotations

import csv
import json
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
DB_PATH = ROOT / "backend" / "offline" / "field_shift.db"
REFERENCE = ROOT / "data-pipeline" / "reference"

sys.path.insert(0, str(ROOT / "data-pipeline"))

from rotation.feasibility import (  # noqa: E402
    ASSUMED_TURNAROUND_DAYS,
    POSITIONS,
    check_pattern,
    load_calendar,
    load_patterns,
    pattern_crops,
)


PATTERN_METHODOLOGY = "season_patterns_v1"
CURRENT_PATTERN_ID = "boro_fallow_taman"
SLOTS_PER_YEAR = len(POSITIONS)
INDICATOR_TYPE = "provisional_indicator_from_unvalidated_crop_priors"

RICE_CROPS = {"rice_aman", "rice_aus", "rice_boro"}


# ---------------------------------------------------------------------
# INPUT
# ---------------------------------------------------------------------

def read_csv_rows(path: Path) -> list[dict[str, str]]:
    with open(path, newline="", encoding="utf-8") as handle:
        return [dict(row) for row in csv.DictReader(handle)]


def load_crop_parameters(conn: sqlite3.Connection) -> dict[str, dict]:
    """
    Crop priors from crop_profiles plus each crop's mean environmental
    compatibility (constant per crop in rotation_scenarios).
    """

    conn.row_factory = sqlite3.Row

    profiles = {
        row["crop_id"]: dict(row)
        for row in conn.execute("SELECT * FROM crop_profiles")
    }

    for row in conn.execute(
        """
        SELECT crop_1_id, AVG(crop_1_mean_compatibility) AS compatibility
        FROM rotation_scenarios
        GROUP BY crop_1_id
        """
    ):
        if row["crop_1_id"] in profiles:
            profiles[row["crop_1_id"]]["environmental_compatibility"] = float(
                row["compatibility"]
            )

    return profiles


def load_context(conn: sqlite3.Connection) -> dict[str, float]:
    """
    The existing historical context constants. They are identical for every
    scenario; soil context is the 0.5 fallback (see BASELINE.md).
    """

    row = conn.execute(
        """
        SELECT historical_water_context,
               historical_soil_context,
               historical_climate_context
        FROM evaluated_rotation_scenarios
        LIMIT 1
        """
    ).fetchone()

    return {
        "water_context": float(row[0]),
        "soil_context": float(row[1]),
        "climate_context": float(row[2]),
    }


# ---------------------------------------------------------------------
# PROVISIONAL INDICATORS
# ---------------------------------------------------------------------

def clip(value: float) -> float:
    return max(0.0, min(1.0, value))


def pattern_indicators(
    crop_ids: list[str],
    profiles: dict[str, dict],
    context: dict[str, float],
) -> dict[str, float]:
    """
    Same component formulas as data-pipeline/build_farmer_priority_scenarios.py,
    adapted to annual patterns (three seasons):

    - Water and fertility demand are SUMMED over the crops and divided by the
      three seasons, so adding a crop never makes a pattern look thriftier.
    - Legume share and crop diversity are counted per season (out of three).
    - Climate tolerances are averaged over the crops grown.
    """

    crops = [profiles[crop_id] for crop_id in crop_ids]
    count = len(crops)

    water_load = sum(float(c["water_demand_index"]) for c in crops) / SLOTS_PER_YEAR
    crop_water_efficiency = clip(1.0 - water_load)
    water_scarcity = 1.0 - context["water_context"]

    water = (
        0.70 * crop_water_efficiency
        + 0.30
        * (
            crop_water_efficiency * water_scarcity
            + (1.0 - water_scarcity) * 0.5
        )
    )

    legume = sum(int(c["legume"]) for c in crops) / SLOTS_PER_YEAR
    diversity = len({c["rotation_group"] for c in crops}) / SLOTS_PER_YEAR

    fertility_load = (
        sum(float(c["soil_fertility_dependency"]) for c in crops) / SLOTS_PER_YEAR
    )

    soil = (
        0.40 * context["soil_context"]
        + 0.30 * legume
        + 0.20 * diversity
        + 0.10 * clip(1.0 - fertility_load)
    )

    def mean(key: str) -> float:
        return sum(float(c[key]) for c in crops) / count

    climate = (
        0.20 * mean("drought_tolerance")
        + 0.20 * mean("heat_tolerance")
        + 0.15 * mean("waterlogging_tolerance")
        + 0.25 * mean("environmental_compatibility")
        + 0.20 * context["climate_context"]
    )

    return {
        "water_conservation_score": round(clip(water), 6),
        "soil_health_score": round(clip(soil), 6),
        "climate_resilience_score": round(clip(climate), 6),
        "crop_diversity_score": round(clip(diversity), 6),
    }


# ---------------------------------------------------------------------
# TABLES
# ---------------------------------------------------------------------

def write_table(
    conn: sqlite3.Connection,
    table: str,
    columns: dict[str, str],
    rows: list[dict],
) -> None:
    conn.execute(f'DROP TABLE IF EXISTS "{table}"')

    column_sql = ", ".join(f'"{name}" {sql_type}' for name, sql_type in columns.items())
    conn.execute(f'CREATE TABLE "{table}" ({column_sql})')

    names = list(columns)
    placeholders = ", ".join("?" for _ in names)
    quoted = ", ".join(f'"{name}"' for name in names)

    conn.executemany(
        f'INSERT INTO "{table}" ({quoted}) VALUES ({placeholders})',
        [
            [None if row.get(name) in ("", None) else row.get(name) for name in names]
            for row in rows
        ],
    )


def build_calendar_table(conn: sqlite3.Connection) -> None:
    rows = read_csv_rows(REFERENCE / "crop_calendar.csv")
    numeric = {"life_days_min", "life_days_max", "nursery_days", "field_days_min"}

    columns = {
        name: ("INTEGER" if name in numeric else "TEXT")
        for name in rows[0].keys()
    }

    write_table(conn, "crop_calendar", columns, rows)


def build_upazila_table(conn: sqlite3.Connection) -> None:
    rows = read_csv_rows(REFERENCE / "feni_upazila_patterns.csv")

    write_table(
        conn,
        "feni_upazila_patterns",
        {
            "pattern_id": "TEXT",
            "upazila": "TEXT",
            "area_ha": "REAL",
            "pct_of_upazila_nca": "REAL",
            "source_id": "TEXT",
            "source_detail": "TEXT",
        },
        rows,
    )


def build_pattern_table(conn: sqlite3.Connection) -> list[dict]:
    calendar = load_calendar(REFERENCE / "crop_calendar.csv")
    patterns = load_patterns(REFERENCE / "cropping_patterns.csv")
    profiles = load_crop_parameters(conn)
    context = load_context(conn)

    rows = []

    for pattern in patterns:
        slots = pattern_crops(pattern)
        crop_ids = [crop for crop in slots.values() if crop != "fallow"]
        result = check_pattern(slots, calendar)

        observed = bool(pattern.get("region_area_ha") or pattern.get("national_area_ha"))
        missing_profiles = [crop for crop in crop_ids if crop not in profiles]

        indicators = (
            pattern_indicators(crop_ids, profiles, context)
            if crop_ids and not missing_profiles
            else {}
        )

        rows.append(
            {
                **pattern,
                "crop_count": len(crop_ids),
                "rice_crop_count": sum(crop in RICE_CROPS for crop in crop_ids),
                "legume_crop_count": sum(
                    int(profiles.get(crop, {}).get("legume") or 0) for crop in crop_ids
                ),
                "is_current_default": int(pattern["pattern_id"] == CURRENT_PATTERN_ID),
                "feasibility_status": result.status,
                "feasibility_reasons": json.dumps(result.reasons),
                # Grown by farmers (per the source) but rejected by the calendar
                # check: the calendar data is incomplete, not the farmers wrong.
                "calendar_conflict": int(observed and result.status == "infeasible"),
                "schedule_json": json.dumps([item.as_dict() for item in result.schedule]),
                "min_gap_days": result.min_gap_days,
                "total_field_days": result.total_field_days,
                "turnaround_days_assumed": ASSUMED_TURNAROUND_DAYS,
                "indicators_available": int(bool(indicators)),
                "missing_profile_crops": json.dumps(missing_profiles),
                "indicator_type": INDICATOR_TYPE if indicators else None,
                **indicators,
            }
        )

    text_columns = list(patterns[0].keys())
    real_columns = {"region_area_ha", "region_pct_nca", "national_area_ha", "national_pct_nca"}
    integer_columns = {"region_upazila_count", "national_upazila_count"}

    columns = {
        name: (
            "REAL" if name in real_columns
            else "INTEGER" if name in integer_columns
            else "TEXT"
        )
        for name in text_columns
    }

    columns.update(
        {
            "crop_count": "INTEGER",
            "rice_crop_count": "INTEGER",
            "legume_crop_count": "INTEGER",
            "is_current_default": "INTEGER",
            "feasibility_status": "TEXT",
            "feasibility_reasons": "TEXT",
            "calendar_conflict": "INTEGER",
            "schedule_json": "TEXT",
            "min_gap_days": "INTEGER",
            "total_field_days": "INTEGER",
            "turnaround_days_assumed": "INTEGER",
            "indicators_available": "INTEGER",
            "missing_profile_crops": "TEXT",
            "indicator_type": "TEXT",
            "water_conservation_score": "REAL",
            "soil_health_score": "REAL",
            "climate_resilience_score": "REAL",
            "crop_diversity_score": "REAL",
        }
    )

    write_table(conn, "cropping_patterns", columns, rows)

    return rows


def update_metadata(conn: sqlite3.Connection) -> None:
    values = {
        "pattern_methodology": PATTERN_METHODOLOGY,
        "patterns_built_at_utc": datetime.now(timezone.utc).isoformat(),
        "current_pattern_default": CURRENT_PATTERN_ID,
        "turnaround_days_assumed": str(ASSUMED_TURNAROUND_DAYS),
        "pattern_indicator_type": INDICATOR_TYPE,
    }

    conn.executemany(
        "INSERT OR REPLACE INTO database_metadata (key, value) VALUES (?, ?)",
        list(values.items()),
    )


def main() -> None:
    if not DB_PATH.exists():
        raise SystemExit(f"Database not found: {DB_PATH}")

    conn = sqlite3.connect(DB_PATH)

    try:
        with conn:
            build_calendar_table(conn)
            build_upazila_table(conn)
            rows = build_pattern_table(conn)
            update_metadata(conn)
    finally:
        conn.close()

    print(f"[OK] {DB_PATH}")
    print(f"[OK] {len(rows)} cropping patterns")

    statuses: dict[str, int] = {}
    for row in rows:
        statuses[row["feasibility_status"]] = statuses.get(row["feasibility_status"], 0) + 1

    for status, count in sorted(statuses.items()):
        print(f"     {status:<11} {count}")

    print(f"[OK] {sum(r['calendar_conflict'] for r in rows)} calendar conflicts")
    print(f"[OK] {sum(r['indicators_available'] for r in rows)} patterns with provisional indicators")


if __name__ == "__main__":
    main()
