"""
FIELD SHIFT — climate-shift tables for the offline database

Loads the outputs of data-pipeline/climate/climate_shift.py into
backend/offline/field_shift.db (only files in the repository are needed):

    climate_indicator_years   upazila, indicator, year, value
    climate_trends            Mann-Kendall / Sen / Pettitt per upazila and indicator
    climate_crosscheck        NASA POWER vs repo POWER file and BMD Feni gauge
    climate_daily             GPM rain and corrected Tmax per day (crop hazard counts)
    climate_extremes_*        variability, return periods (climate_extremes.py)
    climate_recovery          2024 flood recovery at the Fulgazi field
    climate_projections       CMIP6 delta-change projections (climate_projections.py)

Run:
    python data-pipeline/climate/climate_shift.py      # refresh the derived CSVs
    python backend/offline/build_climate_tables.py
"""

from __future__ import annotations

import json
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
    "climate_tmax_bias_correction": "climate_tmax_bias_correction.csv",
    "climate_daily": "climate_daily.csv",
    "climate_extremes_years": "climate_extremes_years.csv",
    "climate_extremes_summary": "climate_extremes_summary.csv",
    "climate_return_curve": "climate_return_curve.csv",
    "climate_projections": "climate_projections.csv",
}
JSON_TABLES = {"climate_recovery": "climate_recovery_fulgazi.json"}


def main() -> None:
    conn = sqlite3.connect(DB_PATH)

    try:
        with conn:
            for table, filename in TABLES.items():
                if not (DERIVED / filename).exists():
                    print(f"[SKIP] {table}: {filename} not built yet")
                    continue
                frame = pd.read_csv(DERIVED / filename)
                frame.to_sql(table, conn, if_exists="replace", index=False)
                print(f"[OK] {table}: {len(frame)} rows")

            for table, filename in JSON_TABLES.items():
                frame = pd.DataFrame([json.loads((DERIVED / filename).read_text(encoding="utf-8"))])
                frame.to_sql(table, conn, if_exists="replace", index=False)
                print(f"[OK] {table}: {len(frame)} rows")

            conn.executemany(
                "INSERT OR REPLACE INTO database_metadata (key, value) VALUES (?, ?)",
                [
                    ("climate_built_at_utc", datetime.now(timezone.utc).isoformat()),
                    ("climate_source", "GPM IMERG V07 rain; NASA POWER temperature bias-corrected to BMD Feni; NEX-GDDP-CMIP6 change factors"),
                ],
            )
    finally:
        conn.close()


if __name__ == "__main__":
    main()
