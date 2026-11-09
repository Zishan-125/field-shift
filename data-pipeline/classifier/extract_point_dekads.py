"""
FIELD SHIFT — dekad (10-day) satellite composites at the classifier points

For every point in data-pipeline/reference/classifier_points.csv (or the
demo fields with --fields) and every dekad (days 1-10, 11-20, 21-end of each
month) from START to END:

    NDVI, EVI, LSWI  median of clear HLS L30 + S30 v002 pixels (Fmask bits
                     0-4 masked, the same mask as fields/extract_field_timeseries.py;
                     negative reflectance clamped to 0 first)
    n_clear          number of clear HLS pixel-observations in the dekad
    VV, VH           Sentinel-1 GRD IW mean backscatter, dB (mean in linear
                     power, both orbit directions pooled)
    rain_mm          GPM IMERG V07 dekad total (half-hours x 0.5 h)
    sm_rootzone      SMAP L4 SPL4SMGP/008 dekad mean, m3/m3

Values are the mean over a 30 m square centred on the point (one HLS
pixel, nine S1 pixels). A dekad with no clear HLS pixel is left empty
(NaN). Nothing is interpolated here; smoothing and gap handling happen in
classifier/features.py and are documented there.

Output (committed; the model reruns without Earth Engine):
    data-pipeline/data/processed/classifier_dekads.csv      (points)
    data-pipeline/data/processed/demo_field_dekads.csv      (--fields)
    columns: point_id, dekad_start, NDVI, EVI, LSWI, n_clear, VV, VH, rain_mm, sm_rootzone

Run:
    python data-pipeline/classifier/extract_point_dekads.py
    python data-pipeline/classifier/extract_point_dekads.py --fields
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
POINTS = ROOT / "data-pipeline" / "reference" / "classifier_points.csv"
FIELDS = ROOT / "data-pipeline" / "reference" / "fields.geojson"
OUT = ROOT / "data-pipeline" / "data" / "processed"

START = "2015-11-01"
END = "2026-01-01"
HLS_MASK = 0b11111      # Fmask bits 0-4: cirrus, cloud, adjacent, shadow, snow/ice
CHUNK = 300             # points per request
BANDS = ["NDVI", "EVI", "LSWI", "n_clear", "VV", "VH", "rain_mm", "sm_rootzone"]


def dekads(start: str, end: str) -> list[tuple[str, str]]:
    out = []
    for month in pd.date_range(start, end, freq="MS", inclusive="left"):
        last = (month + pd.offsets.MonthEnd(0)).day
        for a, b in ((1, 11), (11, 21), (21, last + 1)):
            s = month.replace(day=a)
            e = month.replace(day=b) if b <= last else month + pd.offsets.MonthBegin(1)
            out.append((s.strftime("%Y-%m-%d"), e.strftime("%Y-%m-%d")))
    return out


def hls_collection(ee, region):
    def prep(image, nir, swir):
        fmask = image.select("Fmask")
        clear = fmask.bitwiseAnd(HLS_MASK).eq(0)
        # Negative surface reflectance (noise over water) is clamped to 0 so
        # that flooded pixels give LSWI <= 1 instead of impossible values.
        blue, red = image.select("B2").max(0), image.select("B4").max(0)
        n, s = image.select(nir).max(0), image.select(swir).max(0)
        ndvi = n.subtract(red).divide(n.add(red)).rename("NDVI")
        evi = n.subtract(red).multiply(2.5).divide(
            n.add(red.multiply(6)).subtract(blue.multiply(7.5)).add(1)).rename("EVI")
        lswi = n.subtract(s).divide(n.add(s)).rename("LSWI")
        return ndvi.addBands([evi, lswi]).updateMask(clear).copyProperties(image, ["system:time_start"])

    l30 = ee.ImageCollection("NASA/HLS/HLSL30/v002").filterBounds(region).map(lambda i: prep(i, "B5", "B6"))
    s30 = ee.ImageCollection("NASA/HLS/HLSS30/v002").filterBounds(region).map(lambda i: prep(i, "B8A", "B11"))
    return l30.merge(s30)


def dekad_image(ee, hls, s1, gpm, smap, start: str, end: str):
    window = hls.filterDate(start, end)
    optical = window.median()
    n_clear = window.select("NDVI").count().rename("n_clear")
    empty_optical = ee.Image.constant([0, 0, 0]).rename(["NDVI", "EVI", "LSWI"]).updateMask(0)
    optical = ee.Image(ee.Algorithms.If(window.size().gt(0), optical, empty_optical))
    n_clear = ee.Image(ee.Algorithms.If(window.size().gt(0), n_clear, ee.Image.constant(0).rename("n_clear")))

    radar = s1.filterDate(start, end)
    linear = radar.map(lambda i: ee.Image(10).pow(i.divide(10)).copyProperties(i, ["system:time_start"])).mean()
    backscatter = linear.log10().multiply(10).rename(["VV", "VH"])
    empty_radar = ee.Image.constant([0, 0]).rename(["VV", "VH"]).updateMask(0)
    backscatter = ee.Image(ee.Algorithms.If(radar.size().gt(0), backscatter, empty_radar))

    rain = gpm.filterDate(start, end).sum().multiply(0.5).rename("rain_mm")
    soil = smap.filterDate(start, end)
    soil = ee.Image(ee.Algorithms.If(
        soil.size().gt(0), soil.mean(), ee.Image.constant(0).rename("sm_rootzone").updateMask(0)
    )).rename("sm_rootzone")

    return optical.addBands([n_clear, backscatter, rain, soil])


def retry(call, attempts: int = 5):
    for attempt in range(attempts):
        try:
            return call()
        except Exception as error:  # noqa: BLE001
            if attempt == attempts - 1:
                raise
            print(f"    retry ({attempt + 1}): {str(error)[:150]}")
            time.sleep(15 * (attempt + 1))


def load_targets(use_fields: bool) -> pd.DataFrame:
    if use_fields:
        features = json.loads(FIELDS.read_text(encoding="utf-8"))["features"]
        return pd.DataFrame([{
            "point_id": f["properties"]["field_id"], "lat": f["properties"]["center_lat"],
            "lon": f["properties"]["center_lon"],
        } for f in features])
    return pd.read_csv(POINTS)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", default=os.environ.get("EE_PROJECT", "field-shift-bd"))
    parser.add_argument("--fields", action="store_true", help="the six demo fields instead of the points")
    parser.add_argument("--start", default=START)
    parser.add_argument("--end", default=END)
    parser.add_argument("--out", help="output CSV (parallel runs write parts; merge with --merge)")
    parser.add_argument("--merge", nargs="+", help="merge part files into the default output and exit")
    args = parser.parse_args()

    if args.merge:
        output = OUT / ("demo_field_dekads.csv" if args.fields else "classifier_dekads.csv")
        frame = pd.concat([pd.read_csv(f) for f in args.merge], ignore_index=True)
        frame = frame.drop_duplicates(["point_id", "dekad_start"]).sort_values(["point_id", "dekad_start"])
        frame.to_csv(output, index=False, float_format="%.5g")
        print(f"[OK] merged {len(frame)} rows -> {output}")
        return

    import ee

    ee.Initialize(project=args.project)

    targets = load_targets(args.fields)
    output = Path(args.out) if args.out else OUT / ("demo_field_dekads.csv" if args.fields else "classifier_dekads.csv")
    done = pd.read_csv(output) if output.exists() else pd.DataFrame(columns=["point_id", "dekad_start"])
    done_keys = set(zip(done["point_id"], done["dekad_start"]))

    squares = [
        ee.Feature(ee.Geometry.Point([r.lon, r.lat]).buffer(15).bounds(1), {"point_id": r.point_id})
        for r in targets.itertuples()
    ]
    region = ee.FeatureCollection(squares).geometry().bounds(1)

    hls = hls_collection(ee, region)
    s1 = (
        ee.ImageCollection("COPERNICUS/S1_GRD").filterBounds(region)
        .filter(ee.Filter.eq("instrumentMode", "IW"))
        .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VV"))
        .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VH"))
        .select(["VV", "VH"])
    )
    gpm = ee.ImageCollection("NASA/GPM_L3/IMERG_V07").select("precipitation")
    smap = ee.ImageCollection("NASA/SMAP/SPL4SMGP/008").select("sm_rootzone")

    rows = []
    all_dekads = [d for d in dekads(args.start, args.end) if date.fromisoformat(d[0]) <= date.today()]

    for i, (start, end) in enumerate(all_dekads):
        pending = [s for s, pid in zip(squares, targets["point_id"]) if (pid, start) not in done_keys]
        if not pending:
            continue

        image = dekad_image(ee, hls, s1, gpm, smap, start, end)
        for c in range(0, len(pending), CHUNK):
            chunk = ee.FeatureCollection(pending[c:c + CHUNK])
            result = retry(lambda: image.reduceRegions(chunk, ee.Reducer.mean(), scale=10, tileScale=4).getInfo())
            for feature in result["features"]:
                p = feature["properties"]
                rows.append({"point_id": p["point_id"], "dekad_start": start, **{b: p.get(b) for b in BANDS}})

        if (i + 1) % 9 == 0 or i == len(all_dekads) - 1:
            frame = pd.concat([done, pd.DataFrame(rows)], ignore_index=True)
            frame.to_csv(output, index=False, float_format="%.5g")
            print(f"[OK] up to {start}: {len(frame)} rows", flush=True)

    frame = pd.concat([done, pd.DataFrame(rows)], ignore_index=True).sort_values(["point_id", "dekad_start"])
    frame.to_csv(output, index=False, float_format="%.5g")
    print(f"[OK] {len(frame)} rows -> {output}")


if __name__ == "__main__":
    main()
