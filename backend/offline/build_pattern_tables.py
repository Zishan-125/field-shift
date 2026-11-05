"""
FIELD SHIFT — Cropping-pattern tables for the offline database

Adds season-aware cropping patterns to backend/offline/field_shift.db.
Unlike build_offline_database.py, this script needs only files that are in
the repository:

    data-pipeline/reference/crop_calendar.csv
    data-pipeline/reference/cropping_patterns.csv
    data-pipeline/reference/feni_upazila_patterns.csv
    data-pipeline/reference/crop_yields.csv            (BBS Yearbook 2025, Feni)
    data-pipeline/reference/food_energy.csv            (FCT Bangladesh 2013, USDA)
    data-pipeline/reference/fao56_crop_coefficients.csv
    data-pipeline/derived/feni_monthly_climate.csv     (FAO-56 ET0, GPM rain)
    field_shift.db tables crop_profiles, rotation_scenarios,
    evaluated_rotation_scenarios (read only)

Tables written (dropped and recreated):
    crop_calendar
    cropping_patterns
    feni_upazila_patterns

Indicators (method: data-pipeline/scoring/methodology.md):
    food_production_score     sourced: BBS yields x food energy
    water_productivity_score  sourced: food energy per m3 of crop water need
                              (FAO-56 Kc x ET0, FAO paddy terms)
    soil_health_score         PROVISIONAL: hand-set crop priors + rules
    climate_resilience_score  PROVISIONAL: hand-set crop priors
    crop_diversity_score      crop groups per season

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
CLIMATE = ROOT / "data-pipeline" / "derived" / "feni_monthly_climate.csv"

sys.path.insert(0, str(ROOT / "data-pipeline"))

from rotation.feasibility import (  # noqa: E402
    ASSUMED_TURNAROUND_DAYS,
    POSITIONS,
    check_pattern,
    load_calendar,
    load_patterns,
    pattern_crops,
)
from water.crop_water import (  # noqa: E402
    load_kc_curves,
    load_monthly_climate,
    season_water,
)


PATTERN_METHODOLOGY = "season_patterns_v2"
CURRENT_PATTERN_ID = "boro_fallow_taman"
SLOTS_PER_YEAR = len(POSITIONS)
INDICATOR_TYPE = "mixed: production and water sourced; soil and climate provisional"

RICE_CROPS = {"rice_aman", "rice_aus", "rice_boro"}
RICE_ENERGY_MJ_PER_KG = 14.54  # FCT_BD_2013 01_0012, for rice-equivalent tonnes

# Thresholds for the two evidence flags (judgement, documented in methodology.md).
YIELD_EVIDENCE_MIN_HA = 100   # BBS Feni yield from less than this area is weak evidence
MARKET_REALITY_MIN_HA = 500   # less than this in Feni: seed, market and advice may be scarce


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


def load_food_per_ha() -> dict[str, dict]:
    """
    Output per hectare per crop season, as two separate figures:

    gross_gj_ha       BBS yield (t/ha) x edible portion x energy (MJ/kg):
                      all uses (food, feed, oil cake, seed ...)
    human_food_gj_ha  gross x the share that reaches people as food in
                      Bangladesh (FAO food balance sheets)

    Every crop also carries its end-use class and its BBS area in Feni.
    Crops whose BBS production basis does not match the energy value
    (groundnut, chili) get no energy; crops with an unknown end use
    (mungbean) get gross energy but no human-food energy.
    """

    yields = {row["crop_id"]: row for row in read_csv_rows(REFERENCE / "crop_yields.csv")}
    energy = {row["crop_id"]: row for row in read_csv_rows(REFERENCE / "food_energy.csv")}

    food = {}

    for crop_id in set(yields) | set(energy):
        y = yields.get(crop_id, {})
        e = energy.get(crop_id, {})

        entry = {
            "end_use_class": e.get("end_use_class") or None,
            "human_food_share": float(e["human_food_share"]) if e.get("human_food_share") else None,
            "feni_area_ha": float(y["area_ha_2024_25"]) if y.get("area_ha_2024_25") else None,
        }

        if y.get("yield_t_ha_used"):
            entry["yield_t_ha"] = float(y["yield_t_ha_used"])
            entry["yield_year"] = y["year_used"]

        if "yield_t_ha" in entry and e.get("matches_bbs_production_basis") == "yes":
            gross = (
                entry["yield_t_ha"]
                * float(e["edible_portion_coefficient"])
                * float(e["energy_mj_per_kg_edible"])
            )
            entry["gross_gj_ha"] = round(gross, 3)

            if entry["human_food_share"] is not None:
                entry["human_food_gj_ha"] = round(gross * entry["human_food_share"], 3)

        food[crop_id] = entry

    return food


def evidence_flags(pattern: dict, crop_ids: list[str], food: dict[str, dict]) -> dict:
    """
    Two separate warnings, both shown to the farmer:

    yield_evidence   a yield comes from a very small area in Feni
    market_reality   a crop is little grown in Feni, or the pattern is not in
                     the regional survey: seed, market and advice may be
                     hard to find
    """

    yield_flags = []
    market_flags = []

    for crop_id in crop_ids:
        area = food.get(crop_id, {}).get("feni_area_ha")

        if area is not None and area < YIELD_EVIDENCE_MIN_HA:
            yield_flags.append(
                {"code": "small_area_yield", "crop_id": crop_id, "feni_area_ha": area}
            )

        if area is not None and area < MARKET_REALITY_MIN_HA:
            market_flags.append(
                {"code": "little_grown_in_feni", "crop_id": crop_id, "feni_area_ha": area}
            )

    if not pattern.get("region_area_ha"):
        market_flags.append({"code": "not_in_regional_survey", "crop_id": None})

    return {"yield_evidence": yield_flags, "market_reality": market_flags}


# ---------------------------------------------------------------------
# INDICATORS
# ---------------------------------------------------------------------

def clip(value: float) -> float:
    return max(0.0, min(1.0, value))


def pattern_production_and_water(
    crop_ids: list[str],
    schedule: list[dict],
    food: dict[str, dict],
    curves: dict,
    et0: dict[int, float],
    rain: dict[int, float],
) -> tuple[dict, list[dict]]:
    """
    Food output and water requirement of one pattern for one year.
    A fallow season adds neither water nor food.
    """

    crops = []
    by_crop = {item["crop_id"]: item for item in schedule}

    for crop_id in crop_ids:
        entry = {"crop_id": crop_id, **food.get(crop_id, {})}
        scheduled = by_crop.get(crop_id)

        if scheduled and crop_id in curves:
            water = season_water(
                crop_id,
                scheduled["start_doy"],
                scheduled["field_days"],
                curves[crop_id],
                et0,
                rain,
            )
            entry.update(
                {
                    "crop_et_mm": water.crop_et_mm,
                    "paddy_extra_mm": water.paddy_extra_mm,
                    "water_need_mm": round(water.water_need_mm, 1),
                    "effective_rain_mm": water.effective_rain_mm,
                    "irrigation_mm": water.irrigation_mm,
                }
            )

        crops.append(entry)

    totals: dict = {}

    if all("gross_gj_ha" in c for c in crops):
        gross = sum(c["gross_gj_ha"] for c in crops)
        totals["gross_energy_gj_ha"] = round(gross, 3)
        totals["gross_rice_equivalent_t_ha"] = round(gross / RICE_ENERGY_MJ_PER_KG, 3)

    if all("human_food_gj_ha" in c for c in crops):
        human = sum(c["human_food_gj_ha"] for c in crops)
        totals["human_food_energy_gj_ha"] = round(human, 3)
        totals["rice_equivalent_t_ha"] = round(human / RICE_ENERGY_MJ_PER_KG, 3)

    if all("water_need_mm" in c for c in crops):
        totals["water_need_mm"] = round(sum(c["water_need_mm"] for c in crops), 1)
        totals["irrigation_mm"] = round(sum(c["irrigation_mm"] for c in crops), 1)
        totals["effective_rain_mm"] = round(sum(c["effective_rain_mm"] for c in crops), 1)

    if "human_food_energy_gj_ha" in totals and totals.get("water_need_mm"):
        # Human food energy per m3: GJ/ha -> MJ ; mm -> m3/ha (x10)
        totals["water_productivity_mj_m3"] = round(
            totals["human_food_energy_gj_ha"] * 1000 / (totals["water_need_mm"] * 10), 4
        )

    return totals, crops


def provisional_indicators(
    crop_ids: list[str],
    profiles: dict[str, dict],
    context: dict[str, float],
) -> dict[str, float]:
    """
    Soil, climate and diversity — still built on hand-set crop priors.

    Soil: a fallow season adds no nutrient load (rest). A legume season adds
    no nutrient load either, because legumes fix most of their own nitrogen
    (Herridge, Peoples & Boddey 2008), and it adds the legume credit — so a
    legume always scores above a bare fallow of the same season.
    """

    crops = [profiles[crop_id] for crop_id in crop_ids]
    count = len(crops)

    legume = sum(int(c["legume"]) for c in crops) / SLOTS_PER_YEAR
    diversity = len({c["rotation_group"] for c in crops}) / SLOTS_PER_YEAR

    fertility_load = (
        sum(float(c["soil_fertility_dependency"]) for c in crops if not int(c["legume"]))
        / SLOTS_PER_YEAR
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
    food = load_food_per_ha()
    curves = load_kc_curves(REFERENCE / "fao56_crop_coefficients.csv")
    et0, rain = load_monthly_climate(CLIMATE)

    rows = []

    for pattern in patterns:
        slots = pattern_crops(pattern)
        crop_ids = [crop for crop in slots.values() if crop != "fallow"]
        result = check_pattern(slots, calendar)
        schedule = [item.as_dict() for item in result.schedule]

        observed = bool(pattern.get("region_area_ha") or pattern.get("national_area_ha"))
        missing_profiles = [crop for crop in crop_ids if crop not in profiles]

        totals, crop_details = pattern_production_and_water(
            crop_ids, schedule, food, curves, et0, rain
        )

        provisional = (
            provisional_indicators(crop_ids, profiles, context)
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
                "schedule_json": json.dumps(schedule),
                "min_gap_days": result.min_gap_days,
                "total_field_days": result.total_field_days,
                "turnaround_days_assumed": ASSUMED_TURNAROUND_DAYS,
                "missing_profile_crops": json.dumps(missing_profiles),
                "crop_water_food_json": json.dumps(crop_details),
                "evidence_flags_json": json.dumps(evidence_flags(pattern, crop_ids, food)),
                "unknown_end_use_crops": json.dumps(
                    [crop for crop in crop_ids if food.get(crop, {}).get("human_food_share") is None]
                ),
                **totals,
                **provisional,
            }
        )

    # Normalised production and water-productivity scores, over the patterns
    # that have every indicator (the ones that can be ranked). Both rest on
    # HUMAN food energy; gross output is reported but never scored.
    scorable = [
        row for row in rows
        if row.get("human_food_energy_gj_ha") is not None
        and row.get("water_productivity_mj_m3") is not None
        and row.get("soil_health_score") is not None
    ]

    max_food = max(row["human_food_energy_gj_ha"] for row in scorable)
    max_wp = max(row["water_productivity_mj_m3"] for row in scorable)

    for row in rows:
        complete = row in scorable
        row["indicators_available"] = int(complete)
        row["indicator_type"] = INDICATOR_TYPE if complete else None

        if complete:
            row["food_production_score"] = round(row["human_food_energy_gj_ha"] / max_food, 6)
            row["water_productivity_score"] = round(row["water_productivity_mj_m3"] / max_wp, 6)

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
            "missing_profile_crops": "TEXT",
            "crop_water_food_json": "TEXT",
            "evidence_flags_json": "TEXT",
            "unknown_end_use_crops": "TEXT",
            "human_food_energy_gj_ha": "REAL",
            "gross_energy_gj_ha": "REAL",
            "gross_rice_equivalent_t_ha": "REAL",
            "rice_equivalent_t_ha": "REAL",
            "water_need_mm": "REAL",
            "irrigation_mm": "REAL",
            "effective_rain_mm": "REAL",
            "water_productivity_mj_m3": "REAL",
            "indicators_available": "INTEGER",
            "indicator_type": "TEXT",
            "food_production_score": "REAL",
            "water_productivity_score": "REAL",
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
        "yield_source": "BBS Yearbook of Agricultural Statistics 2025, Feni district, 2024-25",
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

    statuses: dict = {}
    for row in rows:
        statuses[row["feasibility_status"]] = statuses.get(row["feasibility_status"], 0) + 1

    for status, count in sorted(statuses.items()):
        print(f"     {status:<11} {count}")

    print(f"[OK] {sum(r['calendar_conflict'] for r in rows)} calendar conflicts")
    print(f"[OK] {sum(r['indicators_available'] for r in rows)} patterns with all indicators")


if __name__ == "__main__":
    main()
