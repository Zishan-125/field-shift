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

@app.get("/api/offline/fields/{field_id}/rotations")
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
    "/api/offline/fields/{field_id}/rotations/evaluated"
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
    "/api/offline/fields/{field_id}/recommendations"
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