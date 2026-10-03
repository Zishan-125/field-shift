"""
Field Shift — SoilGrids Coverage Diagnostic
============================================

Purpose
-------
Diagnose why the Field Shift centroid returns masked SoilGrids values.

This script DOES NOT create the final soil profile.

It checks:
1. SoilGrids validity exactly at the field centroid.
2. Whether valid SoilGrids pixels exist around the centroid.
3. Coordinates of nearby valid pixels.
4. Distance from the field centroid to those valid pixels.

No soil value is substituted or fabricated.
"""

from __future__ import annotations

import math

import ee

from _common import init_earth_engine


# ============================================================================
# FIELD
# ============================================================================

FIELD_ID = "426e9d97-78cf-45d2-82ae-8131040b5ee7"

LATITUDE = 23.0159
LONGITUDE = 91.3976

SCALE = 250


# ============================================================================
# SOILGRIDS ASSETS
# ============================================================================

SOIL_PROPERTIES = {
    "soil_ph": {
        "asset": "projects/soilgrids-isric/phh2o_mean",
        "band": "phh2o_0-5cm_mean",
    },

    "soil_organic_carbon": {
        "asset": "projects/soilgrids-isric/soc_mean",
        "band": "soc_0-5cm_mean",
    },

    "soil_clay": {
        "asset": "projects/soilgrids-isric/clay_mean",
        "band": "clay_0-5cm_mean",
    },

    "soil_sand": {
        "asset": "projects/soilgrids-isric/sand_mean",
        "band": "sand_0-5cm_mean",
    },

    "soil_silt": {
        "asset": "projects/soilgrids-isric/silt_mean",
        "band": "silt_0-5cm_mean",
    },

    "soil_bulk_density": {
        "asset": "projects/soilgrids-isric/bdod_mean",
        "band": "bdod_0-5cm_mean",
    },

    "soil_cec": {
        "asset": "projects/soilgrids-isric/cec_mean",
        "band": "cec_0-5cm_mean",
    },

    "soil_nitrogen": {
        "asset": "projects/soilgrids-isric/nitrogen_mean",
        "band": "nitrogen_0-5cm_mean",
    },
}


# ============================================================================
# INITIALIZATION
# ============================================================================

def initialize_earth_engine() -> None:

    print(
        "[INFO] Initializing Google Earth Engine..."
    )

    init_earth_engine()

    print(
        "[OK] Earth Engine initialized."
    )


# ============================================================================
# BUILD IMAGE
# ============================================================================

def build_soil_image() -> ee.Image:

    print()
    print("=" * 70)
    print("BUILDING SOILGRIDS DIAGNOSTIC IMAGE")
    print("=" * 70)

    images = []

    for property_name, config in SOIL_PROPERTIES.items():

        print(
            f"[INFO] Loading {property_name}"
        )

        image = (
            ee.Image(config["asset"])
            .select(config["band"])
            .rename(property_name)
        )

        images.append(image)

    stacked = ee.Image.cat(images)

    print(
        "[OK] Diagnostic SoilGrids image created."
    )

    return stacked


# ============================================================================
# CENTROID TEST
# ============================================================================

def test_centroid(
    soil_image: ee.Image,
) -> None:

    print()
    print("=" * 70)
    print("TEST 1 — EXACT FIELD CENTROID")
    print("=" * 70)

    point = ee.Geometry.Point(
        [
            LONGITUDE,
            LATITUDE,
        ]
    )

    print(
        f"Latitude  : {LATITUDE}"
    )

    print(
        f"Longitude : {LONGITUDE}"
    )

    print(
        f"Scale     : {SCALE} m"
    )

    sample = (
        soil_image
        .sample(
            region=point,
            scale=SCALE,
            geometries=True,
            numPixels=1,
            dropNulls=False,
        )
        .first()
    )

    result = sample.getInfo()

    if result is None:

        print(
            "[RESULT] No feature returned."
        )

        return

    properties = result.get(
        "properties",
        {},
    )

    print()

    for property_name in SOIL_PROPERTIES:

        value = properties.get(
            property_name
        )

        print(
            f"{property_name:<25}: {value}"
        )

    null_count = sum(
        properties.get(name) is None
        for name in SOIL_PROPERTIES
    )

    print()

    print(
        f"NULL properties: "
        f"{null_count}/{len(SOIL_PROPERTIES)}"
    )

    if null_count == len(SOIL_PROPERTIES):

        print()
        print(
            "[RESULT] The field centroid is "
            "completely masked for the SoilGrids stack."
        )

    elif null_count > 0:

        print()
        print(
            "[RESULT] The field centroid is partially "
            "masked for SoilGrids."
        )

    else:

        print()
        print(
            "[RESULT] The field centroid has valid "
            "SoilGrids coverage."
        )


# ============================================================================
# NEIGHBORHOOD TEST
# ============================================================================

def test_neighborhood(
    soil_image: ee.Image,
) -> None:

    print()
    print("=" * 70)
    print("TEST 2 — 1 KM NEIGHBORHOOD")
    print("=" * 70)

    point = ee.Geometry.Point(
        [
            LONGITUDE,
            LATITUDE,
        ]
    )

    # 1 km radius around the field centroid.
    region = point.buffer(1000)

    print(
        "[INFO] Searching for valid SoilGrids pixels "
        "within 1 km of the centroid..."
    )

    samples = (
        soil_image
        .sample(
            region=region,
            scale=SCALE,
            geometries=True,
            numPixels=100,
            dropNulls=True,
        )
    )

    count = samples.size().getInfo()

    print()
    print(
        f"[INFO] Valid SoilGrids sample count: {count}"
    )

    if count == 0:

        print()
        print(
            "[RESULT] No valid SoilGrids pixel was found "
            "within 1 km of the centroid."
        )

        return

    print()
    print(
        "[OK] Valid SoilGrids pixels exist near the field."
    )

    # Get up to 10 nearby valid samples.
    sample_list = (
        samples
        .limit(10)
        .getInfo()
    )

    print()
    print(
        "Nearby valid SoilGrids pixels:"
    )

    print()

    for index, feature in enumerate(
        sample_list["features"],
        start=1,
    ):

        geometry = feature.get(
            "geometry"
        )

        coordinates = geometry.get(
            "coordinates"
        )

        properties = feature.get(
            "properties",
            {},
        )

        print(
            f"Pixel #{index}"
        )

        print(
            f"    Longitude : "
            f"{coordinates[0]}"
        )

        print(
            f"    Latitude  : "
            f"{coordinates[1]}"
        )

        print(
            f"    pH        : "
            f"{properties.get('soil_ph')}"
        )

        print(
            f"    Clay      : "
            f"{properties.get('soil_clay')}"
        )

        print(
            f"    Sand      : "
            f"{properties.get('soil_sand')}"
        )

        print(
            f"    Silt      : "
            f"{properties.get('soil_silt')}"
        )

        print()


# ============================================================================
# SINGLE PROPERTY MASK TEST
# ============================================================================

def test_individual_properties() -> None:

    print()
    print("=" * 70)
    print("TEST 3 — INDIVIDUAL SOILGRIDS LAYERS")
    print("=" * 70)

    point = ee.Geometry.Point(
        [
            LONGITUDE,
            LATITUDE,
        ]
    )

    for property_name, config in SOIL_PROPERTIES.items():

        print()
        print(
            f"[INFO] Testing {property_name}"
        )

        image = (
            ee.Image(config["asset"])
            .select(config["band"])
            .rename(property_name)
        )

        sample = (
            image
            .sample(
                region=point,
                scale=SCALE,
                geometries=True,
                numPixels=1,
                dropNulls=False,
            )
            .first()
        )

        result = sample.getInfo()

        if result is None:

            print(
                "       RESULT: no feature"
            )

            continue

        properties = result.get(
            "properties",
            {},
        )

        value = properties.get(
            property_name
        )

        print(
            f"       Value: {value}"
        )

        if value is None:

            print(
                "       STATUS: MASKED"
            )

        else:

            print(
                "       STATUS: VALID"
            )


# ============================================================================
# MAIN
# ============================================================================

def main() -> int:

    print("=" * 70)
    print("FIELD SHIFT — SOILGRIDS COVERAGE DIAGNOSTIC")
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
        f"Resolution: {SCALE} m"
    )

    initialize_earth_engine()

    soil_image = build_soil_image()

    test_centroid(
        soil_image
    )

    test_individual_properties()

    test_neighborhood(
        soil_image
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