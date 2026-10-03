"""
Field Shift — SoilGrids Field Soil Profile
==========================================

Purpose
-------
Build a field-level soil profile from ISRIC SoilGrids 2.0.

Workflow
--------
Backend FastAPI
    ↓
Field GeoJSON Polygon
    ↓
Google Earth Engine
    ↓
ISRIC SoilGrids 250 m
    ↓
Valid-pixel aggregation over field
    ↓
field_soil_profile.csv

Design principles
-----------------
- Uses the actual field polygon from the backend.
- Does NOT use a hard-coded centroid.
- Does NOT fabricate or impute masked values.
- Preserves all six standard SoilGrids depth intervals.
- Uses field-level mean aggregation.
- Records valid SoilGrids pixel count.
- Keeps soil as a field-level/static layer rather than
  duplicating it into monthly environmental observations.

Output
------
data-pipeline/output/soil/field_soil_profile.csv
"""

from __future__ import annotations

import csv
import sys
from pathlib import Path

import ee

# Allow imports from data-pipeline when executed from project root.
sys.path.insert(0, str(Path(__file__).resolve().parent))

from _common import fetch_fields, init_earth_engine


# ---------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------

FIELD_ID = "426e9d97-78cf-45d2-82ae-8131040b5ee7"

BACKEND_URL = "http://localhost:8000"

SOILGRIDS_RESOLUTION_M = 250

OUTPUT_DIR = (
    Path(__file__).resolve().parent
    / "output"
    / "soil"
)

OUTPUT_FILE = OUTPUT_DIR / "field_soil_profile.csv"


# SoilGrids standard depth intervals.
DEPTHS = [
    "0-5cm",
    "5-15cm",
    "15-30cm",
    "30-60cm",
    "60-100cm",
    "100-200cm",
]


# SoilGrids 2.0 properties and documented conversion factors.
#
# Raw SoilGrids values are scaled integers.
# Conversion factors:
#
# phh2o     / 10 -> pH
# soc       / 10 -> g/kg
# clay      / 10 -> %
# sand      / 10 -> %
# silt      / 10 -> %
# bdod      / 100 -> kg/dm3
# cec       / 10 -> cmol(c)/kg
# nitrogen  / 100 -> g/kg
#
SOIL_PROPERTIES = {
    "soil_ph": {
        "asset": "projects/soilgrids-isric/phh2o_mean",
        "prefix": "phh2o",
        "scale_factor": 10,
        "unit": "pH",
    },
    "soil_organic_carbon": {
        "asset": "projects/soilgrids-isric/soc_mean",
        "prefix": "soc",
        "scale_factor": 10,
        "unit": "g/kg",
    },
    "soil_clay": {
        "asset": "projects/soilgrids-isric/clay_mean",
        "prefix": "clay",
        "scale_factor": 10,
        "unit": "%",
    },
    "soil_sand": {
        "asset": "projects/soilgrids-isric/sand_mean",
        "prefix": "sand",
        "scale_factor": 10,
        "unit": "%",
    },
    "soil_silt": {
        "asset": "projects/soilgrids-isric/silt_mean",
        "prefix": "silt",
        "scale_factor": 10,
        "unit": "%",
    },
    "soil_bulk_density": {
        "asset": "projects/soilgrids-isric/bdod_mean",
        "prefix": "bdod",
        "scale_factor": 100,
        "unit": "kg/dm3",
    },
    "soil_cec": {
        "asset": "projects/soilgrids-isric/cec_mean",
        "prefix": "cec",
        "scale_factor": 10,
        "unit": "cmol(c)/kg",
    },
    "soil_nitrogen": {
        "asset": "projects/soilgrids-isric/nitrogen_mean",
        "prefix": "nitrogen",
        "scale_factor": 100,
        "unit": "g/kg",
    },
}


# ---------------------------------------------------------------------
# Backend field
# ---------------------------------------------------------------------

def fetch_field() -> dict:
    """Fetch the field record from the Field Shift backend."""

    print("[INFO] Fetching field from backend...")

    fields = fetch_fields(
        BACKEND_URL,
        FIELD_ID,
    )

    if len(fields) != 1:
        raise RuntimeError(
            f"Expected exactly one field, received {len(fields)}."
        )

    field = fields[0]

    print(f"[OK] Field retrieved: {field.get('name')}")
    print(f"[OK] Field ID: {field.get('id')}")

    return field


def get_field_geometry(field: dict) -> ee.Geometry:
    """Convert backend GeoJSON Polygon to Earth Engine geometry."""

    geojson = field.get("geojson_polygon")

    if not geojson:
        raise RuntimeError(
            "Backend field does not contain geojson_polygon."
        )

    if geojson.get("type") != "Polygon":
        raise RuntimeError(
            "Expected field geometry type Polygon, "
            f"got {geojson.get('type')}."
        )

    coordinates = geojson.get("coordinates")

    if not coordinates:
        raise RuntimeError(
            "Field polygon contains no coordinates."
        )

    geometry = ee.Geometry(geojson)

    print("[OK] Field polygon converted to Earth Engine geometry.")

    return geometry


# ---------------------------------------------------------------------
# SoilGrids image
# ---------------------------------------------------------------------

def build_soil_image() -> ee.Image:
    """
    Build one multi-band SoilGrids image containing:

        8 properties × 6 depths = 48 bands
    """

    print()
    print("=" * 70)
    print("BUILDING SOILGRIDS 2.0 IMAGE")
    print("=" * 70)

    images: list[ee.Image] = []

    for property_name, config in SOIL_PROPERTIES.items():

        print(
            f"[INFO] Loading {property_name} "
            f"({config['prefix']})"
        )

        source_image = ee.Image(
            config["asset"]
        )

        depth_bands: list[ee.Image] = []

        for depth in DEPTHS:

            source_band = (
                f"{config['prefix']}_{depth}_mean"
            )

            output_band = (
                f"{property_name}_{depth}"
            )

            image = (
                source_image
                .select(source_band)
                .divide(config["scale_factor"])
                .rename(output_band)
            )

            depth_bands.append(image)

        property_stack = ee.Image.cat(depth_bands)

        images.append(property_stack)

    soil_image = ee.Image.cat(images)

    print(
        f"[OK] SoilGrids image created "
        f"with {len(SOIL_PROPERTIES) * len(DEPTHS)} bands."
    )

    return soil_image


# ---------------------------------------------------------------------
# Valid-pixel diagnostics
# ---------------------------------------------------------------------

def count_valid_pixels(
    soil_image: ee.Image,
    field_geometry: ee.Geometry,
) -> int:
    """
    Count pixels for which all 48 soil bands are valid.

    This is intentionally conservative.

    A pixel is counted only if every requested property/depth
    has a valid SoilGrids value.
    """

    print()
    print("[INFO] Counting common valid SoilGrids pixels...")

    sample_collection = (
        soil_image
        .sample(
            region=field_geometry,
            scale=SOILGRIDS_RESOLUTION_M,
            geometries=False,
            numPixels=100000,
            dropNulls=True,
        )
    )

    count = sample_collection.size().getInfo()

    return int(count)


# ---------------------------------------------------------------------
# Field-level aggregation
# ---------------------------------------------------------------------

def reduce_soil_profile(
    soil_image: ee.Image,
    field_geometry: ee.Geometry,
) -> dict:
    """
    Calculate field-level mean SoilGrids values.
    """

    print()
    print("=" * 70)
    print("FIELD-LEVEL SOILGRIDS AGGREGATION")
    print("=" * 70)

    print(
        "[INFO] Calculating mean values over field polygon..."
    )

    result = (
        soil_image
        .reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=field_geometry,
            scale=SOILGRIDS_RESOLUTION_M,
            maxPixels=100000,
            bestEffort=False,
        )
        .getInfo()
    )

    if result is None:
        raise RuntimeError(
            "SoilGrids reduceRegion returned no result."
        )

    return result


# ---------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------

def validate_result(result: dict) -> None:
    """Ensure all requested soil properties have valid values."""

    expected_bands = [
        f"{property_name}_{depth}"
        for property_name in SOIL_PROPERTIES
        for depth in DEPTHS
    ]

    missing = [
        band
        for band in expected_bands
        if result.get(band) is None
    ]

    if missing:
        print()
        print("[ERROR] Missing SoilGrids values:")

        for band in missing:
            print(f"    - {band}")

        raise RuntimeError(
            f"SoilGrids profile contains "
            f"{len(missing)} missing bands."
        )

    print()
    print(
        f"[OK] All {len(expected_bands)} "
        "soil variables have valid values."
    )


# ---------------------------------------------------------------------
# Output transformation
# ---------------------------------------------------------------------

def build_output_record(
    field: dict,
    result: dict,
    valid_pixel_count: int,
) -> dict:
    """
    Convert Earth Engine output into one flat CSV record.
    """

    geojson = field["geojson_polygon"]

    coordinates = geojson["coordinates"][0]

    longitudes = [
        point[0]
        for point in coordinates
    ]

    latitudes = [
        point[1]
        for point in coordinates
    ]

    min_lon = min(longitudes)
    max_lon = max(longitudes)

    min_lat = min(latitudes)
    max_lat = max(latitudes)

    # Simple geographic centroid for metadata only.
    # Soil aggregation itself uses the actual polygon.
    centroid_lon = (min_lon + max_lon) / 2
    centroid_lat = (min_lat + max_lat) / 2

    record = {
        "field_id": field["id"],
        "field_name": field.get("name"),
        "soil_source": "ISRIC SoilGrids 2.0",
        "soil_source_access": "Google Earth Engine",
        "soil_spatial_support": "field_polygon",
        "soil_aggregation": "mean",
        "soil_resolution_m": SOILGRIDS_RESOLUTION_M,
        "soil_valid_pixel_count": valid_pixel_count,
        "field_centroid_lat": centroid_lat,
        "field_centroid_lon": centroid_lon,
        "field_min_lat": min_lat,
        "field_max_lat": max_lat,
        "field_min_lon": min_lon,
        "field_max_lon": max_lon,
    }

    for property_name in SOIL_PROPERTIES:

        for depth in DEPTHS:

            band_name = (
                f"{property_name}_{depth}"
            )

            record[band_name] = result[band_name]

    return record


# ---------------------------------------------------------------------
# CSV writer
# ---------------------------------------------------------------------

def write_csv(record: dict) -> None:
    """Write the field-level soil profile."""

    OUTPUT_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    fieldnames = list(record.keys())

    with OUTPUT_FILE.open(
        "w",
        newline="",
        encoding="utf-8",
    ) as file:

        writer = csv.DictWriter(
            file,
            fieldnames=fieldnames,
        )

        writer.writeheader()
        writer.writerow(record)

    print()
    print(
        f"[OK] Soil profile written to:"
    )
    print(f"     {OUTPUT_FILE}")


# ---------------------------------------------------------------------
# Console summary
# ---------------------------------------------------------------------

def print_summary(
    record: dict,
    valid_pixel_count: int,
) -> None:

    print()
    print("=" * 70)
    print("SOIL PROFILE SUMMARY")
    print("=" * 70)

    print(f"Field ID              : {record['field_id']}")
    print(f"Field name            : {record['field_name']}")
    print(f"Soil source           : {record['soil_source']}")
    print(f"Spatial support       : {record['soil_spatial_support']}")
    print(f"Aggregation           : {record['soil_aggregation']}")
    print(
        f"Resolution            : "
        f"{record['soil_resolution_m']} m"
    )
    print(
        f"Valid common pixels   : "
        f"{valid_pixel_count}"
    )

    print()
    print("TOPSOIL (0–5 cm)")
    print("-" * 70)

    topsoil_fields = [
        ("pH", "soil_ph_0-5cm"),
        (
            "Organic carbon (g/kg)",
            "soil_organic_carbon_0-5cm",
        ),
        ("Clay (%)", "soil_clay_0-5cm"),
        ("Sand (%)", "soil_sand_0-5cm"),
        ("Silt (%)", "soil_silt_0-5cm"),
        (
            "Bulk density (kg/dm3)",
            "soil_bulk_density_0-5cm",
        ),
        (
            "CEC (cmol(c)/kg)",
            "soil_cec_0-5cm",
        ),
        (
            "Nitrogen (g/kg)",
            "soil_nitrogen_0-5cm",
        ),
    ]

    for label, key in topsoil_fields:
        print(
            f"{label:<30}: "
            f"{record[key]:.6f}"
        )

    print()
    print("ALL DEPTHS")
    print("-" * 70)

    for property_name, config in SOIL_PROPERTIES.items():

        print()
        print(
            f"{property_name} "
            f"[{config['unit']}]"
        )

        for depth in DEPTHS:

            key = (
                f"{property_name}_{depth}"
            )

            print(
                f"    {depth:<10}: "
                f"{record[key]:.6f}"
            )


# ---------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------

def main() -> int:

    print("=" * 70)
    print("FIELD SHIFT — BUILD FIELD SOIL PROFILE")
    print("=" * 70)

    print(f"Field ID     : {FIELD_ID}")
    print(f"Backend      : {BACKEND_URL}")
    print(
        f"SoilGrids resolution: "
        f"{SOILGRIDS_RESOLUTION_M} m"
    )

    # -------------------------------------------------------------
    # 1. Initialize Earth Engine
    # -------------------------------------------------------------

    print()
    print("[INFO] Initializing Earth Engine...")

    init_earth_engine()

    print("[OK] Earth Engine initialized.")

    # -------------------------------------------------------------
    # 2. Fetch field
    # -------------------------------------------------------------

    field = fetch_field()

    # -------------------------------------------------------------
    # 3. Convert field polygon
    # -------------------------------------------------------------

    field_geometry = get_field_geometry(field)

    # -------------------------------------------------------------
    # 4. Build SoilGrids image
    # -------------------------------------------------------------

    soil_image = build_soil_image()

    # -------------------------------------------------------------
    # 5. Count valid pixels
    # -------------------------------------------------------------

    valid_pixel_count = count_valid_pixels(
        soil_image,
        field_geometry,
    )

    print(
        f"[INFO] Common valid SoilGrids pixels: "
        f"{valid_pixel_count}"
    )

    if valid_pixel_count == 0:
        raise RuntimeError(
            "No valid SoilGrids pixels were found "
            "inside the field polygon."
        )

    # -------------------------------------------------------------
    # 6. Aggregate
    # -------------------------------------------------------------

    result = reduce_soil_profile(
        soil_image,
        field_geometry,
    )

    # -------------------------------------------------------------
    # 7. Validate
    # -------------------------------------------------------------

    validate_result(result)

    # -------------------------------------------------------------
    # 8. Build output record
    # -------------------------------------------------------------

    record = build_output_record(
        field,
        result,
        valid_pixel_count,
    )

    # -------------------------------------------------------------
    # 9. Write CSV
    # -------------------------------------------------------------

    write_csv(record)

    # -------------------------------------------------------------
    # 10. Print summary
    # -------------------------------------------------------------

    print_summary(
        record,
        valid_pixel_count,
    )

    print()
    print("=" * 70)
    print("SOIL PROFILE BUILD COMPLETE")
    print("=" * 70)

    return 0


if __name__ == "__main__":

    try:
        raise SystemExit(main())

    except KeyboardInterrupt:
        print()
        print("[STOPPED] Interrupted by user.")
        raise SystemExit(130)

    except Exception as exc:
        print()
        print("=" * 70)
        print("ERROR")
        print("=" * 70)
        print(f"[ERROR TYPE] {type(exc).__name__}")
        print(f"[ERROR] {exc}")
        raise SystemExit(1)