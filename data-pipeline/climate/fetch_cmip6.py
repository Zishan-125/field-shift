"""
FIELD SHIFT — NASA NEX-GDDP-CMIP6 daily Tmax and rain over Feni district

Earth Engine "NASA/GDDP-CMIP6" (NASA Earth Exchange Global Daily Downscaled
Projections, CMIP6, 0.25 degree, bias-corrected and spatially disaggregated
by NASA), area mean over the Feni district polygon (FAO GAUL 2025).

    models     MODELS below (10 GCMs, one run each as published)
    scenarios  historical 1995-2014, ssp245 and ssp585 2041-2060
    variables  tasmax (K -> C), pr (kg m-2 s-1 -> mm/day)

These are model values. They are only used as change factors against the
observed baseline (climate/climate_projections.py), never shown raw.

Output (committed):
    data-pipeline/data/raw/cmip6/feni_<model>_<scenario>.csv   date, tasmax_c, pr_mm

Run:
    python data-pipeline/climate/fetch_cmip6.py --project field-shift-bd
"""

from __future__ import annotations

import argparse
import os
import time
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data-pipeline" / "data" / "raw" / "cmip6"

MODELS = [
    "ACCESS-CM2", "CNRM-CM6-1", "EC-Earth3", "GFDL-ESM4", "IPSL-CM6A-LR",
    "MIROC6", "MPI-ESM1-2-HR", "MRI-ESM2-0", "NorESM2-MM", "UKESM1-0-LL",
]
PERIODS = {"historical": (1995, 2014), "ssp245": (2041, 2060), "ssp585": (2041, 2060)}
CHUNK_YEARS = 4
SCALE_M = 5000   # 0.25 degree cells weighted by the area they cover


def fetch(ee, region, model: str, scenario: str, start: int, end: int) -> pd.DataFrame:
    collection = (
        ee.ImageCollection("NASA/GDDP-CMIP6")
        .filter(ee.Filter.eq("model", model))
        .filter(ee.Filter.eq("scenario", scenario))
        .filterDate(f"{start}-01-01", f"{end + 1}-01-01")
        .select(["tasmax", "pr"])
    )

    def reduce(image):
        values = image.reduceRegion(ee.Reducer.mean(), region, SCALE_M)
        return ee.Feature(None, values).set("date", image.date().format("YYYY-MM-dd"))

    features = collection.map(reduce).getInfo()["features"]
    frame = pd.DataFrame([f["properties"] for f in features])
    frame["tasmax_c"] = frame["tasmax"] - 273.15
    frame["pr_mm"] = frame["pr"] * 86400
    return frame[["date", "tasmax_c", "pr_mm"]]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", default=os.environ.get("EE_PROJECT", "field-shift-bd"))
    args = parser.parse_args()

    import ee

    ee.Initialize(project=args.project)
    region = (ee.FeatureCollection("FAO/GAUL/2025/level2")
              .filter(ee.Filter.eq("GAUL0_NAME", "Bangladesh"))
              .filter(ee.Filter.eq("GAUL2_NAME", "Feni")).geometry())
    OUT.mkdir(parents=True, exist_ok=True)

    for model in MODELS:
        for scenario, (first, last) in PERIODS.items():
            path = OUT / f"feni_{model}_{scenario}.csv"
            if path.exists():
                continue
            parts = []
            for start in range(first, last + 1, CHUNK_YEARS):
                end = min(start + CHUNK_YEARS - 1, last)
                for attempt in range(5):
                    try:
                        parts.append(fetch(ee, region, model, scenario, start, end))
                        break
                    except Exception as error:  # noqa: BLE001
                        print(f"  retry {model} {scenario} {start} ({attempt + 1}): {str(error)[:120]}", flush=True)
                        time.sleep(20 * (attempt + 1))
                else:
                    raise RuntimeError(f"failed {model} {scenario} {start}")
            frame = pd.concat(parts).sort_values("date")
            frame.to_csv(path, index=False, float_format="%.3f")
            print(f"[OK] {model} {scenario}: {len(frame)} days", flush=True)


if __name__ == "__main__":
    main()
