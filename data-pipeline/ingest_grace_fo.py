"""
Single-dataset backfill for GRACE-FO groundwater storage anomaly.

Same pattern as ingest_smap.py. GRACE-FO updates far less frequently
than the other four datasets (monthly gravity-field solutions, not
near-daily overpasses), so a --step-days smaller than ~30 will mostly
return duplicate values across windows — left as a user-supplied flag
rather than hardcoded, but worth knowing before you backfill a short
date range and wonder why every row looks the same.

Run: python data-pipeline/ingest_grace_fo.py --start-date 2026-01-01 --end-date 2026-04-01 --step-days 30
"""

import csv
from pathlib import Path

import ee

from _common import build_arg_parser, date_windows, default_date_range, fetch_fields, init_earth_engine, region_mean

COLLECTION_ID = "NASA/GRACE/MASS_GRIDS_V04/LAND"
BAND = "lwe_thickness_csr"
DATASET_NAME = "GRACE-FO"


def run(args) -> None:
    init_earth_engine(args.service_account_json)
    start, end = (args.start_date, args.end_date) if args.start_date else default_date_range(90)
    fields = fetch_fields(args.backend_url, args.field_id)

    output_path = Path(args.output or f"data-pipeline/output/{DATASET_NAME.lower().replace('-', '_')}_backfill.csv")
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