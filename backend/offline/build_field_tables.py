"""
FIELD SHIFT — demo-field tables for the offline database

    demo_fields          the six rule-chosen demo fields (fields.geojson)
    demo_field_seasons   what the satellites saw per field, season and year:
                         phenology-rule label (weak label, may be empty) and,
                         when classifier predictions exist, the model's class
                         probabilities

Run:
    python backend/offline/build_field_tables.py
"""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
DB_PATH = ROOT / "backend" / "offline" / "field_shift.db"
FIELDS = ROOT / "data-pipeline" / "reference" / "fields.geojson"
RULES = ROOT / "data-pipeline" / "data" / "processed" / "demo_field_phenology_labels.csv"
PREDICTIONS = ROOT / "data-pipeline" / "derived" / "demo_field_predictions.csv"


def main() -> None:
    features = json.loads(FIELDS.read_text(encoding="utf-8"))["features"]
    fields = pd.DataFrame([f["properties"] for f in features])[
        ["field_id", "upazila", "rule", "center_lat", "center_lon", "size_m",
         "worldcover_cropland_share", "distance_to_river_channel_m", "s1_vv_aug2024_db", "source"]
    ]

    seasons = pd.read_csv(RULES).rename(columns={"point_id": "field_id", "label": "rule_label", "rule": "rule_reason"})
    if PREDICTIONS.exists():
        predictions = pd.read_csv(PREDICTIONS)
        seasons = seasons.merge(predictions, on=["field_id", "season", "year"], how="left")

    conn = sqlite3.connect(DB_PATH)
    try:
        with conn:
            fields.to_sql("demo_fields", conn, if_exists="replace", index=False)
            seasons.to_sql("demo_field_seasons", conn, if_exists="replace", index=False)
    finally:
        conn.close()
    print(f"[OK] demo_fields: {len(fields)} rows; demo_field_seasons: {len(seasons)} rows")


if __name__ == "__main__":
    main()
