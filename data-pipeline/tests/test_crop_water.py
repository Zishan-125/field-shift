"""Tests for water.crop_water against published FAO examples and formulas."""

import pytest

from water.crop_water import (
    KcCurve,
    effective_rainfall_month,
    et0_penman_monteith,
    extraterrestrial_radiation,
    season_water,
)


def test_penman_monteith_reproduces_fao56_example_18():
    # FAO-56 Chapter 4, Example 18: Uccle (Brussels), 6 July, 50°48'N, 100 m.
    # Published: Ra = 41.09 MJ m-2 day-1, ET0 = 3.88 (3.9) mm/day.
    assert extraterrestrial_radiation(50.80, 187) == pytest.approx(41.09, abs=0.05)

    et0 = et0_penman_monteith(
        t_max=21.5, t_min=12.3, rs=22.07, u2=2.078,
        latitude_deg=50.80, altitude_m=100, doy=187, ea=1.409,
    )
    assert et0 == pytest.approx(3.88, abs=0.05)


@pytest.mark.parametrize(
    "rain, expected",
    [
        (90, 0.8 * 90 - 25),    # P > 75 mm/month
        (260, 0.8 * 260 - 25),
        (35, 0.6 * 35 - 10),    # P < 75 mm/month
        (5, 0.0),               # never negative
        (0, 0.0),
    ],
)
def test_effective_rainfall_follows_fao_formula(rain, expected):
    assert effective_rainfall_month(rain) == pytest.approx(expected)


def test_kc_curve_follows_stages():
    curve = KcCurve(kc_ini=0.3, kc_mid=1.2, kc_end=0.4, l_ini=10, l_dev=10, l_mid=10, l_late=10)

    assert curve.kc(5, 40) == pytest.approx(0.3)
    assert curve.kc(15, 40) == pytest.approx(0.75)
    assert curve.kc(25, 40) == pytest.approx(1.2)
    assert curve.kc(40, 40) == pytest.approx(0.4)
    # Stages scale with the season length.
    assert curve.kc(50, 80) == pytest.approx(1.2)


def test_rain_reduces_irrigation_and_rice_adds_paddy_water():
    curve = KcCurve(1.05, 1.2, 0.75, 30, 30, 60, 30)
    et0 = {m: 4.0 for m in range(1, 13)}
    dry = {m: 0.0 for m in range(1, 13)}
    wet = {m: 500.0 for m in range(1, 13)}

    rice_dry = season_water("rice_boro", 1, 120, curve, et0, dry)
    rice_wet = season_water("rice_boro", 1, 120, curve, et0, wet)
    upland_dry = season_water("wheat", 1, 120, curve, et0, dry)

    assert rice_dry.irrigation_mm == pytest.approx(rice_dry.water_need_mm, abs=0.5)
    assert rice_wet.irrigation_mm < rice_dry.irrigation_mm
    # SAT 200 + WL 100 + PERC 6 mm/day x 120 days
    assert rice_dry.paddy_extra_mm == pytest.approx(200 + 100 + 6 * 120)
    assert upland_dry.paddy_extra_mm == 0
