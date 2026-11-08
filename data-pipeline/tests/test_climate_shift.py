"""Tests for the climate-shift analysis (climate/climate_shift.py) and its API."""

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from climate.climate_shift import (
    TEMP_FIRST_YEAR,
    longest_run,
    noleap_doy,
    percentile_thresholds,
    pettitt,
    rainy_season,
    trend,
)
from climate.fetch_power_history import cache_path, load_centroids, read_power_csv

ROOT = Path(__file__).resolve().parents[2]


# ---------------------------------------------------------------------
# Statistics on synthetic series (test data, not Feni data)
# ---------------------------------------------------------------------

def years_series(values):
    return pd.Series(values, index=range(1984, 1984 + len(values)))


def test_pettitt_finds_a_step():
    rng = np.random.default_rng(1)
    values = np.r_[rng.normal(10, 1, 20), rng.normal(20, 1, 20)]

    index, p = pettitt(values)

    assert index == 19
    assert p < 0.01


def test_pettitt_quiet_on_noise():
    rng = np.random.default_rng(2)
    _, p = pettitt(rng.normal(10, 1, 40))

    assert p > 0.05


def test_step_is_not_called_a_trend():
    rng = np.random.default_rng(3)
    values = np.r_[rng.normal(10, 1, 20), rng.normal(20, 1, 22)]

    result = trend(years_series(values))

    assert result["significant"] == 1          # Mann-Kendall alone would say "trend"
    assert result["status"] == "step_change_not_trend"


def test_steady_rise_is_a_trend():
    rng = np.random.default_rng(4)
    values = np.arange(42) * 0.5 + rng.normal(0, 1, 42)

    result = trend(years_series(values))

    assert result["status"] == "trend"
    assert result["change_per_decade"] == pytest.approx(5.0, abs=1.0)


def test_noise_is_not_significant():
    rng = np.random.default_rng(5)
    result = trend(years_series(rng.normal(0, 1, 42)))

    assert result["status"] == "no_significant_trend"
    assert result["p_value"] >= 0.05


def test_longest_run():
    assert longest_run(np.array([1, 1, 0, 1, 1, 1, 0], dtype=bool)) == 3
    assert longest_run(np.zeros(5, dtype=bool)) == 0


def test_rainy_season_on_a_synthetic_monsoon():
    days = pd.date_range("2001-01-01", "2001-12-31")
    rain = pd.Series(np.where((days.month >= 6) & (days.month <= 9), 20.0, 0.5), index=days)

    onset, withdrawal = rainy_season(rain, mean_daily=rain.mean())

    assert onset == pytest.approx(pd.Timestamp("2001-06-01").day_of_year, abs=1)
    assert withdrawal == pytest.approx(pd.Timestamp("2001-09-30").day_of_year, abs=1)


def test_no_rainy_season_is_missing_not_day_365():
    days = pd.date_range("2001-01-01", "2001-12-31")
    rain = pd.Series(1.0, index=days)

    onset, withdrawal = rainy_season(rain, mean_daily=5.0)

    assert np.isnan(onset) and np.isnan(withdrawal)


def test_noleap_doy_shares_feb_29_with_feb_28():
    index = pd.DatetimeIndex(["2024-02-28", "2024-02-29", "2024-03-01", "2023-03-01", "2024-12-31"])

    assert list(noleap_doy(index)) == [59, 60, 60, 60, 365]


def test_percentile_counts_ignore_a_constant_offset():
    rng = np.random.default_rng(6)
    days = pd.date_range("1998-01-01", "2010-12-31")
    tmax = pd.Series(30 + rng.normal(0, 2, len(days)), index=days)

    plain = percentile_thresholds(tmax)
    shifted = percentile_thresholds(tmax + 2.2)

    assert np.allclose(shifted - plain, 2.2)


# ---------------------------------------------------------------------
# Derived results
# ---------------------------------------------------------------------

DERIVED = ROOT / "data-pipeline" / "derived"


def test_bias_correction_shrinks_the_station_gap_out_of_sample():
    report = pd.read_csv(DERIVED / "climate_tmax_bias_correction.csv")
    held_out = report[report["kind"].str.startswith("leave_one_year_out")]

    assert len(held_out) >= 2
    assert (held_out["bias_after_c"].abs() < held_out["bias_before_c"].abs()).all()


def test_temperature_trends_start_after_the_break():
    trends = pd.read_csv(DERIVED / "climate_shift_trends.csv")
    temperature = trends[trends["source_basis"].isin(["tmax_bc", "tmax_raw", "et0"])]

    assert (temperature["first_year"] >= TEMP_FIRST_YEAR).all()


# ---------------------------------------------------------------------
# Cached NASA POWER files
# ---------------------------------------------------------------------

def test_power_cache_is_committed_and_starts_1984():
    for centroid in load_centroids():
        path = cache_path(centroid["upazila"])
        assert path.exists(), path

        frame = read_power_csv(path)
        assert frame.index.min() == pd.Timestamp("1984-01-01")
        assert frame.index.max() >= pd.Timestamp("2025-12-31")


# ---------------------------------------------------------------------
# API
# ---------------------------------------------------------------------

@pytest.fixture(scope="module")
def climate():
    sys.path.insert(0, str(ROOT / "backend" / "offline"))
    from fastapi.testclient import TestClient
    import server

    client = TestClient(server.app)
    response = client.get("/api/offline/climate-shift")
    assert response.status_code == 200
    return client, response.json()


def test_trend_status_needs_significance(climate):
    _, data = climate

    for indicator in data["indicators"]:
        if indicator["status"] == "trend":
            assert indicator["p_value"] < 0.05, indicator["indicator"]
        if indicator["p_value"] >= 0.05:
            assert indicator["status"] == "no_significant_trend", indicator["indicator"]


def test_advice_only_uses_real_trends(climate):
    _, data = climate
    status = {i["indicator"]: i["status"] for i in data["indicators"]}
    role = {i["indicator"]: i["role"] for i in data["indicators"]}
    hazards = [item["hazard"] for item in data["advice"]]

    assert len(hazards) == len(set(hazards))

    caveat = {i["indicator"]: i.get("caveat") for i in data["indicators"]}

    for item in data["advice"]:
        assert status[item["indicator"]] == "trend"
        assert role[item["indicator"]] == "primary"
        assert not (caveat[item["indicator"]] or "").startswith("imerg_sensor_eras")

        for pattern in item["better_patterns"]:
            if any(t["code"] == "fewer_harvests" for t in pattern["trade_offs"]):
                assert pattern["change_kind"] == "trade_off"


def test_response_says_it_is_reanalysis(climate):
    _, data = climate

    assert "reanalysis" in data["notes"]["source"].lower()
    assert "same" in data["notes"]["grid"].lower()


def test_unknown_upazila_is_404(climate):
    client, _ = climate

    assert client.get("/api/offline/climate-shift", params={"upazila": "Nowhere"}).status_code == 404


# ---------------------------------------------------------------------
# GPM IMERG
# ---------------------------------------------------------------------

def test_gpm_cache_is_committed_and_starts_1998():
    from climate.fetch_gpm_imerg import cache_path as gpm_path, read_gpm_csv

    for centroid in load_centroids():
        rain = read_gpm_csv(gpm_path(centroid["upazila"]))
        assert rain.index.min() == pd.Timestamp("1998-01-01")
        assert rain.notna().all()


def test_incomplete_gpm_days_are_scaled_or_dropped(tmp_path, monkeypatch):
    import climate.fetch_gpm_imerg as gpm

    counts = tmp_path / "counts.csv"
    pd.DataFrame({"date": ["2026-01-01", "2026-01-02", "2026-01-03"], "n_halfhours": [48, 36, 8]}).to_csv(counts, index=False)
    rain = tmp_path / "rain.csv"
    pd.DataFrame({"date": ["2026-01-01", "2026-01-02", "2026-01-03"], "precip_mm": [10.0, 9.0, 2.0]}).to_csv(rain, index=False)
    monkeypatch.setattr(gpm, "HALFHOURS_FILE", counts)

    series = gpm.read_gpm_csv(rain)

    assert series.loc["2026-01-01"] == 10.0
    assert series.loc["2026-01-02"] == pytest.approx(12.0)     # 9 mm in 36 half-hours -> rate x 24 h
    assert pd.Timestamp("2026-01-03") not in series.index       # 8 of 48: missing, not 2 mm


def test_gpm_intensity_indicators_carry_the_sensor_era_caveat(climate):
    _, data = climate

    for indicator in data["indicators"]:
        if indicator["source"] == "gpm" and indicator["indicator"] in ("extreme_rain_days", "longest_dry_spell_kharif1"):
            assert indicator["caveat"].startswith("imerg_sensor_eras")
