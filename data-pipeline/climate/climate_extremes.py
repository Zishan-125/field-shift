"""
FIELD SHIFT — what Feni's climate does to a crop: variability and extremes

The trend tests (climate_shift.py) find no significant change in 28 years
of GPM rain. That is a short record, and Mann-Kendall has little power over
it: no detected trend is not evidence of no change. This script describes
the climate a farmer actually has to plan for, as frequencies:

    * monsoon (Jun-Sep) rain per year: mean, coefficient of variation,
      wettest and driest year
    * annual maximum 7-day and 15-day rain totals, their return periods
      (Weibull plotting position, Gumbel fit) with 2024 marked
    * the 5-year return level of the 7-day total, used by the server as the
      "flood-size downpour" threshold when it counts, for each crop window,
      in how many of the 28 years the crop was hit (backend/offline/server.py)
    * the 2024 flood recovery at the Fulgazi demo field (Sentinel-1, HLS)

Rain: GPM IMERG V07 daily per upazila, 1998-2025 (complete years). Tmax:
NASA POWER bias-corrected against BMD Feni (climate_shift.py), 1998-2025.
Daily-intensity counts carry the 2014 TRMM->GPM input change (Huffman 2019,
"Caveats for IMERG in the TRMM Era"); frequencies are also split by era.

Outputs (data-pipeline/derived/):
    climate_daily.csv              upazila, date, rain_mm, tmax_bc_c
    climate_extremes_years.csv     upazila, year, monsoon_rain_mm, rx5/rx7/rx15 and dates
    climate_extremes_summary.csv   upazila, metric, value
    climate_return_curve.csv       upazila, window_days, year, value_mm, rank, return_period_y
    climate_recovery_fulgazi.json  2024 flood timeline at feni_fulgazi_01

Run:
    python data-pipeline/climate/climate_extremes.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import stats

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "data-pipeline"))

from climate.climate_shift import apply_offsets, bias_correction, complete_years  # noqa: E402
from climate.fetch_gpm_imerg import cache_path as gpm_cache_path, read_gpm_csv  # noqa: E402
from climate.fetch_power_history import cache_path, load_centroids, read_power_csv  # noqa: E402

DERIVED = ROOT / "data-pipeline" / "derived"
FULGAZI = ROOT / "data-pipeline" / "data" / "processed" / "feni_fulgazi_01.csv"

FIRST_YEAR, LAST_YEAR = 1998, 2025
MONSOON = (6, 7, 8, 9)
WINDOWS = (5, 7, 15)
RETURN_PERIODS = (2, 5, 10, 25)
FLOOD_RETURN_PERIOD = 5          # "flood-size" 7-day downpour = 5-year return level
FLOOD_VH_DB = -22.0              # single Sentinel-1 scene over open water (Fulgazi: -26 to -29 dB)
GREEN_NDVI = 0.5


def annual_maxima(rain: pd.Series, days: int) -> pd.DataFrame:
    rolling = rain.rolling(days, min_periods=days).sum()
    rows = []
    for year in range(FIRST_YEAR, LAST_YEAR + 1):
        r = rolling[rolling.index.year == year]
        rows.append({"year": year, "value_mm": float(r.max()), "end_date": r.idxmax().strftime("%Y-%m-%d")})
    return pd.DataFrame(rows)


def return_curve(maxima: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """Weibull plotting positions and a Gumbel (EV1) fit by maximum likelihood."""

    n = len(maxima)
    curve = maxima.sort_values("value_mm", ascending=False).reset_index(drop=True)
    curve["rank"] = np.arange(1, n + 1)
    curve["return_period_y"] = (n + 1) / curve["rank"]

    loc, scale = stats.gumbel_r.fit(maxima["value_mm"])
    levels = {T: float(stats.gumbel_r.ppf(1 - 1 / T, loc, scale)) for T in RETURN_PERIODS}
    fit = {"gumbel_loc": loc, "gumbel_scale": scale, **{f"return_level_{T}y_mm": v for T, v in levels.items()}}

    def gumbel_T(value: float) -> float:
        return float(1 / (1 - stats.gumbel_r.cdf(value, loc, scale)))

    curve["gumbel_return_period_y"] = curve["value_mm"].map(gumbel_T)
    return curve, fit


def recovery_fulgazi() -> dict:
    """Flood and recovery at the Fulgazi field in 2024 from its own time series."""

    frame = pd.read_csv(FULGAZI, parse_dates=["date"])
    vh = frame[(frame["variable"] == "VH") & (frame["date"] >= "2024-07-15")].sort_values("date")
    ndvi = frame[(frame["variable"] == "NDVI") & frame["source"].str.startswith("HLS")].sort_values("date")

    flooded = vh[vh["value"] < FLOOD_VH_DB]
    start = flooded["date"].min()
    # End: last flooded scene before two consecutive scenes above the threshold.
    after = vh[vh["date"] >= start].reset_index(drop=True)
    end = start
    for i in range(len(after)):
        if after.loc[i, "value"] < FLOOD_VH_DB:
            end = after.loc[i, "date"]
        elif i + 1 < len(after) and after.loc[i + 1, "value"] >= FLOOD_VH_DB:
            break
    green = ndvi[(ndvi["date"] > end) & (ndvi["value"] >= GREEN_NDVI)]["date"].min()
    before = ndvi[(ndvi["date"] < start) & (ndvi["date"] >= "2024-06-01")].tail(1)

    return {
        "field_id": "feni_fulgazi_01",
        "flood_start": start.strftime("%Y-%m-%d"),
        "flood_end": end.strftime("%Y-%m-%d"),
        "days_under_water": int((end - start).days),
        "green_again": green.strftime("%Y-%m-%d"),
        "days_flood_start_to_green": int((green - start).days),
        "days_flood_end_to_green": int((green - end).days),
        "ndvi_before": round(float(before["value"].iloc[0]), 2) if len(before) else None,
        "ndvi_before_date": before["date"].iloc[0].strftime("%Y-%m-%d") if len(before) else None,
        "min_vh_db": round(float(flooded["value"].min()), 1),
        "rule": f"under water = Sentinel-1 VH < {FLOOD_VH_DB:g} dB (single scenes); "
                f"green again = first clear HLS NDVI >= {GREEN_NDVI:g} after the water left",
    }


def main() -> None:
    feni_power = read_power_csv(cache_path("Feni Sadar"))
    offsets, _ = bias_correction(feni_power["T2M_MAX"])
    tmax_bc = apply_offsets(feni_power["T2M_MAX"], offsets)

    daily_rows, year_rows, summary_rows, curve_rows = [], [], [], []

    for centroid in load_centroids():
        upazila = centroid["upazila"]
        rain = read_gpm_csv(gpm_cache_path(upazila))
        rain = rain[(rain.index.year >= FIRST_YEAR) & (rain.index.year <= LAST_YEAR)]
        assert set(complete_years(rain.index)) == set(range(FIRST_YEAR, LAST_YEAR + 1)), upazila

        daily = pd.DataFrame({"rain_mm": rain, "tmax_bc_c": tmax_bc.reindex(rain.index)})
        daily_rows.append(daily.assign(upazila=upazila).reset_index(names="date"))

        monsoon = rain[np.isin(rain.index.month, MONSOON)].groupby(rain[np.isin(rain.index.month, MONSOON)].index.year).sum()
        years = pd.DataFrame({"year": monsoon.index, "monsoon_rain_mm": monsoon.to_numpy()})

        def add(metric: str, value) -> None:
            summary_rows.append({"upazila": upazila, "metric": metric, "value": value})

        add("n_years", len(monsoon))
        add("monsoon_mean_mm", round(float(monsoon.mean()), 1))
        add("monsoon_sd_mm", round(float(monsoon.std(ddof=1)), 1))
        add("monsoon_cv", round(float(monsoon.std(ddof=1) / monsoon.mean()), 3))
        add("monsoon_wettest_year", int(monsoon.idxmax()))
        add("monsoon_wettest_mm", round(float(monsoon.max()), 1))
        add("monsoon_driest_year", int(monsoon.idxmin()))
        add("monsoon_driest_mm", round(float(monsoon.min()), 1))
        add("monsoon_2024_mm", round(float(monsoon.loc[2024]), 1))

        for days in WINDOWS:
            maxima = annual_maxima(rain, days)
            years[f"rx{days}_mm"] = maxima["value_mm"].round(1).to_numpy()
            years[f"rx{days}_end_date"] = maxima["end_date"].to_numpy()
            curve, fit = return_curve(maxima)
            for key, value in fit.items():
                add(f"rx{days}_{key}", round(value, 2))
            row_2024 = curve[curve["year"] == 2024].iloc[0]
            add(f"rx{days}_2024_mm", round(float(row_2024["value_mm"]), 1))
            add(f"rx{days}_2024_rank", int(row_2024["rank"]))
            add(f"rx{days}_2024_return_period_empirical_y", round(float(row_2024["return_period_y"]), 1))
            add(f"rx{days}_2024_return_period_gumbel_y", round(float(row_2024["gumbel_return_period_y"]), 1))
            if days in (7, 15):
                curve_rows.append(curve.assign(upazila=upazila, window_days=days)[
                    ["upazila", "window_days", "year", "end_date", "value_mm", "rank", "return_period_y", "gumbel_return_period_y"]])

        add("flood_threshold_7day_mm", round(float(stats.gumbel_r.ppf(
            1 - 1 / FLOOD_RETURN_PERIOD, *stats.gumbel_r.fit(years["rx7_mm"]))), 1))
        year_rows.append(years.assign(upazila=upazila))
        print(f"[OK] {upazila}")

    DERIVED.mkdir(parents=True, exist_ok=True)
    daily = pd.concat(daily_rows)
    daily["date"] = daily["date"].dt.strftime("%Y-%m-%d")
    daily[["upazila", "date", "rain_mm", "tmax_bc_c"]].to_csv(DERIVED / "climate_daily.csv", index=False, float_format="%.2f")
    pd.concat(year_rows).to_csv(DERIVED / "climate_extremes_years.csv", index=False)
    pd.DataFrame(summary_rows).to_csv(DERIVED / "climate_extremes_summary.csv", index=False)
    pd.concat(curve_rows).round(2).to_csv(DERIVED / "climate_return_curve.csv", index=False)

    recovery = recovery_fulgazi()
    (DERIVED / "climate_recovery_fulgazi.json").write_text(json.dumps(recovery, indent=1), encoding="utf-8")

    summary = pd.DataFrame(summary_rows)
    print(summary[summary["upazila"] == "Feni Sadar"].to_string(index=False))
    print(json.dumps(recovery, indent=1))


if __name__ == "__main__":
    main()
