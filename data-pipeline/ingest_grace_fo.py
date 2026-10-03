"""
GRACE / GRACE-FO JPL Mascon ingestion.

Dataset:
    NASA/GRACE/MASS_GRIDS_V04/MASCON_CRI

Metric:
    lwe_thickness

Unit:
    cm equivalent liquid water thickness

Spatial interpretation:
    GRACE Mascon / regional terrestrial water-storage anomaly.

Important:
    GRACE is a coarse-resolution regional product. It is NOT
    field-scale groundwater measurement.

    Each field is represented by its centroid, and the GRACE value
    is sampled from the Mascon/pixel containing that centroid.

Temporal interpretation:
    GRACE provides monthly observations. The output date is the
    actual observation date from system:time_start, not an
    artificial aggregation-window date.
"""

import csv
from pathlib import Path

import ee

from _common import (
    build_arg_parser,
    default_date_range,
    fetch_fields,
    init_earth_engine,
)

COLLECTION_ID = (
    "NASA/GRACE/MASS_GRIDS_V04/MASCON_CRI"
)

BAND = "lwe_thickness"

DATASET_NAME = (
    "GRACE_TWS_ANOMALY_MASCON"
)

SCALE = 55660


def get_grace_observations(
    start: str,
    end: str,
):
    """
    Return all GRACE images available in the requested period.

    Each image represents one actual GRACE/GRACE-FO observation.
    """

    collection = (
        ee.ImageCollection(COLLECTION_ID)
        .filterDate(start, end)
        .sort("system:time_start")
        .select(BAND)
    )

    count = collection.size().getInfo()

    if count == 0:
        return []

    images = collection.toList(count)

    observations = []

    for i in range(count):
        image = ee.Image(images.get(i))

        timestamp = image.get(
            "system:time_start"
        ).getInfo()

        observation_date = (
            ee.Date(timestamp)
            .format("YYYY-MM-dd")
            .getInfo()
        )

        observations.append(
            (
                observation_date,
                image,
            )
        )

    return observations


def sample_grace_centroid(
    image,
    geom,
):
    """
    Sample one GRACE Mascon image at the field centroid.

    GRACE is a coarse regional product, so reducing the value
    over a small field polygon can return no valid pixel.

    The centroid provides a consistent Mascon-level regional
    context for the field.
    """

    centroid = geom.centroid()

    stats = image.reduceRegion(
        reducer=ee.Reducer.first(),
        geometry=centroid,
        scale=SCALE,
        maxPixels=1e9,
        bestEffort=True,
    )

    value = stats.get(BAND).getInfo()

    if value is None:
        return None

    return float(value)


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

    print()
    print("=" * 60)
    print("GRACE / GRACE-FO HISTORICAL INGESTION")
    print("=" * 60)
    print(f"Collection : {COLLECTION_ID}")
    print(f"Band       : {BAND}")
    print(f"Period     : {start} → {end}")
    print(f"Fields     : {len(fields)}")
    print("=" * 60)

    observations = get_grace_observations(
        start,
        end,
    )

    print(
        f"[INFO] Available GRACE observations: "
        f"{len(observations)}"
    )

    if not observations:
        print(
            "[WARNING] No GRACE observations "
            "found in requested period."
        )
        return

    output_path = (
        Path(args.output)
        if args.output
        else Path(
            "data-pipeline/output/grace_backfill.csv"
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
                "spatial_support",
                "sampling_method",
            ]
        )

        for field in fields:

            field_id = field["id"]

            geom = ee.Geometry(
                field["geojson_polygon"]
            )

            for observation_date, image in observations:

                try:
                    value = sample_grace_centroid(
                        image,
                        geom,
                    )

                except ee.EEException as exc:
                    print(
                        f"[WARN] GRACE "
                        f"{observation_date}: "
                        f"{exc}"
                    )
                    continue

                if value is None:
                    print(
                        f"[INFO] GRACE "
                        f"{observation_date}: "
                        f"no valid Mascon value"
                    )
                    continue

                writer.writerow(
                    [
                        field_id,
                        observation_date,
                        DATASET_NAME,
                        round(value, 6),
                        "cm",
                        1,
                        "mascon",
                        "field_centroid",
                    ]
                )

                total_rows += 1

                print(
                    f"[OK] GRACE "
                    f"{observation_date}: "
                    f"{value:.6f} cm "
                    f"(source=1, "
                    f"support=mascon)"
                )

    print()
    print("=" * 60)
    print(
        "[SUCCESS] GRACE/GRACE-FO ingestion completed"
    )
    print(f"Output : {output_path}")
    print(f"Rows   : {total_rows}")
    print("=" * 60)


if __name__ == "__main__":

    parser = build_arg_parser(
        description=__doc__,
        default_step_days=30,
        default_days_back=365,
    )

    args = parser.parse_args()

    main(args)