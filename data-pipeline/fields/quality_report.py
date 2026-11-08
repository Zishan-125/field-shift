"""
FIELD SHIFT — data-quality report for the demo-field time series

Reads data-pipeline/data/processed/<field_id>.csv (written by
extract_field_timeseries.py) and reports, per field, season and sensor:

    n_obs           clear / valid observations in the season
    longest_gap_d   longest run of days with no observation, season edges
                    included (a season with no observation = its full length)
    n_outliers      Hampel flags: value further than 3 scaled MADs (and more
                    than a floor) from the median of its 4 neighbours in time
    n_out_of_range  physically impossible or noise-dominated values: an
                    index outside [-1, 1], LST outside 0-60 C, Sentinel-1 VH
                    below -30 dB (our cut-off, below the instrument noise
                    level, where the field mean is mostly noise)

The Sentinel-1 floor (5 dB) is wide on purpose: transplanting and floods
drop backscatter by 5-10 dB within days, which is signal, not error.

Nothing is filled, smoothed or removed here. Outliers are flagged and listed;
deciding what to do with them is the classifier's job, and is documented
there.

Seasons follow the Bangladesh agricultural year used by BBS:
    Rabi      16 Oct - 15 Mar   (labelled by the year it ends, e.g. Rabi 2024 = Oct 2023 - Mar 2024)
    Kharif-1  16 Mar - 15 Jul
    Kharif-2  16 Jul - 15 Oct
Boro rice runs Dec-Apr, so its grain filling falls in the first weeks of
Kharif-1; keep that in mind when reading the Rabi rows.

Outputs (git-ignored, regenerate with this script):
    data-pipeline/output/validation/field_quality_seasons.csv
    data-pipeline/output/validation/field_quality_outliers.csv
    data-pipeline/output/validation/field_quality.md

Run:
    python data-pipeline/fields/quality_report.py
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
PROCESSED = ROOT / "data-pipeline" / "data" / "processed"
OUT = ROOT / "data-pipeline" / "output" / "validation"

# Series checked for outliers and the minimum deviation that counts (so a
# flat, low-noise series does not flag tiny wiggles).
OUTLIER_FLOOR = {"NDVI": 0.15, "EVI": 0.15, "LSWI": 0.15, "VV": 5.0, "VH": 5.0, "LST_day_C": 5.0}
VALID_RANGE = {"NDVI": (-1, 1), "EVI": (-1, 1), "LSWI": (-1, 1), "LST_day_C": (0, 60), "VH": (-30, 10), "VV": (-30, 10)}
HAMPEL_HALF_WINDOW = 2
HAMPEL_SIGMAS = 3.0

# Which rows count as one "observation" of a sensor.
SENSOR_VARIABLE = {
    "HLS (L30+S30)": ("NDVI", ("HLSL30", "HLSS30")),
    "Sentinel-1": ("VV", ("S1_GRD",)),
    "MOD13Q1": ("NDVI", ("MOD13Q1",)),
    "MOD11A2": ("LST_day_C", ("MOD11A2",)),
    "SMAP L4": ("sm_rootzone", ("SPL4SMGP_008",)),
    "GPM IMERG": ("precip_mm", ("GPM_IMERG_V07",)),
}


def seasons(first_year: int, last_year: int) -> list[tuple[str, pd.Timestamp, pd.Timestamp]]:
    out = []
    for year in range(first_year, last_year + 1):
        out.append((f"Rabi {year}", pd.Timestamp(f"{year - 1}-10-16"), pd.Timestamp(f"{year}-03-15")))
        out.append((f"Kharif-1 {year}", pd.Timestamp(f"{year}-03-16"), pd.Timestamp(f"{year}-07-15")))
        out.append((f"Kharif-2 {year}", pd.Timestamp(f"{year}-07-16"), pd.Timestamp(f"{year}-10-15")))
    return out


def longest_gap(dates: pd.Series, start: pd.Timestamp, end: pd.Timestamp) -> int:
    """Longest run of days without an observation, counting the season edges."""

    days = sorted(set(dates))
    edges = [start - pd.Timedelta(days=1)] + days + [end + pd.Timedelta(days=1)]
    return int(max((b - a).days - 1 for a, b in zip(edges, edges[1:])))


def good_rows(frame: pd.DataFrame) -> pd.Series:
    """Observations usable as 'clear': MODIS QA 0/1 (good / marginal), the rest as extracted."""

    modis = frame["source"].isin(["MOD13Q1", "MOD11A2"])
    return ~modis | frame["qc"].isin([0, 1])


def hampel(series: pd.DataFrame, floor: float) -> pd.DataFrame:
    """Flag points far from the median of their neighbours (the point itself excluded)."""

    values = series["value"].to_numpy()
    flags = []

    for i in range(len(values)):
        lo, hi = max(0, i - HAMPEL_HALF_WINDOW), min(len(values), i + HAMPEL_HALF_WINDOW + 1)
        neighbours = np.r_[values[lo:i], values[i + 1:hi]]
        if len(neighbours) < 2:
            flags.append((False, np.nan))
            continue
        median = np.median(neighbours)
        mad = 1.4826 * np.median(np.abs(neighbours - median))
        deviation = abs(values[i] - median)
        flags.append((deviation > max(HAMPEL_SIGMAS * mad, floor), median))

    out = series.copy()
    out["is_outlier"] = [f for f, _ in flags]
    out["neighbour_median"] = [m for _, m in flags]
    return out


def field_report(path: Path) -> tuple[list[dict], pd.DataFrame]:
    frame = pd.read_csv(path, parse_dates=["date"])
    frame = frame[good_rows(frame)]
    field_id = frame["field_id"].iloc[0]

    # Outliers per series (S1 per orbit: the geometry differs between orbits).
    flagged = []
    for variable, floor in OUTLIER_FLOOR.items():
        part = frame[frame["variable"] == variable]
        keys = ["source", "orbit"] if variable in ("VV", "VH") else ["variable"]
        for _, group in part.groupby(keys, dropna=False):
            group = group.sort_values("date")
            if variable in ("NDVI", "EVI", "LSWI") and group["source"].iloc[0].startswith("HLS"):
                continue  # HLS is checked below as one L30+S30 series
            flagged.append(hampel(group, floor))
        if variable in ("NDVI", "EVI", "LSWI"):
            hls = part[part["source"].str.startswith("HLS")].sort_values("date")
            if not hls.empty:
                flagged.append(hampel(hls, floor))

    outliers = pd.concat(flagged) if flagged else pd.DataFrame()
    outliers = outliers[outliers["is_outlier"]].assign(flag="hampel") if not outliers.empty else outliers

    lo = frame["variable"].map({k: v[0] for k, v in VALID_RANGE.items()})
    hi = frame["variable"].map({k: v[1] for k, v in VALID_RANGE.items()})
    out_of_range = frame[(frame["value"] < lo) | (frame["value"] > hi)].assign(flag="out_of_range")
    outliers = pd.concat([outliers, out_of_range], ignore_index=True)

    first, last = frame["date"].min().year, frame["date"].max().year + 1
    end_of_data = frame["date"].max()
    rows = []

    for season, start, end in seasons(first, last):
        if start > end_of_data:
            break
        season_end = min(end, end_of_data)
        partial = season_end < end

        for sensor, (variable, sources) in SENSOR_VARIABLE.items():
            obs = frame[(frame["variable"] == variable) & frame["source"].isin(sources)
                        & frame["date"].between(start, season_end)]
            n_out = n_range = 0
            if not outliers.empty:
                hit = ((outliers["variable"] == variable) & outliers["source"].isin(sources)
                       & outliers["date"].between(start, season_end))
                n_out = int((hit & (outliers["flag"] == "hampel")).sum())
                n_range = int((hit & (outliers["flag"] == "out_of_range")).sum())
            rows.append({
                "field_id": field_id, "season": season, "season_start": start.date(),
                "season_end": season_end.date(), "partial_season": partial, "sensor": sensor,
                "n_obs": int(obs["date"].nunique()),
                "longest_gap_d": longest_gap(obs["date"], start, season_end),
                "n_outliers": n_out,
                "n_out_of_range": n_range,
            })

    return rows, outliers


def markdown(summary: pd.DataFrame, outliers: pd.DataFrame) -> str:
    lines = [
        "# Demo-field data quality",
        "",
        "Generated by `data-pipeline/fields/quality_report.py`. Nothing is gap-filled.",
        "`n_obs` = days with a clear/valid observation; `gap` = longest run of days without one (season edges count).",
        "",
    ]
    for field_id, part in summary.groupby("field_id"):
        lines += [f"## {field_id}", ""]
        for sensor in ("HLS (L30+S30)", "Sentinel-1", "MOD13Q1"):
            s = part[part["sensor"] == sensor]
            pivot = s.assign(cell=s["n_obs"].astype(str) + " / " + s["longest_gap_d"].astype(str) + " d")
            lines += [f"**{sensor}** (n_obs / longest gap)", "", "| Season | " + " | ".join(
                str(y) for y in sorted({x.split()[-1] for x in s["season"]})) + " |"]
            years = sorted({x.split()[-1] for x in s["season"]})
            lines.append("|---" * (len(years) + 1) + "|")
            for name in ("Rabi", "Kharif-1", "Kharif-2"):
                cells = []
                for y in years:
                    hit = pivot[pivot["season"] == f"{name} {y}"]
                    cells.append(hit["cell"].iloc[0] if len(hit) else "")
                lines.append(f"| {name} | " + " | ".join(cells) + " |")
            lines.append("")
        n_out = outliers[outliers["field_id"] == field_id] if not outliers.empty else outliers
        if n_out.empty:
            lines += ["No values flagged.", ""]
        else:
            counts = n_out.groupby(["flag", "source", "variable"]).size()
            lines += ["Flagged values (kept in the data, not removed):", "", "| Flag | Source | Variable | n |", "|---|---|---|---|"]
            lines += [f"| {f} | {src} | {v} | {n} |" for (f, src, v), n in counts.items()]
            lines.append("")
    return "\n".join(lines)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    summaries, flagged = [], []

    for path in sorted(PROCESSED.glob("feni_*.csv")):
        rows, outliers = field_report(path)
        summaries += rows
        flagged.append(outliers)

    summary = pd.DataFrame(summaries)
    outliers = pd.concat(flagged) if flagged else pd.DataFrame()
    summary.to_csv(OUT / "field_quality_seasons.csv", index=False)
    outliers.to_csv(OUT / "field_quality_outliers.csv", index=False)
    (OUT / "field_quality.md").write_text(markdown(summary, outliers), encoding="utf-8")
    print(f"[OK] {len(summary)} season rows, {len(outliers)} outliers -> {OUT}")


if __name__ == "__main__":
    main()
