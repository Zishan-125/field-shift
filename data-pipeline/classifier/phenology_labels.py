"""
FIELD SHIFT — weak crop labels from phenology rules

Each (point, season, year) gets at most one label from transparent rules on
the raw dekad composites (classifier/extract_point_dekads.py). Points where
no rule fires, or two rules fire, stay UNLABELLED; they are not guessed.
These are weak labels, not ground truth. Rules, thresholds and failure modes:
docs/methodology/phenology.md.

Seasons and windows follow the DAE BAMIS Chattogram crop calendar
(data-pipeline/reference/crop_calendar.csv), widened by a few dekads for late
planting:

    Rabi season Y   (Oct Y-1 to May Y)  -> Boro | Rabi_nonrice | Fallow
    Kharif-2 season Y (Jul to Nov Y)    -> T_Aman | Fallow

Signals per dekad:
    optical flood   LSWI + 0.05 >= EVI (flooded or freshly transplanted
                    paddy; Xiao et al. 2005), needs a clear HLS dekad
    radar flood     Sentinel-1 VH < VH_FLOOD_DB (dekad mean)
    green           NDVI >= threshold (per rule)

Run:
    python data-pipeline/classifier/phenology_labels.py              # points
    python data-pipeline/classifier/phenology_labels.py --fields     # demo fields
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
PROCESSED = ROOT / "data-pipeline" / "data" / "processed"

# Thresholds (our choices; see docs/methodology/phenology.md for why).
# Radar values are 10-day means over pooled orbits, which flatten the short
# flooding dip at transplanting: -19 dB here corresponds to single scenes
# of about -22 dB and below. Set by inspecting the six demo fields (which
# are excluded from the training points), not tuned on labels.
XIAO_MARGIN = 0.05          # LSWI + 0.05 >= EVI  (Xiao et al. 2005)
VH_FLOOD_DB = -19.0         # flooding / just transplanted (dekad mean)
VH_FALLOW_MAX_DB = -20.0    # Kharif-2 fallow: water or bare all of Sep-Oct
VH_CANOPY_DB = -17.0        # rice canopy late in the season
VH_RISE_DB = 4.0            # flooding -> canopy rise
NDVI_AMAN_GREEN = 0.60      # if Oct-Nov is seen at all, the canopy must be green
NDVI_BORO_PEAK = 0.60
NDVI_RABI_PEAK = 0.50
NDVI_FALLOW_MAX = 0.40
MIN_CLEAR_FALLOW = 6        # clear dekads needed to call a Rabi field fallow
MIN_RADAR_DEKADS = 6        # radar dekads needed to rule flooding out

# Windows as (month, day) relative to the season year Y; month > 9 in a Rabi
# window means year Y-1.
RABI = {
    "boro_transplant": ((12, 11), (2, 10)),     # BAMIS 17 Dec-14 Jan, plus late transplanting
    "boro_peak": ((2, 11), (4, 30)),            # flowering 12-18 Mar, harvest 2-22 Apr
    "rabi_peak": ((12, 1), (3, 20)),            # mustard, wheat, maize, lentil, potato canopy
    "rabi_no_flood": ((11, 21), (2, 20)),
    "april": ((4, 1), (4, 30)),
    "fallow": ((12, 1), (4, 30)),
}
KHARIF2 = {
    "aman_transplant": ((7, 1), (8, 31)),       # BAMIS 2-29 Jul, BRRI to 15 Aug
    "aman_canopy": ((9, 11), (11, 10)),         # flowering 17-23 Sep, harvest Oct-Nov
    "aman_green": ((10, 1), (11, 20)),
    "fallow_radar": ((9, 1), (10, 31)),
}


def window(frame: pd.DataFrame, year: int, span: tuple, rabi: bool) -> pd.DataFrame:
    (m0, d0), (m1, d1) = span
    y0 = year - 1 if (rabi and m0 > 9) else year
    y1 = year - 1 if (rabi and m1 > 9) else year
    start, end = pd.Timestamp(y0, m0, d0), pd.Timestamp(y1, m1, d1)
    return frame[(frame["dekad_start"] >= start) & (frame["dekad_start"] <= end)]


def optical_flood(w: pd.DataFrame) -> pd.Series:
    return (w["LSWI"] + XIAO_MARGIN >= w["EVI"]) & w["NDVI"].notna()


def radar_flood(w: pd.DataFrame) -> pd.Series:
    return w["VH"] < VH_FLOOD_DB


def rabi_label(p: pd.DataFrame, year: int) -> tuple[str | None, str]:
    transplant = window(p, year, RABI["boro_transplant"], True)
    flooded = bool(optical_flood(transplant).any() or radar_flood(transplant).any())
    boro_peak = window(p, year, RABI["boro_peak"], True)["NDVI"].max()
    rabi_peak = window(p, year, RABI["rabi_peak"], True)["NDVI"].max()
    no_flood_w = window(p, year, RABI["rabi_no_flood"], True)
    radar_seen = int(no_flood_w["VH"].notna().sum())
    flood_any = bool(optical_flood(no_flood_w).any() or radar_flood(no_flood_w).any())
    april = window(p, year, RABI["april"], True)["NDVI"].max()
    fallow_w = window(p, year, RABI["fallow"], True)
    clear = int(fallow_w["NDVI"].notna().sum())

    fired = []
    if flooded and boro_peak >= NDVI_BORO_PEAK:
        fired.append(("Boro", f"flooding at transplanting; NDVI peak {boro_peak:.2f} Feb-Apr"))
    if (rabi_peak >= NDVI_RABI_PEAK and not flood_any and radar_seen >= MIN_RADAR_DEKADS
            and not (april >= NDVI_RABI_PEAK)):
        fired.append(("Rabi_nonrice", f"NDVI peak {rabi_peak:.2f} Dec-Mar, no flooding in {radar_seen} radar dekads, April NDVI {april:.2f}"))
    if clear >= MIN_CLEAR_FALLOW and fallow_w["NDVI"].max() < NDVI_FALLOW_MAX:
        fired.append(("Fallow", f"NDVI max {fallow_w['NDVI'].max():.2f} in {clear} clear dekads Dec-Apr"))

    if len(fired) == 1:
        return fired[0]
    return None, "no rule fired" if not fired else "conflict: " + ", ".join(f[0] for f in fired)


def kharif2_label(p: pd.DataFrame, year: int) -> tuple[str | None, str]:
    transplant = window(p, year, KHARIF2["aman_transplant"], False)
    canopy = window(p, year, KHARIF2["aman_canopy"], False)
    green = window(p, year, KHARIF2["aman_green"], False)["NDVI"]
    fallow_w = window(p, year, KHARIF2["fallow_radar"], False)

    vh_low, vh_high = transplant["VH"].min(), canopy["VH"].max()
    fired = []
    if (radar_flood(transplant).any() and vh_high >= VH_CANOPY_DB and vh_high - vh_low >= VH_RISE_DB
            and not (green.notna().any() and green.max() < NDVI_AMAN_GREEN)):
        fired.append(("T_Aman", f"VH {vh_low:.1f} dB Jul-Aug -> {vh_high:.1f} dB Sep-Nov"))
    if (fallow_w["VH"].notna().sum() >= 4 and fallow_w["VH"].max() < VH_FALLOW_MAX_DB
            and not (green.max() >= NDVI_FALLOW_MAX)):
        fired.append(("Fallow", f"VH max {fallow_w['VH'].max():.1f} dB Sep-Oct (water or bare)"))

    if len(fired) == 1:
        return fired[0]
    return None, "no rule fired" if not fired else "conflict: " + ", ".join(f[0] for f in fired)


def label_all(dekads: pd.DataFrame) -> pd.DataFrame:
    dekads = dekads.copy()
    dekads["dekad_start"] = pd.to_datetime(dekads["dekad_start"])
    first, last = dekads["dekad_start"].min(), dekads["dekad_start"].max()
    rows = []

    for point_id, p in dekads.groupby("point_id"):
        for year in range(first.year + 1, last.year + 1):
            if pd.Timestamp(year, 5, 31) <= last:
                label, why = rabi_label(p, year)
                rows.append({"point_id": point_id, "season": "rabi", "year": year, "label": label, "rule": why})
            if pd.Timestamp(year, 11, 30) <= last:
                label, why = kharif2_label(p, year)
                rows.append({"point_id": point_id, "season": "kharif2", "year": year, "label": label, "rule": why})

    return pd.DataFrame(rows)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--fields", action="store_true")
    args = parser.parse_args()

    name = "demo_field" if args.fields else "classifier"
    labels = label_all(pd.read_csv(PROCESSED / f"{name}_dekads.csv"))
    labels.to_csv(PROCESSED / f"{name}_phenology_labels.csv", index=False)

    summary = labels.assign(label=labels["label"].fillna("unlabelled")).pivot_table(
        index=["season", "year"], columns="label", values="point_id", aggfunc="count", fill_value=0)
    print(summary.to_string())


if __name__ == "__main__":
    main()
