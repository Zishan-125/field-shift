"""
FIELD SHIFT — fetch NASA POWER daily history for the Feni upazilas

Downloads NASA POWER daily point data (community AG) from 1984-01-01 to the
latest available day for the centroid of each Feni upazila
(data-pipeline/reference/feni_upazila_centroids.csv) and caches the raw API
responses (CSV format, header included) under data-pipeline/data/raw/power/.
The cached files are committed so the analysis reruns offline.

NASA POWER is a reanalysis / satellite-model product (meteorology from
MERRA-2, solar from CERES/GEWEX), not a rain-gauge or station record.

Run (internet needed only to refresh the cache):
    python data-pipeline/climate/fetch_power_history.py            # missing files only
    python data-pipeline/climate/fetch_power_history.py --refresh  # re-download all
"""

from __future__ import annotations

import argparse
import csv
import io
import sys
import time
from datetime import date
from pathlib import Path

import pandas as pd
import requests

ROOT = Path(__file__).resolve().parents[2]
CENTROIDS = ROOT / "data-pipeline" / "reference" / "feni_upazila_centroids.csv"
CACHE_DIR = ROOT / "data-pipeline" / "data" / "raw" / "power"

API = "https://power.larc.nasa.gov/api/temporal/daily/point"
COMMUNITY = "AG"
START = "19840101"
PARAMETERS = [
    "T2M",
    "T2M_MAX",
    "T2M_MIN",
    "PRECTOTCORR",
    "RH2M",
    "WS2M",
    "ALLSKY_SFC_SW_DWN",
    "GWETROOT",
    "GWETTOP",
]
FILL_VALUE = -999


def cache_path(upazila: str) -> Path:
    return CACHE_DIR / f"power_daily_{upazila.lower().replace(' ', '_')}.csv"


def load_centroids() -> list[dict]:
    with open(CENTROIDS, newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def fetch(latitude: float, longitude: float, end: str) -> str:
    params = {
        "parameters": ",".join(PARAMETERS),
        "community": COMMUNITY,
        "latitude": latitude,
        "longitude": longitude,
        "start": START,
        "end": end,
        "format": "CSV",
    }

    for attempt in range(4):
        response = requests.get(API, params=params, timeout=300)

        if response.status_code == 200:
            return response.text

        time.sleep(10 * (attempt + 1))

    response.raise_for_status()
    return ""


def read_power_csv(path: Path) -> pd.DataFrame:
    """Parse a cached POWER CSV (skips the header block, drops fill values)."""

    text = path.read_text(encoding="utf-8")
    body = text.split("-END HEADER-", 1)[1].lstrip()
    frame = pd.read_csv(io.StringIO(body))
    frame["date"] = pd.to_datetime(
        frame["YEAR"].astype(str) + frame["DOY"].astype(str).str.zfill(3),
        format="%Y%j",
    )
    frame[PARAMETERS] = frame[PARAMETERS].astype(float).where(frame[PARAMETERS] > FILL_VALUE)

    # Trailing days not yet published come back as fill values in every column.
    complete = frame[PARAMETERS].notna().any(axis=1)
    last = complete[complete].index.max()

    return frame.loc[:last].set_index("date")[PARAMETERS].astype(float)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--refresh", action="store_true")
    args = parser.parse_args()

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    end = date.today().strftime("%Y%m%d")

    for row in load_centroids():
        path = cache_path(row["upazila"])

        if path.exists() and not args.refresh:
            print(f"[cache] {path.name}")
            continue

        print(f"[fetch] {row['upazila']} ({row['latitude']}, {row['longitude']}) {START}-{end}")
        text = fetch(float(row["latitude"]), float(row["longitude"]), end)
        path.write_text(text, encoding="utf-8")

        frame = read_power_csv(path)
        print(f"        {len(frame)} days, {frame.index.min():%Y-%m-%d} to {frame.index.max():%Y-%m-%d}")

    print("[OK] cache:", CACHE_DIR)


if __name__ == "__main__":
    sys.exit(main())
