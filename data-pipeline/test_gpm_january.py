import ee
from _common import init_earth_engine

init_earth_engine(None)

# Feni, Bangladesh
feni = ee.Geometry.Point([91.3976, 23.0159])
region = feni.buffer(15000)

collection = (
    ee.ImageCollection("NASA/GPM_L3/IMERG_V07")
    .filterDate("2025-07-01", "2025-08-01")
    .filterBounds(region)
    .select("precipitation")
)

print("=" * 60)
print("GPM IMERG V07 rainfall accumulation validation")
print("=" * 60)

print("Image count:", collection.size().getInfo())

# ---------------------------------------------------------
# Maximum precipitation rate
# ---------------------------------------------------------
max_rate = collection.max()

max_point = max_rate.reduceRegion(
    reducer=ee.Reducer.max(),
    geometry=feni,
    scale=11132,
    maxPixels=1e9,
    bestEffort=True,
)

print(
    "Maximum precipitation at Feni:",
    max_point.get("precipitation").getInfo(),
    "mm/hr",
)

# ---------------------------------------------------------
# Convert 30-minute precipitation rate to accumulation
# ---------------------------------------------------------
rainfall = collection.map(
    lambda image: image.multiply(0.5)
).sum()

# ---------------------------------------------------------
# July rainfall at Feni point
# ---------------------------------------------------------
point_total = rainfall.reduceRegion(
    reducer=ee.Reducer.mean(),
    geometry=feni,
    scale=11132,
    maxPixels=1e9,
    bestEffort=True,
)

print(
    "Total July rainfall at Feni:",
    point_total.get("precipitation").getInfo(),
    "mm",
)

# ---------------------------------------------------------
# July rainfall over 15 km region
# ---------------------------------------------------------
region_total = rainfall.reduceRegion(
    reducer=ee.Reducer.mean(),
    geometry=region,
    scale=11132,
    maxPixels=1e9,
    bestEffort=True,
)

print(
    "Mean July rainfall over 15 km region:",
    region_total.get("precipitation").getInfo(),
    "mm",
)

print("=" * 60)