"""
FIELD SHIFT — Sentinel-1 flood extent on Aman cropland, 2024 vs the BBS damage table

Independent of the BBS area figures: the share of Aman cropland the radar
saw under water in late August - September 2024, compared with BBS Table
4.2.9 (Aman damaged by the Aug-Sep 2024 floods: Feni 55 %, Noakhali 44 %;
Cumilla's row covers only part of the district).

Two measurements, both with the same window in 2023 as a normal-year
control (transplanted paddy is flooded on purpose, so only the excess over
2023 is flood):

  A. pixels   all ESA WorldCover cropland in each district; Sentinel-1 IW VV
              mean of the scenes in WINDOW below VV_WATER_DB (open water)
  B. points   the classifier points labelled T_Aman by the phenology rules in
              2023 (so the Aman land is chosen without using 2024); share
              whose dekad-mean VH stays below VH_WATER_DB in at least
              MIN_DEKADS of the late-August / September 2024 dekads

Output: data-pipeline/derived/flood_extent_check.csv

Run:
    python data-pipeline/classifier/flood_extent_check.py --pixels   # Earth Engine
    python data-pipeline/classifier/flood_extent_check.py --points   # needs classifier dekads + labels
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
PROCESSED = ROOT / "data-pipeline" / "data" / "processed"
REFERENCE = ROOT / "data-pipeline" / "reference"
OUTPUT = ROOT / "data-pipeline" / "derived" / "flood_extent_check.csv"

WINDOWS = {2023: ("2023-08-21", "2023-09-11"), 2024: ("2024-08-21", "2024-09-11")}
VV_WATER_DB = -18.0          # same open-water threshold used to pick the Fulgazi field
VH_WATER_DB = -20.0          # dekad means (pooled orbits) over standing water
POINT_DEKADS = ["08-21", "09-01", "09-11", "09-21"]
MIN_DEKADS = 2
DISTRICTS = {"Feni": "Feni", "Noakhali": "Noakhali", "Cumilla": "Comilla"}
BBS_DAMAGE = {"Feni": 55.0, "Noakhali": 44.0, "Cumilla": None}   # % of Aman area damaged, Table 4.2.9


def pixels(project: str) -> list[dict]:
    import ee

    ee.Initialize(project=project)
    cropland = ee.ImageCollection("ESA/WorldCover/v200").first().select("Map").eq(40)
    gaul = ee.FeatureCollection("FAO/GAUL/2025/level2").filter(ee.Filter.eq("GAUL0_NAME", "Bangladesh"))
    rows = []

    for district, gaul_name in DISTRICTS.items():
        region = gaul.filter(ee.Filter.eq("GAUL2_NAME", gaul_name)).geometry()
        for year, (start, end) in WINDOWS.items():
            vv = (ee.ImageCollection("COPERNICUS/S1_GRD").filterBounds(region).filterDate(start, end)
                  .filter(ee.Filter.eq("instrumentMode", "IW"))
                  .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VV"))
                  .select("VV"))
            n_scenes = vv.size().getInfo()
            water = vv.mean().lt(VV_WATER_DB).updateMask(cropland.selfMask())
            share = water.reduceRegion(ee.Reducer.mean(), region, 30, maxPixels=1e10, tileScale=4).get("VV").getInfo()
            rows.append({"method": "A_pixels_worldcover_cropland", "district": district, "year": year,
                         "window": f"{start} to {end}", "n": n_scenes, "share_under_water_pct": round(100 * share, 1)})
            print(rows[-1], flush=True)
    return rows


def points() -> list[dict]:
    dekads = pd.read_csv(PROCESSED / "classifier_dekads.csv")
    labels = pd.read_csv(PROCESSED / "classifier_phenology_labels.csv")
    district = pd.read_csv(REFERENCE / "classifier_points.csv").set_index("point_id")["district"]

    aman = labels[(labels["season"] == "kharif2") & (labels["year"] == 2023) & (labels["label"] == "T_Aman")]["point_id"]
    rows = []
    for year in WINDOWS:
        wanted = [f"{year}-{d}" for d in POINT_DEKADS]
        d = dekads[dekads["point_id"].isin(aman) & dekads["dekad_start"].isin(wanted)]
        wet = (d["VH"] < VH_WATER_DB).groupby(d["point_id"]).sum() >= MIN_DEKADS
        frame = pd.DataFrame({"wet": wet, "district": district.reindex(wet.index)})
        for name, g in frame.groupby("district"):
            rows.append({"method": "B_points_aman_2023", "district": name, "year": year,
                         "window": f"dekads {', '.join(POINT_DEKADS)}", "n": len(g),
                         "share_under_water_pct": round(100 * float(g["wet"].mean()), 1)})
    return rows


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pixels", action="store_true")
    parser.add_argument("--points", action="store_true")
    parser.add_argument("--project", default=os.environ.get("EE_PROJECT", "field-shift-bd"))
    args = parser.parse_args()

    old = pd.read_csv(OUTPUT) if OUTPUT.exists() else pd.DataFrame(columns=["method"])
    new = (pixels(args.project) if args.pixels else []) + (points() if args.points else [])
    new = pd.DataFrame(new)
    frame = pd.concat([old[~old["method"].isin(new["method"].unique())], new], ignore_index=True)

    frame["bbs_aman_damaged_pct"] = frame["district"].map(BBS_DAMAGE)
    excess = frame.pivot_table(index=["method", "district"], columns="year", values="share_under_water_pct")
    frame["excess_over_2023_pct"] = frame.apply(
        lambda r: round(excess.loc[(r["method"], r["district"]), 2024] - excess.loc[(r["method"], r["district"]), 2023], 1)
        if r["year"] == 2024 else None, axis=1)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(OUTPUT, index=False)
    print(frame.to_string(index=False))


if __name__ == "__main__":
    main()
