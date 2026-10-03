"""
SMAP L4 root-zone soil-moisture ingestion.

Dataset:
    NASA/SMAP/SPL4SMGP/008

Metric:
    sm_rootzone

Unit:
    volumetric soil-water fraction (m3/m3)

Important:
    SMAP is a coarse regional product. It should be interpreted as
    environmental soil-moisture context, not field-survey ground truth.
"""

import csv
from pathlib import Path

import ee

from _common import (
    build_arg_parser,
    date_windows,
    default_date_range,
    fetch_fields,
    init_earth_engine,
    region_mean,
)


COLLECTION_ID = "NASA/SMAP/SPL4SMGP/008"
BAND = "sm_rootzone"

SCALE = 11000
DATASET_NAME = "SMAP_ROOTZONE"


def main(args):

    init_earth_engine(
        args.service_account_json
    )

    fields = fetch_fields(
        args.backend_url,
        args.field_id,
    )

    if args.start_date:
        start = args.start_date
    else:
        start, _ = default_date_range(
            args.days_back
        )

    end = args.end_date

    windows = date_windows(
        start,
        end,
        args.step_days,
    )

    output_path = (
        Path(args.output)
        if args.output
        else Path(
            "data-pipeline/output/smap_backfill.csv"
        )
    )

    output_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

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
                "observation_count",
            ]
        )

        for field in fields:

            geom = ee.Geometry(
                field["geojson_polygon"]
            )

            for window_start, window_end in windows:

                try:

                    collection = (
                        ee.ImageCollection(
                            COLLECTION_ID
                        )
                        .filterDate(
                            window_start,
                            window_end,
                        )
                        .filterBounds(geom)
                        .select(BAND)
                    )

                    observation_count = (
                        collection.size().getInfo()
                    )

                    if observation_count == 0:
                        continue

                    value = region_mean(
                        collection_id=COLLECTION_ID,
                        band=BAND,
                        geom=geom,
                        start=window_start,
                        end=window_end,
                        scale=SCALE,
                    )

                except ee.EEException as exc:

                    print(
                        f"[WARN] SMAP "
                        f"{window_start}: {exc}"
                    )

                    continue

                if value is None:
                    continue

                writer.writerow(
                    [
                        field["id"],
                        window_start,
                        DATASET_NAME,
                        round(value, 6),
                        "m3/m3",
                        observation_count,
                    ]
                )

                total_rows += 1

    print()
    print("=" * 60)
    print("[SUCCESS] SMAP ingestion completed")
    print(f"Output : {output_path}")
    print(f"Rows   : {total_rows}")
    print("=" * 60)


if __name__ == "__main__":

    parser = build_arg_parser(
        description=__doc__,
        default_step_days=7,
        default_days_back=30,
    )

    args = parser.parse_args()

    main(args)