"""
Guard tests for the pattern recommendations: the ranking must never reward
growing less food. They run the real API (backend/offline/server.py) on the
committed database.
"""

import sqlite3
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend" / "offline"))

from fastapi.testclient import TestClient  # noqa: E402

import server  # noqa: E402

FIELD_ID = server.FIELD_ID
URL = f"/api/offline/fields/{FIELD_ID}/pattern-recommendations"


@pytest.fixture(scope="module")
def client():
    return TestClient(server.app)


def recommend(client, **body):
    response = client.post(URL, json=body)
    assert response.status_code == 200, response.text
    return response.json()


def full_ranking(data):
    """Current pattern and candidates together, best first."""
    rows = [data["current"]] + data["results"]
    return sorted(rows, key=lambda row: row["score"], reverse=True)


# ---------------------------------------------------------------------
# Ranking guards (default weights)
# ---------------------------------------------------------------------

def test_default_profile_gives_food_production_a_visible_weight(client):
    data = recommend(client)

    assert data["priority_profile"]["food_production"] >= 0.2


def test_triple_rice_is_not_ranked_last(client):
    ranking = full_ranking(recommend(client))
    ids = [row["pattern_id"] for row in ranking]

    assert "boro_aus_taman" in ids
    assert ids[-1] != "boro_aus_taman"


def test_no_single_crop_pattern_in_top_three(client):
    top = full_ranking(recommend(client))[:3]

    for row in top:
        assert row["facts"]["crop_count"] > 1, row["pattern_id"]


@pytest.mark.parametrize("current", ["boro_fallow_taman", "boro_aus_taman", "mungbean_aus_taman"])
def test_fewer_harvests_is_always_a_trade_off(client, current):
    data = recommend(client, current_pattern_id=current)

    for row in data["results"] + data["not_scored"]:
        comparison = row["comparison"]

        if comparison["harvests_change"] < 0:
            codes = [item["code"] for item in comparison["trade_offs"]]
            assert comparison["change_kind"] == "trade_off", row["pattern_id"]
            assert "fewer_harvests" in codes, row["pattern_id"]


def test_less_food_is_always_a_trade_off(client):
    data = recommend(client)

    for row in data["results"]:
        food = row["comparison"]["human_food_energy_gj_ha"]

        if food is not None and food["change"] < 0:
            assert row["comparison"]["change_kind"] == "trade_off", row["pattern_id"]


def test_every_score_responds_to_the_production_weight(client):
    low = recommend(client, food_production=0.1)
    high = recommend(client, food_production=0.9)

    low_scores = {row["pattern_id"]: row["score"] for row in full_ranking(low)}
    high_scores = {row["pattern_id"]: row["score"] for row in full_ranking(high)}

    assert low_scores.keys() == high_scores.keys()

    for pattern_id, score in low_scores.items():
        assert score != pytest.approx(high_scores[pattern_id], abs=1e-6), pattern_id


@pytest.mark.parametrize(
    "priority",
    ["food_production", "water_productivity", "soil_health", "climate_resilience", "crop_diversity"],
)
def test_no_priority_weight_is_dead(client, priority):
    """Raising any one priority must change the ranking scores."""

    base = {row["pattern_id"]: row["score"] for row in full_ranking(recommend(client))}
    boosted = {
        row["pattern_id"]: row["score"]
        for row in full_ranking(recommend(client, **{priority: 1.0}))
    }

    changed = [pid for pid in base if base[pid] != pytest.approx(boosted[pid], abs=1e-6)]
    assert len(changed) >= len(base) - 1, priority


# ---------------------------------------------------------------------
# Indicator guards (database)
# ---------------------------------------------------------------------

@pytest.fixture(scope="module")
def patterns():
    conn = sqlite3.connect(server.DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = {row["pattern_id"]: dict(row) for row in conn.execute("SELECT * FROM cropping_patterns")}
    conn.close()
    return rows


@pytest.mark.parametrize(
    "with_legume, with_fallow",
    [
        ("lentil_fallow_taman", "fallow_fallow_taman"),
        ("mungbean_fallow_taman", "fallow_fallow_taman"),
        ("mungbean_aus_taman", "fallow_aus_taman"),
        ("lentil_aus_taman", "fallow_aus_taman"),
    ],
)
def test_legume_season_beats_bare_fallow_for_soil(patterns, with_legume, with_fallow):
    assert patterns[with_legume]["soil_health_score"] > patterns[with_fallow]["soil_health_score"]


def test_fallow_season_adds_no_water_and_no_food(patterns):
    single = patterns["fallow_fallow_taman"]
    double = patterns["boro_fallow_taman"]

    # Adding Boro adds both water and food: an empty season is not a "saving".
    assert double["water_need_mm"] > single["water_need_mm"]
    assert double["human_food_energy_gj_ha"] > single["human_food_energy_gj_ha"]


def test_more_harvests_of_the_same_crops_produce_more_food(patterns):
    assert patterns["boro_aus_taman"]["human_food_energy_gj_ha"] > patterns["boro_fallow_taman"]["human_food_energy_gj_ha"]
    assert patterns["boro_fallow_taman"]["human_food_energy_gj_ha"] > patterns["fallow_fallow_taman"]["human_food_energy_gj_ha"]
