"""
Shared plumbing for ingest_smap.py, ingest_modis_ndvi.py,
ingest_gpm_rainfall.py, ingest_ecostress.py, and ingest_grace_fo.py.

Why this file exists: those five scripts each do the exact same three
things — connect to Earth Engine, fetch the field list from the
backend, and compute a windowed regional mean — for one dataset each.
Writing that logic five times means five places to fix the same bug.
Writing it once here means each ingest_*.py file is small enough to
read in ten seconds and trust: dataset ID, band name, done.

This intentionally overlaps in *logic* with
data-pipeline/gee_field_clip.py (which also computes regional means
over date windows) — that overlap is fine because the two tools serve
different operational purposes: gee_field_clip.py does a full
multi-year, multi-dataset export for ML training; these scripts do a
narrow, single-dataset backfill for ops/debugging. If you find
yourself editing the region-mean math, change it here AND in
gee_field_clip.py, or better, promote this file to be the one both
import from.
"""

import argparse
import json
from datetime import date, datetime, timedelta

import ee
import httpx

BACKEND_URL_DEFAULT = "http://localhost:8000"


def init_earth_engine(service_account_json_path: str) -> None:
    with open(service_account_json_path) as f:
        info = json.load(f)
    credentials = ee.ServiceAccountCredentials(email=info["client_email"], key_file=service_account_json_path)
    ee.Initialize(credentials)


def fetch_fields(backend_url: str, field_id: str | None) -> list[dict]:
    """
    Pulls field polygons from the backend's own /api/v1/fields
    endpoint — same reasoning as gee_field_clip.py: this script stays
    correct even if the Field table's columns change later, since it
    only depends on the public API contract, not the database schema.
    """
    with httpx.Client(base_url=backend_url, timeout=30.0) as client:
        if field_id:
            response = client.get(f"/api/v1/fields/{field_id}")
            response.raise_for_status()
            return [response.json()]
        response = client.get("/api/v1/fields")
        response.raise_for_status()
        return response.json()


def date_windows(start: str, end: str, step_days: int) -> list[tuple[str, str]]:
    start_date = date.fromisoformat(start)
    end_date = date.fromisoformat(end)
    windows = []
    current = start_date
    while current < end_date:
        window_end = min(current + timedelta(days=step_days), end_date)
        windows.append((current.isoformat(), window_end.isoformat()))
        current = window_end
    return windows


def region_mean(collection_id: str, band: str, geom: "ee.Geometry", start: str, end: str) -> float | None:
    image = ee.ImageCollection(collection_id).filterDate(start, end).filterBounds(geom).select(band).mean()
    stats = image.reduceRegion(reducer=ee.Reducer.mean(), geometry=geom, scale=1000, maxPixels=1e9)
    value = stats.get(band).getInfo()
    return float(value) if value is not None else None


def default_date_range(days_back: int) -> tuple[str, str]:
    end = datetime.utcnow().date()
    start = end - timedelta(days=days_back)
    return start.isoformat(), end.isoformat()


def build_arg_parser(description: str) -> argparse.ArgumentParser:
    """Every ingest_*.py shares the same four flags — defined once so
    `--help` output is consistent across all five scripts."""
    parser = argparse.ArgumentParser(description=description)
    parser.add_argument("--start-date", help="YYYY-MM-DD. Defaults to 30 days before --end-date.")
    parser.add_argument("--end-date", default=datetime.utcnow().date().isoformat(), help="YYYY-MM-DD. Defaults to today.")
    parser.add_argument("--field-id", help="Backfill a single field only. Omit to run for every field.")
    parser.add_argument("--step-days", type=int, default=16, help="Window size per data point. Defaults to 16 (MODIS's native cadence).")
    parser.add_argument("--service-account-json", default=".gee_service_account.json")
    parser.add_argument("--backend-url", default=BACKEND_URL_DEFAULT)
    parser.add_argument("--output", default=None, help="Output CSV path. Defaults to data-pipeline/output/<dataset>_backfill.csv")
    return parser