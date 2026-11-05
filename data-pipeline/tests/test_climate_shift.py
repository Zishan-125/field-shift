"""Tests for the climate-shift analysis (climate/climate_shift.py) and its API."""

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from climate.climate_shift import longest_run, pettitt, rainy_season, trend
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

    for item in data["advice"]:
        assert status[item["indicator"]] == "trend"

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
