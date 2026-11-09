"""
FIELD SHIFT — do the crop-hazard flags line up with Feni's BBS rice yields?

The app counts how often each crop's window was hit (server.crop_exposure).
A flag that fires in most years may describe normal weather, not damage.
This checks the flags against BBS Feni district yield and production
(reference/bbs_feni_rice_series.csv, BBS Yearbooks 2013-2025):

    Boro    heat at flowering   vs Total Boro yield / production (harvest year)
    T. Aman flood-size downpour vs Total Aman yield / production (season year)

A year is flagged when the hazard hit the crop's window (current pattern's
calendar) in at least half of the six upazilas; heat is the same in every
upazila (one temperature grid cell).

Statistics: difference of means (flagged - unflagged) and an exact two-sided
permutation p-value over all ways of choosing the flagged years. Done on the
raw values and on "local anomalies" (value minus the median of the other
years within +-3 years), because Aman yield steps up by about 0.4 t/ha in
2020-21 and a raw comparison would mix that step with the hazard.

Output: data-pipeline/derived/hazard_yield_check.csv

Run:
    python data-pipeline/climate/hazard_yield_check.py
"""

from __future__ import annotations

import itertools
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend" / "offline"))

REFERENCE = ROOT / "data-pipeline" / "reference" / "bbs_feni_rice_series.csv"
OUTPUT = ROOT / "data-pipeline" / "derived" / "hazard_yield_check.csv"
UPAZILAS = ["Chhagalnaiya", "Daganbhuiyan", "Feni Sadar", "Fulgazi", "Parshuram", "Sonagazi"]
CHECKS = {
    ("rice_boro", "heat_flowering"): "total_boro",
    ("rice_aman", "flood_rain"): "total_aman",
    ("rice_aman", "heat_flowering"): "total_aman",
}
LINK_P = 0.05   # a hazard counts as linked to loss if flagged years are lower at p < 0.05 (local anomaly)


def local_anomaly(series: pd.Series) -> pd.Series:
    out = {}
    for year, value in series.items():
        neighbours = series[(series.index != year) & (abs(series.index - year) <= 3)]
        out[year] = value - neighbours.median()
    return pd.Series(out)


def permutation(values: pd.Series, flagged: set) -> tuple[float, float]:
    v = values.to_numpy(dtype=float)
    is_flagged = np.array([y in flagged for y in values.index])
    k, n = int(is_flagged.sum()), len(v)
    observed = v[is_flagged].mean() - v[~is_flagged].mean()
    combos = np.array(list(itertools.combinations(range(n), k)))
    sums = v[combos].sum(axis=1)
    diffs = sums / k - (v.sum() - sums) / (n - k)
    p = float((np.abs(diffs) >= abs(observed) - 1e-12).mean())
    return float(observed), p


def main() -> None:
    import server

    recommendations = server.pattern_recommendations(server.FIELD_ID, server.PatternRecommendationRequest())
    schedule = {item["crop_id"]: item for item in recommendations["current"]["schedule"]}
    offsets = server.flowering_offsets()
    bbs = pd.read_csv(REFERENCE)
    rows = []

    for (crop_id, hazard), bbs_crop in CHECKS.items():
        item = schedule[crop_id]
        hits_by_upazila = [set(server.crop_hits(item, u, offsets)["hits"][hazard]) for u in UPAZILAS]
        series = bbs[bbs["crop"] == bbs_crop].set_index("season_year")
        flagged = {y for y in series.index if sum(y in h for h in hits_by_upazila) >= len(UPAZILAS) / 2}

        for outcome in ("yield_t_ha", "production_t"):
            for basis, values in (("raw", series[outcome].astype(float)),
                                  ("local_anomaly", local_anomaly(series[outcome].astype(float)))):
                diff, p = permutation(values, flagged)
                unflagged_mean = values[[y not in flagged for y in values.index]].mean()
                rows.append({
                    "crop": crop_id, "hazard": hazard, "outcome": outcome, "basis": basis,
                    "years": f"{values.index.min()}-{values.index.max()}", "n_years": len(values),
                    "flagged_years": " ".join(str(y) for y in sorted(flagged)), "n_flagged": len(flagged),
                    "mean_flagged": round(values[[y in flagged for y in values.index]].mean(), 3),
                    "mean_unflagged": round(unflagged_mean, 3),
                    "difference": round(diff, 3),
                    "difference_pct_of_unflagged_level": round(100 * diff / series[outcome].mean(), 1),
                    "permutation_p": round(p, 3),
                })

    frame = pd.DataFrame(rows)
    local = frame[frame["basis"] == "local_anomaly"]
    verdict = {}
    for (crop, hazard), g in local.groupby(["crop", "hazard"]):
        linked = ((g["difference"] < 0) & (g["permutation_p"] < LINK_P)).any()
        verdict[(crop, hazard)] = "linked_to_loss" if linked else "exposure_only"
    frame["verdict"] = [verdict[(c, h)] for c, h in zip(frame["crop"], frame["hazard"])]
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(OUTPUT, index=False)
    print(frame.to_string(index=False))


if __name__ == "__main__":
    main()
