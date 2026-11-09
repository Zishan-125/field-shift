"""Tests for the phenology labels and classifier features (synthetic series, not Feni data)."""

import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "data-pipeline" / "classifier"))

from features import WINDOW_DEKADS, build_samples, smooth  # noqa: E402
from phenology_labels import kharif2_label, label_all, rabi_label  # noqa: E402

DEKADS = pd.to_datetime(
    [f"{y}-{m:02d}-{d:02d}" for y in (2020, 2021) for m in range(1, 13) for d in (1, 11, 21)]
)


def series(ndvi, vh, lswi=None, evi=None) -> pd.DataFrame:
    """A point whose values are functions of the dekad date."""

    frame = pd.DataFrame({"point_id": "p1", "dekad_start": DEKADS})
    frame["NDVI"] = [ndvi(t) for t in DEKADS]
    frame["EVI"] = [evi(t) if evi else (n * 0.6 if n == n else np.nan) for t, n in zip(DEKADS, frame["NDVI"])]
    frame["LSWI"] = [lswi(t) if lswi else 0.0 for t in DEKADS]
    frame["VH"] = [vh(t) for t in DEKADS]
    frame["VV"] = frame["VH"] + 6
    frame["n_clear"] = frame["NDVI"].notna().astype(int)
    frame["rain_mm"] = 10.0
    frame["sm_rootzone"] = 0.3
    return frame


def in_months(t, months):
    return t.month in months


def test_boro_needs_flooding_then_green():
    p = series(
        ndvi=lambda t: 0.75 if in_months(t, (3, 4)) else 0.3,
        vh=lambda t: -24.0 if in_months(t, (1,)) else -15.0,
    )
    label, why = rabi_label(p, 2021)
    assert label == "Boro", why


def test_green_rabi_without_flooding_is_nonrice():
    p = series(
        ndvi=lambda t: 0.65 if in_months(t, (12, 1, 2)) else 0.25,
        vh=lambda t: -15.0,
    )
    label, why = rabi_label(p, 2021)
    assert label == "Rabi_nonrice", why


def test_bare_rabi_is_fallow():
    p = series(ndvi=lambda t: 0.2, vh=lambda t: -16.0)
    label, _ = rabi_label(p, 2021)
    assert label == "Fallow"


def test_aman_from_radar_rise():
    p = series(
        ndvi=lambda t: np.nan if in_months(t, (6, 7, 8, 9, 10, 11)) else 0.3,   # monsoon cloud
        vh=lambda t: -24.0 if in_months(t, (7,)) else (-13.0 if in_months(t, (9, 10)) else -18.0),
    )
    label, why = kharif2_label(p, 2021)
    assert label == "T_Aman", why


def test_green_veto_stops_aman():
    p = series(
        ndvi=lambda t: 0.3,                                                # seen and not green in Oct-Nov
        vh=lambda t: -24.0 if in_months(t, (7,)) else (-13.0 if in_months(t, (9, 10)) else -18.0),
    )
    label, _ = kharif2_label(p, 2021)
    assert label != "T_Aman"


def test_no_data_means_no_label():
    p = series(ndvi=lambda t: np.nan, vh=lambda t: np.nan)
    labels = label_all(p)
    assert labels["label"].isna().all()


def test_smooth_leaves_short_runs_and_gaps():
    values = np.array([0.1, np.nan, 0.2, 0.3, 0.4, 0.5, 0.6, np.nan])
    out = smooth(values)
    assert np.isnan(out[1]) and np.isnan(out[7])
    assert out[0] == 0.1                                                  # run of one: untouched
    assert np.allclose(out[2:7], values[2:7], atol=1e-9)                  # linear run: SG keeps it


def test_samples_have_full_windows_and_gap_counts():
    p = series(ndvi=lambda t: 0.5 if t.month != 8 else np.nan, vh=lambda t: -15.0)
    samples = build_samples(p, seasons=[("kharif2", 2020), ("rabi", 2021)])
    assert len(samples) == 2
    assert {f"NDVI_k{k:02d}" for k in range(WINDOW_DEKADS)} <= set(samples.columns)
    kharif = samples[samples["season"] == "kharif2"].iloc[0]
    assert kharif["n_optical_dekads"] == WINDOW_DEKADS - 3                 # August missing, and counted
