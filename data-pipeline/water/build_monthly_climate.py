"""
FIELD SHIFT — monthly climate normals for crop water requirements

Inputs (both in the repository):
    Feni_Daily_Weather_NASA_POWER_ML.csv
        NASA POWER daily point data (community AG, lat 23.0159, lon 91.3971),
        2015-01-30 to 2024-12-31. Columns used: temp_max_c (T2M_MAX),
        temp_min_c (T2M_MIN), relative_humidity_pct (RH2M), wind_speed_m_s
        (WS2M, already at 2 m), solar_radiation_kwh_m2_day (ALLSKY_SFC_SW_DWN —
        the values are MJ m-2 day-1 despite the column name; checked against
        the POWER API). et0_mm_day in that file is Hargreaves and is kept only
        for comparison.
    backend/offline/field_shift.db, monthly_environmental_features
        ag_rainfall_mm (GPM IMERG) and power_precipitation, 2019-01 to 2024-09.

Output:
    data-pipeline/derived/feni_monthly_climate.csv

Run:
    python data-pipeline/water/build_monthly_climate.py
"""

from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "data-pipeline"))

from water.crop_water import et0_penman_monteith  # noqa: E402

POWER_DAILY = ROOT / "Feni_Daily_Weather_NASA_POWER_ML.csv"
DB_PATH = ROOT / "backend" / "offline" / "field_shift.db"
OUTPUT = ROOT / "data-pipeline" / "derived" / "feni_monthly_climate.csv"

LATITUDE = 23.0159
ALTITUDE_M = 10.66  # elevation of the POWER grid point, from the POWER API response


def main() -> None:
    daily = pd.read_csv(POWER_DAILY, parse_dates=["date"])

    daily["et0_pm"] = [
        et0_penman_monteith(
            t_max=row.temp_max_c,
            t_min=row.temp_min_c,
            rs=row.solar_radiation_kwh_m2_day,  # MJ m-2 day-1, see module docstring
            u2=row.wind_speed_m_s,
            latitude_deg=LATITUDE,
            altitude_m=ALTITUDE_M,
            doy=row.date.day_of_year,
            rh_mean=row.relative_humidity_pct,
        )
        for row in daily.itertuples()
    ]

    daily["month"] = daily["date"].dt.month

    et0 = daily.groupby("month").agg(
        et0_pm_mm_day=("et0_pm", "mean"),
        et0_hargreaves_mm_day=("et0_mm_day", "mean"),
        et0_days=("et0_pm", "size"),
    )

    with sqlite3.connect(DB_PATH) as conn:
        monthly = pd.read_sql(
            """
            SELECT month, ag_rainfall_mm, power_precipitation
            FROM monthly_environmental_features
            """,
            conn,
        )

    rain = monthly.groupby("month").agg(
        rain_gpm_mm_month=("ag_rainfall_mm", "mean"),
        rain_power_mm_month=("power_precipitation", "mean"),
        rain_years=("ag_rainfall_mm", "count"),
    )

    climate = et0.join(rain).reset_index().round(
        {
            "et0_pm_mm_day": 2,
            "et0_hargreaves_mm_day": 2,
            "rain_gpm_mm_month": 1,
            "rain_power_mm_month": 1,
        }
    )

    climate["et0_period"] = f"{daily['date'].min():%Y-%m-%d} to {daily['date'].max():%Y-%m-%d}"
    climate["rain_period"] = "2019-01 to 2024-09"

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    climate.to_csv(OUTPUT, index=False)

    print(climate.to_string(index=False))
    print(f"[OK] {OUTPUT}")


if __name__ == "__main__":
    main()
