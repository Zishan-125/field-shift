"""
FIELD SHIFT — Offline Database Builder

Purpose
-------
Build a deterministic, offline SQLite database from validated pipeline artifacts.

Runtime must NOT require:
    - NASA APIs
    - Google Earth Engine
    - Internet
    - External ML services

Source artifacts:
    - Agricultural features
    - Field soil profile
    - Crop profiles
    - Rotation scenarios
    - Evaluated rotation scenarios

Database:
    backend/offline/field_shift.db
"""

from __future__ import annotations

import csv
import json
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


# ---------------------------------------------------------------------------
# PATHS
# ---------------------------------------------------------------------------

ROOT = Path(__file__).resolve().parents[2]

OUTPUT_DIR = ROOT / "backend" / "offline"
DB_PATH = OUTPUT_DIR / "field_shift.db"

AGRICULTURAL_FEATURES = (
    ROOT
    / "data-pipeline"
    / "output"
    / "features"
    / "agricultural_features_2019_2024.csv"
)

SOIL_PROFILE = (
    ROOT
    / "data-pipeline"
    / "output"
    / "soil"
    / "field_soil_profile.csv"
)

CROP_PROFILES = (
    ROOT
    / "data-pipeline"
    / "output"
    / "crop"
    / "crop_profiles.csv"
)

ROTATION_SCENARIOS = (
    ROOT
    / "data-pipeline"
    / "output"
    / "scenarios"
    / "rotation_scenarios.csv"
)

EVALUATED_ROTATIONS = (
    ROOT
    / "data-pipeline"
    / "output"
    / "scenarios"
    / "evaluated_rotation_scenarios.csv"
)


# ---------------------------------------------------------------------------
# EXPECTED VALIDATED COUNTS
# ---------------------------------------------------------------------------

EXPECTED_COUNTS = {
    "fields": 1,
    "field_soil_profiles": 1,
    "monthly_environmental_features": 69,
    "crop_profiles": 8,
    "rotation_scenarios": 272,
    "evaluated_rotation_scenarios": 272,
}


# ---------------------------------------------------------------------------
# CURRENT VALIDATED FIELD REGISTRY
# ---------------------------------------------------------------------------

FIELD_ID = "426e9d97-78cf-45d2-82ae-8131040b5ee7"

FIELD_NAME = "Feni Test Plot"

FIELD_GEOMETRY = {
    "type": "Polygon",
    "coordinates": [
        [
            [91.39, 23.01],
            [91.40, 23.01],
            [91.40, 23.00],
            [91.39, 23.00],
            [91.39, 23.01],
        ]
    ],
}

FIELD_CENTROID_LON = 91.395
FIELD_CENTROID_LAT = 23.005


# ---------------------------------------------------------------------------
# HELPERS
# ---------------------------------------------------------------------------

def quote_identifier(name: str) -> str:
    """Safely quote an SQLite identifier."""
    return '"' + name.replace('"', '""') + '"'


def validate_identifier(name: str) -> None:
    """
    Ensure source CSV column names can safely be represented in SQLite.

    We preserve the original names rather than silently renaming columns.
    """
    if not name:
        raise ValueError("Encountered empty CSV column name.")

    if "\x00" in name:
        raise ValueError(f"Invalid NULL byte in column name: {name!r}")


def read_csv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    """Read a CSV while preserving source column names and values."""
    if not path.exists():
        raise FileNotFoundError(f"Required artifact not found: {path}")

    with path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)

        if not reader.fieldnames:
            raise ValueError(f"CSV has no header: {path}")

        columns = list(reader.fieldnames)

        if len(columns) != len(set(columns)):
            raise ValueError(
                f"Duplicate columns detected in {path}: {columns}"
            )

        for column in columns:
            validate_identifier(column)

        rows = list(reader)

    return columns, rows


def infer_sqlite_type(values: list[str]) -> str:
    """
    Infer a practical SQLite type.

    SQLite remains permissive, but using INTEGER/REAL where appropriate
    makes downstream SQL queries cleaner.
    """
    non_empty = [
        str(value).strip()
        for value in values
        if value is not None and str(value).strip() != ""
    ]

    if not non_empty:
        return "TEXT"

    integer_ok = True
    real_ok = True

    for value in non_empty:
        try:
            int(value)
        except ValueError:
            integer_ok = False

        try:
            float(value)
        except ValueError:
            real_ok = False

    if integer_ok:
        return "INTEGER"

    if real_ok:
        return "REAL"

    return "TEXT"


def convert_value(value: str, sql_type: str) -> Any:
    """Convert CSV text into a SQLite-compatible Python value."""
    if value is None:
        return None

    value = str(value).strip()

    if value == "":
        return None

    if sql_type == "INTEGER":
        try:
            return int(value)
        except ValueError:
            return value

    if sql_type == "REAL":
        try:
            return float(value)
        except ValueError:
            return value

    return value


def create_dynamic_table(
    conn: sqlite3.Connection,
    table_name: str,
    columns: list[str],
    rows: list[dict[str, str]],
) -> None:
    """
    Create a table directly from a validated CSV.

    Source columns are preserved exactly.
    """
    column_types: dict[str, str] = {}

    for column in columns:
        values = [row.get(column, "") for row in rows]
        column_types[column] = infer_sqlite_type(values)

    column_sql = ", ".join(
        f"{quote_identifier(column)} {column_types[column]}"
        for column in columns
    )

    conn.execute(
        f"DROP TABLE IF EXISTS {quote_identifier(table_name)}"
    )

    conn.execute(
        f"CREATE TABLE {quote_identifier(table_name)} ({column_sql})"
    )

    placeholders = ", ".join(["?"] * len(columns))

    insert_sql = (
        f"INSERT INTO {quote_identifier(table_name)} "
        f"({', '.join(quote_identifier(c) for c in columns)}) "
        f"VALUES ({placeholders})"
    )

    converted_rows = []

    for row in rows:
        converted_rows.append(
            tuple(
                convert_value(row.get(column, ""), column_types[column])
                for column in columns
            )
        )

    if converted_rows:
        conn.executemany(insert_sql, converted_rows)

    print(
        f"[OK] {table_name}: "
        f"{len(rows)} rows × {len(columns)} columns"
    )


def create_fields_table(conn: sqlite3.Connection) -> None:
    """Create the local field registry."""
    conn.execute("DROP TABLE IF EXISTS fields")

    conn.execute(
        """
        CREATE TABLE fields (
            field_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            geometry_type TEXT NOT NULL,
            geometry_geojson TEXT NOT NULL,
            centroid_lat REAL NOT NULL,
            centroid_lon REAL NOT NULL,
            min_lat REAL NOT NULL,
            max_lat REAL NOT NULL,
            min_lon REAL NOT NULL,
            max_lon REAL NOT NULL
        )
        """
    )

    geometry_json = json.dumps(
        FIELD_GEOMETRY,
        separators=(",", ":"),
    )

    conn.execute(
        """
        INSERT INTO fields (
            field_id,
            name,
            geometry_type,
            geometry_geojson,
            centroid_lat,
            centroid_lon,
            min_lat,
            max_lat,
            min_lon,
            max_lon
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            FIELD_ID,
            FIELD_NAME,
            FIELD_GEOMETRY["type"],
            geometry_json,
            FIELD_CENTROID_LAT,
            FIELD_CENTROID_LON,
            23.00,
            23.01,
            91.39,
            91.40,
        ),
    )

    print("[OK] fields: 1 row")


def create_metadata_table(conn: sqlite3.Connection) -> None:
    """Create database provenance metadata."""
    conn.execute("DROP TABLE IF EXISTS database_metadata")

    conn.execute(
        """
        CREATE TABLE database_metadata (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
        """
    )

    metadata = {
        "database_name": "Field Shift Offline Database",
        "database_version": "1.0.0",
        "built_at_utc": datetime.now(timezone.utc).isoformat(),
        "runtime_mode": "offline_first",
        "internet_required": "false",
        "field_id": FIELD_ID,
        "historical_period": "2019-01-01 to 2024-09-30",
        "farmer_priority_methodology": "farmer_priority_v2",
        "synthetic_yield_target": "false",
        "source_of_truth": "validated_pipeline_artifacts",
    }

    conn.executemany(
        "INSERT INTO database_metadata (key, value) VALUES (?, ?)",
        metadata.items(),
    )


def create_indexes(conn: sqlite3.Connection) -> None:
    """Create indexes needed by the future FastAPI runtime."""

    indexes = [
        (
            "idx_env_field_month",
            "monthly_environmental_features",
            ["field_id", "observation_month"],
        ),
        (
            "idx_soil_field",
            "field_soil_profiles",
            ["field_id"],
        ),
        (
            "idx_rotation_id",
            "rotation_scenarios",
            ["rotation_id"],
        ),
        (
            "idx_eval_rotation_id",
            "evaluated_rotation_scenarios",
            ["rotation_id"],
        ),
        (
            "idx_eval_priority",
            "evaluated_rotation_scenarios",
            ["farmer_priority_score"],
        ),
        (
            "idx_crop_id",
            "crop_profiles",
            ["crop_id"],
        ),
    ]

    for index_name, table_name, columns in indexes:
        columns_sql = ", ".join(quote_identifier(c) for c in columns)

        conn.execute(
            f"""
            CREATE INDEX IF NOT EXISTS {quote_identifier(index_name)}
            ON {quote_identifier(table_name)} ({columns_sql})
            """
        )

    print(f"[OK] Created {len(indexes)} runtime indexes.")


def validate_database(conn: sqlite3.Connection) -> None:
    """Validate the final offline database."""

    print()
    print("=" * 70)
    print("VALIDATING OFFLINE DATABASE")
    print("=" * 70)

    tables = [
        "fields",
        "field_soil_profiles",
        "monthly_environmental_features",
        "crop_profiles",
        "rotation_scenarios",
        "evaluated_rotation_scenarios",
    ]

    for table in tables:
        row = conn.execute(
            f"SELECT COUNT(*) FROM {quote_identifier(table)}"
        ).fetchone()

        actual = row[0]
        expected = EXPECTED_COUNTS[table]

        if actual != expected:
            raise RuntimeError(
                f"[FAIL] {table}: expected {expected}, got {actual}"
            )

        print(f"[OK] {table}: {actual} rows")

    # ------------------------------------------------------------------
    # Field identity
    # ------------------------------------------------------------------

    field = conn.execute(
        "SELECT field_id, name FROM fields LIMIT 1"
    ).fetchone()

    if not field:
        raise RuntimeError("[FAIL] No field record found.")

    if field[0] != FIELD_ID:
        raise RuntimeError(
            f"[FAIL] Unexpected field ID: {field[0]}"
        )

    print(f"[OK] Field ID: {field[0]}")
    print(f"[OK] Field name: {field[1]}")

    # ------------------------------------------------------------------
    # Environmental period
    # ------------------------------------------------------------------

    period = conn.execute(
        """
        SELECT
            MIN(observation_month),
            MAX(observation_month),
            COUNT(DISTINCT observation_month)
        FROM monthly_environmental_features
        """
    ).fetchone()

    print(
        f"[OK] Environmental period: "
        f"{period[0]} → {period[1]} "
        f"({period[2]} months)"
    )

    if period[2] != 69:
        raise RuntimeError(
            f"[FAIL] Expected 69 monthly observations, got {period[2]}"
        )

    # ------------------------------------------------------------------
    # Rotation IDs
    # ------------------------------------------------------------------

    duplicate_rotation = conn.execute(
        """
        SELECT rotation_id, COUNT(*)
        FROM evaluated_rotation_scenarios
        GROUP BY rotation_id
        HAVING COUNT(*) > 1
        LIMIT 1
        """
    ).fetchone()

    if duplicate_rotation:
        raise RuntimeError(
            f"[FAIL] Duplicate evaluated rotation ID: "
            f"{duplicate_rotation[0]}"
        )

    print("[OK] Evaluated rotation IDs are unique.")

    # ------------------------------------------------------------------
    # Score range
    # ------------------------------------------------------------------

    score_range = conn.execute(
        """
        SELECT
            MIN(farmer_priority_score),
            MAX(farmer_priority_score)
        FROM evaluated_rotation_scenarios
        """
    ).fetchone()

    if score_range[0] is None or score_range[1] is None:
        raise RuntimeError("[FAIL] Farmer priority scores are empty.")

    if score_range[0] < 0 or score_range[1] > 1:
        raise RuntimeError(
            "[FAIL] Farmer priority score outside [0,1]."
        )

    print(
        f"[OK] Farmer priority score range: "
        f"{score_range[0]:.4f} → {score_range[1]:.4f}"
    )

    # ------------------------------------------------------------------
    # Synthetic target check
    # ------------------------------------------------------------------

    synthetic_values = conn.execute(
        """
        SELECT DISTINCT synthetic_yield_target
        FROM evaluated_rotation_scenarios
        """
    ).fetchall()

    print(
        "[OK] synthetic_yield_target values:",
        [row[0] for row in synthetic_values],
    )

    # ------------------------------------------------------------------
    # Metadata
    # ------------------------------------------------------------------

    metadata = dict(
        conn.execute(
            "SELECT key, value FROM database_metadata"
        ).fetchall()
    )

    if metadata.get("internet_required") != "false":
        raise RuntimeError(
            "[FAIL] Database is not marked offline."
        )

    if metadata.get("synthetic_yield_target") != "false":
        raise RuntimeError(
            "[FAIL] Synthetic target flag is incorrect."
        )

    print("[OK] Offline metadata validated.")
    print("[OK] No synthetic yield target.")
    print("[OK] Database provenance metadata present.")


# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------

def main() -> None:
    print()
    print("=" * 70)
    print("FIELD SHIFT — OFFLINE DATABASE BUILDER")
    print("=" * 70)
    print(f"[ROOT] {ROOT}")
    print(f"[DB]   {DB_PATH}")
    print()

    source_files = [
        AGRICULTURAL_FEATURES,
        SOIL_PROFILE,
        CROP_PROFILES,
        ROTATION_SCENARIOS,
        EVALUATED_ROTATIONS,
    ]

    print("CHECKING SOURCE ARTIFACTS")
    print("-" * 70)

    for path in source_files:
        if not path.exists():
            raise FileNotFoundError(
                f"Required source artifact missing:\n{path}"
            )

        print(f"[OK] {path.relative_to(ROOT)}")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Remove previous database so the build is deterministic.
    if DB_PATH.exists():
        DB_PATH.unlink()
        print()
        print("[INFO] Removed previous field_shift.db")

    conn = sqlite3.connect(DB_PATH)

    try:
        conn.execute("PRAGMA foreign_keys = ON")
        conn.execute("PRAGMA journal_mode = DELETE")

        # ---------------------------------------------------------------
        # Fields
        # ---------------------------------------------------------------

        print()
        print("BUILDING FIELD REGISTRY")
        print("-" * 70)

        create_fields_table(conn)

        # ---------------------------------------------------------------
        # CSV artifacts
        # ---------------------------------------------------------------

        print()
        print("IMPORTING VALIDATED PIPELINE ARTIFACTS")
        print("-" * 70)

        csv_sources = [
            (
                "monthly_environmental_features",
                AGRICULTURAL_FEATURES,
            ),
            (
                "field_soil_profiles",
                SOIL_PROFILE,
            ),
            (
                "crop_profiles",
                CROP_PROFILES,
            ),
            (
                "rotation_scenarios",
                ROTATION_SCENARIOS,
            ),
            (
                "evaluated_rotation_scenarios",
                EVALUATED_ROTATIONS,
            ),
        ]

        for table_name, source_path in csv_sources:
            columns, rows = read_csv(source_path)

            print(
                f"[SOURCE] {source_path.name}: "
                f"{len(rows)} rows × {len(columns)} columns"
            )

            create_dynamic_table(
                conn,
                table_name,
                columns,
                rows,
            )

        # ---------------------------------------------------------------
        # Metadata + indexes
        # ---------------------------------------------------------------

        print()
        print("ADDING DATABASE METADATA")
        print("-" * 70)

        create_metadata_table(conn)
        create_indexes(conn)

        conn.commit()

        # ---------------------------------------------------------------
        # Final validation
        # ---------------------------------------------------------------

        validate_database(conn)

        conn.commit()

    except Exception:
        conn.rollback()
        raise

    finally:
        conn.close()

    print()
    print("=" * 70)
    print("[SUCCESS] OFFLINE DATABASE BUILD COMPLETE")
    print("=" * 70)
    print(f"[OUTPUT] {DB_PATH}")
    print()
    print("Runtime dependencies:")
    print("  - SQLite: YES")
    print("  - Internet: NO")
    print("  - NASA API: NO")
    print("  - Google Earth Engine: NO")
    print("  - External ML service: NO")
    print()
    print("Ready for the local FastAPI runtime.")


if __name__ == "__main__":
    main()