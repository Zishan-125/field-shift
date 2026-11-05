"""
FIELD SHIFT — climate-shift tables for the offline database

Loads the outputs of data-pipeline/climate/climate_shift.py into
backend/offline/field_shift.db (only files in the repository are needed):

    climate_indicator_years   upazila, indicator, year, value
    climate_trends            Mann-Kendall / Sen / Pettitt per upazila and indicator
    climate_crosscheck        NASA POWER vs repo POWER file and BMD Feni gauge

Run:
    python data-pipeline/climate/climate_shift.py      # refresh the derived CSVs
    python backend/offline/build_climate_tables.py
"""

from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
DB_PATH = ROOT / "backend" / "offline" / "field_shift.db"
DERIVED = ROOT / "data-pipeline" / "derived"

TABLES = {
    "climate_indicator_years": "climate_shift_years.csv",
    "climate_trends": "climate_shift_trends.csv",
    "climate_crosscheck": "climate_crosscheck.csv",
}


def main() -> None:
    conn = sqlite3.connect(DB_PATH)

    try:
        with conn:
            for table, filename in TABLES.items():
                frame = pd.read_csv(DERIVED / filename)
                frame.to_sql(table, conn, if_exists="replace", index=False)
                print(f"[OK] {table}: {len(frame)} rows")

            conn.executemany(
                "INSERT OR REPLACE INTO database_metadata (key, value) VALUES (?, ?)",
                [
                    ("climate_built_at_utc", datetime.now(timezone.utc).isoformat()),
                    ("climate_source", "NASA POWER daily (AG), MERRA-2 / CERES; reanalysis, not a gauge record"),
                ],
            )
    finally:
        conn.close()


if __name__ == "__main__":
    main()
