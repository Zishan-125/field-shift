"""
Guards for food vs feed vs oilseed: a crop that mostly feeds animals (maize)
must not top the food ranking on biomass, and a pattern that maxes out two
indicators must carry its weak-evidence flags.
"""

import csv
import sqlite3
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend" / "offline"))

from fastapi.testclient import TestClient  # noqa: E402

import server  # noqa: E402

URL = f"/api/offline/fields/{server.FIELD_ID}/pattern-recommendations"
LOW_HUMAN_FOOD_SHARE = 0.5


@pytest.fixture(scope="module")
def shares():
    path = ROOT / "data-pipeline" / "reference" / "food_energy.csv"
    with open(path, newline="", encoding="utf-8") as handle:
        return {
            row["crop_id"]: float(row["human_food_share"]) if row["human_food_share"] else None
            for row in csv.DictReader(handle)
        }


@pytest.fixture(scope="module")
def patterns():
    conn = sqlite3.connect(server.DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = [dict(row) for row in conn.execute("SELECT * FROM cropping_patterns")]
    conn.close()
    return rows


@pytest.fixture(scope="module")
def ranked():
    data = TestClient(server.app).post(URL, json={}).json()
    return [data["current"]] + data["results"]


def crops_of(row):
    return [row[k] for k in ("rabi_crop", "kharif1_crop", "kharif2_crop") if row[k] != "fallow"]


@pytest.mark.parametrize(
    "path",
    sorted((ROOT / "data-pipeline" / "reference").glob("*.csv")),
    ids=lambda path: path.name,
)
def test_reference_csv_rows_match_header(path):
    """An unquoted comma in a note silently shifts columns; catch it."""

    with open(path, newline="", encoding="utf-8") as handle:
        rows = list(csv.reader(handle))

    width = len(rows[0])
    bad = [index + 1 for index, row in enumerate(rows) if row and len(row) != width]
    assert not bad, f"{path.name}: lines {bad} do not have {width} fields"


def test_every_end_use_share_is_sourced_or_empty():
    path = ROOT / "data-pipeline" / "reference" / "food_energy.csv"
    with open(path, newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            if row["human_food_share"]:
                assert 0 <= float(row["human_food_share"]) <= 1, row["crop_id"]
                assert row["end_use_source_id"] and row["human_food_share_basis"], row["crop_id"]
            assert row["end_use_class"], row["crop_id"]


def test_human_food_never_exceeds_gross_output(patterns):
    for row in patterns:
        if row["human_food_energy_gj_ha"] is not None:
            assert row["human_food_energy_gj_ha"] <= row["gross_energy_gj_ha"] + 1e-9, row["pattern_id"]


def test_unknown_end_use_is_not_counted_as_food(patterns, shares):
    for row in patterns:
        if any(shares.get(crop) is None for crop in crops_of(row)):
            assert row["human_food_energy_gj_ha"] is None, row["pattern_id"]
            assert row["food_production_score"] is None, row["pattern_id"]


def test_low_food_share_crop_does_not_top_the_food_ranking(patterns, shares):
    scored = [row for row in patterns if row["food_production_score"] is not None]
    top = max(scored, key=lambda row: row["food_production_score"])

    for crop in crops_of(top):
        assert shares[crop] >= LOW_HUMAN_FOOD_SHARE, (top["pattern_id"], crop)


def test_biomass_alone_does_not_win(patterns, shares):
    """The pattern with the most gross output must not lead on food if a
    low-share crop is what makes it big."""

    scored = [row for row in patterns if row["food_production_score"] is not None]
    biggest = max(scored, key=lambda row: row["gross_energy_gj_ha"])

    if any(shares[crop] < LOW_HUMAN_FOOD_SHARE for crop in crops_of(biggest)):
        assert biggest["food_production_score"] < 1.0


def test_maize_pattern_is_not_first_on_food(patterns):
    by_id = {row["pattern_id"]: row for row in patterns}

    assert (
        by_id["maize_fallow_taman"]["food_production_score"]
        < by_id["boro_aus_taman"]["food_production_score"]
    )


def test_double_maximum_requires_evidence_flags(ranked):
    for row in ranked:
        indicators = row["indicators"] or {}
        maxed = [key for key, value in indicators.items() if value is not None and value >= 0.999]

        if len(maxed) >= 2:
            flags = row["evidence_flags"]
            assert flags["yield_evidence"] or flags["market_reality"], (row["pattern_id"], maxed)


def test_market_flag_marks_patterns_outside_the_regional_survey(ranked):
    for row in ranked:
        if not row["adoption"]["observed_in_region"]:
            codes = [flag["code"] for flag in row["evidence_flags"]["market_reality"]]
            assert "not_in_regional_survey" in codes, row["pattern_id"]
