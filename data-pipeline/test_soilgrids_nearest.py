"""
Field Shift — SoilGrids Nearest Valid Pixel Diagnostic
=======================================================

Purpose
-------
Determine the distance between the field centroid and the nearest
valid SoilGrids pixel.

This script DOES NOT create the final soil profile.

It only diagnoses spatial coverage.

No soil values are fabricated or imputed.
"""

from __future__ import annotations

import ee

from _common import init_earth_engine


FIELD_ID = "426e9d97-78cf-45d2-82ae-8131040b5ee7"

LATITUDE = 23.0159
LONGITUDE = 91.3976

SCALE = 250

SEARCH_RADIUS_M = 2000


SOIL_PROPERTIES = {
    "soil_ph": {
        "asset": "projects/soilgrids-isric/phh2o_mean",
        "band": "phh2o_0-5cm_mean",
        "conversion": 10,
    },
    "soil_organic_carbon": {
        "asset": "projects/soilgrids-isric/soc_mean",
        "band": "soc_0-5cm_mean",
        "conversion": 10,
    },
    "soil_clay": {
        "asset": "projects/soilgrids-isric/clay_mean",
        "band": "clay_0-5cm_mean",
        "conversion": 10,
    },
    "soil_sand": {
        "asset": "projects/soilgrids-isric/sand_mean",
        "band": "sand_0-5cm_mean",
        "conversion": 10,
    },
    "soil_silt": {
        "asset": "projects/soilgrids-isric/silt_mean",
        "band": "silt_0-5cm_mean",
        "conversion": 10,
    },
    "soil_bulk_density": {
        "asset": "projects/soilgrids-isric/bdod_mean",
        "band": "bdod_0-5cm_mean",
        "conversion": 100,
    },
    "soil_cec": {
        "asset": "projects/soilgrids-isric/cec_mean",
        "band": "cec_0-5cm_mean",
        "conversion": 10,
    },
    "soil_nitrogen": {
        "asset": "projects/soilgrids-isric/nitrogen_mean",
        "band": "nitrogen_0-5cm_mean",
        "conversion": 100,
    },
}


def build_soil_image() -> ee.Image:
    print()
    print("=" * 70)
    print("BUILDING SOILGRIDS IMAGE")
    print("=" * 70)

    images = []

    for property_name, config in SOIL_PROPERTIES.items():

        image = (
            ee.Image(config["asset"])
            .select(config["band"])
            .rename(property_name)
        )

        images.append(
            image
            .divide(config["conversion"])
            .rename(property_name)
        )

    soil_image = ee.Image.cat(images)

    print("[OK] SoilGrids image created.")

    return soil_image


def count_valid_pixels(
    soil_image: ee.Image,
    point: ee.Geometry,
    radius_m: int,
) -> int:

    region = point.buffer(radius_m)

    samples = (
        soil_image
        .sample(
            region=region,
            scale=SCALE,
            geometries=True,
            numPixels=5000,
            dropNulls=True,
        )
    )

    return samples.size().getInfo()


def find_nearest_valid_pixel(
    soil_image: ee.Image,
    point: ee.Geometry,
):

    print()
    print("=" * 70)
    print("SEARCHING FOR NEAREST VALID SOILGRIDS PIXEL")
    print("=" * 70)

    region = point.buffer(SEARCH_RADIUS_M)

    samples = (
        soil_image
        .sample(
            region=region,
            scale=SCALE,
            geometries=True,
            numPixels=5000,
            dropNulls=True,
        )
    )

    count = samples.size().getInfo()

    print(
        f"[INFO] Valid pixels within "
        f"{SEARCH_RADIUS_M} m: {count}"
    )

    if count == 0:
        print(
            "[RESULT] No valid SoilGrids pixels found."
        )
        return None

    centroid_feature = ee.Feature(
        point,
        {
            "field_id": FIELD_ID,
        },
    )

    def add_distance(feature):

        distance = (
            feature.geometry()
            .distance(
                centroid_feature.geometry()
            )
        )

        return feature.set(
            "distance_m",
            distance,
        )

    samples_with_distance = samples.map(
        add_distance
    )

    nearest = (
        samples_with_distance
        .sort("distance_m")
        .first()
    )

    return nearest


def print_nearest_pixel(
    nearest,
) -> None:

    print()
    print("=" * 70)
    print("NEAREST VALID SOILGRIDS PIXEL")
    print("=" * 70)

    if nearest is None:
        return

    result = nearest.getInfo()

    if result is None:
        print("[RESULT] No nearest pixel returned.")
        return

    geometry = result.get("geometry")

    properties = result.get(
        "properties",
        {},
    )

    coordinates = geometry.get(
        "coordinates",
        [],
    )

    distance_m = properties.get(
        "distance_m"
    )

    print()
    print(
        f"Field centroid:"
    )
    print(
        f"    Latitude  : {LATITUDE}"
    )
    print(
        f"    Longitude : {LONGITUDE}"
    )

    print()
    print(
        "Nearest valid SoilGrids pixel:"
    )

    print(
        f"    Longitude : {coordinates[0]}"
    )

    print(
        f"    Latitude  : {coordinates[1]}"
    )

    print(
        f"    Distance  : {distance_m:.2f} m"
    )

    print()
    print(
        "Soil properties:"
    )

    for property_name in SOIL_PROPERTIES:

        value = properties.get(
            property_name
        )

        print(
            f"    {property_name:<25}: {value}"
        )

    print()
    print(
        "[IMPORTANT] These values are the "
        "nearest valid SoilGrids pixel values."
    )


def main() -> int:

    print("=" * 70)
    print("FIELD SHIFT — SOILGRIDS NEAREST PIXEL DIAGNOSTIC")
    print("=" * 70)

    print(
        f"Field ID  : {FIELD_ID}"
    )

    print(
        f"Latitude  : {LATITUDE}"
    )

    print(
        f"Longitude : {LONGITUDE}"
    )

    print(
        f"Search radius: {SEARCH_RADIUS_M} m"
    )

    print(
        "[INFO] Initializing Google Earth Engine..."
    )

    init_earth_engine()

    print(
        "[OK] Earth Engine initialized."
    )

    soil_image = build_soil_image()

    point = ee.Geometry.Point(
        [
            LONGITUDE,
            LATITUDE,
        ]
    )

    print()
    print("=" * 70)
    print("VALID PIXEL COUNTS BY SEARCH RADIUS")
    print("=" * 70)

    for radius in [
        250,
        500,
        750,
        1000,
        1500,
        2000,
    ]:

        count = count_valid_pixels(
            soil_image,
            point,
            radius,
        )

        print(
            f"Radius {radius:>4} m : "
            f"{count} valid pixels"
        )

    nearest = find_nearest_valid_pixel(
        soil_image,
        point,
    )

    print_nearest_pixel(
        nearest
    )

    print()
    print("=" * 70)
    print("DIAGNOSTIC COMPLETE")
    print("=" * 70)

    return 0


if __name__ == "__main__":

    try:

        raise SystemExit(
            main()
        )

    except KeyboardInterrupt:

        print(
            "\n[STOPPED] Interrupted by user."
        )

        raise SystemExit(130)

    except Exception as exc:

        print()
        print("=" * 70)
        print("ERROR")
        print("=" * 70)

        print(
            f"[ERROR TYPE] {type(exc).__name__}"
        )

        print(
            f"[ERROR] {exc}"
        )

        raise SystemExit(1)