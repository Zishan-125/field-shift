import ee

from _common import fetch_fields, init_earth_engine


FIELD_ID = "426e9d97-78cf-45d2-82ae-8131040b5ee7"

COLLECTION_ID = "NASA/GPM_L3/IMERG_V07"
BAND = "precipitation"
SCALE = 11132


init_earth_engine(None)

fields = fetch_fields(
    "http://localhost:8000",
    FIELD_ID,
)

field = fields[0]

geom = ee.Geometry(
    field["geojson_polygon"]
)

collection = (
    ee.ImageCollection(COLLECTION_ID)
    .filterDate("2025-01-01", "2025-01-02")
    .filterBounds(geom)
    .select(BAND)
)

print("Image count:", collection.size().getInfo())

first = ee.Image(collection.first())

stats = first.reduceRegion(
    reducer=ee.Reducer.mean(),
    geometry=geom,
    scale=SCALE,
    maxPixels=1e9,
    bestEffort=True,
)

print("First image precipitation:", stats.get(BAND).getInfo())

daily_sum = (
    collection
    .map(lambda image: image.multiply(0.5))
    .sum()
)

daily_stats = daily_sum.reduceRegion(
    reducer=ee.Reducer.mean(),
    geometry=geom,
    scale=SCALE,
    maxPixels=1e9,
    bestEffort=True,
)

print(
    "Jan 1 rainfall:",
    daily_stats.get(BAND).getInfo(),
)