"""
MODIS MOD13Q1 V6.1 vegetation-index ingestion.

Outputs:
- NDVI
- EVI

Temporal cadence:
- 16 days

Spatial resolution:
- 250 m
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


COLLECTION_ID = "MODIS/061/MOD13Q1"

DATASET_NAME_NDVI = "MODIS_NDVI"
DATASET_NAME_EVI = "MODIS_EVI"

SCALE = 250
SCALE_FACTOR = 0.0001


def mask_modis_quality(image):
    """
    Keep pixels with SummaryQA 0 (good) or 1 (marginal).
    """

    qa = image.select("SummaryQA")

    mask = qa.lte(1)

    return image.updateMask(mask)


def region_mean(
    geom,
    band: str,
    start: str,
    end: str,
):
    collection = (
        ee.ImageCollection(COLLECTION_ID)
        .filterDate(start, end)
        .filterBounds(geom)
        .map(mask_modis_quality)
        .select(band)
    )

    count = collection.size().getInfo()

    if count == 0:
        return None, 0

    image = collection.mean()

    stats = image.reduceRegion(
        reducer=ee.Reducer.mean(),
        geometry=geom,
        scale=SCALE,
        maxPixels=1e9,
        bestEffort=True,
    )

    value = stats.get(band).getInfo()

    if value is None:
        return None, count

    return float(value) * SCALE_FACTOR, count


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
            "data-pipeline/output/modis_backfill.csv"
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
                "quality",
            ]
        )

        for field in fields:

            geom = ee.Geometry(
                field["geojson_polygon"]
            )

            for window_start, window_end in windows:

                for band, dataset_name in [
                    ("NDVI", DATASET_NAME_NDVI),
                    ("EVI", DATASET_NAME_EVI),
                ]:

                    try:

                        value, observation_count = (
                            region_mean(
                                geom,
                                band,
                                window_start,
                                window_end,
                            )
                        )

                    except ee.EEException as exc:

                        print(
                            f"[WARN] {dataset_name} "
                            f"{window_start}: {exc}"
                        )

                        continue

                    if value is None:
                        continue

                    writer.writerow(
                        [
                            field["id"],
                            window_start,
                            dataset_name,
                            round(value, 6),
                            "index",
                            observation_count,
                            "SummaryQA<=1",
                        ]
                    )

                    total_rows += 1

    print()
    print("=" * 60)
    print("[SUCCESS] MODIS ingestion completed")
    print(f"Output : {output_path}")
    print(f"Rows   : {total_rows}")
    print("=" * 60)


if __name__ == "__main__":

    parser = build_arg_parser(
        description=__doc__,
        default_step_days=16,
        default_days_back=32,
    )

    args = parser.parse_args()

    main(args)