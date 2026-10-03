"""
Field Shift — SoilGrids Field Polygon Diagnostic
================================================

Purpose
-------
Test SoilGrids coverage using the actual field polygon
retrieved from the Field Shift backend.

This script does NOT create the final soil profile.

It checks:
1. Backend field geometry.
2. Polygon centroid.
3. SoilGrids coverage over the complete field.
4. Number of valid SoilGrids pixels.
5. Sample soil values from valid pixels.

No values are fabricated or imputed.
"""

from __future__ import annotations

import sys

import ee
from shapely.geometry import shape

sys.path.insert(0, "data-pipeline")

from _common import fetch_fields, init_earth_engine


FIELD_ID = "426e9d97-78cf-45d2-82ae-8131040b5ee7"
BACKEND_URL = "http://localhost:8000"

SOILGRIDS_SCALE = 250

SOIL_PROPERTIES = {
    "soil_ph": {
        "asset": "projects/soilgrids-isric/phh2o_mean",
        "band": "phh2o_0-5cm_mean",
        "scale_factor": 10,
    },
    "soil_organic_carbon": {
        "asset": "projects/soilgrids-isric/soc_mean",
        "band": "soc_0-5cm_mean",
        "scale_factor": 10,
    },
    "soil_clay": {
        "asset": "projects/soilgrids-isric/clay_mean",
        "band": "clay_0-5cm_mean",
        "scale_factor": 10,
    },
    "soil_sand": {
        "asset": "projects/soilgrids-isric/sand_mean",
        "band": "sand_0-5cm_mean",
        "scale_factor": 10,
    },
    "soil_silt": {
        "asset": "projects/soilgrids-isric/silt_mean",
        "band": "silt_0-5cm_mean",
        "scale_factor": 10,
    },
    "soil_bulk_density": {
        "asset": "projects/soilgrids-isric/bdod_mean",
        "band": "bdod_0-5cm_mean",
        "scale_factor": 100,
    },
    "soil_cec": {
        "asset": "projects/soilgrids-isric/cec_mean",
        "band": "cec_0-5cm_mean",
        "scale_factor": 10,
    },
    "soil_nitrogen": {
        "asset": "projects/soilgrids-isric/nitrogen_mean",
        "band": "nitrogen_0-5cm_mean",
        "scale_factor": 100,
    },
}


def load_field_polygon() -> dict:
    print("[INFO] Fetching field geometry from backend...")

    fields = fetch_fields(BACKEND_URL, FIELD_ID)

    if len(fields) != 1:
        raise RuntimeError(
            f"Expected exactly 1 field, received {len(fields)}."
        )

    field = fields[0]

    geojson = field.get("geojson_polygon")

    if not geojson:
        raise RuntimeError("Backend returned no geojson_polygon.")

    if geojson.get("type") != "Polygon":
        raise RuntimeError(
            f"Expected Polygon geometry, got {geojson.get('type')}."
        )

    print("[OK] Field polygon retrieved.")

    return geojson


def inspect_geometry(geojson: dict) -> tuple[ee.Geometry, object]:
    polygon = shape(geojson)

    print()
    print("=" * 70)
    print("FIELD GEOMETRY")
    print("=" * 70)

    print(f"Geometry type : {polygon.geom_type}")
    print(f"Area (degree²): {polygon.area}")
    print(f"Bounds        : {polygon.bounds}")

    centroid = polygon.centroid

    print()
    print("Polygon centroid:")
    print(f"    Longitude : {centroid.x}")
    print(f"    Latitude  : {centroid.y}")

    ee_polygon = ee.Geometry(geojson)

    return ee_polygon, polygon


def build_soil_image() -> ee.Image:
    print()
    print("=" * 70)
    print("BUILDING SOILGRIDS IMAGE")
    print("=" * 70)

    images = []

    for property_name, config in SOIL_PROPERTIES.items():

        print(f"[INFO] Loading {property_name}")

        image = (
            ee.Image(config["asset"])
            .select(config["band"])
            .divide(config["scale_factor"])
            .rename(property_name)
        )

        images.append(image)

    stacked = ee.Image.cat(images)

    print("[OK] SoilGrids image created.")

    return stacked


def test_field_coverage(
    soil_image: ee.Image,
    field_geometry: ee.Geometry,
) -> None:

    print()
    print("=" * 70)
    print("SOILGRIDS COVERAGE OVER FIELD")
    print("=" * 70)

    print("[INFO] Sampling valid SoilGrids pixels inside field...")

    samples = (
        soil_image
        .sample(
            region=field_geometry,
            scale=SOILGRIDS_SCALE,
            geometries=True,
            numPixels=1000,
            dropNulls=True,
        )
    )

    count = samples.size().getInfo()

    print()
    print(f"Valid SoilGrids pixels: {count}")

    if count == 0:
        print()
        print("[RESULT] No valid SoilGrids pixels found inside field.")
        return

    print()
    print("[OK] SoilGrids coverage exists inside the actual field.")

    sample_list = samples.limit(10).getInfo()

    print()
    print("First valid pixels:")
    print()

    for index, feature in enumerate(
        sample_list["features"],
        start=1,
    ):

        coordinates = feature["geometry"]["coordinates"]
        properties = feature.get("properties", {})

        print(f"Pixel #{index}")
        print(f"    Longitude : {coordinates[0]}")
        print(f"    Latitude  : {coordinates[1]}")

        for property_name in SOIL_PROPERTIES:
            print(
                f"    {property_name:<24}: "
                f"{properties.get(property_name)}"
            )

        print()


def test_field_reduction(
    soil_image: ee.Image,
    field_geometry: ee.Geometry,
) -> None:

    print()
    print("=" * 70)
    print("FIELD-LEVEL REDUCTION")
    print("=" * 70)

    print("[INFO] Calculating mean soil properties over field...")

    result = (
        soil_image
        .reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=field_geometry,
            scale=SOILGRIDS_SCALE,
            maxPixels=100000,
            bestEffort=True,
        )
        .getInfo()
    )

    print()

    for property_name in SOIL_PROPERTIES:

        value = result.get(property_name)

        print(
            f"{property_name:<25}: {value}"
        )

    null_count = sum(
        result.get(property_name) is None
        for property_name in SOIL_PROPERTIES
    )

    print()
    print(
        f"NULL properties: "
        f"{null_count}/{len(SOIL_PROPERTIES)}"
    )

    if null_count == 0:
        print()
        print("[OK] All soil properties have field-level coverage.")
    else:
        print()
        print("[WARNING] Some soil properties are masked.")


def main() -> int:

    print("=" * 70)
    print("FIELD SHIFT — FIELD POLYGON SOILGRIDS DIAGNOSTIC")
    print("=" * 70)

    print(f"Field ID : {FIELD_ID}")

    print()
    print("[INFO] Initializing Earth Engine...")
    init_earth_engine()
    print("[OK] Earth Engine initialized.")

    geojson = load_field_polygon()

    field_geometry, polygon = inspect_geometry(geojson)

    soil_image = build_soil_image()

    test_field_coverage(
        soil_image,
        field_geometry,
    )

    test_field_reduction(
        soil_image,
        field_geometry,
    )

    print()
    print("=" * 70)
    print("DIAGNOSTIC COMPLETE")
    print("=" * 70)

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())

    except KeyboardInterrupt:
        print("\n[STOPPED] Interrupted by user.")
        raise SystemExit(130)

    except Exception as exc:
        print()
        print("=" * 70)
        print("ERROR")
        print("=" * 70)
        print(f"[ERROR TYPE] {type(exc).__name__}")
        print(f"[ERROR] {exc}")
        raise SystemExit(1)