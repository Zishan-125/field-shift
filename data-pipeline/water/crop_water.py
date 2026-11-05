"""
FIELD SHIFT — crop water requirement

References (see docs/data-sources.md):
    FAO56   Allen, R.G., Pereira, L.S., Raes, D. & Smith, M. (1998). Crop
            evapotranspiration. FAO Irrigation and Drainage Paper 56.
            ET0: Chapter 4, Eq. 6 (FAO Penman-Monteith) with Eqs. 7, 8, 11-13,
            19, 21-25, 37-40, 42. Kc: Chapter 6, Tables 11 and 12, Fig. 25.
    FAO_IWN Brouwer, C. & Heibloem, M. (1986). Irrigation Water Management
            Training Manual No. 3: Irrigation Water Needs. FAO.
            Chapter 4: effective rainfall (Section 4.2) and the paddy-rice
            terms SAT, PERC and WL (Section 4.4).

All depths are in mm; 1 mm over 1 ha = 10 m3.
"""

from __future__ import annotations

import csv
import math
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path
from typing import Mapping, Optional


# ---------------------------------------------------------------------
# FAO-56 PENMAN-MONTEITH REFERENCE EVAPOTRANSPIRATION
# ---------------------------------------------------------------------

STEFAN_BOLTZMANN = 4.903e-9  # MJ K-4 m-2 day-1 (FAO-56 Eq. 39)
ALBEDO = 0.23                # grass reference (FAO-56 Eq. 38)


def saturation_vapour_pressure(t_c: float) -> float:
    """FAO-56 Eq. 11, kPa."""
    return 0.6108 * math.exp(17.27 * t_c / (t_c + 237.3))


def extraterrestrial_radiation(latitude_deg: float, doy: int) -> float:
    """FAO-56 Eqs. 21-25, MJ m-2 day-1."""
    phi = math.radians(latitude_deg)
    dr = 1 + 0.033 * math.cos(2 * math.pi * doy / 365)
    delta = 0.409 * math.sin(2 * math.pi * doy / 365 - 1.39)
    ws = math.acos(max(-1.0, min(1.0, -math.tan(phi) * math.tan(delta))))

    return (24 * 60 / math.pi) * 0.0820 * dr * (
        ws * math.sin(phi) * math.sin(delta)
        + math.cos(phi) * math.cos(delta) * math.sin(ws)
    )


def et0_penman_monteith(
    t_max: float,
    t_min: float,
    rs: float,
    u2: float,
    latitude_deg: float,
    altitude_m: float,
    doy: int,
    rh_mean: Optional[float] = None,
    ea: Optional[float] = None,
) -> float:
    """
    Daily grass reference ET0 (mm/day), FAO-56 Eq. 6.

    rs: incoming shortwave radiation, MJ m-2 day-1
    u2: wind speed at 2 m, m/s
    Give either ea (kPa) or rh_mean (%); with rh_mean, ea follows Eq. 19.
    Soil heat flux G = 0 for daily steps (Eq. 42).
    """

    t_mean = (t_max + t_min) / 2                                  # Eq. 9
    pressure = 101.3 * ((293 - 0.0065 * altitude_m) / 293) ** 5.26  # Eq. 7
    gamma = 0.665e-3 * pressure                                   # Eq. 8

    es = (saturation_vapour_pressure(t_max) + saturation_vapour_pressure(t_min)) / 2  # Eq. 12

    if ea is None:
        if rh_mean is None:
            raise ValueError("Give ea or rh_mean.")
        ea = rh_mean / 100 * es                                   # Eq. 19

    delta = (
        4098 * saturation_vapour_pressure(t_mean) / (t_mean + 237.3) ** 2
    )                                                             # Eq. 13

    ra = extraterrestrial_radiation(latitude_deg, doy)
    rso = (0.75 + 2e-5 * altitude_m) * ra                         # Eq. 37
    rns = (1 - ALBEDO) * rs                                       # Eq. 38
    rs_rso = min(rs / rso, 1.0) if rso > 0 else 0.0
    rnl = (
        STEFAN_BOLTZMANN
        * ((t_max + 273.16) ** 4 + (t_min + 273.16) ** 4) / 2
        * (0.34 - 0.14 * math.sqrt(ea))
        * (1.35 * rs_rso - 0.35)
    )                                                             # Eq. 39
    rn = rns - rnl                                                # Eq. 40
    g = 0.0                                                       # Eq. 42

    return (
        0.408 * delta * (rn - g)
        + gamma * (900 / (t_mean + 273)) * u2 * (es - ea)
    ) / (delta + gamma * (1 + 0.34 * u2))


# ---------------------------------------------------------------------
# EFFECTIVE RAINFALL AND PADDY TERMS (FAO_IWN Chapter 4)
# ---------------------------------------------------------------------

PADDY_SATURATION_MM = 200       # SAT, Section 4.4 step 4
PADDY_WATER_LAYER_MM = 100      # WL, Section 4.4 step 6
PADDY_PERCOLATION_MM_DAY = 6    # PERC, Section 4.4 step 5: "on average" (4 heavy clay - 8 sandy)

RICE_CROPS = {"rice_aman", "rice_aus", "rice_boro"}


def effective_rainfall_month(p_mm: float) -> float:
    """FAO_IWN Section 4.2: Pe from monthly rainfall P (mm/month), never negative."""
    pe = 0.8 * p_mm - 25 if p_mm > 75 else 0.6 * p_mm - 10
    return max(pe, 0.0)


# ---------------------------------------------------------------------
# CROP COEFFICIENT CURVE (FAO-56 Chapter 6, Fig. 25)
# ---------------------------------------------------------------------

@dataclass(frozen=True)
class KcCurve:
    kc_ini: float
    kc_mid: float
    kc_end: float
    l_ini: float
    l_dev: float
    l_mid: float
    l_late: float

    def kc(self, day: float, season_days: int) -> float:
        """Kc on a day of the season, with Table 11 stages scaled to season_days."""

        total = self.l_ini + self.l_dev + self.l_mid + self.l_late
        scale = season_days / total
        ini, dev, mid = self.l_ini * scale, self.l_dev * scale, self.l_mid * scale
        late = self.l_late * scale

        if day < ini:
            return self.kc_ini
        if day < ini + dev:
            return self.kc_ini + (day - ini) / dev * (self.kc_mid - self.kc_ini)
        if day < ini + dev + mid:
            return self.kc_mid
        return self.kc_mid + min((day - ini - dev - mid) / late, 1.0) * (
            self.kc_end - self.kc_mid
        )


def load_kc_curves(path: Path | str) -> dict[str, KcCurve]:
    curves = {}

    with open(path, newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            if not row["kc_mid"]:
                continue

            curves[row["crop_id"]] = KcCurve(
                kc_ini=float(row["kc_ini"]),
                kc_mid=float(row["kc_mid"]),
                kc_end=float(row["kc_end"]),
                l_ini=float(row["l_ini"]),
                l_dev=float(row["l_dev"]),
                l_mid=float(row["l_mid"]),
                l_late=float(row["l_late"]),
            )

    return curves


# ---------------------------------------------------------------------
# SEASONAL WATER REQUIREMENT
# ---------------------------------------------------------------------

@dataclass
class SeasonWater:
    crop_id: str
    crop_et_mm: float          # sum of Kc x ET0
    paddy_extra_mm: float      # SAT + WL + PERC (rice only)
    effective_rain_mm: float   # effective rainfall that falls while the crop is in the field
    irrigation_mm: float       # sum over months of max(0, need - Pe)

    @property
    def water_need_mm(self) -> float:
        """Total water the crop needs, from rain or irrigation."""
        return self.crop_et_mm + self.paddy_extra_mm


def season_water(
    crop_id: str,
    start_doy: int,
    field_days: int,
    curve: KcCurve,
    et0_by_month: Mapping[int, float],
    rain_by_month: Mapping[int, float],
) -> SeasonWater:
    """
    Water requirement of one crop season, accumulated month by month
    (as in FAO_IWN Chapter 4): IN = ET crop (+ SAT + PERC + WL for rice) - Pe.

    et0_by_month: mean ET0, mm/day, for months 1..12
    rain_by_month: mean rainfall, mm/month, for months 1..12
    Effective rainfall of a month is shared out by the days the crop is in
    the field in that month.
    """

    is_rice = crop_id in RICE_CROPS
    start = date(2001, 1, 1) + timedelta(days=start_doy - 1)

    need_by_month: dict[tuple[int, int], float] = {}
    days_by_month: dict[tuple[int, int], int] = {}
    crop_et = 0.0

    for offset in range(field_days):
        day = start + timedelta(days=offset)
        key = (day.year, day.month)
        etc = curve.kc(offset + 0.5, field_days) * et0_by_month[day.month]

        crop_et += etc
        need_by_month[key] = need_by_month.get(key, 0.0) + etc
        days_by_month[key] = days_by_month.get(key, 0) + 1

    paddy_extra = 0.0

    if is_rice:
        first = (start.year, start.month)
        # FAO_IWN 4.4: SAT is needed in the month before planting and WL at
        # planting; both are charged to the first month the crop is in the field.
        need_by_month[first] += PADDY_SATURATION_MM + PADDY_WATER_LAYER_MM
        paddy_extra += PADDY_SATURATION_MM + PADDY_WATER_LAYER_MM

        for key, days in days_by_month.items():
            need_by_month[key] += PADDY_PERCOLATION_MM_DAY * days
            paddy_extra += PADDY_PERCOLATION_MM_DAY * days

    effective_rain = 0.0
    irrigation = 0.0

    for key, need in need_by_month.items():
        year, month = key
        days_in_month = (date(year + month // 12, month % 12 + 1, 1) - date(year, month, 1)).days
        pe = effective_rainfall_month(rain_by_month[month]) * days_by_month[key] / days_in_month

        effective_rain += min(pe, need)
        irrigation += max(need - pe, 0.0)

    return SeasonWater(
        crop_id=crop_id,
        crop_et_mm=round(crop_et, 1),
        paddy_extra_mm=round(paddy_extra, 1),
        effective_rain_mm=round(effective_rain, 1),
        irrigation_mm=round(irrigation, 1),
    )


def load_monthly_climate(path: Path | str) -> tuple[dict[int, float], dict[int, float]]:
    """Read data-pipeline/derived/feni_monthly_climate.csv -> (ET0 mm/day, rain mm/month)."""

    et0, rain = {}, {}

    with open(path, newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            month = int(row["month"])
            et0[month] = float(row["et0_pm_mm_day"])
            rain[month] = float(row["rain_gpm_mm_month"])

    return et0, rain
