"""
Single-dataset backfill for MODIS NDVI (vegetation health).

Same purpose and usage pattern as ingest_smap.py — see that file's
docstring for when to reach for this vs. gee_field_clip.py. The one
MODIS-specific detail: the raw NDVI band is scaled by 10000 in the
source product, so this script divides it back down before writing,
matching the same normalization nasa_data_service.py applies for the
live API — keep both in sync if this ever changes.

Run: python data-pipeline/ingest_modis_ndvi.py --start-date 2026-01-01 --end-date 2026-02-01
"""

import csv
from pathlib import Path

import ee

from _common import build_arg_parser, date_windows, default_date_range, fetch_fields, init_earth_engine, region_mean

COLLECTION_ID = "MODIS/061/MOD13Q1"
BAND = "NDVI"
DATASET_NAME = "MODIS"
NDVI_SCALE_FACTOR = 10000  # raw product units -> the -1..1 NDVI range used everywhere else in the codebase


def run(args) -> None:
    init_earth_engine(args.service_account_json)
    start, end = (args.start_date, args.end_date) if args.start_date else default_date_range(32)
    fields = fetch_fields(args.backend_url, args.field_id)

    output_path = Path(args.output or f"data-pipeline/output/{DATASET_NAME.lower()}_ndvi_backfill.csv")
    output_path.parent.mkdir(parents=True, exist_ok=True)

    rows_written = 0
    with open(output_path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["field_id", "date", "dataset", "value"])

        for field in fields:
            geom = ee.Geometry(field["geojson_polygon"])
            for window_start, window_end in date_windows(start, end, args.step_days):
                raw_value = region_mean(COLLECTION_ID, BAND, geom, window_start, window_end)
                if raw_value is not None:
                    writer.writerow([field["id"], window_start, DATASET_NAME, raw_value / NDVI_SCALE_FACTOR])
                    rows_written += 1

    print(f"Wrote {rows_written} {DATASET_NAME} rows for {len(fields)} field(s) to {output_path}")


if __name__ == "__main__":
    args = build_arg_parser(__doc__).parse_args()
    run(args)