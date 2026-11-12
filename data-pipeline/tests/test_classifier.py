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


def test_bbs_area_reference_records_units_and_converts():
    bbs = pd.read_csv(ROOT / "data-pipeline" / "reference" / "bbs_district_rice_area.csv")

    assert bbs["area_acre_column_header"].str.startswith("Acre").all()
    assert bbs["area_ha_column_header"].str.startswith(("Hectare", "Hector")).all()
    ratio = bbs["area_acre"] * 0.404686 / bbs["area_ha"]
    assert ratio.between(0.995, 1.005).all()       # every row: hectare column = acre column x 0.4047


def test_demo_fields_endpoint_reports_coastal_fallow():
    sys.path.insert(0, str(ROOT / "backend" / "offline"))
    from fastapi.testclient import TestClient
    import server

    response = TestClient(server.app).get("/api/offline/demo-fields")
    assert response.status_code == 200
    data = response.json()

    assert len(data["fields"]) == 6
    coastal = data["coastal_fallow"]
    assert coastal["field_id"] == "feni_sonagazi_01"
    assert coastal["coastal"]["fallow"] <= coastal["coastal"]["years"]
    assert "not the salt" in coastal["note"]


def test_field_signal_reaches_the_score_and_the_top_pick_check_is_reported():
    sys.path.insert(0, str(ROOT / "backend" / "offline"))
    from fastapi.testclient import TestClient
    import server

    data = TestClient(server.app).get("/api/offline/demo-fields").json()
    picks = data["top_picks"]

    assert len(picks) == 6
    # Guard: if all six share a top pick, the API must say so (shown on screen as a limitation).
    assert data["same_top_everywhere"] == (len({p["top"] for p in picks.values()}) == 1)
    # The field-specific signal must reach the score: coastal Sonagazi is not scored like the inland fields.
    inland = [p["risk"] for f, p in picks.items() if f != "feni_sonagazi_01"]
    assert picks["feni_sonagazi_01"]["risk"] > max(inland)
    assert len({p["second"] for p in picks.values()}) > 1


def test_recommendations_name_the_driving_hazard_from_the_field_record():
    sys.path.insert(0, str(ROOT / "backend" / "offline"))
    import server

    result = server.pattern_recommendations("feni_sonagazi_01", server.PatternRecommendationRequest())
    drivers = [p["risk_driver"] for p in result["results"] if p.get("risk_driver")]
    assert drivers, "some recommendation must be driven by this field's own hazards"
    for d in drivers:
        assert 0 < d["evidence"]["n_hit"] <= d["evidence"]["n_years"]


def test_never_observed_dry_season_is_feasibility_not_score():
    sys.path.insert(0, str(ROOT / "backend" / "offline"))
    import server

    sonagazi = server.pattern_recommendations("feni_sonagazi_01", server.PatternRecommendationRequest())
    obs = sonagazi["field_observation"]
    assert obs["never_cropped"] and obs["readable"] >= server.MIN_READABLE_SEASONS and obs["cropped"] == 0
    assert sonagazi["not_observed_on_field"], "gated patterns are listed, not hidden"
    for p in sonagazi["results"]:
        assert not server.needs_dry_season_crop(p)
    for p in sonagazi["not_observed_on_field"]:
        assert server.needs_dry_season_crop(p)
        assert "salinity" not in p["not_observed_reason"]["detail"].lower()

    # Too few readable seasons: the rule must not fire.
    chhagalnaiya = server.pattern_recommendations("feni_chhagalnaiya_01", server.PatternRecommendationRequest())
    assert chhagalnaiya["field_observation"]["readable"] < server.MIN_READABLE_SEASONS
    assert not chhagalnaiya["field_observation"]["never_cropped"]
    assert chhagalnaiya["not_observed_on_field"] == []


def test_guard_six_fields_do_not_all_share_a_top_pick():
    sys.path.insert(0, str(ROOT / "backend" / "offline"))
    from fastapi.testclient import TestClient
    import server

    data = TestClient(server.app).get("/api/offline/demo-fields").json()
    assert not data["same_top_everywhere"]
