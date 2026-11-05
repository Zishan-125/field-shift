"""
FIELD SHIFT — 40 years of climate change in Feni (NASA POWER)

Reads the cached NASA POWER daily files (fetch_power_history.py), computes
yearly agro-climatic indicators per upazila, tests each indicator for a trend
(Mann-Kendall + Sen's slope) and cross-checks POWER against the repo's older
POWER file and the BMD Feni rain gauge.

Definitions and citations: docs/methodology/climate-shift.md

Outputs (data-pipeline/derived/):
    climate_shift_years.csv      one row per upazila, indicator and year
    climate_shift_trends.csv     one row per upazila and indicator
    climate_crosscheck.csv       POWER vs other sources

Run:
    python data-pipeline/climate/climate_shift.py
"""

from __future__ import annotations

import csv
import re
import sys
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd
import pymannkendall as mk

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "data-pipeline"))

from climate.fetch_power_history import cache_path, load_centroids, read_power_csv  # noqa: E402
from water.crop_water import et0_penman_monteith  # noqa: E402

DERIVED = ROOT / "data-pipeline" / "derived"
CALENDAR = ROOT / "data-pipeline" / "reference" / "crop_calendar.csv"
BMD = ROOT / "data-pipeline" / "reference" / "bmd_feni_station.csv"
OLD_POWER = ROOT / "Feni_Daily_Weather_NASA_POWER_ML.csv"

FIRST_YEAR = 1984
SIGNIFICANCE = 0.05

HOT_DAY_C = 35.0           # Tmax threshold (prompt; Jagadish et al. 2007 for rice anthesis)
HEAVY_RAIN_MM = 50.0       # extreme rain day
DRY_DAY_MM = 1.0           # ETCCDI dry day: precipitation < 1 mm (Zhang et al. 2011)
KHARIF1_MONTHS = (3, 4, 5, 6)
RABI_MONTHS = (11, 12, 1, 2)  # Nov-Dec of the previous year + Jan-Feb

# Which source variable each indicator rests on (for the gauge check).
INDICATOR_BASIS = {
    "rainy_season_onset_doy": "rain",
    "rainy_season_withdrawal_doy": "rain",
    "rainy_season_length_days": "rain",
    "hot_days_mar_may": "tmax",
    "hot_days_boro_flowering": "tmax",
    "extreme_rain_days": "rain",
    "longest_dry_spell_kharif1": "rain",
    "rabi_rain_mm": "rain",
    "annual_rain_mm": "rain",
    "annual_et0_mm": "et0",
}

INDICATORS = {
    "rainy_season_onset_doy": ("day of year", "Rainy-season onset (Liebmann & Marengo 2001)"),
    "rainy_season_withdrawal_doy": ("day of year", "Rainy-season withdrawal (Liebmann & Marengo 2001)"),
    "rainy_season_length_days": ("days", "Rainy-season length"),
    "hot_days_mar_may": ("days", f"Days with Tmax >= {HOT_DAY_C:g} C in March-May"),
    "hot_days_boro_flowering": ("days", f"Days with Tmax >= {HOT_DAY_C:g} C in the Boro flowering window"),
    "extreme_rain_days": ("days", f"Days with rain >= {HEAVY_RAIN_MM:g} mm"),
    "longest_dry_spell_kharif1": ("days", "Longest run of dry days (< 1 mm) in Kharif-1 (Mar-Jun)"),
    "rabi_rain_mm": ("mm", "Rabi rainfall (Nov-Feb, season ending in the year)"),
    "annual_rain_mm": ("mm", "Annual rainfall"),
    "annual_et0_mm": ("mm", "Annual reference evapotranspiration (FAO-56 Penman-Monteith)"),
}


# ---------------------------------------------------------------------
# INPUT
# ---------------------------------------------------------------------

def elevation_m(path: Path) -> float:
    header = path.read_text(encoding="utf-8").split("-END HEADER-", 1)[0]
    match = re.search(r"=\s*([-\d.]+)\s*meters", header)
    return float(match.group(1))


def boro_flowering_window() -> tuple[str, str]:
    with open(CALENDAR, newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            if row["crop_id"] == "rice_boro" and row["flowering_start"]:
                return row["flowering_start"], row["flowering_end"]
    raise ValueError("No Boro flowering window in crop_calendar.csv")


def add_et0(frame: pd.DataFrame, latitude: float, altitude: float) -> pd.DataFrame:
    frame = frame.copy()
    valid = frame[["T2M_MAX", "T2M_MIN", "ALLSKY_SFC_SW_DWN", "WS2M", "RH2M"]].notna().all(axis=1)

    frame["ET0"] = np.nan
    frame.loc[valid, "ET0"] = [
        et0_penman_monteith(
            t_max=row.T2M_MAX,
            t_min=row.T2M_MIN,
            rs=row.ALLSKY_SFC_SW_DWN,
            u2=row.WS2M,
            latitude_deg=latitude,
            altitude_m=altitude,
            doy=day.day_of_year,
            rh_mean=row.RH2M,
        )
        for day, row in frame[valid].iterrows()
    ]
    return frame


# ---------------------------------------------------------------------
# INDICATORS
# ---------------------------------------------------------------------

def longest_run(mask: np.ndarray) -> int:
    best = run = 0
    for value in mask:
        run = run + 1 if value else 0
        best = max(best, run)
    return best


def rainy_season(rain: pd.Series, mean_daily: float) -> tuple[float, float]:
    """
    Liebmann & Marengo (2001): anomalous accumulation
    A(d) = sum over days up to d of (R - mean daily rain of all years).
    Onset = day after the minimum of A; withdrawal = day of the maximum of A
    after onset. Applied to one calendar year (the dry season is Dec-Feb).
    """

    accumulation = (rain - mean_daily).cumsum().to_numpy()
    onset_index = int(np.argmin(accumulation))

    # No rainy season detected: the year never rises above the long-term
    # mean (minimum on the last day). Recorded as missing, not as day 365.
    if onset_index >= len(rain) - 2:
        return float("nan"), float("nan")

    withdrawal_index = onset_index + int(np.argmax(accumulation[onset_index:]))

    onset_doy = rain.index[onset_index + 1].day_of_year
    withdrawal_doy = rain.index[withdrawal_index].day_of_year
    return float(onset_doy), float(withdrawal_doy)


def yearly_indicators(frame: pd.DataFrame, flowering: tuple[str, str]) -> pd.DataFrame:
    rain = frame["PRECTOTCORR"]
    tmax = frame["T2M_MAX"]
    last_day = frame.index.max()

    # Climatological mean daily rain over complete years (for Liebmann & Marengo).
    complete_years = [y for y in range(FIRST_YEAR, last_day.year + 1) if date(y, 12, 31) <= last_day.date()]
    mean_daily = rain[rain.index.year.isin(complete_years)].mean()

    flower_start = pd.Timestamp(f"2001-{flowering[0]}").day_of_year
    flower_end = pd.Timestamp(f"2001-{flowering[1]}").day_of_year

    rows = []

    for year in range(FIRST_YEAR, last_day.year + 1):
        in_year = frame.index.year == year
        year_complete = year in complete_years
        values: dict[str, float] = {}

        if year_complete:
            r = rain[in_year]
            onset, withdrawal = rainy_season(r, mean_daily)
            values["rainy_season_onset_doy"] = onset
            values["rainy_season_withdrawal_doy"] = withdrawal
            values["rainy_season_length_days"] = withdrawal - onset
            values["extreme_rain_days"] = float((r >= HEAVY_RAIN_MM).sum())
            values["annual_rain_mm"] = float(r.sum())
            et0 = frame.loc[in_year, "ET0"]
            if et0.notna().sum() >= 360:
                values["annual_et0_mm"] = float(et0.mean() * len(et0))

        mam = in_year & np.isin(frame.index.month, (3, 4, 5))
        if mam.sum() == 92:
            values["hot_days_mar_may"] = float((tmax[mam] >= HOT_DAY_C).sum())

        doy = frame.index.day_of_year
        # Fixed calendar dates (non-leap day numbers); leap years shift by one day after Feb.
        leap_shift = 1 if (year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)) else 0
        flowering_mask = in_year & (doy >= flower_start + leap_shift) & (doy <= flower_end + leap_shift)
        if flowering_mask.sum() == flower_end - flower_start + 1:
            values["hot_days_boro_flowering"] = float((tmax[flowering_mask] >= HOT_DAY_C).sum())

        k1 = in_year & np.isin(frame.index.month, KHARIF1_MONTHS)
        if k1.sum() == 122:
            values["longest_dry_spell_kharif1"] = float(longest_run((rain[k1] < DRY_DAY_MM).to_numpy()))

        rabi = ((frame.index.year == year - 1) & np.isin(frame.index.month, (11, 12))) | (
            in_year & np.isin(frame.index.month, (1, 2))
        )
        if year > FIRST_YEAR and rabi.sum() >= 120:
            values["rabi_rain_mm"] = float(rain[rabi].sum())

        for indicator, value in values.items():
            if not np.isnan(value):
                rows.append({"year": year, "indicator": indicator, "value": round(value, 2)})

    return pd.DataFrame(rows)


# ---------------------------------------------------------------------
# TRENDS
# ---------------------------------------------------------------------

MIN_SEGMENT_YEARS = 15


def pettitt(values: np.ndarray) -> tuple[int, float]:
    """
    Pettitt (1979) change-point test.
    Returns (index of the last value before the change, approximate p-value).
    """

    n = len(values)
    signs = np.sign(values[None, :] - values[:, None])  # sgn(x_j - x_i)
    u = np.array([signs[: t + 1, t + 1 :].sum() for t in range(n - 1)])
    k = np.abs(u).max()
    p = 2 * np.exp(-6 * k**2 / (n**3 + n**2))
    return int(np.abs(u).argmax()), float(min(p, 1.0))


def trend(series: pd.Series) -> dict:
    """
    Mann-Kendall test with Sen's slope (pymannkendall original_test), plus a
    Pettitt break check. A single test cannot tell a step change in the data
    from a gradual trend, so when there is a break the segment after it is
    tested on its own:

    trend                    MK p < 0.05 and either no break, or the
                             post-break segment also trends the same way
    step_change_not_trend    MK p < 0.05, Pettitt p < 0.05, post-break
                             segment shows no significant trend
    no_significant_trend     MK p >= 0.05
    """

    series = series.sort_index()
    values = series.to_numpy()
    years = series.index.to_numpy()
    result = mk.original_test(values)

    break_index, break_p = pettitt(values)
    break_year = int(years[break_index + 1])

    post = values[break_index + 1 :]
    post_result = mk.original_test(post) if len(post) >= MIN_SEGMENT_YEARS else None

    significant = result.p < SIGNIFICANCE
    has_break = break_p < SIGNIFICANCE

    if not significant:
        status = "no_significant_trend"
    elif not has_break:
        status = "trend"
    elif (
        post_result is not None
        and post_result.p < SIGNIFICANCE
        and np.sign(post_result.slope) == np.sign(result.slope)
    ):
        status = "trend"
    else:
        status = "step_change_not_trend"

    return {
        "n_years": len(values),
        "first_year": int(years[0]),
        "last_year": int(years[-1]),
        "mean_value": round(float(np.mean(values)), 3),
        "sen_slope_per_year": round(float(result.slope), 5),
        "change_per_decade": round(float(result.slope) * 10, 3),
        "mk_tau": round(float(result.Tau), 4),
        "mk_z": round(float(result.z), 4),
        "p_value": round(float(result.p), 5),
        "significant": int(significant),
        "direction": result.trend if significant else "no significant trend",
        "pettitt_break_year": break_year,
        "pettitt_p_value": round(break_p, 5),
        "mean_before_break": round(float(values[: break_index + 1].mean()), 3),
        "mean_after_break": round(float(post.mean()), 3),
        "post_break_years": len(post),
        "post_break_change_per_decade": (
            round(float(post_result.slope) * 10, 3) if post_result is not None else None
        ),
        "post_break_p_value": round(float(post_result.p), 5) if post_result is not None else None,
        "status": status,
    }


# ---------------------------------------------------------------------
# CROSS-CHECKS
# ---------------------------------------------------------------------

def crosscheck(frame: pd.DataFrame) -> list[dict]:
    rows: list[dict] = []

    # 1. The repo's older POWER file (fetched earlier for 23.0159, 91.3971).
    old = pd.read_csv(OLD_POWER, parse_dates=["date"]).set_index("date")
    pairs = {
        "T2M_MAX": "temp_max_c",
        "T2M_MIN": "temp_min_c",
        "PRECTOTCORR": "rainfall_mm",
        "RH2M": "relative_humidity_pct",
        "WS2M": "wind_speed_m_s",
        "ALLSKY_SFC_SW_DWN": "solar_radiation_kwh_m2_day",
    }
    overlap = frame.index.intersection(old.index)

    for new_col, old_col in pairs.items():
        diff = (frame.loc[overlap, new_col] - old.loc[overlap, old_col]).abs()
        rows.append(
            {
                "check": "power_vs_repo_power_file",
                "variable": new_col,
                "period": f"{overlap.min():%Y-%m-%d} to {overlap.max():%Y-%m-%d}",
                "n": int(diff.notna().sum()),
                "power": round(float(frame.loc[overlap, new_col].mean()), 3),
                "other": round(float(old.loc[overlap, old_col].mean()), 3),
                "mean_abs_diff": round(float(diff.mean()), 4),
                "max_abs_diff": round(float(diff.max()), 4),
                "share_identical": round(float((diff < 1e-6).mean()), 4),
                "note": "Same grid cell; differences would come from POWER reprocessing.",
            }
        )

    # 2. BMD Feni rain gauge and Tmax (BBS Yearbook 2025, Tables 6.1.x / 6.2.x).
    bmd = pd.read_csv(BMD)
    monthly_rain = frame["PRECTOTCORR"].resample("MS").sum()
    monthly_tmax = frame["T2M_MAX"].resample("MS").mean()

    for _, row in bmd.iterrows():
        year = int(row["year"])

        if row["variable"] == "rain_annual":
            power = float(frame.loc[str(year), "PRECTOTCORR"].sum())
        elif row["variable"] == "rain_month":
            power = float(monthly_rain.loc[f"{year}-{int(row['month']):02d}-01"])
        else:
            power = float(monthly_tmax.loc[f"{year}-{int(row['month']):02d}-01"])

        gauge = float(row["value"])
        rows.append(
            {
                "check": "power_vs_bmd_feni_station",
                "variable": row["variable"],
                "period": f"{year}" + (f"-{int(row['month']):02d}" if pd.notna(row["month"]) else ""),
                "n": 1,
                "power": round(power, 2),
                "other": gauge,
                "mean_abs_diff": round(abs(power - gauge), 2),
                "max_abs_diff": round(abs(power - gauge), 2),
                "share_identical": None,
                "note": "BMD gauge (point) vs POWER grid-cell (reanalysis) value.",
            }
        )

    return rows


GAUGE_RAIN_TOLERANCE = 0.15   # annual POWER/gauge ratio within +-15 % counts as agreeing
GAUGE_TMAX_TOLERANCE_C = 1.0  # mean monthly Tmax bias within +-1 C counts as agreeing


def gauge_agreement(checks: pd.DataFrame) -> dict:
    """Summarise how POWER compares with the BMD Feni station, per variable."""

    bmd = checks[checks["check"] == "power_vs_bmd_feni_station"]

    rain = bmd[bmd["variable"] == "rain_annual"]
    ratio = rain["power"] / rain["other"]
    rain_agrees = bool((ratio.sub(1).abs() <= GAUGE_RAIN_TOLERANCE).all())

    tmax = bmd[bmd["variable"] == "tmax_month_mean"]
    bias = tmax["power"] - tmax["other"]
    tmax_agrees = bool(abs(bias.mean()) <= GAUGE_TMAX_TOLERANCE_C)

    return {
        "rain": {
            "agrees": int(rain_agrees),
            "summary": (
                f"POWER annual rain / BMD Feni gauge, {rain['period'].min()}-{rain['period'].max()}: "
                f"{ratio.min():.2f} to {ratio.max():.2f} (mean {ratio.mean():.2f})"
            ),
        },
        "tmax": {
            "agrees": int(tmax_agrees),
            "summary": (
                f"POWER minus BMD Feni monthly mean Tmax, {len(tmax)} months 2023-24: "
                f"mean {bias.mean():+.1f} C (range {bias.min():+.1f} to {bias.max():+.1f})"
            ),
        },
        "et0": {
            "agrees": None,
            "summary": "No station ET0 to compare with; depends on POWER temperature, humidity, wind and solar.",
        },
    }


# ---------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------

def main() -> None:
    flowering = boro_flowering_window()
    year_rows, trend_rows = [], []
    feni_frame = None

    for centroid in load_centroids():
        upazila = centroid["upazila"]
        path = cache_path(upazila)
        frame = add_et0(read_power_csv(path), float(centroid["latitude"]), elevation_m(path))

        if upazila == "Feni Sadar":
            feni_frame = frame

        years = yearly_indicators(frame, flowering)
        years.insert(0, "upazila", upazila)
        year_rows.append(years)

        for indicator, group in years.groupby("indicator"):
            series = group.set_index("year")["value"]
            unit, label = INDICATORS[indicator]
            trend_rows.append({"upazila": upazila, "indicator": indicator, "label": label, "unit": unit, **trend(series)})

        print(f"[OK] {upazila}: {frame.index.min():%Y-%m-%d} to {frame.index.max():%Y-%m-%d}")

    DERIVED.mkdir(parents=True, exist_ok=True)
    pd.concat(year_rows).to_csv(DERIVED / "climate_shift_years.csv", index=False)

    checks = pd.DataFrame(crosscheck(feni_frame))
    checks.to_csv(DERIVED / "climate_crosscheck.csv", index=False)
    agreement = gauge_agreement(checks)

    trends = pd.DataFrame(trend_rows)
    trends["source_basis"] = trends["indicator"].map(INDICATOR_BASIS)
    trends["gauge_agreement"] = trends["source_basis"].map(lambda basis: agreement[basis]["summary"])
    trends["gauge_agrees"] = trends["source_basis"].map(lambda basis: agreement[basis]["agrees"])
    trends.to_csv(DERIVED / "climate_shift_trends.csv", index=False)

    feni = trends[trends["upazila"] == "Feni Sadar"]
    print(feni[["indicator", "n_years", "mean_value", "change_per_decade", "p_value", "direction"]].to_string(index=False))


if __name__ == "__main__":
    main()
