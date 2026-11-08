""""
FIELD SHIFT — Offline FastAPI Runtime

Runtime characteristics:
    - SQLite only
    - No NASA API
    - No Google Earth Engine
    - No internet dependency
    - No external ML service
    - Explainable farmer-priority evaluation
"""

import json
from pathlib import Path
import sqlite3
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------
# CONFIGURATION
# ---------------------------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "field_shift.db"

FIELD_ID = "426e9d97-78cf-45d2-82ae-8131040b5ee7"

METHODOLOGY_VERSION = "farmer_priority_v2"


# ---------------------------------------------------------------------
# FASTAPI APP
# ---------------------------------------------------------------------

app = FastAPI(
    title="Field Shift Offline Runtime",
    description=(
        "Offline decision-support API for crop rotation scenarios "
        "using locally stored NASA-derived environmental data, "
        "SoilGrids soil information, crop profiles, and farmer priorities."
    ),
    version="1.0.0",
)


# ---------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------

# Allow local Vite frontend and production Vercel frontend to communicate
# with this FastAPI backend.

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://field-shift-five.vercel.app",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------
# DATABASE HELPERS
# ---------------------------------------------------------------------

def get_connection() -> sqlite3.Connection:
    """
    Open a read/write SQLite connection to the offline database.
    """

    if not DB_PATH.exists():
        raise RuntimeError(
            f"Offline database not found: {DB_PATH}"
        )

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    return conn


def fetch_one(query: str, params=()):
    """
    Execute a query and return one row as a dictionary.
    """

    conn = get_connection()

    try:
        row = conn.execute(query, params).fetchone()

        if row is None:
            return None

        return dict(row)

    finally:
        conn.close()


def fetch_all(query: str, params=()):
    """
    Execute a query and return all rows as dictionaries.
    """

    conn = get_connection()

    try:
        rows = conn.execute(query, params).fetchall()

        return [dict(row) for row in rows]

    finally:
        conn.close()


def table_exists(table_name: str) -> bool:
    """
    Check whether a SQLite table exists.
    """

    row = fetch_one(
        """
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
          AND name = ?
        """,
        (table_name,),
    )

    return row is not None


def field_exists(field_id: str) -> bool:
    """
    Check whether a field exists in the offline database.

    IMPORTANT:
        The fields table uses `field_id`, not `id`.
    """

    row = fetch_one(
        """
        SELECT field_id
        FROM fields
        WHERE field_id = ?
        """,
        (field_id,),
    )

    return row is not None


def require_field(field_id: str):
    """
    Fetch a field or raise a clean 404 response.
    """

    field = fetch_one(
        """
        SELECT *
        FROM fields
        WHERE field_id = ?
        """,
        (field_id,),
    )

    if field is None:
        raise HTTPException(
            status_code=404,
            detail=f"Field not found: {field_id}",
        )

    return field


# ---------------------------------------------------------------------
# REQUEST MODELS
# ---------------------------------------------------------------------

class FarmerPriorityRequest(BaseModel):
    """
    Farmer preference weights.

    Values may be supplied in any non-negative combination.
    They are normalized internally so their total becomes 1.0.
    """

    water_conservation: float = Field(
        default=0.40,
        ge=0.0,
        le=1.0,
    )

    soil_health: float = Field(
        default=0.30,
        ge=0.0,
        le=1.0,
    )

    climate_resilience: float = Field(
        default=0.20,
        ge=0.0,
        le=1.0,
    )

    crop_diversity: float = Field(
        default=0.10,
        ge=0.0,
        le=1.0,
    )


# ---------------------------------------------------------------------
# PRIORITY HELPERS
# ---------------------------------------------------------------------

def normalize_priorities(request: FarmerPriorityRequest):
    """
    Normalize farmer priority weights so their total equals 1.0.
    """

    raw = {
        "water_conservation": request.water_conservation,
        "soil_health": request.soil_health,
        "climate_resilience": request.climate_resilience,
        "crop_diversity": request.crop_diversity,
    }

    total = sum(raw.values())

    if total <= 0:
        raise HTTPException(
            status_code=400,
            detail=(
                "At least one farmer priority must be "
                "greater than zero."
            ),
        )

    return {
        key: value / total
        for key, value in raw.items()
    }


def calculate_priority_score(row, weights):
    """
    Recalculate the scenario score locally according to
    the farmer's requested priorities.

    This is a weighted scenario indicator.

    It is NOT:
        - crop yield prediction
        - profit prediction
        - irrigation requirement prediction
        - causal agronomic outcome
    """

    water = float(
        row.get("water_conservation_score") or 0.0
    )

    soil = float(
        row.get("soil_health_score") or 0.0
    )

    climate = float(
        row.get("climate_resilience_score") or 0.0
    )

    diversity = float(
        row.get("crop_diversity_score") or 0.0
    )

    contributions = {
        "water_conservation": (
            water * weights["water_conservation"]
        ),

        "soil_health": (
            soil * weights["soil_health"]
        ),

        "climate_resilience": (
            climate * weights["climate_resilience"]
        ),

        "crop_diversity": (
            diversity * weights["crop_diversity"]
        ),
    }

    score = sum(contributions.values())

    return score, contributions


# ---------------------------------------------------------------------
# ROOT
# ---------------------------------------------------------------------

@app.get("/")
def root():
    return {
        "service": "Field Shift Offline Runtime",
        "status": "online",
        "runtime": "offline",
        "database": str(DB_PATH),

        "internet_required": False,
        "nasa_api_required": False,
        "google_earth_engine_required": False,
        "external_ml_service_required": False,

        "methodology_version": METHODOLOGY_VERSION,
    }


# ---------------------------------------------------------------------
# HEALTH
# ---------------------------------------------------------------------

@app.get("/api/offline/health")
def health():
    try:
        db_exists = DB_PATH.exists()

        if not db_exists:
            return {
                "status": "degraded",
                "database": "missing",
                "database_path": str(DB_PATH),
                "internet_required": False,
            }

        metadata = fetch_all(
            """
            SELECT key, value
            FROM database_metadata
            ORDER BY key
            """
        )

        return {
            "status": "healthy",
            "database": "available",
            "database_path": str(DB_PATH),

            "internet_required": False,
            "nasa_api_required": False,
            "google_earth_engine_required": False,
            "external_ml_service_required": False,

            "methodology_version": METHODOLOGY_VERSION,

            "metadata": metadata,
        }

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                f"Offline runtime health check failed: {exc}"
            ),
        )


# ---------------------------------------------------------------------
# FIELD
# ---------------------------------------------------------------------

@app.get("/api/offline/fields/{field_id}")
def get_field(field_id: str):
    """
    Return field metadata and geometry.
    """

    field = require_field(field_id)

    return {
        "field": field,
        "runtime": "offline",
        "internet_required": False,
    }


# ---------------------------------------------------------------------
# ENVIRONMENT
# ---------------------------------------------------------------------

@app.get("/api/offline/fields/{field_id}/environment")
def get_environment(
    field_id: str,
    limit: int = Query(
        default=69,
        ge=1,
        le=1000,
    ),
):
    """
    Return monthly environmental features for a field.
    """

    require_field(field_id)

    rows = fetch_all(
        """
        SELECT *
        FROM monthly_environmental_features
        WHERE field_id = ?
        ORDER BY observation_month
        LIMIT ?
        """,
        (field_id, limit),
    )

    return {
        "field_id": field_id,

        "count": len(rows),

        "period": {
            "start": (
                rows[0]["observation_month"]
                if rows
                else None
            ),

            "end": (
                rows[-1]["observation_month"]
                if rows
                else None
            ),
        },

        "data": rows,

        "runtime": "offline",

        "internet_required": False,
    }


# ---------------------------------------------------------------------
# SOIL
# ---------------------------------------------------------------------

@app.get("/api/offline/fields/{field_id}/soil")
def get_soil(field_id: str):
    """
    Return the field-level SoilGrids profile.
    """

    require_field(field_id)

    soil = fetch_one(
        """
        SELECT *
        FROM field_soil_profiles
        WHERE field_id = ?
        """,
        (field_id,),
    )

    if soil is None:
        raise HTTPException(
            status_code=404,
            detail="Soil profile not found.",
        )

    return {
        "field_id": field_id,

        "soil_profile": soil,

        "runtime": "offline",

        "soil_values_are_modelled_predictions": True,

        "internet_required": False,
    }


# ---------------------------------------------------------------------
# CROPS
# ---------------------------------------------------------------------

@app.get("/api/offline/crops")
def get_crops():
    """
    Return all validated crop profiles.
    """

    crops = fetch_all(
        """
        SELECT *
        FROM crop_profiles
        ORDER BY crop_name
        """
    )

    return {
        "count": len(crops),

        "crops": crops,

        "runtime": "offline",

        "internet_required": False,
    }


# ---------------------------------------------------------------------
# ROTATIONS
# ---------------------------------------------------------------------

@app.get(
    "/api/offline/fields/{field_id}/rotations",
    deprecated=True,  # crop permutations without a season check; use /patterns
)
def get_rotations(
    field_id: str,
    limit: int = Query(
        default=272,
        ge=1,
        le=1000,
    ),
):
    """
    Return generated crop rotation scenarios.
    """

    require_field(field_id)

    rows = fetch_all(
        """
        SELECT *
        FROM rotation_scenarios
        ORDER BY rotation_id
        LIMIT ?
        """,
        (limit,),
    )

    return {
        "field_id": field_id,

        "count": len(rows),

        "rotations": rows,

        "runtime": "offline",

        "internet_required": False,

        "methodology_version": METHODOLOGY_VERSION,

        "score_type": (
            "scenario_indicator_not_yield_prediction"
        ),
    }


# ---------------------------------------------------------------------
# EVALUATED ROTATIONS
# ---------------------------------------------------------------------

@app.get(
    "/api/offline/fields/{field_id}/rotations/evaluated",
    deprecated=True,
)
def get_evaluated_rotations(
    field_id: str,
    limit: int = Query(
        default=272,
        ge=1,
        le=1000,
    ),
):
    """
    Return farmer-priority evaluated rotation scenarios
    stored in SQLite.
    """

    require_field(field_id)

    rows = fetch_all(
        """
        SELECT *
        FROM evaluated_rotation_scenarios
        ORDER BY farmer_priority_score DESC
        LIMIT ?
        """,
        (limit,),
    )

    return {
        "field_id": field_id,

        "count": len(rows),

        "methodology_version": METHODOLOGY_VERSION,

        "score_type": (
            "scenario_indicator_not_yield_prediction"
        ),

        "scenarios": rows,

        "runtime": "offline",

        "internet_required": False,
    }


# ---------------------------------------------------------------------
# INTERACTIVE FARMER PRIORITY RE-EVALUATION
# ---------------------------------------------------------------------

@app.post(
    "/api/offline/fields/{field_id}/recommendations",
    deprecated=True,  # use /pattern-recommendations
)
def recommendations(
    field_id: str,
    request: FarmerPriorityRequest,
):
    """
    Recalculate all rotation scenario scores according
    to the farmer's requested priorities.

    The calculation is completely local and uses the
    evaluated scenario component scores stored in SQLite.
    """

    # -------------------------------------------------------------
    # 1. Validate field
    # -------------------------------------------------------------

    field = require_field(field_id)

    # -------------------------------------------------------------
    # 2. Normalize farmer priorities
    # -------------------------------------------------------------

    weights = normalize_priorities(request)

    # -------------------------------------------------------------
    # 3. Load evaluated scenarios
    # -------------------------------------------------------------

    scenarios = fetch_all(
        """
        SELECT *
        FROM evaluated_rotation_scenarios
        """
    )

    if not scenarios:
        raise HTTPException(
            status_code=404,
            detail=(
                "No evaluated rotation scenarios "
                "found for this field."
            ),
        )

    # -------------------------------------------------------------
    # 4. Recalculate scores
    # -------------------------------------------------------------

    evaluated = []

    for row in scenarios:

        score, contributions = calculate_priority_score(
            row,
            weights,
        )

        item = {
            "rotation_id": row["rotation_id"],

            "crop_1_name": row.get("crop_1_name"),

            "crop_2_name": row.get("crop_2_name"),

            "crop_3_name": row.get("crop_3_name"),

            "farmer_priority_score": round(
                score,
                6,
            ),

            "water_conservation_score": row.get(
                "water_conservation_score"
            ),

            "soil_health_score": row.get(
                "soil_health_score"
            ),

            "climate_resilience_score": row.get(
                "climate_resilience_score"
            ),

            "crop_diversity_score": row.get(
                "crop_diversity_score"
            ),

            "priority_contributions": {
                key: round(
                    value,
                    6,
                )
                for key, value in contributions.items()
            },

            "priority_profile": weights,

            "methodology_version": (
                METHODOLOGY_VERSION
            ),

            "score_type": (
                "scenario_indicator_not_yield_prediction"
            ),

            "synthetic_yield_target": False,

            "internet_required": False,
        }

        evaluated.append(item)

    # -------------------------------------------------------------
    # 5. Sort by recalculated score
    # -------------------------------------------------------------

    evaluated.sort(
        key=lambda x: x["farmer_priority_score"],
        reverse=True,
    )

    # -------------------------------------------------------------
    # 6. Return response
    # -------------------------------------------------------------

    return {
        "field": {
            "field_id": field["field_id"],
            "name": field.get("name"),
        },

        "priority_profile": weights,

        "scenario_count": len(evaluated),

        "results": evaluated,

        "runtime": {
            "mode": "offline",

            "internet_required": False,

            "nasa_api_required": False,

            "google_earth_engine_required": False,

            "external_ml_service_required": False,
        },

        "methodology": {
            "version": METHODOLOGY_VERSION,

            "score_type": (
                "scenario_indicator_not_yield_prediction"
            ),

            "synthetic_yield_target": False,
        },
    }


# ---------------------------------------------------------------------
# SEASON-AWARE CROPPING PATTERNS
# ---------------------------------------------------------------------

PATTERN_METHODOLOGY_VERSION = "season_patterns_v2"

DEFAULT_CURRENT_PATTERN_ID = "boro_fallow_taman"

SEASONS = ("rabi", "kharif1", "kharif2")

RECOMMENDABLE_STATUSES = ("feasible", "tight")

INDICATOR_KEYS = (
    "food_production_score",
    "water_productivity_score",
    "soil_health_score",
    "climate_resilience_score",
    "crop_diversity_score",
)

PRIORITY_TO_INDICATOR = {
    "food_production": "food_production_score",
    "water_productivity": "water_productivity_score",
    "soil_health": "soil_health_score",
    "climate_resilience": "climate_resilience_score",
    "crop_diversity": "crop_diversity_score",
}

# Default farmer profile (a UI default, not data). Food production has its
# own visible weight so that growing less food can never look like a win.
DEFAULT_PATTERN_PRIORITIES = {
    "food_production": 0.30,
    "water_productivity": 0.25,
    "soil_health": 0.20,
    "climate_resilience": 0.15,
    "crop_diversity": 0.10,
}


class PatternRecommendationRequest(BaseModel):
    """
    Farmer priorities (any non-negative mix; normalised to sum 1)
    plus the pattern the farmer grows today.
    """

    food_production: float = Field(
        default=DEFAULT_PATTERN_PRIORITIES["food_production"], ge=0.0, le=1.0
    )
    water_productivity: float = Field(
        default=DEFAULT_PATTERN_PRIORITIES["water_productivity"], ge=0.0, le=1.0
    )
    soil_health: float = Field(
        default=DEFAULT_PATTERN_PRIORITIES["soil_health"], ge=0.0, le=1.0
    )
    climate_resilience: float = Field(
        default=DEFAULT_PATTERN_PRIORITIES["climate_resilience"], ge=0.0, le=1.0
    )
    crop_diversity: float = Field(
        default=DEFAULT_PATTERN_PRIORITIES["crop_diversity"], ge=0.0, le=1.0
    )

    current_pattern_id: str = Field(
        default=DEFAULT_CURRENT_PATTERN_ID,
    )


def normalize_pattern_priorities(request: PatternRecommendationRequest) -> dict:
    raw = {key: getattr(request, key) for key in PRIORITY_TO_INDICATOR}
    total = sum(raw.values())

    if total <= 0:
        raise HTTPException(
            status_code=400,
            detail="At least one farmer priority must be greater than zero.",
        )

    return {key: value / total for key, value in raw.items()}


def crop_names() -> dict:
    """
    English and Bangla crop names from the crop calendar.
    """

    rows = fetch_all(
        """
        SELECT crop_id, crop_name_en, crop_name_bn
        FROM crop_calendar
        """
    )

    names = {"fallow": {"en": "Fallow", "bn": "পতিত"}}

    for row in rows:
        names.setdefault(
            row["crop_id"],
            {"en": row["crop_name_en"], "bn": row["crop_name_bn"]},
        )

    return names


def crop_label(crop_id: str, names: dict) -> dict:
    name = names.get(crop_id, {"en": crop_id, "bn": crop_id})

    return {
        "crop_id": crop_id,
        "name_en": name["en"],
        "name_bn": name["bn"],
        "is_fallow": crop_id == "fallow",
    }


def load_upazilas() -> dict:
    by_pattern: dict = {}

    for row in fetch_all(
        """
        SELECT *
        FROM feni_upazila_patterns
        ORDER BY area_ha DESC
        """
    ):
        by_pattern.setdefault(row["pattern_id"], []).append(
            {
                "upazila": row["upazila"],
                "area_ha": row["area_ha"],
                "pct_of_upazila_nca": row["pct_of_upazila_nca"],
            }
        )

    return by_pattern


def serialize_pattern(row: dict, names: dict, upazilas: dict) -> dict:
    """
    Turn a cropping_patterns row into the API shape.
    """

    schedule = json.loads(row["schedule_json"] or "[]")

    for item in schedule:
        item.update(crop_label(item["crop_id"], names))

    indicators = (
        {key: row[key] for key in INDICATOR_KEYS}
        if row["indicators_available"]
        else None
    )

    return {
        "pattern_id": row["pattern_id"],
        "name": row["pattern_name_source"],
        "seasons": {
            "rabi": crop_label(row["rabi_crop"], names),
            "kharif1": crop_label(row["kharif1_crop"], names),
            "kharif2": crop_label(row["kharif2_crop"], names),
        },
        "schedule": schedule,
        "facts": {
            "crop_count": row["crop_count"],
            "rice_crop_count": row["rice_crop_count"],
            "legume_crop_count": row["legume_crop_count"],
        },
        "feasibility": {
            "status": row["feasibility_status"],
            "reasons": json.loads(row["feasibility_reasons"] or "[]"),
            "calendar_conflict": bool(row["calendar_conflict"]),
            "min_gap_days": row["min_gap_days"],
            "total_field_days": row["total_field_days"],
            "turnaround_days_assumed": row["turnaround_days_assumed"],
            "turnaround_is_assumption": True,
        },
        "adoption": {
            "region": "Chittagong agricultural region (incl. Feni)",
            "region_area_ha": row["region_area_ha"],
            "region_pct_nca": row["region_pct_nca"],
            "region_upazila_count": row["region_upazila_count"],
            "national_area_ha": row["national_area_ha"],
            "national_pct_nca": row["national_pct_nca"],
            "national_upazila_count": row["national_upazila_count"],
            "observed_in_region": row["region_area_ha"] is not None,
            "feni_upazilas": upazilas.get(row["pattern_id"], []),
            "source_id": row["source_id"],
            "source_detail": row["source_detail"],
            "reference_year": "2014-15",
        },
        "notes": row["notes"],
        "production": {
            # Two separate figures, never blended: ranking uses human food.
            "human_food_energy_gj_ha": row["human_food_energy_gj_ha"],
            "rice_equivalent_t_ha": row["rice_equivalent_t_ha"],
            "gross_energy_gj_ha": row["gross_energy_gj_ha"],
            "gross_rice_equivalent_t_ha": row["gross_rice_equivalent_t_ha"],
            "harvests_per_year": row["crop_count"],
            "unknown_end_use_crops": json.loads(row["unknown_end_use_crops"] or "[]"),
            "yield_source": "BBS Yearbook of Agricultural Statistics 2025, Feni, 2024-25",
            "end_use_source": "FAOSTAT Food Balance Sheets, Bangladesh, 2021-23 mean",
        },
        "evidence_flags": json.loads(row["evidence_flags_json"] or "{}"),
        "water": {
            "water_need_mm": row["water_need_mm"],
            "irrigation_mm": row["irrigation_mm"],
            "irrigation_m3_ha": (
                round(row["irrigation_mm"] * 10)
                if row["irrigation_mm"] is not None
                else None
            ),
            "effective_rain_mm": row["effective_rain_mm"],
            "water_productivity_mj_m3": row["water_productivity_mj_m3"],
            "method": "FAO-56 Kc x Penman-Monteith ET0; FAO effective rainfall and paddy terms",
        },
        "per_crop": [
            {**item, **crop_label(item["crop_id"], names)}
            for item in json.loads(row["crop_water_food_json"] or "[]")
        ],
        "indicators": indicators,
        "indicator_type": row["indicator_type"],
        "missing_profile_crops": json.loads(row["missing_profile_crops"] or "[]"),
    }


def compare_with_current(current: dict, candidate: dict) -> dict:
    """
    Both sides of a change: food produced and water needed, against the
    current pattern, and the trade-offs a farmer must accept.
    """

    def delta(section: str, key: str):
        before = current[section][key]
        after = candidate[section][key]

        if before is None or after is None:
            return None

        return {
            "current": before,
            "candidate": after,
            "change": round(after - before, 3),
            "change_pct": round((after - before) / before * 100, 1) if before else None,
        }

    food = delta("production", "human_food_energy_gj_ha")
    water = delta("water", "irrigation_mm")
    harvests = candidate["facts"]["crop_count"] - current["facts"]["crop_count"]
    rice = candidate["facts"]["rice_crop_count"] - current["facts"]["rice_crop_count"]

    trade_offs = []

    if harvests < 0:
        trade_offs.append(
            {
                "code": "fewer_harvests",
                "detail": f"{-harvests} fewer crop season(s) per year than now.",
            }
        )

    if food is not None and food["change"] < 0:
        trade_offs.append(
            {
                "code": "less_food",
                "detail": f"{-food['change_pct']}% less food energy per hectare per year.",
            }
        )

    if water is not None and water["change"] > 0:
        trade_offs.append(
            {
                "code": "more_irrigation",
                "detail": f"{round(water['change'])} mm more irrigation water per year.",
            }
        )

    if rice < 0:
        trade_offs.append(
            {
                "code": "fewer_rice_seasons",
                "detail": f"{-rice} fewer rice season(s) per year than now.",
            }
        )

    if candidate["feasibility"]["status"] == "tight":
        trade_offs.append(
            {
                "code": "tight_timing",
                "detail": "The next crop must go in almost straight after harvest.",
            }
        )

    return {
        "human_food_energy_gj_ha": food,
        "irrigation_mm": water,
        "harvests_change": harvests,
        "rice_seasons_change": rice,
        "trade_offs": trade_offs,
        # Never present a pattern with fewer harvests or less food as a plain
        # improvement, whatever its score.
        "change_kind": "trade_off" if trade_offs else "improvement",
    }


def season_changes(current: dict, candidate: dict) -> list:
    """
    Season-by-season difference between two patterns.
    """

    changes = []

    for season in SEASONS:
        before = current["seasons"][season]
        after = candidate["seasons"][season]

        if before["crop_id"] == after["crop_id"]:
            change = "same"
        elif before["is_fallow"]:
            change = "added"
        elif after["is_fallow"]:
            change = "removed"
        else:
            change = "replaced"

        changes.append(
            {
                "season": season,
                "change": change,
                "from": before,
                "to": after,
            }
        )

    return changes


def load_patterns_or_404() -> list:
    if not table_exists("cropping_patterns"):
        raise HTTPException(
            status_code=503,
            detail=(
                "Cropping patterns are not built. "
                "Run backend/offline/build_pattern_tables.py."
            ),
        )

    return fetch_all(
        """
        SELECT *
        FROM cropping_patterns
        ORDER BY region_area_ha DESC
        """
    )


@app.get("/api/offline/crop-calendar")
def get_crop_calendar():
    """
    Sourced sowing/harvest windows per crop (all variants).
    Empty windows mean no source has been found yet.
    """

    rows = fetch_all(
        """
        SELECT *
        FROM crop_calendar
        ORDER BY crop_id, variant_id
        """
    )

    return {
        "count": len(rows),
        "calendar": rows,
        "dates_are_month_day": True,
        "runtime": "offline",
        "internet_required": False,
    }


@app.get("/api/offline/patterns")
def get_patterns():
    """
    All curated cropping patterns with their feasibility check,
    including rejected ones and the reason.
    """

    names = crop_names()
    upazilas = load_upazilas()

    patterns = [
        serialize_pattern(row, names, upazilas)
        for row in load_patterns_or_404()
    ]

    status_counts: dict = {}

    for pattern in patterns:
        status = pattern["feasibility"]["status"]
        status_counts[status] = status_counts.get(status, 0) + 1

    return {
        "count": len(patterns),
        "status_counts": status_counts,
        "default_current_pattern_id": DEFAULT_CURRENT_PATTERN_ID,
        "patterns": patterns,
        "methodology_version": PATTERN_METHODOLOGY_VERSION,
        "runtime": "offline",
        "internet_required": False,
    }


@app.post("/api/offline/fields/{field_id}/pattern-recommendations")
def pattern_recommendations(
    field_id: str,
    request: PatternRecommendationRequest,
):
    """
    Rank feasible cropping patterns for the farmer's priorities and show
    each one as a change from the farmer's current pattern.
    """

    field = require_field(field_id)
    weights = normalize_pattern_priorities(request)

    names = crop_names()
    upazilas = load_upazilas()

    patterns = {
        row["pattern_id"]: serialize_pattern(row, names, upazilas)
        for row in load_patterns_or_404()
    }

    if request.current_pattern_id not in patterns:
        raise HTTPException(
            status_code=404,
            detail=f"Pattern not found: {request.current_pattern_id}",
        )

    def score(pattern: dict):
        if pattern["indicators"] is None:
            return None, None

        contributions = {
            priority: pattern["indicators"][indicator] * weights[priority]
            for priority, indicator in PRIORITY_TO_INDICATOR.items()
        }

        return round(sum(contributions.values()), 6), {
            key: round(value, 6) for key, value in contributions.items()
        }

    current = patterns[request.current_pattern_id]
    current_score, current_contributions = score(current)
    current = {
        **current,
        "score": current_score,
        "priority_contributions": current_contributions,
    }

    recommended = []
    not_scored = []
    not_recommended = []

    for pattern_id, pattern in patterns.items():
        if pattern_id == request.current_pattern_id:
            continue

        if pattern["feasibility"]["status"] not in RECOMMENDABLE_STATUSES:
            not_recommended.append(pattern)
            continue

        pattern_score, contributions = score(pattern)

        item = {
            **pattern,
            "score": pattern_score,
            "priority_contributions": contributions,
            "season_changes": season_changes(current, pattern),
            "comparison": compare_with_current(current, pattern),
        }

        if pattern_score is None:
            not_scored.append(item)
            continue

        item["score_change"] = (
            round(pattern_score - current_score, 6)
            if current_score is not None
            else None
        )

        item["indicator_changes"] = (
            {
                key: round(
                    pattern["indicators"][key] - current["indicators"][key],
                    6,
                )
                for key in INDICATOR_KEYS
            }
            if current["indicators"] is not None
            else None
        )

        recommended.append(item)

    recommended.sort(key=lambda item: item["score"], reverse=True)

    for rank, item in enumerate(recommended, start=1):
        item["rank"] = rank

    not_scored.sort(
        key=lambda item: item["adoption"]["region_area_ha"] or 0,
        reverse=True,
    )

    return {
        "field": {
            "field_id": field["field_id"],
            "name": field.get("name"),
        },
        "priority_profile": weights,
        "current": current,
        "results": recommended,
        "not_scored": not_scored,
        "not_recommended": not_recommended,
        "counts": {
            "patterns": len(patterns),
            "recommended": len(recommended),
            "not_scored": len(not_scored),
            "not_recommended": len(not_recommended),
        },
        "methodology": {
            "version": PATTERN_METHODOLOGY_VERSION,
            "score_type": "scenario_indicator_not_yield_prediction",
            "indicator_sources": {
                "food_production_score": "sourced: BBS Feni yields 2024-25 x food energy (FCT Bangladesh 2013, USDA) x share eaten by people (FAOSTAT FBS Bangladesh)",
                "water_productivity_score": "sourced: human food energy per m3 of crop water need (FAO-56 Kc x ET0, FAO effective rainfall)",
                "soil_health_score": "provisional: hand-set crop priors",
                "climate_resilience_score": "provisional: hand-set crop priors",
                "crop_diversity_score": "crop groups per season",
            },
            "default_priorities": DEFAULT_PATTERN_PRIORITIES,
            "synthetic_yield_target": False,
            "notes": [
                "Patterns are real annual cropping patterns recorded in the "
                "Chittagong agricultural region (Shahidullah et al. 2017).",
                "Feasibility uses sourced DAE/BRRI/BARI crop calendars; the "
                "turnaround time between crops is an assumption.",
                "Yields are district averages for Feni (BBS), not a forecast "
                "for this field. Cost and income are not included yet.",
                "Soil and climate scores still use hand-set crop parameters "
                "that are not validated.",
            ],
        },
        "runtime": {
            "mode": "offline",
            "internet_required": False,
        },
    }


# ---------------------------------------------------------------------
# CLIMATE SHIFT (NASA POWER 1984-)
# ---------------------------------------------------------------------

DEFAULT_UPAZILA = "Feni Sadar"  # contains the test plot

# How each indicator can threaten crops. Rules, not data: documented in
# docs/methodology/climate-shift.md. "months" = hazard months; a crop is
# exposed when it is in the field in those months ("flowering" = only when its
# flowering window from crop_calendar.csv falls in those months).
CLIMATE_RULES = {
    "tx90p_mar_may": {"adverse": "increasing", "hazard": "heat_mar_may", "months": [3, 4, 5], "exposure": "flowering"},
    "tx90p_boro_flowering": {"adverse": "increasing", "hazard": "heat_boro_flowering", "months": [3], "exposure": "flowering"},
    "tmax_mean_mar_may_bc": {"adverse": "increasing", "hazard": "heat_mar_may", "months": [3, 4, 5], "exposure": "flowering"},
    "extreme_rain_days": {"adverse": "increasing", "hazard": "heavy_rain", "months": [6, 7, 8, 9], "exposure": "in_field"},
    "annual_rain_mm": {"adverse": "increasing", "hazard": "wetter_monsoon", "months": [6, 7, 8, 9], "exposure": "in_field"},
    "kharif_rain_mm": {"adverse": "increasing", "hazard": "wetter_monsoon", "months": [6, 7, 8, 9], "exposure": "in_field"},
    "longest_dry_spell_kharif1": {"adverse": "increasing", "hazard": "kharif1_dry_spell", "months": [3, 4, 5, 6], "exposure": "in_field"},
    "rabi_rain_mm": {"adverse": "decreasing", "hazard": "drier_rabi", "months": [11, 12, 1, 2], "exposure": "irrigation"},
    "annual_et0_mm": {"adverse": "increasing", "hazard": "higher_water_demand", "months": [], "exposure": "irrigation"},
    "rainy_season_onset_doy": {"adverse": "increasing", "hazard": "late_onset", "months": [5, 6, 7], "exposure": "in_field"},
    "rainy_season_withdrawal_doy": {"adverse": "decreasing", "hazard": "early_withdrawal", "months": [9, 10], "exposure": "in_field"},
}


def months_in_field(item: dict) -> set:
    from datetime import date, timedelta

    start = date(2001, 1, 1) + timedelta(days=item["start_doy"] - 1)
    return {(start + timedelta(days=offset)).month for offset in range(item["field_days"])}


def flowering_months() -> dict:
    months = {}

    for row in fetch_all(
        "SELECT crop_id, flowering_start, flowering_end FROM crop_calendar WHERE flowering_start IS NOT NULL"
    ):
        start_month = int(row["flowering_start"].split("-")[0])
        end_month = int(row["flowering_end"].split("-")[0])
        months.setdefault(row["crop_id"], set()).update(range(start_month, end_month + 1))

    return months


def exposed_crops(pattern: dict, rule: dict, flowering: dict) -> list:
    exposed = []

    for item in pattern["schedule"]:
        if rule["exposure"] == "flowering":
            hit = bool(flowering.get(item["crop_id"], set()) & set(rule["months"]))
        else:
            hit = bool(months_in_field(item) & set(rule["months"]))

        if hit:
            exposed.append({"crop_id": item["crop_id"], "name_en": item["name_en"], "name_bn": item["name_bn"]})

    return exposed


def climate_advice(trends: list, recommendations: dict) -> list:
    """
    Turn each indicator with a real trend into advice: which crop of the
    current pattern it threatens and which recommended pattern lowers that
    exposure. Only status == "trend" is used, and not indicators flagged as
    possibly a satellite-input artefact (caveat "imerg_sensor_eras"): a
    "fewer heavy-rain days" message that may come from the 2014 change in
    IMERG inputs is not advice a farmer should act on.
    """

    current = recommendations["current"]
    # Plain improvements first, then trade-offs; within each, by rank.
    ranked = sorted(
        recommendations["results"],
        key=lambda p: (p["comparison"]["change_kind"] != "improvement", p["rank"]),
    )
    flowering = flowering_months()
    advice = []

    def summary(pattern: dict, **extra) -> dict:
        return {
            "pattern_id": pattern["pattern_id"],
            "name": pattern["name"],
            "seasons": pattern["seasons"],
            "rank": pattern["rank"],
            "change_kind": pattern["comparison"]["change_kind"],
            "trade_offs": pattern["comparison"]["trade_offs"],
            **extra,
        }

    for trend in trends:
        rule = CLIMATE_RULES.get(trend["indicator"])

        if rule is None or trend["status"] != "trend" or trend.get("role") != "primary":
            continue

        if (trend.get("caveat") or "").startswith("imerg_sensor_eras"):
            continue

        # Several indicators can point to the same hazard (annual and Kharif
        # rain); give the advice once.
        if any(item["hazard"] == rule["hazard"] for item in advice):
            continue

        adverse = trend["direction"] == rule["adverse"]
        item = {
            "indicator": trend["indicator"],
            "hazard": rule["hazard"],
            "direction": trend["direction"],
            "adverse": adverse,
            "change_per_decade": trend["change_per_decade"],
            "unit": trend["unit"],
            "gauge_agrees": trend["gauge_agrees"],
            "threatened_crops": [],
            "better_patterns": [],
        }

        if rule["exposure"] == "irrigation":
            item["current_irrigation_mm"] = current["water"]["irrigation_mm"]

            if adverse:
                item["better_patterns"] = [
                    summary(p, irrigation_mm=p["water"]["irrigation_mm"])
                    for p in ranked
                    if p["water"]["irrigation_mm"] is not None
                    and p["water"]["irrigation_mm"] < current["water"]["irrigation_mm"]
                ][:2]
        else:
            threatened = exposed_crops(current, rule, flowering)
            item["threatened_crops"] = threatened

            if adverse and threatened:
                item["better_patterns"] = [
                    summary(p, exposed_crops=exposed_crops(p, rule, flowering))
                    for p in ranked
                    if len(exposed_crops(p, rule, flowering)) < len(threatened)
                ][:2]

        advice.append(item)

    return advice


@app.get("/api/offline/climate-shift")
def climate_shift(upazila: str = Query(default=DEFAULT_UPAZILA)):
    """
    Yearly agro-climatic indicators for a Feni upazila from NASA POWER
    (1984-), with Mann-Kendall / Sen trends, a Pettitt break check, a check
    against the BMD Feni gauge, and advice linked to the recommendations.
    """

    if not table_exists("climate_trends"):
        raise HTTPException(
            status_code=503,
            detail="Climate tables are not built. Run backend/offline/build_climate_tables.py.",
        )

    upazilas = [row["upazila"] for row in fetch_all("SELECT DISTINCT upazila FROM climate_trends ORDER BY upazila")]

    if upazila not in upazilas:
        raise HTTPException(status_code=404, detail=f"Upazila not found: {upazila}. Available: {upazilas}")

    trends = fetch_all("SELECT * FROM climate_trends WHERE upazila = ? ORDER BY indicator", (upazila,))
    years = fetch_all(
        "SELECT indicator, year, value FROM climate_indicator_years WHERE upazila = ? ORDER BY indicator, year",
        (upazila,),
    )

    series: dict = {}
    for row in years:
        series.setdefault(row["indicator"], []).append({"year": row["year"], "value": row["value"]})

    for trend in trends:
        trend["series"] = series.get(trend["indicator"], [])
        trend["significant"] = bool(trend["significant"])
        trend["gauge_agrees"] = None if trend["gauge_agrees"] is None else bool(trend["gauge_agrees"])

    checks = fetch_all("SELECT * FROM climate_crosscheck")
    recommendations = pattern_recommendations(FIELD_ID, PatternRecommendationRequest())
    rain_source = next((t["source"] for t in trends if t["source_basis"] == "rain"), "power")

    return {
        "upazila": upazila,
        "available_upazilas": upazilas,
        "indicators": trends,
        "gauge_check": {
            "station": "BMD Feni (BBS Yearbook of Agricultural Statistics 2025, Tables 6.1.x and 6.2.x)",
            # Rain rows of the source used for the indicators; both sources below for the chart.
            "annual_rain": [
                c for c in checks
                if c["variable"] == "rain_annual" and c["check"] == f"{rain_source}_vs_bmd_feni_station"
            ],
            "annual_rain_by_source": {
                source: [
                    c for c in checks
                    if c["variable"] == "rain_annual" and c["check"] == f"{source}_vs_bmd_feni_station"
                ]
                for source in ("power", "gpm")
            },
            "monthly_rain": [
                c for c in checks
                if c["variable"] == "rain_month" and c["check"] == f"{rain_source}_vs_bmd_feni_station"
            ],
            "monthly_tmax": [c for c in checks if c["variable"] == "tmax_month_mean"],
            "monthly_tmax_bc": [c for c in checks if c["variable"] == "tmax_month_mean_bc"],
            "tmax_bias_correction": (
                fetch_all("SELECT * FROM climate_tmax_bias_correction")
                if table_exists("climate_tmax_bias_correction")
                else []
            ),
        },
        "repo_file_check": [c for c in checks if c["check"] == "power_vs_repo_power_file"],
        "advice": climate_advice(trends, recommendations),
        "rain_source": rain_source,
        "notes": {
            "source": (
                "Rainfall: NASA GPM IMERG V07 daily, averaged over each upazila polygon. "
                if rain_source == "gpm"
                else "Rainfall: NASA POWER (GPM IMERG not yet fetched); POWER rain has a break around 1997 "
                     "and disagrees with the BMD Feni gauge. "
            ) + "Temperature and ET0: NASA POWER (MERRA-2 reanalysis, CERES solar), from 1998, Tmax "
                "bias-corrected against the BMD Feni station. Reanalysis and satellite data, not station records.",
            "grid": (
                "GPM rainfall (about 10 km) differs between upazilas. "
                if rain_source == "gpm"
                else "NASA POWER rainfall is one grid cell for all of Feni. "
            ) + "NASA POWER temperature is one 0.5 x 0.625 degree cell for all six upazilas: "
                "the temperature charts are the same for every upazila.",
            "significance": "A trend is reported only when Mann-Kendall p < 0.05 and it is not explained by a "
                            "single break in the record (Pettitt test). Heat uses percentile thresholds "
                            "(days above the 1998-2010 90th percentile).",
        },
        "runtime": "offline",
        "internet_required": False,
    }


# ---------------------------------------------------------------------
# STARTUP VALIDATION
# ---------------------------------------------------------------------

@app.on_event("startup")
def startup_validation():

    print("=" * 70)
    print("FIELD SHIFT — OFFLINE FASTAPI RUNTIME")
    print("=" * 70)

    print(f"[DB] {DB_PATH}")

    # -------------------------------------------------------------
    # Database existence
    # -------------------------------------------------------------

    if not DB_PATH.exists():
        print(
            "[ERROR] Offline database does not exist."
        )
        return

    # -------------------------------------------------------------
    # Required tables
    # -------------------------------------------------------------

    required_tables = [
        "fields",
        "field_soil_profiles",
        "monthly_environmental_features",
        "crop_profiles",
        "rotation_scenarios",
        "evaluated_rotation_scenarios",
        "database_metadata",
        "crop_calendar",
        "cropping_patterns",
        "feni_upazila_patterns",
    ]

    for table in required_tables:

        if table_exists(table):
            print(
                f"[OK] table: {table}"
            )

        else:
            print(
                f"[ERROR] missing table: {table}"
            )

    # -------------------------------------------------------------
    # Validate actual field schema
    # -------------------------------------------------------------

    field_columns = [
        row["name"]
        for row in fetch_all(
            "PRAGMA table_info(fields)"
        )
    ]

    if "field_id" in field_columns:
        print(
            "[OK] fields.field_id column detected"
        )
    else:
        print(
            "[ERROR] fields.field_id column missing"
        )

    soil_columns = [
        row["name"]
        for row in fetch_all(
            "PRAGMA table_info(field_soil_profiles)"
        )
    ]

    if "field_id" in soil_columns:
        print(
            "[OK] field_soil_profiles.field_id detected"
        )
    else:
        print(
            "[ERROR] field_soil_profiles.field_id missing"
        )

    # -------------------------------------------------------------
    # Validate configured field
    # -------------------------------------------------------------

    if field_exists(FIELD_ID):
        print(
            f"[OK] configured field exists: {FIELD_ID}"
        )
    else:
        print(
            f"[WARNING] configured field not found: {FIELD_ID}"
        )

    # -------------------------------------------------------------
    # Runtime characteristics
    # -------------------------------------------------------------

    print("[OK] Runtime mode: OFFLINE")
    print("[OK] Internet required: NO")
    print("[OK] NASA API required: NO")
    print("[OK] Google Earth Engine required: NO")
    print("[OK] External ML service required: NO")

    print(
        f"[OK] Methodology: {METHODOLOGY_VERSION}"
    )

    print(
        "[OK] CORS: Enabled for localhost and Vercel"
    )

    print("=" * 70)