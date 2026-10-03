import os
import requests
import ee
from dotenv import load_dotenv

from _common import init_earth_engine

load_dotenv()
init_earth_engine()

FIELD_ID = "426e9d97-78cf-45d2-82ae-8131040b5ee7"
START = "2025-01-01"
END = "2025-02-01"

COLLECTION = "NASA/ECOSTRESS/L2T_LSTE/V2"

BACKEND_URL = os.getenv(
    "BACKEND_URL",
    "http://127.0.0.1:8000",
)


def get_field_geometry():
    """Retrieve the field GeoJSON polygon from the Field Shift backend."""

    url = f"{BACKEND_URL}/api/v1/fields/{FIELD_ID}"

    response = requests.get(url, timeout=30)
    response.raise_for_status()

    field = response.json()

    geometry = field.get("geojson_polygon")

    if geometry is None:
        raise RuntimeError(
            "Backend response does not contain 'geojson_polygon'.\n"
            f"Response: {field}"
        )

    return ee.Geometry(geometry)

def main():

    print("=" * 70)
    print("ECOSTRESS QC DIAGNOSTIC")
    print("=" * 70)

    geom = get_field_geometry()

    collection = (
        ee.ImageCollection(COLLECTION)
        .filterDate(START, END)
        .filterBounds(geom)
        .select(["LST", "QC", "cloud", "water"])
    )

    count = collection.size().getInfo()

    print(f"ECOSTRESS source images: {count}")

    if count == 0:
        print("No ECOSTRESS images found.")
        return

    images = collection.toList(count)

    for i in range(count):

        image = ee.Image(images.get(i))

        image_id = image.id().getInfo()

        date = (
            ee.Date(image.get("system:time_start"))
            .format("YYYY-MM-dd HH:mm:ss")
            .getInfo()
        )

        # ---------------------------------------------------------
        # Raw LST — NO QC MASK
        # ---------------------------------------------------------
        raw_lst = image.select("LST").reduceRegion(
            reducer=ee.Reducer.mean().combine(
                reducer2=ee.Reducer.count(),
                sharedInputs=True,
            ),
            geometry=geom,
            scale=70,
            maxPixels=1e9,
            bestEffort=True,
        ).getInfo()

        # ---------------------------------------------------------
        # QC histogram
        # ---------------------------------------------------------
        qc_hist = image.select("QC").reduceRegion(
            reducer=ee.Reducer.frequencyHistogram(),
            geometry=geom,
            scale=70,
            maxPixels=1e9,
            bestEffort=True,
        ).getInfo()

        # ---------------------------------------------------------
        # Cloud histogram
        # ---------------------------------------------------------
        cloud_hist = image.select("cloud").reduceRegion(
            reducer=ee.Reducer.frequencyHistogram(),
            geometry=geom,
            scale=70,
            maxPixels=1e9,
            bestEffort=True,
        ).getInfo()

        # ---------------------------------------------------------
        # Water histogram
        # ---------------------------------------------------------
        water_hist = image.select("water").reduceRegion(
            reducer=ee.Reducer.frequencyHistogram(),
            geometry=geom,
            scale=70,
            maxPixels=1e9,
            bestEffort=True,
        ).getInfo()

        print()
        print("-" * 70)
        print(f"IMAGE : {image_id}")
        print(f"DATE  : {date}")
        print()

        print("RAW LST:")
        print(raw_lst)

        print()
        print("QC VALUES:")
        print(qc_hist)

        print()
        print("CLOUD VALUES:")
        print(cloud_hist)

        print()
        print("WATER VALUES:")
        print(water_hist)

    print()
    print("=" * 70)
    print("DIAGNOSTIC COMPLETE")
    print("=" * 70)


if __name__ == "__main__":
    main()