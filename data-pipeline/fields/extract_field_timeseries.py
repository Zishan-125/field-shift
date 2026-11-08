"""
FIELD SHIFT — satellite time series for the demo fields (2015 to present)

For each field in data-pipeline/reference/fields.geojson (90 m squares):

    HLS L30 + S30 v002 (30 m)  NDVI, EVI, LSWI per clear acquisition; Fmask
                               bits 0-4 (cirrus, cloud, adjacent, shadow,
                               snow) masked per pixel, water kept (flooding is
                               signal). Negative reflectance clamped to 0.
                               An acquisition counts only if >= 50 % of the
                               field's pixels are clear.
    MODIS MOD13Q1 (250 m)      NDVI, EVI (16-day); SummaryQA kept as qc
    MODIS MOD11A2 (1 km)       LST day, C (8-day); QC_Day bits 0-1 kept as qc
    SMAP SPL4SMGP/008 (9 km)   root-zone soil moisture, m3/m3, daily mean of
                               the 3-hourly product
    GPM IMERG V07 (0.1 deg)    daily rainfall, mm (UTC days); qc = half-hours
                               present (of 48); short days scaled as in the
                               NASA daily product, < 36 dropped
    Sentinel-1 GRD IW (10 m)   VV, VH in dB (field mean in linear power), with
                               orbit pass and relative orbit

Output, one tidy long-format CSV per field (committed):
    data-pipeline/data/processed/<field_id>.csv
    columns: field_id, date, source, variable, value, n_pixels, n_valid, qc, orbit

Run:
    python data-pipeline/fields/extract_field_timeseries.py --field feni_feni_sadar_01
    python data-pipeline/fields/extract_field_timeseries.py --all
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "data-pipeline"))

FIELDS = ROOT / "data-pipeline" / "reference" / "fields.geojson"
OUT_DIR = ROOT / "data-pipeline" / "data" / "processed"
GPM_CACHE = ROOT / "data-pipeline" / "data" / "raw" / "gpm" / "fields"

START_YEAR = 2015
HLS_MASK_BITS = (0, 1, 2, 3, 4)   # cirrus, cloud, adjacent to cloud/shadow, cloud shadow, snow/ice
HLS_MIN_CLEAR_SHARE = 0.5
HLS_TILE_PREFIX = "T46Q"          # MGRS tiles over Feni; HLS S30 footprints in EE are unreliable


def load_fields() -> list[dict]:
    return json.loads(FIELDS.read_text(encoding="utf-8"))["features"]


def retry(call, attempts: int = 4):
    for attempt in range(attempts):
        try:
            return call()
        except Exception as error:  # noqa: BLE001 - transient Earth Engine errors
            if attempt == attempts - 1:
                raise
            print(f"    retry ({attempt + 1}): {str(error)[:120]}")
            time.sleep(10 * (attempt + 1))


def region_frame(collection, geometry, scale: int) -> pd.DataFrame:
    """Earth Engine getRegion as a DataFrame (one row per pixel and image)."""

    rows = retry(lambda: collection.getRegion(geometry, scale).getInfo())
    frame = pd.DataFrame(rows[1:], columns=rows[0])
    frame["date"] = pd.to_datetime(frame["time"], unit="ms").dt.normalize()
    return frame


def years() -> list[tuple[str, str]]:
    today = date.today()
    return [(f"{y}-01-01", f"{y + 1}-01-01") for y in range(START_YEAR, today.year + 1)]


# ---------------------------------------------------------------------
# HLS
# ---------------------------------------------------------------------

HLS = {
    "NASA/HLS/HLSL30/v002": {"blue": "B2", "red": "B4", "nir": "B5", "swir1": "B6"},
    "NASA/HLS/HLSS30/v002": {"blue": "B2", "red": "B4", "nir": "B8A", "swir1": "B11"},
}


def hls(ee, field_id: str, square) -> list[dict]:
    rows = []

    for collection_id, bands in HLS.items():
        sensor = collection_id.split("/")[2]
        names = list(bands.values()) + ["Fmask"]

        for start, end in years():
            collection = (
                ee.ImageCollection(collection_id)
                .filterBounds(square)
                .filter(ee.Filter.stringStartsWith("system:index", HLS_TILE_PREFIX))
                .filterDate(start, end)
                .select(names)
            )
            frame = region_frame(collection, square, 30)

            if frame.empty:
                continue

            fmask = frame["Fmask"].fillna(255).astype(int).to_numpy()
            bad = np.zeros(len(frame), dtype=bool)
            for bit in HLS_MASK_BITS:
                bad |= (fmask >> bit) & 1 == 1
            has_data = frame[bands["red"]].notna() & frame[bands["nir"]].notna()
            frame["clear"] = has_data & ~pd.Series(bad, index=frame.index)

            # Negative surface reflectance (noise over water) clamped to 0, so a
            # flooded field gives LSWI <= 1 rather than an impossible value.
            blue, red, nir, swir = (frame[bands[k]].clip(lower=0) for k in ("blue", "red", "nir", "swir1"))
            frame["NDVI"] = (nir - red) / (nir + red)
            frame["EVI"] = 2.5 * (nir - red) / (nir + 6 * red - 7.5 * blue + 1)
            frame["LSWI"] = (nir - swir) / (nir + swir)

            # Overlapping tiles give the same date twice: pool their pixels.
            for day, group in frame[has_data].groupby("date"):
                clear = group[group["clear"]]
                share = len(clear) / len(group)

                if share < HLS_MIN_CLEAR_SHARE:
                    continue

                for variable in ("NDVI", "EVI", "LSWI"):
                    rows.append({
                        "field_id": field_id, "date": day, "source": sensor, "variable": variable,
                        "value": float(clear[variable].mean()), "n_pixels": len(group),
                        "n_valid": len(clear), "qc": round(share, 3), "orbit": None,
                    })

    return rows


# ---------------------------------------------------------------------
# MODIS, SMAP, Sentinel-1
# ---------------------------------------------------------------------

def modis(ee, field_id: str, square) -> list[dict]:
    rows = []
    centre = square.centroid(1)

    for start, end in years():
        ndvi = region_frame(
            ee.ImageCollection("MODIS/061/MOD13Q1").filterDate(start, end).select(["NDVI", "EVI", "SummaryQA"]),
            centre, 250,
        )
        for _, r in ndvi.iterrows():
            for variable in ("NDVI", "EVI"):
                if pd.notna(r[variable]):
                    rows.append({
                        "field_id": field_id, "date": r["date"], "source": "MOD13Q1", "variable": variable,
                        "value": float(r[variable]) * 0.0001, "n_pixels": 1, "n_valid": 1,
                        "qc": int(r["SummaryQA"]) if pd.notna(r["SummaryQA"]) else None, "orbit": None,
                    })

        lst = region_frame(
            ee.ImageCollection("MODIS/061/MOD11A2").filterDate(start, end).select(["LST_Day_1km", "QC_Day"]),
            centre, 1000,
        )
        for _, r in lst.iterrows():
            if pd.notna(r["LST_Day_1km"]):
                rows.append({
                    "field_id": field_id, "date": r["date"], "source": "MOD11A2", "variable": "LST_day_C",
                    "value": float(r["LST_Day_1km"]) * 0.02 - 273.15, "n_pixels": 1, "n_valid": 1,
                    "qc": int(r["QC_Day"]) & 0b11 if pd.notna(r["QC_Day"]) else None, "orbit": None,
                })

    return rows


def smap(ee, field_id: str, square) -> list[dict]:
    rows = []
    centre = square.centroid(1)

    # 8 images a day: one getRegion per quarter stays inside EE's memory limit.
    for start, _ in years():
        y = start[:4]
        for q_start, q_end in (("01-01", "04-01"), ("04-01", "07-01"), ("07-01", "10-01"), ("10-01", None)):
            q_from = f"{y}-{q_start}"
            if date.fromisoformat(q_from) > date.today():
                break
            q_to = f"{y}-{q_end}" if q_end else f"{int(y) + 1}-01-01"
            rows += smap_rows(ee, field_id, centre, q_from, q_to)

    return rows


def smap_rows(ee, field_id: str, centre, start: str, end: str) -> list[dict]:
    rows = []
    collection = ee.ImageCollection("NASA/SMAP/SPL4SMGP/008").filterDate(start, end).select(["sm_rootzone"])
    if retry(lambda: collection.size().getInfo()) == 0:
        return rows
    frame = region_frame(collection, centre, 11000)
    daily = frame.dropna(subset=["sm_rootzone"]).groupby("date")["sm_rootzone"].agg(["mean", "count"])
    for day, r in daily.iterrows():
        rows.append({
            "field_id": field_id, "date": day, "source": "SPL4SMGP_008", "variable": "sm_rootzone",
            "value": float(r["mean"]), "n_pixels": 1, "n_valid": int(r["count"]), "qc": None, "orbit": None,
        })

    return rows


def sentinel1(ee, field_id: str, square) -> list[dict]:
    rows = []

    for start, end in years():
        collection = (
            ee.ImageCollection("COPERNICUS/S1_GRD")
            .filterBounds(square)
            .filterDate(start, end)
            .filter(ee.Filter.eq("instrumentMode", "IW"))
            .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VV"))
            .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VH"))
        )
        info = retry(lambda: collection.aggregate_array("system:index").getInfo())
        if not info:
            continue

        orbits = dict(zip(info, retry(lambda: collection.aggregate_array("orbitProperties_pass").getInfo())))
        relative = dict(zip(info, retry(lambda: collection.aggregate_array("relativeOrbitNumber_start").getInfo())))
        frame = region_frame(collection.select(["VV", "VH"]), square, 10)

        for (image_id, day), group in frame.groupby(["id", "date"]):
            for band in ("VV", "VH"):
                values = group[band].dropna()
                if values.empty:
                    continue
                linear = np.power(10, values / 10).mean()
                rows.append({
                    "field_id": field_id, "date": day, "source": "S1_GRD", "variable": band,
                    "value": float(10 * np.log10(linear)), "n_pixels": len(group), "n_valid": len(values),
                    "qc": None, "orbit": f"{orbits.get(image_id, '')[:3]}{relative.get(image_id, '')}",
                })

    return rows


# ---------------------------------------------------------------------
# GPM (all fields at once, daily)
# ---------------------------------------------------------------------

def gpm(ee, features: list[dict]) -> list[dict]:
    from climate.fetch_gpm_imerg import fetch_period

    regions = ee.FeatureCollection([
        ee.Feature(ee.Geometry(f["geometry"]).centroid(1).buffer(500), {"upazila": f["properties"]["field_id"]})
        for f in features
    ])
    rows = []

    for start, end in years():
        for q_start, q_end in (("01-01", "04-01"), ("04-01", "07-01"), ("07-01", "10-01"), ("10-01", None)):
            s = f"{start[:4]}-{q_start}"
            e = f"{start[:4]}-{q_end}" if q_end else end
            if date.fromisoformat(s) > date.today():
                break
            for r in retry(lambda: fetch_period(ee, regions, s, min(e, date.today().isoformat()))):
                if r["precip_mm"] is not None:
                    rows.append({
                        "field_id": r["upazila"], "date": pd.Timestamp(r["date"]), "source": "GPM_IMERG_V07",
                        "variable": "precip_mm", "value": float(r["precip_mm"]), "n_pixels": 1, "n_valid": 1,
                        "qc": None, "orbit": None,
                    })

    return rows


def scale_incomplete_days(rain: pd.DataFrame) -> pd.DataFrame:
    """Same rule as climate.fetch_gpm_imerg.read_gpm_csv: qc = half-hours present."""

    from climate.fetch_gpm_imerg import HALFHOURS_FILE, MIN_HALFHOURS

    counts = pd.read_csv(HALFHOURS_FILE, parse_dates=["date"]).set_index("date")["n_halfhours"]
    n = rain["date"].map(counts).fillna(48)
    rain = rain.assign(value=rain["value"].where(n >= 48, rain["value"] * 48 / n.clip(lower=1)), qc=n.astype(int))
    return rain[n >= MIN_HALFHOURS]


# ---------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--field", action="append", help="field_id (repeatable)")
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--project", default=os.environ.get("EE_PROJECT", "field-shift-bd"))
    args = parser.parse_args()

    import ee

    ee.Initialize(project=args.project)

    features = load_fields()
    if not args.all:
        features = [f for f in features if f["properties"]["field_id"] in (args.field or [])]
    if not features:
        raise SystemExit("No fields selected (--field <id> or --all)")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    GPM_CACHE.mkdir(parents=True, exist_ok=True)
    missing = [f for f in features if not (GPM_CACHE / f"{f['properties']['field_id']}.csv").exists()]
    if missing:
        fetched = pd.DataFrame(gpm(ee, missing))
        for field_id, group in fetched.groupby("field_id"):
            group.to_csv(GPM_CACHE / f"{field_id}.csv", index=False, float_format="%.4g")
    rain = pd.concat(
        [pd.read_csv(GPM_CACHE / f"{f['properties']['field_id']}.csv", parse_dates=["date"]) for f in features],
        ignore_index=True,
    )
    rain = scale_incomplete_days(rain)
    print(f"[OK] GPM: {len(rain)} rows")

    for feature in features:
        field_id = feature["properties"]["field_id"]
        square = ee.Geometry(feature["geometry"])
        rows = []

        for name, extract in (("HLS", hls), ("MODIS", modis), ("SMAP", smap), ("S1", sentinel1)):
            started = time.time()
            part = extract(ee, field_id, square)
            print(f"  {field_id} {name}: {len(part)} rows ({time.time() - started:.0f} s)")
            rows += part

        frame = pd.concat([pd.DataFrame(rows), rain[rain["field_id"] == field_id]], ignore_index=True)
        frame["date"] = pd.to_datetime(frame["date"]).dt.strftime("%Y-%m-%d")
        frame = frame.sort_values(["source", "variable", "date"])
        frame.to_csv(OUT_DIR / f"{field_id}.csv", index=False, float_format="%.5g")
        print(f"[OK] {field_id}: {len(frame)} rows -> {OUT_DIR / (field_id + '.csv')}")


if __name__ == "__main__":
    main()
