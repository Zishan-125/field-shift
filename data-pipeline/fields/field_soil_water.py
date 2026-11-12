"""
FIELD SHIFT — soil water limits for the demo fields (for the SMAP drought count)

Field capacity (33 kPa) and wilting point (1500 kPa) from the Saxton & Rawls
(2006) pedotransfer equations, using ISRIC SoilGrids 2.0 sand, clay and
organic carbon within 300 m of each demo field's centre, depth-weighted over 0-30 cm (0-5, 5-15,
15-30 cm). Organic matter = 1.724 x organic carbon.

    Saxton, K.E. & Rawls, W.J. (2006). Soil water characteristic estimates by
    texture and organic matter for hydrologic solutions. Soil Science Society
    of America Journal 70: 1569-1578. doi:10.2136/sssaj2005.0117

SMAP is put on the field's soil through its degree of saturation:
    theta_field = sm_rootzone / smap_porosity x theta_sat
A crop is short of water when that drops below
    theta_fc - p * (theta_fc - theta_wp)
with p the FAO-56 depletion fraction (Allen et al. 1998, Table 22), applied
in backend/offline/server.py to SMAP L4 root-zone moisture. SMAP is a 9 km
model product with its own soil; this compares it with the field's soil,
which is approximate and documented as such.

Output: data-pipeline/derived/demo_field_soil_water.csv

Run:
    python data-pipeline/fields/field_soil_water.py --project field-shift-bd
"""

from __future__ import annotations

import argparse
import json
import os
import time
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
FIELDS = ROOT / "data-pipeline" / "reference" / "fields.geojson"
OUTPUT = ROOT / "data-pipeline" / "derived" / "demo_field_soil_water.csv"
DEPTHS = {"0-5cm": 5, "5-15cm": 10, "15-30cm": 15}


def saxton_rawls(sand_pct: float, clay_pct: float, om_pct: float) -> tuple[float, float, float]:
    """Field capacity, wilting point and saturation (m3/m3), Saxton & Rawls (2006) eqs 1-5."""

    S, C, OM = sand_pct / 100, clay_pct / 100, om_pct
    t1500 = -0.024 * S + 0.487 * C + 0.006 * OM + 0.005 * S * OM - 0.013 * C * OM + 0.068 * S * C + 0.031
    wp = t1500 + (0.14 * t1500 - 0.02)
    t33 = -0.251 * S + 0.195 * C + 0.011 * OM + 0.006 * S * OM - 0.027 * C * OM + 0.452 * S * C + 0.299
    fc = t33 + (1.283 * t33 ** 2 - 0.374 * t33 - 0.015)
    ts33 = 0.278 * S + 0.034 * C + 0.022 * OM - 0.018 * S * OM - 0.027 * C * OM - 0.584 * S * C + 0.078
    s33 = ts33 + (0.636 * ts33 - 0.107)
    sat = fc + s33 - 0.097 * S + 0.043
    return fc, wp, sat


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", default=os.environ.get("EE_PROJECT", "field-shift-bd"))
    args = parser.parse_args()

    import ee

    for attempt in range(10):
        try:
            ee.Initialize(project=args.project)
            break
        except Exception as error:  # noqa: BLE001 - concurrency limit
            print(f"retry init ({attempt + 1}): {str(error)[:80]}")
            time.sleep(30)

    features = json.loads(FIELDS.read_text(encoding="utf-8"))["features"]
    collection = ee.FeatureCollection([
        # 300 m buffer: a 90 m square can miss every 250 m SoilGrids pixel centre.
        ee.Feature(ee.Geometry(f["geometry"]).centroid(1).buffer(300), {"field_id": f["properties"]["field_id"]})
        for f in features
    ])
    bands = []
    for prop in ("sand", "clay", "soc"):
        image = ee.Image(f"projects/soilgrids-isric/{prop}_mean")
        bands += [image.select(f"{prop}_{d}_mean") for d in DEPTHS]
    stack = ee.Image.cat(bands)
    result = stack.reduceRegions(collection, ee.Reducer.mean(), 250).getInfo()["features"]

    # SMAP L4 model porosity of each field's 9 km cell (constant in time).
    smap = ee.ImageCollection("NASA/SMAP/SPL4SMGP/008").filterDate("2024-01-01", "2024-01-02").first()
    ratio = smap.select("sm_rootzone").divide(smap.select("sm_rootzone_wetness")).rename("porosity")
    centres = ee.FeatureCollection([
        ee.Feature(ee.Geometry(f["geometry"]).centroid(1), {"field_id": f["properties"]["field_id"]}) for f in features
    ])
    smap_porosity = {
        f["properties"]["field_id"]: round(f["properties"]["porosity"], 3)
        for f in ratio.sampleRegions(centres, ["field_id"], 9000).getInfo()["features"]
    }

    rows = []
    total = sum(DEPTHS.values())
    for feature in result:
        p = feature["properties"]
        avg = {prop: sum(p[f"{prop}_{d}_mean"] * w for d, w in DEPTHS.items()) / total / 10 for prop in ("sand", "clay", "soc")}
        om = 1.724 * avg["soc"] / 10                      # soc g/kg -> % C -> % OM
        fc, wp, sat = saxton_rawls(avg["sand"], avg["clay"], om)
        rows.append({"field_id": p["field_id"], "sand_pct": round(avg["sand"], 1), "clay_pct": round(avg["clay"], 1),
                     "soc_g_kg": round(avg["soc"], 1), "theta_fc": round(fc, 3), "theta_wp": round(wp, 3),
                     "theta_sat": round(sat, 3), "smap_porosity": smap_porosity.get(p["field_id"]),
                     "method": "SoilGrids 2.0 0-30 cm, Saxton & Rawls (2006); SMAP porosity = sm_rootzone / sm_rootzone_wetness"})

    frame = pd.DataFrame(rows)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(OUTPUT, index=False)
    print(frame.to_string(index=False))


if __name__ == "__main__":
    main()
