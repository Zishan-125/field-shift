"""
FIELD SHIFT — Sentinel-1 orbit mix per demo field and year

The classifier dekads pool all Sentinel-1 orbits over a field. If the share
of each orbit changes across years (Sentinel-1B failed in December 2021,
which removed half the passes), pooling can inject a false change, because
orbits see the field at different incidence angles. This table counts
observations per orbit per field per year, and measures each orbit's offset
from the all-orbit mean on overlapping periods (same field, same month).

Output: data-pipeline/derived/s1_orbit_mix.csv, s1_orbit_offsets.csv

Run:
    python data-pipeline/fields/orbit_mix.py
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
PROCESSED = ROOT / "data-pipeline" / "data" / "processed"
DERIVED = ROOT / "data-pipeline" / "derived"


def main() -> None:
    frames = [pd.read_csv(p, parse_dates=["date"]) for p in sorted(PROCESSED.glob("feni_*_01.csv"))]
    s1 = pd.concat(frames)
    s1 = s1[(s1["source"] == "S1_GRD") & (s1["variable"] == "VH")].copy()
    s1["year"] = s1["date"].dt.year
    s1["month"] = s1["date"].dt.to_period("M")

    counts = s1.pivot_table(index=["field_id", "year"], columns="orbit", values="value", aggfunc="count", fill_value=0)
    shares = counts.div(counts.sum(axis=1), axis=0).round(2)
    table = counts.join(shares, rsuffix="_share")
    table["n_total"] = counts.sum(axis=1)

    # Orbit offset: VH of each orbit minus the mean of all orbits in the same field-month.
    s1["month_mean"] = s1.groupby(["field_id", "month"])["value"].transform("mean")
    s1["offset_db"] = s1["value"] - s1["month_mean"]
    offsets = s1.groupby(["field_id", "orbit"])["offset_db"].agg(["mean", "std", "count"]).round(2)

    DERIVED.mkdir(parents=True, exist_ok=True)
    table.to_csv(DERIVED / "s1_orbit_mix.csv")
    offsets.to_csv(DERIVED / "s1_orbit_offsets.csv")
    print(counts.to_string())
    print(offsets.to_string())


if __name__ == "__main__":
    main()
