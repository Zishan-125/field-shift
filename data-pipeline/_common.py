"""
Shared Earth Engine and backend utilities for the Field Shift data pipeline.

The ingestion scripts use this module for:
- Earth Engine authentication
- backend field retrieval
- date-window generation
- field-level spatial aggregation
- consistent CLI arguments

Dataset-specific temporal cadence and spatial resolution should remain
inside each ingestion script because NASA products do not share the same
resolution or revisit interval.
"""

import argparse
import json
import os
from datetime import date, datetime, timedelta
from pathlib import Path

import ee
import httpx
from dotenv import load_dotenv


BACKEND_URL_DEFAULT = "http://localhost:8000"



def init_earth_engine(
    service_account_json_path: str | None = None,
) -> None:
    """
    Initialize Google Earth Engine.

    Authentication priority:
    1. Explicit JSON file passed to --service-account-json
    2. GEE_SERVICE_ACCOUNT_JSON from .env
    """

    project_root = Path(__file__).resolve().parent.parent

    # Load the project's .env file.
    load_dotenv(project_root / ".env")

    info = None
    key_file = None

    # ---------------------------------------------------------------
    # Option 1: Explicit JSON service-account file
    # ---------------------------------------------------------------
    if service_account_json_path:
        path = Path(service_account_json_path)

        # Resolve relative paths from the project root.
        if not path.is_absolute():
            path = project_root / path

        if path.exists():
            with path.open(encoding="utf-8") as f:
                info = json.load(f)

            key_file = path

    # ---------------------------------------------------------------
    # Option 2: JSON stored in .env
    # ---------------------------------------------------------------
    if info is None:
        raw_json = os.getenv("GEE_SERVICE_ACCOUNT_JSON")

        if not raw_json:
            raise RuntimeError(
                "GEE_SERVICE_ACCOUNT_JSON was not found in .env "
                "and no valid service-account JSON file was provided."
            )

        try:
            info = json.loads(raw_json)
        except json.JSONDecodeError as exc:
            raise ValueError(
                "GEE_SERVICE_ACCOUNT_JSON in .env is not valid JSON."
            ) from exc

    required_keys = {
        "client_email",
        "private_key",
    }

    missing = required_keys - set(info.keys())

    if missing:
        raise ValueError(
            "Invalid Earth Engine service-account JSON. "
            f"Missing keys: {sorted(missing)}"
        )

    # ---------------------------------------------------------------
    # Initialize Earth Engine
    # ---------------------------------------------------------------

    if key_file:
        credentials = ee.ServiceAccountCredentials(
            email=info["client_email"],
            key_file=str(key_file),
        )
    else:
        credentials = ee.ServiceAccountCredentials(
            email=info["client_email"],
            key_data=info["private_key"],
        )

    ee.Initialize(credentials)

    print(
        f"[OK] Earth Engine initialized as: "
        f"{info['client_email']}"
    )

def fetch_fields(
    backend_url: str,
    field_id: str | None = None,
) -> list[dict]:
    """
    Fetch field polygons from the backend API.

    Expected endpoint:
        GET /api/v1/fields
        GET /api/v1/fields/{field_id}
    """

    with httpx.Client(
        base_url=backend_url.rstrip("/"),
        timeout=30.0,
    ) as client:

        if field_id:
            response = client.get(f"/api/v1/fields/{field_id}")
        else:
            response = client.get("/api/v1/fields")

        response.raise_for_status()

        data = response.json()

    if field_id:
        fields = [data]
    else:
        fields = data

    if not isinstance(fields, list):
        raise ValueError("Backend fields endpoint did not return a list.")

    print(f"[OK] Retrieved {len(fields)} field(s) from backend.")

    return fields


def date_windows(
    start: str,
    end: str,
    step_days: int,
) -> list[tuple[str, str]]:
    """
    Split [start, end) into fixed-length date windows.

    Example:
        2025-01-01 -> 2025-01-05, step=2

        [
            ("2025-01-01", "2025-01-03"),
            ("2025-01-03", "2025-01-05")
        ]
    """

    if step_days <= 0:
        raise ValueError("step_days must be greater than zero.")

    start_date = date.fromisoformat(start)
    end_date = date.fromisoformat(end)

    if start_date >= end_date:
        raise ValueError(
            f"Start date must be before end date: {start} >= {end}"
        )

    windows = []

    current = start_date

    while current < end_date:
        window_end = min(
            current + timedelta(days=step_days),
            end_date,
        )

        windows.append(
            (
                current.isoformat(),
                window_end.isoformat(),
            )
        )

        current = window_end

    return windows


def region_mean(
    collection_id: str,
    band: str,
    geom: "ee.Geometry",
    start: str,
    end: str,
    scale: int,
) -> float | None:
    """
    Calculate the spatial mean of the temporal mean of an Earth Engine
    ImageCollection.

    This is appropriate for products such as:
    - MODIS vegetation indices
    - SMAP soil moisture
    - ECOSTRESS indices
    - GRACE monthly anomalies

    Rainfall accumulation should NOT use this function.
    """

    collection = (
        ee.ImageCollection(collection_id)
        .filterDate(start, end)
        .filterBounds(geom)
        .select(band)
    )

    count = collection.size().getInfo()

    if count == 0:
        return None

    image = collection.mean()

    stats = image.reduceRegion(
        reducer=ee.Reducer.mean(),
        geometry=geom,
        scale=scale,
        maxPixels=1e9,
        bestEffort=True,
    )

    value = stats.get(band).getInfo()

    if value is None:
        return None

    return float(value)


def region_sum(
    collection_id: str,
    band: str,
    geom: "ee.Geometry",
    start: str,
    end: str,
    scale: int,
) -> float | None:
    """
    Calculate spatial mean of the temporal sum.

    Useful for quantities that are already expressed as an amount per
    image interval and need temporal accumulation.
    """

    collection = (
        ee.ImageCollection(collection_id)
        .filterDate(start, end)
        .filterBounds(geom)
        .select(band)
    )

    count = collection.size().getInfo()

    if count == 0:
        return None

    image = collection.sum()

    stats = image.reduceRegion(
        reducer=ee.Reducer.mean(),
        geometry=geom,
        scale=scale,
        maxPixels=1e9,
        bestEffort=True,
    )

    value = stats.get(band).getInfo()

    if value is None:
        return None

    return float(value)


def default_date_range(days_back: int) -> tuple[str, str]:
    """Return a UTC date range ending today."""

    if days_back <= 0:
        raise ValueError("days_back must be greater than zero.")

    end = datetime.utcnow().date()
    start = end - timedelta(days=days_back)

    return start.isoformat(), end.isoformat()


def build_arg_parser(
    description: str,
    default_step_days: int,
    default_days_back: int,
) -> argparse.ArgumentParser:
    """Build a consistent CLI parser for ingestion scripts."""

    parser = argparse.ArgumentParser(
        description=description
    )

    parser.add_argument(
        "--start-date",
        help="YYYY-MM-DD. If omitted, calculated from --days-back.",
    )

    parser.add_argument(
        "--end-date",
        default=datetime.utcnow().date().isoformat(),
        help="YYYY-MM-DD. Defaults to today.",
    )

    parser.add_argument(
        "--days-back",
        type=int,
        default=default_days_back,
        help=f"Days before --end-date when --start-date is omitted. "
             f"Default: {default_days_back}.",
    )

    parser.add_argument(
        "--field-id",
        help="Backfill one field only. Omit to process every field.",
    )

    parser.add_argument(
        "--step-days",
        type=int,
        default=default_step_days,
        help=f"Aggregation window size. Default: {default_step_days}.",
    )

    parser.add_argument(
    "--service-account-json",
    default=None,
    help=(
        "Optional path to Earth Engine service-account JSON. "
        "If omitted, GEE_SERVICE_ACCOUNT_JSON from .env is used."
    ),
)

    parser.add_argument(
        "--backend-url",
        default=BACKEND_URL_DEFAULT,
        help="Backend API base URL.",
    )

    parser.add_argument(
        "--output",
        default=None,
        help="Output CSV path.",
    )

    return parser