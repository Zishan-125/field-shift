"""
FIELD SHIFT — climate change in Feni from NASA data

Two sources, used for what each can do:

* Rainfall — NASA GPM IMERG V07 daily, area-averaged per upazila polygon,
  1998- (cache from fetch_gpm_imerg.py). IMERG uses TRMM-era satellite
  inputs before mid-2014 and GPM-era inputs after; indicators that count
  days above or below an intensity threshold carry a caveat with the mean of
  each era (see sensor_era_caveat()). If that cache is missing, NASA POWER
  rainfall is used and every rain indicator is flagged: POWER rain has a
  break around 1997 and disagrees with the BMD Feni gauge.
* Temperature and ET0 — NASA POWER (MERRA-2 / CERES), one grid cell for all
  of Feni. Trends from 1998 only (after the break in the record). Tmax is
  bias-corrected against the BMD Feni station (one offset per calendar
  month) and heat is counted against percentile thresholds, so the remaining
  bias matters far less than with a fixed 35 C threshold.

Every indicator is tested with Mann-Kendall + Sen's slope and a Pettitt
break check (see trend()). Definitions and citations:
docs/methodology/climate-shift.md

Outputs (data-pipeline/derived/):
    climate_shift_years.csv          upazila, indicator, year, value
    climate_shift_trends.csv         upazila, indicator, statistics, status
    climate_crosscheck.csv           POWER / GPM vs other sources
    climate_tmax_bias_correction.csv monthly offsets and leave-one-year-out check

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

from climate.fetch_gpm_imerg import cache_path as gpm_cache_path, read_gpm_csv  # noqa: E402
from climate.fetch_power_history import cache_path, load_centroids, read_power_csv  # noqa: E402
from water.crop_water import et0_penman_monteith  # noqa: E402

DERIVED = ROOT / "data-pipeline" / "derived"
CALENDAR = ROOT / "data-pipeline" / "reference" / "crop_calendar.csv"
BMD = ROOT / "data-pipeline" / "reference" / "bmd_feni_station.csv"
OLD_POWER = ROOT / "Feni_Daily_Weather_NASA_POWER_ML.csv"

POWER_FIRST_YEAR = 1984
TEMP_FIRST_YEAR = 1998          # POWER temperature/solar break years 1998-2000 (Pettitt)
PERCENTILE_BASE = (1998, 2010)  # base period for percentile thresholds
PERCENTILE = 90
PERCENTILE_WINDOW_DAYS = 2      # +-2 days around each calendar day (5-day window, as ETCCDI)
SIGNIFICANCE = 0.05

HOT_DAY_C = 35.0           # Tmax threshold (project brief; Jagadish et al. 2007 for rice anthesis)
HEAVY_RAIN_MM = 50.0       # extreme rain day (project brief)
DRY_DAY_MM = 1.0           # ETCCDI dry day: precipitation < 1 mm (Zhang et al. 2011)
KHARIF1_MONTHS = (3, 4, 5, 6)

# indicator -> (unit, label, basis, role). "comparison" indicators are kept to
# show the effect of the bias correction; advice uses "primary" ones only.
INDICATORS = {
    "rainy_season_onset_doy": ("day of year", "Rainy-season onset (Liebmann & Marengo 2001)", "rain", "primary"),
    "rainy_season_withdrawal_doy": ("day of year", "Rainy-season withdrawal (Liebmann & Marengo 2001)", "rain", "primary"),
    "rainy_season_length_days": ("days", "Rainy-season length", "rain", "primary"),
    "extreme_rain_days": ("days", f"Days with rain >= {HEAVY_RAIN_MM:g} mm", "rain", "primary"),
    "longest_dry_spell_kharif1": ("days", "Longest run of dry days (< 1 mm) in Kharif-1 (Mar-Jun)", "rain", "primary"),
    "rabi_rain_mm": ("mm", "Rabi rainfall (Nov-Feb, season ending in the year)", "rain", "primary"),
    "kharif_rain_mm": ("mm", "Kharif rainfall (Mar-Oct)", "rain", "primary"),
    "annual_rain_mm": ("mm", "Annual rainfall", "rain", "primary"),
    "annual_rain_mm_power": ("mm", "Annual rainfall, NASA POWER (for comparison with GPM)", "rain_power", "comparison"),
    "tx90p_mar_may": ("days", "Days in March-May above the 1998-2010 90th percentile of Tmax", "tmax_bc", "primary"),
    "tx90p_boro_flowering": ("days", "Days in the Boro flowering window above the 1998-2010 90th percentile of Tmax", "tmax_bc", "primary"),
    "tmax_mean_mar_may_bc": ("C", "Mean Tmax March-May, bias-corrected", "tmax_bc", "primary"),
    "hot_days_mar_may_bc": ("days", f"Days with Tmax >= {HOT_DAY_C:g} C in March-May, bias-corrected", "tmax_bc", "comparison"),
    "hot_days_mar_may_raw": ("days", f"Days with Tmax >= {HOT_DAY_C:g} C in March-May, uncorrected POWER", "tmax_raw", "comparison"),
    "hot_days_boro_flowering_bc": ("days", f"Days with Tmax >= {HOT_DAY_C:g} C at Boro flowering, bias-corrected", "tmax_bc", "comparison"),
    "hot_days_boro_flowering_raw": ("days", f"Days with Tmax >= {HOT_DAY_C:g} C at Boro flowering, uncorrected POWER", "tmax_raw", "comparison"),
    "annual_et0_mm": ("mm", "Annual reference evapotranspiration (FAO-56 Penman-Monteith)", "et0", "primary"),
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


def complete_years(index: pd.DatetimeIndex) -> list[int]:
    """Years with a value on every day."""

    counts = pd.Series(1, index=index).groupby(index.year).count()
    return [int(y) for y, n in counts.items() if n >= (366 if pd.Timestamp(f"{y}-12-31").is_leap_year else 365)]


# ---------------------------------------------------------------------
# TMAX BIAS CORRECTION (POWER vs BMD Feni station)
# ---------------------------------------------------------------------

def bmd_tmax() -> pd.DataFrame:
    bmd = pd.read_csv(BMD)
    tmax = bmd[bmd["variable"] == "tmax_month_mean"].copy()
    tmax["month"] = tmax["month"].astype(int)
    return tmax[["year", "month", "value"]]


def monthly_offsets(power_tmax: pd.Series, station: pd.DataFrame) -> pd.DataFrame:
    """Station minus POWER monthly mean Tmax, averaged per calendar month."""

    monthly = power_tmax.groupby([power_tmax.index.year, power_tmax.index.month]).mean()
    rows = []

    for _, row in station.iterrows():
        power = float(monthly.loc[(int(row["year"]), int(row["month"]))])
        rows.append({"year": int(row["year"]), "month": int(row["month"]), "station": float(row["value"]), "power": power})

    pairs = pd.DataFrame(rows)
    pairs["difference"] = pairs["station"] - pairs["power"]
    return pairs


def apply_offsets(tmax: pd.Series, offsets: dict[int, float]) -> pd.Series:
    return tmax + tmax.index.month.map(offsets).to_numpy()


def bias_correction(power_tmax: pd.Series) -> tuple[dict[int, float], pd.DataFrame]:
    """
    Mean-bias correction by calendar month (delta method): add the mean
    station-minus-POWER difference of that month. Months without station
    data borrow the mean offset of all months. Checked by leaving one year
    out: offsets from the other year correct the held-out year.
    """

    pairs = monthly_offsets(power_tmax, bmd_tmax())
    overall = float(pairs["difference"].mean())
    offsets = {m: float(pairs.loc[pairs["month"] == m, "difference"].mean()) if (pairs["month"] == m).any() else overall
               for m in range(1, 13)}

    report = []

    for month in range(1, 13):
        subset = pairs[pairs["month"] == month]
        report.append({
            "kind": "offset",
            "month": month,
            "n_station_months": len(subset),
            "station_mean": round(float(subset["station"].mean()), 2) if len(subset) else None,
            "power_mean": round(float(subset["power"].mean()), 2) if len(subset) else None,
            "offset_c": round(offsets[month], 3),
        })

    for held_out in sorted(pairs["year"].unique()):
        train = pairs[pairs["year"] != held_out]
        test = pairs[pairs["year"] == held_out]
        train_overall = float(train["difference"].mean())
        cv_offsets = {m: float(train.loc[train["month"] == m, "difference"].mean())
                      if (train["month"] == m).any() else train_overall for m in range(1, 13)}
        corrected = test["power"] + test["month"].map(cv_offsets)
        residual = test["station"] - corrected
        raw = test["station"] - test["power"]
        report.append({
            "kind": f"leave_one_year_out_{held_out}",
            "month": None,
            "n_station_months": len(test),
            "bias_before_c": round(float(-raw.mean()), 3),          # POWER minus station
            "bias_after_c": round(float(-residual.mean()), 3),
            "mae_before_c": round(float(raw.abs().mean()), 3),
            "mae_after_c": round(float(residual.abs().mean()), 3),
        })

    return offsets, pd.DataFrame(report)


def percentile_thresholds(tmax: pd.Series) -> pd.Series:
    """
    90th percentile of Tmax for each calendar day (non-leap day numbers),
    from the base years, pooling a +-2 day window (ETCCDI-style TX90p).
    """

    base = tmax[(tmax.index.year >= PERCENTILE_BASE[0]) & (tmax.index.year <= PERCENTILE_BASE[1])]
    doy = noleap_doy(base.index)
    values = pd.DataFrame({"doy": doy, "tmax": base.to_numpy()})

    thresholds = {}
    for day in range(1, 366):
        window = [((day - 1 + k) % 365) + 1 for k in range(-PERCENTILE_WINDOW_DAYS, PERCENTILE_WINDOW_DAYS + 1)]
        thresholds[day] = float(np.percentile(values.loc[values["doy"].isin(window), "tmax"], PERCENTILE))

    return pd.Series(thresholds)


def noleap_doy(index: pd.DatetimeIndex) -> np.ndarray:
    """Day of year on a 365-day calendar (29 Feb shares 28 Feb's number)."""

    doy = index.day_of_year.to_numpy().copy()
    leap_after_feb = index.is_leap_year & (index.month > 2)
    doy[leap_after_feb] -= 1
    return doy


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


def rain_indicators(rain: pd.Series) -> list[dict]:
    years = complete_years(rain.index)
    mean_daily = rain[rain.index.year.isin(years)].mean()
    rows = []

    for year in years:
        r = rain[rain.index.year == year]
        values: dict[str, float] = {}

        onset, withdrawal = rainy_season(r, mean_daily)
        values["rainy_season_onset_doy"] = onset
        values["rainy_season_withdrawal_doy"] = withdrawal
        values["rainy_season_length_days"] = withdrawal - onset
        values["extreme_rain_days"] = float((r >= HEAVY_RAIN_MM).sum())
        values["annual_rain_mm"] = float(r.sum())
        values["kharif_rain_mm"] = float(r[(r.index.month >= 3) & (r.index.month <= 10)].sum())
        values["longest_dry_spell_kharif1"] = float(
            longest_run((r[np.isin(r.index.month, KHARIF1_MONTHS)] < DRY_DAY_MM).to_numpy())
        )

        rabi = rain[((rain.index.year == year - 1) & np.isin(rain.index.month, (11, 12)))
                    | ((rain.index.year == year) & np.isin(rain.index.month, (1, 2)))]
        if len(rabi) >= 120:
            values["rabi_rain_mm"] = float(rabi.sum())

        rows += [{"year": year, "indicator": k, "value": round(v, 2)} for k, v in values.items() if not np.isnan(v)]

    return rows


def temperature_indicators(
    frame: pd.DataFrame,
    tmax_bc: pd.Series,
    thresholds: pd.Series,
    flowering: tuple[str, str],
) -> list[dict]:
    tmax_raw = frame["T2M_MAX"]
    doy = pd.Series(noleap_doy(frame.index), index=frame.index)
    above = tmax_bc > doy.map(thresholds)

    flower_start = pd.Timestamp(f"2001-{flowering[0]}").day_of_year
    flower_end = pd.Timestamp(f"2001-{flowering[1]}").day_of_year
    flowering_days = flower_end - flower_start + 1
    last = frame.index.max()
    rows = []

    for year in range(TEMP_FIRST_YEAR, last.year + 1):
        in_year = frame.index.year == year
        values: dict[str, float] = {}

        mam = in_year & np.isin(frame.index.month, (3, 4, 5))
        if mam.sum() == 92:
            values["tx90p_mar_may"] = float(above[mam].sum())
            values["tmax_mean_mar_may_bc"] = float(tmax_bc[mam].mean())
            values["hot_days_mar_may_bc"] = float((tmax_bc[mam] >= HOT_DAY_C).sum())
            values["hot_days_mar_may_raw"] = float((tmax_raw[mam] >= HOT_DAY_C).sum())

        flower = in_year & (doy >= flower_start).to_numpy() & (doy <= flower_end).to_numpy()
        if flower.sum() == flowering_days:
            values["tx90p_boro_flowering"] = float(above[flower].sum())
            values["hot_days_boro_flowering_bc"] = float((tmax_bc[flower] >= HOT_DAY_C).sum())
            values["hot_days_boro_flowering_raw"] = float((tmax_raw[flower] >= HOT_DAY_C).sum())

        if year in complete_years(frame.index):
            et0 = frame.loc[in_year, "ET0"]
            if et0.notna().sum() >= 360:
                values["annual_et0_mm"] = float(et0.mean() * len(et0))

        rows += [{"year": year, "indicator": k, "value": round(v, 2)} for k, v in values.items()]

    return rows


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
        "pettitt_break_free": int(not has_break),
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

GAUGE_RAIN_TOLERANCE = 0.15   # annual source/gauge ratio within +-15 % counts as agreeing
GAUGE_TMAX_TOLERANCE_C = 1.0  # mean monthly Tmax bias within +-1 C counts as agreeing


def rain_vs_gauge(rain: pd.Series, source: str) -> list[dict]:
    bmd = pd.read_csv(BMD)
    monthly = rain.resample("MS").sum()
    rows = []

    for _, row in bmd[bmd["variable"].isin(["rain_annual", "rain_month"])].iterrows():
        year = int(row["year"])

        if row["variable"] == "rain_annual":
            if year not in rain.index.year:
                continue
            value = float(rain[str(year)].sum())
            period = f"{year}"
        else:
            key = pd.Timestamp(f"{year}-{int(row['month']):02d}-01")
            if key not in monthly.index:
                continue
            value = float(monthly.loc[key])
            period = f"{year}-{int(row['month']):02d}"

        rows.append({
            "check": f"{source}_vs_bmd_feni_station",
            "variable": row["variable"],
            "period": period,
            "n": 1,
            "power": round(value, 2),   # column name kept for the API; holds the satellite/reanalysis value
            "other": float(row["value"]),
            "mean_abs_diff": round(abs(value - float(row["value"])), 2),
            "max_abs_diff": round(abs(value - float(row["value"])), 2),
            "share_identical": None,
            "note": f"BMD gauge (point) vs {source.upper()} value.",
        })

    return rows


def crosscheck(frame: pd.DataFrame, tmax_bc: pd.Series, gpm: pd.Series | None) -> list[dict]:
    rows: list[dict] = []

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
        rows.append({
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
        })

    rows += rain_vs_gauge(frame["PRECTOTCORR"], "power")
    if gpm is not None:
        rows += rain_vs_gauge(gpm, "gpm")

    station = bmd_tmax()
    for label, series in (("tmax_month_mean", frame["T2M_MAX"]), ("tmax_month_mean_bc", tmax_bc)):
        monthly = series.groupby([series.index.year, series.index.month]).mean()
        for _, row in station.iterrows():
            value = float(monthly.loc[(int(row["year"]), int(row["month"]))])
            rows.append({
                "check": "power_vs_bmd_feni_station",
                "variable": label,
                "period": f"{int(row['year'])}-{int(row['month']):02d}",
                "n": 1,
                "power": round(value, 2),
                "other": float(row["value"]),
                "mean_abs_diff": round(abs(value - float(row["value"])), 2),
                "max_abs_diff": round(abs(value - float(row["value"])), 2),
                "share_identical": None,
                "note": "In-sample after correction; see the leave-one-year-out check for an honest residual."
                if label.endswith("_bc") else "BMD station vs POWER grid-cell value.",
            })

    return rows


def gauge_agreement(checks: pd.DataFrame, bias_report: pd.DataFrame, rain_source: str) -> dict:
    """How each source compares with the BMD Feni station."""

    def rain_summary(source: str) -> dict:
        rain = checks[(checks["check"] == f"{source}_vs_bmd_feni_station") & (checks["variable"] == "rain_annual")]
        ratio = rain["power"] / rain["other"]
        return {
            "agrees": int(bool((ratio.sub(1).abs() <= GAUGE_RAIN_TOLERANCE).all())),
            "summary": (
                f"{source.upper()} annual rain / BMD Feni gauge, {rain['period'].min()}-{rain['period'].max()}: "
                f"{ratio.min():.2f} to {ratio.max():.2f} (mean {ratio.mean():.2f})"
            ),
        }

    raw = checks[(checks["check"] == "power_vs_bmd_feni_station") & (checks["variable"] == "tmax_month_mean")]
    raw_bias = raw["power"] - raw["other"]
    cv = bias_report[bias_report["kind"].str.startswith("leave_one_year_out")]
    cv_bias = float(cv["bias_after_c"].abs().max())

    return {
        "rain": rain_summary(rain_source),
        "rain_power": rain_summary("power"),
        "tmax_raw": {
            "agrees": int(abs(raw_bias.mean()) <= GAUGE_TMAX_TOLERANCE_C),
            "summary": (
                f"POWER minus BMD Feni monthly mean Tmax, {len(raw)} months 2023-24: "
                f"mean {raw_bias.mean():+.1f} C (range {raw_bias.min():+.1f} to {raw_bias.max():+.1f})"
            ),
        },
        "tmax_bc": {
            "agrees": int(cv_bias <= GAUGE_TMAX_TOLERANCE_C),
            "summary": (
                "Bias-corrected Tmax, leave-one-year-out: remaining mean bias "
                + ", ".join(f"{r.kind[-4:]} {r.bias_after_c:+.2f} C (MAE {r.mae_after_c:.2f})" for r in cv.itertuples())
                + f"; before correction {', '.join(f'{r.kind[-4:]} {r.bias_before_c:+.2f} C' for r in cv.itertuples())}"
            ),
        },
        "et0": {
            "agrees": None,
            "summary": "No station ET0 to compare with; depends on POWER temperature, humidity, wind and solar.",
        },
    }


# ---------------------------------------------------------------------
# IMERG SENSOR ERAS
# ---------------------------------------------------------------------

GPM_ERA_START = 2014  # GPM Core Observatory launched 27 Feb 2014; IMERG V07 inputs change in 2014
INTENSITY_INDICATORS = ("extreme_rain_days", "longest_dry_spell_kharif1")


def sensor_era_caveat(series: pd.Series) -> str | None:
    """
    Daily-intensity counts from IMERG can shift when the satellite inputs
    change, even if totals do not. Pettitt may not catch a gradual shift, so
    the era means are always written next to the trend.
    """

    before = series[series.index < GPM_ERA_START]
    after = series[series.index >= GPM_ERA_START]
    if before.empty or after.empty:
        return None
    return (
        f"imerg_sensor_eras: mean {before.mean():.1f} in {before.index.min()}-{before.index.max()} "
        f"(TRMM-era inputs) vs {after.mean():.1f} in {after.index.min()}-{after.index.max()} (GPM era). "
        "A change in daily intensities across 2014 can come from the satellite inputs; "
        "no daily gauge data to check it."
    )


# ---------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------

def main() -> None:
    flowering = boro_flowering_window()
    year_rows, trend_rows = [], []
    feni = {}

    # POWER temperature is one grid cell for all of Feni, so the bias
    # correction and thresholds are computed once (Feni Sadar file).
    feni_path = cache_path("Feni Sadar")
    feni_power = read_power_csv(feni_path)
    offsets, bias_report = bias_correction(feni_power["T2M_MAX"])
    thresholds = percentile_thresholds(apply_offsets(feni_power["T2M_MAX"], offsets))

    gpm_available = all(gpm_cache_path(c["upazila"]).exists() for c in load_centroids())
    rain_source = "gpm" if gpm_available else "power"

    for centroid in load_centroids():
        upazila = centroid["upazila"]
        path = cache_path(upazila)
        frame = add_et0(read_power_csv(path), float(centroid["latitude"]), elevation_m(path))
        tmax_bc = apply_offsets(frame["T2M_MAX"], offsets)

        rain = read_gpm_csv(gpm_cache_path(upazila)) if gpm_available else frame["PRECTOTCORR"]

        if upazila == "Feni Sadar":
            feni = {"frame": frame, "tmax_bc": tmax_bc, "gpm": rain if gpm_available else None}

        rows = rain_indicators(rain) + temperature_indicators(frame, tmax_bc, thresholds, flowering)

        if gpm_available:
            power_rain = frame["PRECTOTCORR"]
            rows += [
                {"year": y, "indicator": "annual_rain_mm_power", "value": round(float(power_rain[power_rain.index.year == y].sum()), 2)}
                for y in complete_years(power_rain.index)
            ]

        years = pd.DataFrame(rows)
        years.insert(0, "upazila", upazila)
        year_rows.append(years)

        for indicator, group in years.groupby("indicator"):
            unit, label, basis, role = INDICATORS[indicator]
            source = rain_source if basis == "rain" else "power"
            trend_rows.append({
                "upazila": upazila, "indicator": indicator, "label": label, "unit": unit,
                "source": source, "source_basis": basis, "role": role,
                **trend(group.set_index("year")["value"]),
                "caveat": (
                    sensor_era_caveat(group.set_index("year")["value"])
                    if source == "gpm" and indicator in INTENSITY_INDICATORS else None
                ),
            })

        print(f"[OK] {upazila}")

    DERIVED.mkdir(parents=True, exist_ok=True)
    pd.concat(year_rows).to_csv(DERIVED / "climate_shift_years.csv", index=False)
    bias_report.to_csv(DERIVED / "climate_tmax_bias_correction.csv", index=False)

    checks = pd.DataFrame(crosscheck(feni["frame"], feni["tmax_bc"], feni["gpm"]))
    checks.to_csv(DERIVED / "climate_crosscheck.csv", index=False)
    agreement = gauge_agreement(checks, bias_report, rain_source)

    trends = pd.DataFrame(trend_rows)
    trends["gauge_agreement"] = trends["source_basis"].map(lambda b: agreement[b]["summary"])
    trends["gauge_agrees"] = trends["source_basis"].map(lambda b: agreement[b]["agrees"])
    trends.to_csv(DERIVED / "climate_shift_trends.csv", index=False)

    print(f"rain source: {rain_source}")
    print(bias_report.to_string(index=False))
    out = trends[trends["upazila"] == "Feni Sadar"]
    print(out[["indicator", "role", "source", "first_year", "change_per_decade", "p_value", "pettitt_break_free", "status", "gauge_agrees"]].to_string(index=False))


if __name__ == "__main__":
    main()
