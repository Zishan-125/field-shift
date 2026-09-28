"""
Before writing this, it's worth being explicit about something I
flagged earlier and you haven't resolved yet: this file is NOT five
separate ingest_smap.py / ingest_modis_ndvi.py / ... scripts, and I
didn't write those. Here's why.

backend/app/services/nasa_data_service.py already pulls SMAP, MODIS,
GPM, ECOSTRESS and GRACE-FO from Earth Engine — live, for one field,
for the current 2-4 week window, whenever a farmer opens the
dashboard or texts STATUS. Writing five more scripts that pull the
same five datasets the same way would just be that logic duplicated
in two places that will drift out of sync the first time either one
changes.

What data-pipeline/ actually needs to do is a DIFFERENT job: pull
YEARS of history, for MANY fields at once, in bulk, offline — because
that's what ml-models/stress_risk_model.py and shift_score_model.py
need to train against, and it's not something you'd ever want to run
inside a live API request. That's what this file is.

Run it as: python data-pipeline/gee_field_clip.py --years 5
"""

import argparse
import asyncio
import csv
import json
import sys
from datetime import date, timedelta
from pathlib import Path

import ee
import httpx

# Datasets + bands, matching nasa_data_service.py exactly so a model
# trained on this export sees the same signals the live API computes.
DATASETS = {
    "SMAP": ("NASA/SMAP/SPL4SMGP/007", "sm_rootzone"),
    "MODIS": ("MODIS/061/MOD13Q1", "NDVI"),
    "GPM": ("NASA/GPM_L3/IMERG_MONTHLY_V07", "precipitation"),
    "ECOSTRESS": ("NASA/ECOSTRESS/ESI/L4/ESI_PT_JPL", "ESI"),
    "GRACE-FO": ("NASA/GRACE/MASS_GRIDS_V04/LAND", "lwe_thickness_csr"),
}

STEP_DAYS = 16  # one export point roughly every 16 days (matches MODIS's native cadence)
BACKEND_URL = "http://localhost:8000"  # override with --backend-url if not running via Docker Compose


def init_earth_engine(service_account_json_path: str) -> None:
    with open(service_account_json_path) as f:
        info = json.load(f)
    credentials = ee.ServiceAccountCredentials(email=info["client_email"], key_file=service_account_json_path)
    ee.Initialize(credentials)


async def fetch_fields_from_backend(backend_url: str) -> list[dict]:
    """
    Reuses the backend's own /api/v1/fields endpoint rather than
    connecting to Postgres directly — this script then works
    correctly no matter how the Field table evolves, since it only
    depends on the same public API contract the frontend already
    relies on.
    """
    async with httpx.AsyncClient(base_url=backend_url, timeout=30.0) as client:
        response = await client.get("/api/v1/fields")
        response.raise_for_status()
        return response.json()


def _date_steps(start: date, end: date, step_days: int) -> list[tuple[str, str]]:
    steps = []
    current = start
    while current < end:
        window_end = min(current + timedelta(days=step_days), end)
        steps.append((current.isoformat(), window_end.isoformat()))
        current = window_end
    return steps


def _region_mean(collection_id: str, band: str, geom: "ee.Geometry", start: str, end: str) -> float | None:
    image = ee.ImageCollection(collection_id).filterDate(start, end).filterBounds(geom).select(band).mean()
    stats = image.reduceRegion(reducer=ee.Reducer.mean(), geometry=geom, scale=1000, maxPixels=1e9)
    value = stats.get(band).getInfo()
    return float(value) if value is not None else None


def export_field_history(field: dict, years: int, output_dir: Path) -> Path:
    """
    Writes one CSV per field: date, dataset, value. Long/tidy format
    (rather than one wide row per date) so ml-models/notebooks can
    pivot however each model needs without re-exporting.
    """
    geom = ee.Geometry(field["geojson_polygon"])
    end = date.today()
    start = end.replace(year=end.year - years)

    output_path = output_dir / f"field_{field['id']}_history.csv"
    with open(output_path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["field_id", "date", "dataset", "value"])

        for window_start, window_end in _date_steps(start, end, STEP_DAYS):
            for dataset_name, (collection_id, band) in DATASETS.items():
                try:
                    value = _region_mean(collection_id, band, geom, window_start, window_end)
                except ee.EEException as exc:
                    print(f"  [skip] {field['id']} {dataset_name} {window_start}: {exc}", file=sys.stderr)
                    continue
                if value is not None:
                    writer.writerow([field["id"], window_start, dataset_name, value])

    return output_path


async def main(years: int, service_account_json_path: str, backend_url: str, output_dir: Path) -> None:
    init_earth_engine(service_account_json_path)
    output_dir.mkdir(parents=True, exist_ok=True)

    fields = await fetch_fields_from_backend(backend_url)
    print(f"Exporting {years}-year history for {len(fields)} field(s)...")

    for field in fields:
        path = export_field_history(field, years, output_dir)
        print(f"  wrote {path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--years", type=int, default=5, help="How many years of history to export per field")
    parser.add_argument("--service-account-json", default=".gee_service_account.json",
                         help="Path to the GEE service-account key file (not the inline env var)")
    parser.add_argument("--backend-url", default=BACKEND_URL)
    parser.add_argument("--output-dir", default="ml-models/data/raw", type=Path)
    args = parser.parse_args()

    asyncio.run(main(args.years, args.service_account_json, args.backend_url, args.output_dir))