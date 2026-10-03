"""
GPM IMERG V07 rainfall ingestion.

The Earth Engine IMERG V07 collection provides 30-minute precipitation
estimates. We aggregate these into accumulated rainfall over each
configured window.

Output unit:
    millimeters (mm)
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
)


COLLECTION_ID = "NASA/GPM_L3/IMERG_V07"
BAND = "precipitation"

# Approximate native spatial resolution of IMERG.
SCALE = 11132

# IMERG precipitation is mm/hour.
# Each image represents 30 minutes = 0.5 hour.
HALF_HOUR_FACTOR = 0.5


def rainfall_sum(
    geom,
    start: str,
    end: str,
):
    collection = (
        ee.ImageCollection(COLLECTION_ID)
        .filterDate(start, end)
        .filterBounds(geom)
        .select(BAND)
    )

    count = collection.size().getInfo()

    if count == 0:
        return None, 0

    rainfall = (
        collection
        .sum()
        .multiply(HALF_HOUR_FACTOR)
    )

    stats = rainfall.reduceRegion(
        reducer=ee.Reducer.mean(),
        geometry=geom,
        scale=SCALE,
        maxPixels=1e9,
        bestEffort=True,
    )

    value = stats.get(BAND).getInfo()

    if value is None:
        return None, count

    return float(value), count


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
            "data-pipeline/output/gpm_rainfall_backfill.csv"
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

                    value, observation_count = (
                        rainfall_sum(
                            geom,
                            window_start,
                            window_end,
                        )
                    )

                except ee.EEException as exc:

                    print(
                        f"[WARN] GPM "
                        f"{window_start}: {exc}"
                    )

                    continue

                if value is None:
                    continue

                writer.writerow(
                    [
                        field["id"],
                        window_start,
                        "GPM",
                        round(value, 4),
                        "mm",
                        observation_count,
                    ]
                )

                total_rows += 1

    print()
    print("=" * 60)
    print("[SUCCESS] GPM rainfall ingestion completed")
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