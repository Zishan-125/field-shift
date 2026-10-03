import ee

from _common import init_earth_engine

COLLECTION_ID = "NASA/GRACE/MASS_GRIDS_V04/MASCON_CRI"
BAND = "lwe_thickness"


def main():
    init_earth_engine()

    collection = ee.ImageCollection(COLLECTION_ID)

    total = collection.size().getInfo()
    print(f"[INFO] Total GRACE images: {total}")

    start = "2019-01-01"
    end = "2025-01-01"

    historical = (
        collection
        .filterDate(start, end)
        .sort("system:time_start")
    )

    count = historical.size().getInfo()
    print(f"[INFO] GRACE images 2019-2024: {count}")

    if count == 0:
        print("[WARNING] No GRACE observations found.")
        return

    images = historical.toList(count)

    print()
    print("Available GRACE observation dates:")
    print("-" * 50)

    for i in range(count):
        image = ee.Image(images.get(i))

        timestamp = image.get("system:time_start").getInfo()

        date_string = (
            ee.Date(timestamp)
            .format("YYYY-MM-dd")
            .getInfo()
        )

        print(date_string)

    print("-" * 50)
    print(f"[SUCCESS] Found {count} available observations.")


if __name__ == "__main__":
    main()