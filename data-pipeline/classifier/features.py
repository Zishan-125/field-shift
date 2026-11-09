"""
FIELD SHIFT — classifier features from dekad composites

One sample per (point, season, year). The season window is 21 dekads
(7 months) from the season start:

    rabi     1 Nov (Y-1) to 31 May (Y)
    kharif2  1 Jun (Y)   to 31 Dec (Y)

Per dekad position k = 0..20: NDVI, EVI, LSWI, VV, VH, rain_mm,
sm_rootzone, named e.g. NDVI_k07. Plus per sample: season flag, number of
clear HLS dekads and of radar dekads in the window (so the model can tell
"no data" from "low value").

Gap handling (documented in docs/ml/crop_classifier.md; this is where the
"never gap-fill silently" rule is applied, and the gap counts above are the
disclosure):
    1. Each point's full dekad series is linearly interpolated in time for
       NDVI/EVI/LSWI across gaps of at most MAX_GAP_DEKADS (60 days);
       longer gaps stay NaN (LightGBM handles missing values natively).
       Radar is interpolated across at most 2 dekads.
    2. Savitzky-Golay smoothing (window 5 dekads, order 2) where 5
       consecutive values exist; elsewhere the interpolated value is kept.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from scipy.signal import savgol_filter

OPTICAL = ["NDVI", "EVI", "LSWI"]
RADAR = ["VV", "VH"]
WEATHER = ["rain_mm", "sm_rootzone"]
BANDS = OPTICAL + RADAR + WEATHER
WINDOW_DEKADS = 21
MAX_GAP_DEKADS = 6
MAX_RADAR_GAP = 2
SG_WINDOW, SG_ORDER = 5, 2
SEASON_START = {"rabi": (11, 1, -1), "kharif2": (6, 1, 0)}   # month, day, year offset


def smooth(values: np.ndarray) -> np.ndarray:
    """Savitzky-Golay on runs of >= SG_WINDOW consecutive finite values."""

    out = values.copy()
    finite = np.isfinite(values)
    start = None
    for i in range(len(values) + 1):
        if i < len(values) and finite[i]:
            start = i if start is None else start
            continue
        if start is not None and i - start >= SG_WINDOW:
            out[start:i] = savgol_filter(values[start:i], SG_WINDOW, SG_ORDER)
        start = None
    return out


def prepare_series(dekads: pd.DataFrame) -> pd.DataFrame:
    """Interpolate short gaps and smooth, per point, on the full dekad series."""

    dekads = dekads.copy()
    dekads["dekad_start"] = pd.to_datetime(dekads["dekad_start"])
    dekads = dekads.sort_values(["point_id", "dekad_start"])
    dekads["optical_seen"] = dekads["NDVI"].notna()
    dekads["radar_seen"] = dekads["VH"].notna()
    parts = []

    for _, p in dekads.groupby("point_id", sort=False):
        p = p.copy()
        for band in OPTICAL:
            p[band] = smooth(p[band].interpolate(limit=MAX_GAP_DEKADS, limit_area="inside").to_numpy())
        for band in RADAR:
            p[band] = smooth(p[band].interpolate(limit=MAX_RADAR_GAP, limit_area="inside").to_numpy())
        parts.append(p)

    return pd.concat(parts, ignore_index=True)


def season_window(series: pd.DataFrame, season: str, year: int) -> pd.DataFrame:
    month, day, offset = SEASON_START[season]
    start = pd.Timestamp(year + offset, month, day)
    window = series[series["dekad_start"] >= start].head(WINDOW_DEKADS)
    return window if len(window) == WINDOW_DEKADS else window.iloc[0:0]


def build_samples(dekads: pd.DataFrame, seasons: list[tuple[str, int]] | None = None) -> pd.DataFrame:
    """One row per (point, season, year) with a complete 21-dekad window."""

    series = prepare_series(dekads)
    first, last = series["dekad_start"].min(), series["dekad_start"].max()
    if seasons is None:
        seasons = [(s, y) for y in range(first.year + 1, last.year + 1) for s in ("rabi", "kharif2")]

    rows = []
    for point_id, p in series.groupby("point_id", sort=False):
        p = p.reset_index(drop=True)
        for season, year in seasons:
            w = season_window(p, season, year)
            if w.empty:
                continue
            row = {"point_id": point_id, "season": season, "year": year,
                   "is_rabi": int(season == "rabi"),
                   "n_optical_dekads": int(w["optical_seen"].sum()),
                   "n_radar_dekads": int(w["radar_seen"].sum())}
            for band in BANDS:
                values = w[band].to_numpy(dtype=float)
                row.update({f"{band}_k{k:02d}": values[k] for k in range(WINDOW_DEKADS)})
            rows.append(row)

    return pd.DataFrame(rows)


def feature_columns(samples: pd.DataFrame) -> list[str]:
    return [c for c in samples.columns if c not in ("point_id", "season", "year", "label", "district")]
