"""
FIELD SHIFT — CMIP6 projections for Feni by the delta change-factor method

Two indicators only, Feni district, 2041-2060 against 1995-2014, SSP2-4.5
and SSP5-8.5, every model in data-pipeline/data/raw/cmip6/
(NASA NEX-GDDP-CMIP6, fetch_cmip6.py):

    hot_days_mar_may   days with Tmax >= 35 C in March-May, per year
        model change   delta_m = mean Tmax(future, month m) - mean Tmax(historical, m),
                       m = March, April, May (additive)
        applied to     observed bias-corrected daily Tmax (NASA POWER corrected to
                       BMD Feni, climate_shift.py), 1998-2014: Tmax + delta_m,
                       then days >= 35 C counted and averaged over the years
    rx5day_mm          wettest 5-day rain total of the year (median year)
        model change   factor = median annual Rx5day(future) / median annual Rx5day(historical)
        applied to     observed GPM IMERG Rx5day, Feni district = mean of the six
                       upazila series, 1998-2014 median
        Medians, not means: a single extreme model year moves a 20-year mean of
        annual maxima a lot (IPSL-CM6A-LR historical 1998: 6,605 mm of rain in
        the year, which made its SSP2-4.5 mean-based factor 0.49).

Model values are never shown: only their change is applied to observations.
The observed baseline starts in 1998 (POWER temperature break, GPM start),
not 1995; the model baseline is the standard 1995-2014. The delta method
shifts the mean and keeps today's day-to-day variability, so it cannot show
changes in variability. These are projections, not forecasts.

Output: data-pipeline/derived/climate_projections.csv
    indicator, scenario, model, baseline_observed, change, projected, method

Run:
    python data-pipeline/climate/climate_projections.py
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "data-pipeline"))

from climate.climate_shift import apply_offsets, bias_correction  # noqa: E402
from climate.fetch_cmip6 import MODELS, OUT as CMIP6_DIR  # noqa: E402
from climate.fetch_gpm_imerg import cache_path as gpm_cache_path, read_gpm_csv  # noqa: E402
from climate.fetch_power_history import cache_path, load_centroids, read_power_csv  # noqa: E402

DERIVED = ROOT / "data-pipeline" / "derived"
OBS_YEARS = (1998, 2014)
HOT_C = 35.0
MAM = (3, 4, 5)
MIN_MODELS = 5


def rx5(rain: pd.Series) -> pd.Series:
    rolling = rain.rolling(5, min_periods=5).sum()
    return rolling.groupby(rolling.index.year).max()


def observed() -> tuple[pd.Series, pd.Series]:
    power = read_power_csv(cache_path("Feni Sadar"))
    offsets, _ = bias_correction(power["T2M_MAX"])
    tmax = apply_offsets(power["T2M_MAX"], offsets)
    tmax = tmax[(tmax.index.year >= OBS_YEARS[0]) & (tmax.index.year <= OBS_YEARS[1])]

    rain = pd.concat([read_gpm_csv(gpm_cache_path(c["upazila"])) for c in load_centroids()], axis=1).mean(axis=1)
    rain = rain[(rain.index.year >= OBS_YEARS[0]) & (rain.index.year <= OBS_YEARS[1])]
    return tmax, rain


def load_model(model: str, scenario: str) -> pd.DataFrame | None:
    path = CMIP6_DIR / f"feni_{model}_{scenario}.csv"
    if not path.exists():
        return None
    return pd.read_csv(path, parse_dates=["date"]).set_index("date")


def hot_days(tmax: pd.Series) -> float:
    mam = tmax[np.isin(tmax.index.month, MAM)]
    return float((mam >= HOT_C).groupby(mam.index.year).sum().mean())


def main() -> None:
    tmax_obs, rain_obs = observed()
    base_hot = hot_days(tmax_obs)
    base_rx5 = float(rx5(rain_obs).median())
    rows = []

    for model in MODELS:
        hist = load_model(model, "historical")
        if hist is None:
            continue
        for scenario in ("ssp245", "ssp585"):
            future = load_model(model, scenario)
            if future is None:
                continue

            delta = {m: float(future.loc[future.index.month == m, "tasmax_c"].mean()
                              - hist.loc[hist.index.month == m, "tasmax_c"].mean()) for m in MAM}
            shifted = tmax_obs + tmax_obs.index.month.map(lambda m: delta.get(m, 0.0)).to_numpy()
            rows.append({
                "indicator": "hot_days_mar_may", "scenario": scenario, "model": model,
                "baseline_observed": round(base_hot, 2),
                "change": round(float(np.mean(list(delta.values()))), 3),
                "projected": round(hot_days(shifted), 2),
                "method": "additive monthly Tmax delta (Mar, Apr, May) on observed corrected Tmax 1998-2014; change = mean delta, C",
            })

            factor = float(rx5(future["pr_mm"]).median() / rx5(hist["pr_mm"]).median())
            rows.append({
                "indicator": "rx5day_mm", "scenario": scenario, "model": model,
                "baseline_observed": round(base_rx5, 1),
                "change": round(factor, 4),
                "projected": round(base_rx5 * factor, 1),
                "method": "multiplicative change factor on median annual Rx5day, applied to the GPM 1998-2014 median; change = factor",
            })

    frame = pd.DataFrame(rows)
    n_models = frame["model"].nunique() if len(frame) else 0
    if n_models < MIN_MODELS:
        raise SystemExit(f"Only {n_models} models with all three runs; need {MIN_MODELS}")

    DERIVED.mkdir(parents=True, exist_ok=True)
    frame.to_csv(DERIVED / "climate_projections.csv", index=False)

    summary = frame.groupby(["indicator", "scenario"]).agg(
        baseline=("baseline_observed", "first"), models=("model", "nunique"),
        median=("projected", "median"), low=("projected", "min"), high=("projected", "max"),
        change_median=("change", "median"), change_low=("change", "min"), change_high=("change", "max"),
    )
    print(summary.round(2).to_string())


if __name__ == "__main__":
    main()
