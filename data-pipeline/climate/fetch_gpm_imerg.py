"""
FIELD SHIFT — fetch GPM IMERG daily rainfall for the Feni upazilas

NASA GPM IMERG V07 (Earth Engine "NASA/GPM_L3/IMERG_V07", half-hourly,
band "precipitation" in mm/hr, 0.1 degree) summed to daily totals
(mm/hr x 0.5 h per half-hour image) and averaged over each upazila polygon
(data-pipeline/reference/feni_upazilas.geojson, geoBoundaries ADM3).

Area averaging: the reduction runs at 1 km so each 0.1 degree IMERG cell
counts in proportion to the area it covers inside the polygon. At native
scale only pixel centres would count, and the smallest upazilas (about
110 km2, i.e. one IMERG cell) could come back empty.

Days are UTC days (IMERG time stamps are UTC).

Output, committed so the analysis reruns without Earth Engine:
    data-pipeline/data/raw/gpm/gpm_imerg_daily_<upazila>.csv   date, precip_mm

Run (needs an Earth Engine-enabled Google Cloud project):
    python data-pipeline/climate/fetch_gpm_imerg.py --project <cloud-project-id>
    (or set EE_PROJECT)
"""

from __future__ import annotations

import argparse
import json
import os
import time
from datetime import date
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
POLYGONS = ROOT / "data-pipeline" / "reference" / "feni_upazilas.geojson"
CACHE_DIR = ROOT / "data-pipeline" / "data" / "raw" / "gpm"

COLLECTION = "NASA/GPM_L3/IMERG_V07"
BAND = "precipitation"
HALF_HOUR = 0.5
REDUCE_SCALE_M = 1000
FIRST_YEAR = 2000  # IMERG starts June 2000


def cache_path(upazila: str) -> Path:
    return CACHE_DIR / f"gpm_imerg_daily_{upazila.lower().replace(' ', '_')}.csv"


def read_gpm_csv(path: Path) -> pd.Series:
    frame = pd.read_csv(path, parse_dates=["date"]).set_index("date").sort_index()
    return frame["precip_mm"]


def upazila_features(ee):
    data = json.loads(POLYGONS.read_text(encoding="utf-8"))
    return ee.FeatureCollection(
        [ee.Feature(ee.Geometry(f["geometry"]), {"upazila": f["properties"]["upazila"]}) for f in data["features"]]
    )


def fetch_period(ee, regions, start: str, end: str) -> list[dict]:
    """Daily area-mean rainfall for all upazilas between start (incl.) and end (excl.)."""

    collection = ee.ImageCollection(COLLECTION).select(BAND)
    start_date = ee.Date(start)
    n_days = ee.Date(end).difference(start_date, "day").int()

    def daily(offset):
        day = start_date.advance(offset, "day")
        image = collection.filterDate(day, day.advance(1, "day")).sum().multiply(HALF_HOUR)
        return image.rename("precip_mm").set("date", day.format("YYYY-MM-dd"))

    days = ee.ImageCollection(ee.List.sequence(0, n_days.subtract(1)).map(daily))

    def reduce(image):
        return image.reduceRegions(
            collection=regions, reducer=ee.Reducer.mean(), scale=REDUCE_SCALE_M
        ).map(lambda f: f.set("date", image.get("date")))

    features = days.map(reduce).flatten().getInfo()["features"]

    return [
        {
            "upazila": f["properties"]["upazila"],
            "date": f["properties"]["date"],
            "precip_mm": f["properties"].get("mean"),
        }
        for f in features
    ]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", default=os.environ.get("EE_PROJECT"))
    parser.add_argument("--start-year", type=int, default=FIRST_YEAR)
    args = parser.parse_args()

    if not args.project:
        raise SystemExit("Give an Earth Engine Cloud project: --project <id> or EE_PROJECT=<id>")

    import ee

    ee.Initialize(project=args.project)
    regions = upazila_features(ee)
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    rows: list[dict] = []
    today = date.today()

    for year in range(args.start_year, today.year + 1):
        # Quarters keep each request well inside Earth Engine's limits.
        for q_start, q_end in (("01-01", "04-01"), ("04-01", "07-01"), ("07-01", "10-01"), ("10-01", None)):
            start = f"{year}-{q_start}"
            end = f"{year}-{q_end}" if q_end else f"{year + 1}-01-01"

            if date.fromisoformat(start) > today:
                break

            for attempt in range(4):
                try:
                    rows.extend(fetch_period(ee, regions, start, min(end, today.isoformat())))
                    break
                except Exception as error:  # noqa: BLE001 - retry transient EE errors
                    print(f"  retry {start} ({attempt + 1}): {error}")
                    time.sleep(15 * (attempt + 1))
            else:
                raise RuntimeError(f"Failed {start} to {end}")

        print(f"[OK] {year}")

    frame = pd.DataFrame(rows)
    frame["date"] = pd.to_datetime(frame["date"])

    for upazila, group in frame.groupby("upazila"):
        group = group.sort_values("date")[["date", "precip_mm"]]
        # IMERG has no data before 2000-06-01; empty days come back as null.
        group = group.dropna(subset=["precip_mm"])
        group.to_csv(cache_path(upazila), index=False, float_format="%.3f")
        print(f"[OK] {upazila}: {len(group)} days, {group['date'].min():%Y-%m-%d} to {group['date'].max():%Y-%m-%d}")


if __name__ == "__main__":
    main()
