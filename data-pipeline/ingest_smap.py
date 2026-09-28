"""
Single-dataset backfill for SMAP root-zone soil moisture.

Use this when you need to re-pull JUST soil moisture for one field or
one date range — e.g. NASA reprocessed the SMAP L4 product, or a
specific week's data looked wrong in the dashboard and you want to
refresh it without touching the other four datasets. For routine full
exports (all datasets, all fields, years of history — the ML training
path), use gee_field_clip.py instead.

Run: python data-pipeline/ingest_smap.py --start-date 2026-01-01 --end-date 2026-02-01
"""

import csv
from pathlib import Path

import ee

from _common import build_arg_parser, date_windows, default_date_range, fetch_fields, init_earth_engine, region_mean

COLLECTION_ID = "NASA/SMAP/SPL4SMGP/007"
BAND = "sm_rootzone"
DATASET_NAME = "SMAP"


def run(args) -> None:
    init_earth_engine(args.service_account_json)
    start, end = (args.start_date, args.end_date) if args.start_date else default_date_range(30)
    fields = fetch_fields(args.backend_url, args.field_id)

    output_path = Path(args.output or f"data-pipeline/output/{DATASET_NAME.lower()}_backfill.csv")
    output_path.parent.mkdir(parents=True, exist_ok=True)

    rows_written = 0
    with open(output_path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["field_id", "date", "dataset", "value"])

        for field in fields:
            geom = ee.Geometry(field["geojson_polygon"])
            for window_start, window_end in date_windows(start, end, args.step_days):
                value = region_mean(COLLECTION_ID, BAND, geom, window_start, window_end)
                if value is not None:
                    writer.writerow([field["id"], window_start, DATASET_NAME, value])
                    rows_written += 1

    print(f"Wrote {rows_written} {DATASET_NAME} rows for {len(fields)} field(s) to {output_path}")


if __name__ == "__main__":
    args = build_arg_parser(__doc__).parse_args()
    run(args)