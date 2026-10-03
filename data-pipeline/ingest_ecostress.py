"""
ECOSTRESS L2 Land Surface Temperature ingestion.

Dataset:
    NASA/ECOSTRESS/L2T_LSTE/V2

Processing:
    - Apply conservative ECOSTRESS QC filtering.
    - Convert LST from Kelvin to Celsius.
    - Aggregate valid observations over configurable windows.
    - Preserve irregular observation frequency.

Output:
    Land Surface Temperature in degrees Celsius.
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


COLLECTION_ID = "NASA/ECOSTRESS/L2T_LSTE/V2"

LST_BAND = "LST"
QC_BAND = "QC"

# ECOSTRESS L2T_LSTE V2 native spatial resolution.
SCALE = 70

# Kelvin -> Celsius.
KELVIN_TO_CELSIUS = 273.15


def mask_ecostress_quality(image):
    """
    Apply ECOSTRESS LST quality filtering.

    The ECOSTRESS QC band is bit-packed.

    We require:
        Bit 0 = LST quality -> 0 (good)
        Bit 1 = LST error estimate -> 0 (good)

    We additionally require:
        cloud = 0  -> clear
        water = 0  -> land

    We do NOT require bits 2-6 of QC to be zero because
    doing so would reject valid ECOSTRESS LST pixels that
    are present in the product and documented for LST use.
    """

    qc = image.select(QC_BAND)

    # Bit 0: LST quality
    lst_quality_good = (
        qc.bitwiseAnd(1).eq(0)
    )

    # Bit 1: LST error estimate
    lst_error_good = (
        qc.rightShift(1)
        .bitwiseAnd(1)
        .eq(0)
    )

    # Dedicated ECOSTRESS cloud mask.
    clear_sky = image.select("cloud").eq(0)

    # Dedicated ECOSTRESS land/water mask.
    land_pixel = image.select("water").eq(0)

    valid = (
        lst_quality_good
        .And(lst_error_good)
        .And(clear_sky)
        .And(land_pixel)
    )

    return image.updateMask(valid)


def add_valid_pixel_count(image, geom):
    """
    Count valid LST pixels inside the field and attach
    the result as an image property.

    This avoids converting an ee.Number/ee.Long into ee.Image.
    """

    count = (
        image.select(LST_BAND)
        .reduceRegion(
            reducer=ee.Reducer.count(),
            geometry=geom,
            scale=SCALE,
            maxPixels=1e9,
            bestEffort=True,
        )
        .get(LST_BAND)
    )

    count = ee.Number(
        ee.Algorithms.If(
            count,
            count,
            0,
        )
    )

    return image.set(
        "valid_pixel_count",
        count,
    )


def get_ecostress_observations(
    geom,
    start: str,
    end: str,
):
    """
    Retrieve and quality-filter ECOSTRESS observations.

    Returns:
        filtered_collection
        source_count
        valid_observation_count
    """

    collection = (
    ee.ImageCollection(COLLECTION_ID)
    .filterDate(start, end)
    .filterBounds(geom)
    .select([
        LST_BAND,
        QC_BAND,
        "cloud",
        "water",
    ])
)

    source_count = collection.size().getInfo()

    if source_count == 0:
        return collection, 0, 0

    filtered = collection.map(
        mask_ecostress_quality
    )

    # Attach the number of valid LST pixels to every image.
    with_counts = filtered.map(
        lambda image: add_valid_pixel_count(
            image,
            geom,
        )
    )

    # Count observations that contain at least one valid
    # LST pixel inside the requested field.
    valid_observation_count = (
        with_counts
        .map(
           lambda image: ee.Feature(
    None,
    {
        "has_valid_observation": (
            ee.Number(
                image.get("valid_pixel_count")
            )
            .gt(0)
            .int()
        )
    },
)
        )
        .aggregate_sum(
            "has_valid_observation"
        )
        .getInfo()
    )

    if valid_observation_count is None:
        valid_observation_count = 0

    return (
        with_counts,
        source_count,
        int(valid_observation_count),
    )


def lst_mean_celsius(
    geom,
    start: str,
    end: str,
):
    """
    Calculate the mean valid ECOSTRESS LST for a time window.

    Returns:
        value_celsius
        source_count
        valid_observation_count
    """

    (
        collection,
        source_count,
        valid_observation_count,
    ) = get_ecostress_observations(
        geom,
        start,
        end,
    )

    if source_count == 0:
        return None, 0, 0

    if valid_observation_count == 0:
        return (
            None,
            source_count,
            0,
        )

    # Mean of valid ECOSTRESS observations.
    mean_lst_kelvin = (
        collection
        .select(LST_BAND)
        .mean()
    )

    stats = mean_lst_kelvin.reduceRegion(
        reducer=ee.Reducer.mean(),
        geometry=geom,
        scale=SCALE,
        maxPixels=1e9,
        bestEffort=True,
    )

    value = stats.get(
        LST_BAND
    ).getInfo()

    if value is None:
        return (
            None,
            source_count,
            valid_observation_count,
        )

    value_celsius = (
        float(value)
        - KELVIN_TO_CELSIUS
    )

    return (
        value_celsius,
        source_count,
        valid_observation_count,
    )


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
            "data-pipeline/output/"
            "ecostress_backfill.csv"
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
                "source_observation_count",
                "valid_observation_count",
                "quality",
            ]
        )

        for field in fields:

            geom = ee.Geometry(
                field["geojson_polygon"]
            )

            for (
                window_start,
                window_end,
            ) in windows:

                try:

                    (
                        value,
                        source_count,
                        valid_count,
                    ) = lst_mean_celsius(
                        geom,
                        window_start,
                        window_end,
                    )

                except ee.EEException as exc:

                    print(
                        f"[WARN] ECOSTRESS "
                        f"{window_start}: {exc}"
                    )

                    continue

                if value is None:

                    print(
                        f"[INFO] ECOSTRESS "
                        f"{window_start}: "
                        f"no valid LST observation "
                        f"(source={source_count}, "
                        f"valid={valid_count})"
                    )

                    continue

                writer.writerow(
                    [
                        field["id"],
                        window_start,
                        "ECOSTRESS_LST",
                        round(value, 4),
                        "degC",
                        source_count,
                        valid_count,
                        (
                            "QC:good_l2t;"
                            "clear_sky;"
                            "no_interpolation;"
                            "no_outlier;"
                            "land"
                        ),
                    ]
                )

                total_rows += 1

                print(
                    f"[OK] ECOSTRESS "
                    f"{window_start}: "
                    f"{value:.2f} degC "
                    f"(source={source_count}, "
                    f"valid={valid_count})"
                )

    print()
    print("=" * 60)
    print(
        "[SUCCESS] ECOSTRESS LST "
        "ingestion completed"
    )
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