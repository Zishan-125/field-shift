"""
FIELD SHIFT — cropland sample points for the crop classifier

400 points in each of Feni, Noakhali and Cumilla (Comilla in FAO GAUL 2025),
drawn at random from ESA WorldCover v200 cropland (class 40) where the whole
90 m square around the point is cropland, so the 30 m HLS pixel under the
point is not mixed with homestead trees, water or roads.

Points are thinned to be at least MIN_SPACING_M apart (less spatial
autocorrelation between training and test points) and kept at least
DEMO_EXCLUSION_M away from the six demo fields, so the demo timeline is never
scored on points the model trained on.

These are unlabelled locations. Labels come from the phenology rules
(classifier/phenology_labels.py), not from field visits.

Output: data-pipeline/reference/classifier_points.csv
    point_id, district, lat, lon

Run:
    python data-pipeline/classifier/sample_points.py --project field-shift-bd
"""

from __future__ import annotations

import argparse
import json
import math
import os
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
FIELDS = ROOT / "data-pipeline" / "reference" / "fields.geojson"
OUTPUT = ROOT / "data-pipeline" / "reference" / "classifier_points.csv"

DISTRICTS = {"Feni": "Feni", "Noakhali": "Noakhali", "Cumilla": "Comilla"}   # our name -> GAUL name
PER_DISTRICT = 400
MIN_SPACING_M = 500
DEMO_EXCLUSION_M = 1000
SEED = 2026


def metres(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat = math.radians((a[0] + b[0]) / 2)
    dy = (a[0] - b[0]) * 111_320
    dx = (a[1] - b[1]) * 111_320 * math.cos(lat)
    return math.hypot(dx, dy)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", default=os.environ.get("EE_PROJECT", "field-shift-bd"))
    args = parser.parse_args()

    import ee

    ee.Initialize(project=args.project)

    cropland = ee.ImageCollection("ESA/WorldCover/v200").first().select("Map").eq(40)
    solid = cropland.focalMin(radius=45, kernelType="square", units="meters").selfMask().rename("ok")
    gaul = ee.FeatureCollection("FAO/GAUL/2025/level2").filter(ee.Filter.eq("GAUL0_NAME", "Bangladesh"))

    demo = [
        (f["properties"]["center_lat"], f["properties"]["center_lon"])
        for f in json.loads(FIELDS.read_text(encoding="utf-8"))["features"]
    ]
    rows = []

    for district, gaul_name in DISTRICTS.items():
        polygon = gaul.filter(ee.Filter.eq("GAUL2_NAME", gaul_name)).geometry()
        sample = (
            solid.sample(region=polygon, scale=30, numPixels=12000, seed=SEED, geometries=True)
            .randomColumn("r", SEED).sort("r").limit(4500)        # random order, under EE's 5,000 limit
        )
        candidates = [f["geometry"]["coordinates"][::-1] for f in sample.getInfo()["features"]]

        kept: list[tuple[float, float]] = []
        for lat, lon in candidates:
            point = (lat, lon)
            if any(metres(point, d) < DEMO_EXCLUSION_M for d in demo):
                continue
            if any(metres(point, k) < MIN_SPACING_M for k in kept):
                continue
            kept.append(point)
            if len(kept) == PER_DISTRICT:
                break

        if len(kept) < PER_DISTRICT:
            print(f"[WARN] {district}: only {len(kept)} points after thinning")

        for i, (lat, lon) in enumerate(kept, start=1):
            rows.append({"point_id": f"{district.lower()}_{i:03d}", "district": district,
                         "lat": round(lat, 6), "lon": round(lon, 6)})
        print(f"[OK] {district}: {len(kept)} points from {len(candidates)} candidates")

    pd.DataFrame(rows).to_csv(OUTPUT, index=False)
    print(f"[OK] {len(rows)} points -> {OUTPUT}")


if __name__ == "__main__":
    main()
