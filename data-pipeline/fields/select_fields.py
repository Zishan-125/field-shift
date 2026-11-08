"""
FIELD SHIFT — choose the six demo fields (one per Feni upazila)

Every field is a 90 m x 90 m square (3 x 3 HLS pixels) whose every 10 m
pixel is cropland in ESA WorldCover v200 (2021, class 40). These are demo
fields chosen by rule, not surveyed farmer plots.

Rules:
    default     cropland block nearest the upazila polygon's centroid
    Sonagazi    coastal: cropland block nearest the southernmost point of
                the upazila (the Feni river estuary / Bay of Bengal side)
    Fulgazi     flood-prone: cropland that Sentinel-1 shows flooded in the
                August 2024 Muhuri flood (VV < -18 dB on average over
                21-31 Aug 2024) and within 2 km of a permanent river channel
                (JRC Global Surface Water occurrence >= 50 %); nearest to
                the channel

Output: data-pipeline/reference/fields.geojson

Run:
    python data-pipeline/fields/select_fields.py --project field-shift-bd
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
UPAZILAS = ROOT / "data-pipeline" / "reference" / "feni_upazilas.geojson"
OUTPUT = ROOT / "data-pipeline" / "reference" / "fields.geojson"

HALF_SIDE_M = 45          # 90 m square
FLOOD_VV_DB = -18.0       # open water / flooded threshold on S1 VV
FLOOD_WINDOW = ("2024-08-21", "2024-09-01")
RIVER_OCCURRENCE = 50     # JRC occurrence (% of months with water)
RIVER_BUFFER_M = 2000


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", default=os.environ.get("EE_PROJECT", "field-shift-bd"))
    args = parser.parse_args()

    import ee

    ee.Initialize(project=args.project)

    worldcover = ee.ImageCollection("ESA/WorldCover/v200").first().select("Map")
    cropland = worldcover.eq(40)
    # 1 where the whole 90 m square around the pixel is cropland.
    solid = cropland.focalMin(radius=HALF_SIDE_M, kernelType="square", units="meters").selfMask()

    river = ee.Image("JRC/GSW1_4/GlobalSurfaceWater").select("occurrence").gte(RIVER_OCCURRENCE).selfMask()
    river_distance = river.fastDistanceTransform(256).sqrt().multiply(ee.Image.pixelArea().sqrt())

    s1 = (
        ee.ImageCollection("COPERNICUS/S1_GRD")
        .filterDate(*FLOOD_WINDOW)
        .filter(ee.Filter.eq("instrumentMode", "IW"))
        .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VV"))
        .select("VV")
        .mean()
    )
    flooded = s1.lt(FLOOD_VV_DB)

    data = json.loads(UPAZILAS.read_text(encoding="utf-8"))
    fields = []

    for feature in data["features"]:
        upazila = feature["properties"]["upazila"]
        polygon = ee.Geometry(feature["geometry"])

        if upazila == "Sonagazi":
            from shapely.geometry import shape

            outline = shape(feature["geometry"])
            parts = getattr(outline, "geoms", [outline])
            south = min((c for part in parts for c in part.exterior.coords), key=lambda c: c[1])
            target = ee.Geometry.Point(south)
            candidates = solid
            rule = "coastal: cropland block nearest the southernmost point of the upazila"
        elif upazila == "Fulgazi":
            target = None
            candidates = solid.updateMask(flooded).updateMask(river_distance.lt(RIVER_BUFFER_M))
            rule = (
                f"flood-prone: Sentinel-1 VV < {FLOOD_VV_DB:g} dB (mean {FLOOD_WINDOW[0]} to {FLOOD_WINDOW[1]}), "
                f"within {RIVER_BUFFER_M} m of a JRC river channel (Muhuri), nearest to the channel"
            )
        else:
            target = polygon.centroid(1)
            candidates = solid
            rule = "cropland block nearest the upazila centroid"

        layer = candidates.rename("ok").addBands(river_distance.rename("river_m"))
        if target is not None:
            layer = layer.addBands(ee.Image.constant(0).paint(target, 1).fastDistanceTransform(512).sqrt().rename("d"))

        points = layer.updateMask(candidates).sample(
            region=polygon, scale=10, numPixels=6000, seed=1, geometries=True
        ).getInfo()["features"]

        if not points:
            raise RuntimeError(f"No candidate cropland in {upazila}")

        key = (lambda p: p["properties"]["river_m"]) if target is None else (lambda p: p["properties"]["d"])
        best = min(points, key=key)
        lon, lat = best["geometry"]["coordinates"]
        square = ee.Geometry.Point([lon, lat]).buffer(HALF_SIDE_M).bounds(1)

        check = ee.Dictionary({
            "cropland_share": cropland.reduceRegion(ee.Reducer.mean(), square, 10).get("Map"),
            "river_distance_m": river_distance.reduceRegion(ee.Reducer.min(), square, 30).values().get(0),
            "s1_vv_aug2024_db": s1.reduceRegion(ee.Reducer.mean(), square, 10).get("VV"),
        }).getInfo()

        fields.append({
            "type": "Feature",
            "properties": {
                "field_id": f"feni_{upazila.lower().replace(' ', '_')}_01",
                "upazila": upazila,
                "rule": rule,
                "center_lat": round(lat, 6),
                "center_lon": round(lon, 6),
                "size_m": 2 * HALF_SIDE_M,
                "worldcover_cropland_share": round(check["cropland_share"], 3),
                "distance_to_river_channel_m": round(check["river_distance_m"]) if check["river_distance_m"] is not None else None,
                "s1_vv_aug2024_db": round(check["s1_vv_aug2024_db"], 2) if check["s1_vv_aug2024_db"] is not None else None,
                "source": "ESA WorldCover v200; JRC GSW 1.4; Copernicus Sentinel-1 GRD. Demo field chosen by rule, not a surveyed plot.",
            },
            "geometry": square.getInfo(),
        })
        print(upazila, fields[-1]["properties"])

    OUTPUT.write_text(json.dumps({"type": "FeatureCollection", "features": fields}, indent=1), encoding="utf-8")
    print(f"[OK] {OUTPUT}")


if __name__ == "__main__":
    main()
