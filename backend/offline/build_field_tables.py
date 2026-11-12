"""
FIELD SHIFT — demo-field tables for the offline database

    demo_fields          the six rule-chosen demo fields (fields.geojson)
    demo_field_seasons   what the satellites saw per field, season and year:
                         phenology-rule label (weak label, may be empty) and,
                         when classifier predictions exist, the model's class
                         probabilities
    demo_field_s1        Sentinel-1 VH per scene (field mean, dB) with orbit
    demo_field_smap      SMAP L4 root-zone moisture per day, on the field's
                         soil: sm_rootzone / SMAP porosity x theta_sat
    demo_field_soil      field capacity / wilting point / saturation
                         (fields/field_soil_water.py)

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
PROCESSED = ROOT / "data-pipeline" / "data" / "processed"
SOIL = ROOT / "data-pipeline" / "derived" / "demo_field_soil_water.csv"
UPAZILAS = ROOT / "data-pipeline" / "reference" / "feni_upazilas.geojson"


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

    soil = pd.read_csv(SOIL) if SOIL.exists() else None
    s1_parts, smap_parts = [], []
    for field_id in fields["field_id"]:
        path = PROCESSED / f"{field_id}.csv"
        if not path.exists():
            print(f"[SKIP] {field_id}: no time series yet")
            continue
        series = pd.read_csv(path)
        vh = series[(series["source"] == "S1_GRD") & (series["variable"] == "VH")]
        s1_parts.append(vh[["field_id", "date", "orbit", "value"]].rename(columns={"value": "vh_db"}))
        if soil is not None:
            limits = soil.set_index("field_id").loc[field_id]
            sm = series[series["variable"] == "sm_rootzone"][["field_id", "date", "value"]].copy()
            sm["theta_field"] = (sm["value"] / limits["smap_porosity"] * limits["theta_sat"]).round(4)
            smap_parts.append(sm[["field_id", "date", "theta_field"]])

    conn = sqlite3.connect(DB_PATH)
    try:
        with conn:
            fields.to_sql("demo_fields", conn, if_exists="replace", index=False)
            seasons.to_sql("demo_field_seasons", conn, if_exists="replace", index=False)
            if s1_parts:
                pd.concat(s1_parts).to_sql("demo_field_s1", conn, if_exists="replace", index=False)
            if smap_parts:
                pd.concat(smap_parts).to_sql("demo_field_smap", conn, if_exists="replace", index=False)
            if soil is not None:
                soil.to_sql("demo_field_soil", conn, if_exists="replace", index=False)
            pd.DataFrame([{"key": "feni_upazilas", "geojson": UPAZILAS.read_text(encoding="utf-8")}]).to_sql(
                "demo_area", conn, if_exists="replace", index=False)
    finally:
        conn.close()
    print(f"[OK] demo_fields: {len(fields)} rows; demo_field_seasons: {len(seasons)} rows; "
          f"time series for {len(s1_parts)} fields")


if __name__ == "__main__":
    main()
