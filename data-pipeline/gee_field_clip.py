"""
Bulk historical Earth Engine exporter for ML training.

This script:
1. Gets field polygons from the backend.
2. Reads historical NASA Earth-observation datasets.
3. Calculates field-level temporal/spatial aggregates.
4. Writes tidy CSV files.

This is a PRE-DEPLOYMENT pipeline.

It should NOT be called by the live FastAPI request path.
"""

import argparse
import asyncio
import csv
import sys
from datetime import date
from pathlib import Path

import ee

from _common import (
    fetch_fields,
    init_earth_engine,
    date_windows,
    region_mean,
    region_sum,
)


# ---------------------------------------------------------------------
# Dataset configuration
# ---------------------------------------------------------------------

DATASETS = {
    "SMAP": {
        "collection": "NASA/SMAP/SPL4SMGP/008",
        "band": "sm_rootzone",
        "scale": 11000,
        "step_days": 7,
        "unit": "m3/m3",
    },

    "MODIS_NDVI": {
        "collection": "MODIS/061/MOD13Q1",
        "band": "NDVI",
        "scale": 250,
        "step_days": 16,
        "unit": "index",
    },

    "MODIS_EVI": {
        "collection": "MODIS/061/MOD13Q1",
        "band": "EVI",
        "scale": 250,
        "step_days": 16,
        "unit": "index",
    },

    "ECOSTRESS": {
        "collection": "NASA/ECOSTRESS/ESI/L4/ESI_PT_JPL",
        "band": "ESI",
        "scale": 1000,
        "step_days": 30,
        "unit": "index",
    },

    "GRACE": {
        "collection": "NASA/GRACE/MASS_GRIDS_V04/MASCON_CRI",
        "band": "lwe_thickness",
        "scale": 55660,
        "step_days": 30,
        "unit": "cm",
    },
}


GPM_COLLECTION = "NASA/GPM_L3/IMERG_V07"
GPM_BAND = "precipitation"
GPM_SCALE = 11132


def gpm_rainfall(
    geom: "ee.Geometry",
    start: str,
    end: str,
) -> float | None:
    """
    Calculate accumulated rainfall in mm.

    IMERG V07 precipitation is reported as a rate in mm/hr.
    The collection has 30-minute observations.

    Therefore:

        sum(rate) * 0.5 hours

    gives accumulated rainfall in mm.
    """

    collection = (
        ee.ImageCollection(GPM_COLLECTION)
        .filterDate(start, end)
        .filterBounds(geom)
        .select(GPM_BAND)
    )

    count = collection.size().getInfo()

    if count == 0:
        return None

    rainfall = collection.sum().multiply(0.5)

    stats = rainfall.reduceRegion(
        reducer=ee.Reducer.mean(),
        geometry=geom,
        scale=GPM_SCALE,
        maxPixels=1e9,
        bestEffort=True,
    )

    value = stats.get(GPM_BAND).getInfo()

    if value is None:
        return None

    return float(value)


def process_dataset(
    field: dict,
    dataset_name: str,
    config: dict,
    start: date,
    end: date,
    writer,
) -> int:

    geom = ee.Geometry(field["geojson_polygon"])

    windows = date_windows(
        start.isoformat(),
        end.isoformat(),
        config["step_days"],
    )

    rows_written = 0

    for window_start, window_end in windows:

        try:
            value = region_mean(
                collection_id=config["collection"],
                band=config["band"],
                geom=geom,
                start=window_start,
                end=window_end,
                scale=config["scale"],
            )

        except ee.EEException as exc:
            print(
                f"[WARN] {dataset_name} "
                f"{window_start}: {exc}",
                file=sys.stderr,
            )
            continue

        if value is None:
            continue

        # MODIS raw values have a scale factor of 0.0001.
        if dataset_name in {"MODIS_NDVI", "MODIS_EVI"}:
            value *= 0.0001

        writer.writerow(
            [
                field["id"],
                window_start,
                dataset_name,
                value,
                config["unit"],
            ]
        )

        rows_written += 1

    return rows_written


def export_field_history(
    field: dict,
    start: date,
    end: date,
    output_dir: Path,
) -> Path:

    output_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    output_path = (
        output_dir /
        f"field_{field['id']}_history.csv"
    )

    geom = ee.Geometry(field["geojson_polygon"])

    total_rows = 0

    with output_path.open(
        "w",
        newline="",
        encoding="utf-8",
    ) as f:

        writer = csv.writer(f)

        writer.writerow(
            [
                "field_id",
                "date",
                "dataset",
                "value",
                "unit",
            ]
        )

        # -------------------------------------------------------------
        # GPM rainfall
        # -------------------------------------------------------------

        gpm_windows = date_windows(
            start.isoformat(),
            end.isoformat(),
            7,
        )

        print(
            f"  [GPM] {len(gpm_windows)} windows"
        )

        for window_start, window_end in gpm_windows:

            try:
                value = gpm_rainfall(
                    geom,
                    window_start,
                    window_end,
                )

            except ee.EEException as exc:
                print(
                    f"  [WARN] GPM {window_start}: {exc}",
                    file=sys.stderr,
                )
                continue

            if value is None:
                continue

            writer.writerow(
                [
                    field["id"],
                    window_start,
                    "GPM",
                    value,
                    "mm",
                ]
            )

            total_rows += 1

        # -------------------------------------------------------------
        # Other datasets
        # -------------------------------------------------------------

        for dataset_name, config in DATASETS.items():

            print(
                f"  [{dataset_name}] processing..."
            )

            rows = process_dataset(
                field=field,
                dataset_name=dataset_name,
                config=config,
                start=start,
                end=end,
                writer=writer,
            )

            total_rows += rows

    print(
        f"  [OK] {output_path} "
        f"({total_rows} rows)"
    )

    return output_path


async def main(
    years: int,
    service_account_json_path: str,
    backend_url: str,
    output_dir: Path,
    field_id: str | None,
) -> None:

    if years <= 0:
        raise ValueError("--years must be greater than zero.")

    init_earth_engine(
        service_account_json_path
    )

    fields = fetch_fields(
        backend_url=backend_url,
        field_id=field_id,
    )

    if not fields:
        raise RuntimeError(
            "No fields returned by backend."
        )

    end = date.today()

    start = date(
        end.year - years,
        end.month,
        end.day,
    )

    print()
    print("=" * 70)
    print("FIELD SHIFT HISTORICAL EXPORT")
    print("=" * 70)
    print(f"Start : {start}")
    print(f"End   : {end}")
    print(f"Fields: {len(fields)}")
    print("=" * 70)
    print()

    for field in fields:

        print(
            f"[FIELD] {field['id']}"
        )

        export_field_history(
            field=field,
            start=start,
            end=end,
            output_dir=output_dir,
        )

    print()
    print("[SUCCESS] Historical export completed.")


if __name__ == "__main__":

    parser = argparse.ArgumentParser(
        description=__doc__
    )

    parser.add_argument(
        "--years",
        type=int,
        default=5,
    )

    parser.add_argument(
        "--service-account-json",
        default=".gee_service_account.json",
    )

    parser.add_argument(
        "--backend-url",
        default="http://localhost:8000",
    )

    parser.add_argument(
        "--field-id",
        default=None,
    )

    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("ml-models/data/raw"),
    )

    args = parser.parse_args()

    asyncio.run(
        main(
            years=args.years,
            service_account_json_path=args.service_account_json,
            backend_url=args.backend_url,
            output_dir=args.output_dir,
            field_id=args.field_id,
        )
    )