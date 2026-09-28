"""
Fetch REAL daily weather data for Feni, Bangladesh from NASA POWER
and engineer features for Machine Learning / Time-Series forecasting pipelines.

Dependencies:
    pip install requests pandas openpyxl numpy scikit-learn
"""

import math
import requests
import numpy as np
import pandas as pd
from datetime import date

# ---------------------------------------------------------------------------
# CONFIGURATION
# ---------------------------------------------------------------------------
LATITUDE = 23.0159      # Feni, Bangladesh
LONGITUDE = 91.3971
START_DATE = "20150101" # YYYYMMDD
END_DATE = "20241231"   
COMMUNITY = "AG"        # Agroclimatology

# Meteorological Parameters
PARAMETERS = "T2M,T2M_MAX,T2M_MIN,PRECTOTCORR,ALLSKY_SFC_SW_DWN,RH2M,WS2M"
BASE_URL = "https://power.larc.nasa.gov/api/temporal/daily/point"

# ---------------------------------------------------------------------------
# DATA FETCHING & CLEANING
# ---------------------------------------------------------------------------
def fetch_power_daily(lat, lon, start, end, parameters, community="AG"):
    """Fetch raw daily weather data from NASA POWER API."""
    params = {
        "parameters": parameters,
        "community": community,
        "longitude": lon,
        "latitude": lat,
        "start": start,
        "end": end,
        "format": "JSON",
    }
    print(f"--> Fetching NASA POWER data for ({lat}, {lon}) [{start} to {end}]...")
    resp = requests.get(BASE_URL, params=params, timeout=60)
    resp.raise_for_status()
    data = resp.json()

    param_data = data["properties"]["parameter"]
    df = pd.DataFrame(param_data)
    df.index = pd.to_datetime(df.index, format="%Y%m%d")
    df.index.name = "date"
    df = df.reset_index()

    # NASA POWER uses -999, -99, or -999.0 as missing value sentinels
    df = df.replace([-999, -99, -999.0, -99.0], np.nan)
    return df


def clean_and_rename(df):
    """Rename metrics and perform basic interpolation for missing values."""
    df = df.rename(columns={
        "T2M": "mean_temp_c",
        "T2M_MAX": "temp_max_c",
        "T2M_MIN": "temp_min_c",
        "PRECTOTCORR": "rainfall_mm",
        "ALLSKY_SFC_SW_DWN": "solar_radiation_kwh_m2_day",
        "RH2M": "relative_humidity_pct",
        "WS2M": "wind_speed_m_s",
    })
    
    # Linear interpolation for isolated missing weather records
    feature_cols = [
        "mean_temp_c", "temp_max_c", "temp_min_c", 
        "rainfall_mm", "solar_radiation_kwh_m2_day", 
        "relative_humidity_pct", "wind_speed_m_s"
    ]
    df[feature_cols] = df[feature_cols].apply(pd.to_numeric, errors='coerce')
    df[feature_cols] = df[feature_cols].interpolate(method="linear").bfill().ffill()
    
    return df

# ---------------------------------------------------------------------------
# AGRO-CLIMATIC & PHYSICAL DERIVATIONS
# ---------------------------------------------------------------------------
def daily_et0_hargreaves(row, lat_deg=LATITUDE):
    """Calculate Reference Evapotranspiration (ET0) using Hargreaves method."""
    lat_rad = math.radians(lat_deg)
    J = row["date"].dayofyear
    dr = 1 + 0.033 * math.cos(2 * math.pi * J / 365)
    delta = 0.409 * math.sin(2 * math.pi * J / 365 - 1.39)
    ws = math.acos(max(-1, min(1, -math.tan(lat_rad) * math.tan(delta))))
    Gsc = 0.0820
    
    Ra = (24 * 60 / math.pi) * Gsc * dr * (
        ws * math.sin(lat_rad) * math.sin(delta)
        + math.cos(lat_rad) * math.cos(delta) * math.sin(ws)
    )  # MJ/m2/day
    Ra_mm = Ra / 2.45
    
    tmax, tmin, tmean = row["temp_max_c"], row["temp_min_c"], row["mean_temp_c"]
    if pd.isna(tmax) or pd.isna(tmin) or pd.isna(tmean):
        return np.nan
    
    return 0.0023 * (tmean + 17.8) * math.sqrt(max(tmax - tmin, 0)) * Ra_mm


def add_agro_derivations(df, kc=1.05, eff_rain_factor=0.8, pump_kwh_per_m3=0.13):
    """Derive ET0 and Irrigation Energy Demand."""
    df["et0_mm_day"] = df.apply(daily_et0_hargreaves, axis=1)
    etc = df["et0_mm_day"] * kc
    nir = (etc - eff_rain_factor * df["rainfall_mm"]).clip(lower=0)
    df["irrigation_energy_kwh_per_ha"] = (nir * 10 * pump_kwh_per_m3).round(3)
    return df

# ---------------------------------------------------------------------------
# MACHINE LEARNING FEATURE ENGINEERING
# ---------------------------------------------------------------------------
def add_ml_features(df):
    """
    Generate ML-ready temporal, cyclical, lag, and rolling statistics features.
    """
    df = df.copy()

    # 1. Cyclical Time Features (Preserves temporal continuity across year boundary)
    day_of_year = df["date"].dt.dayofyear
    df["sin_day"] = np.sin(2 * np.pi * day_of_year / 365.25)
    df["cos_day"] = np.cos(2 * np.pi * day_of_year / 365.25)
    
    month = df["date"].dt.month
    df["sin_month"] = np.sin(2 * np.pi * month / 12)
    df["cos_month"] = np.cos(2 * np.pi * month / 12)

    # 2. Lagged Features (Target & Climate Indicators)
    targets_and_key_drivers = ["rainfall_mm", "mean_temp_c", "irrigation_energy_kwh_per_ha"]
    for col in targets_and_key_drivers:
        for lag in [1, 2, 3, 7]:
            df[f"{col}_lag_{lag}"] = df[col].shift(lag)

    # 3. Rolling Window Aggregations (Past trend windows)
    for window in [3, 7, 14, 30]:
        df[f"rainfall_sum_{window}d"] = df["rainfall_mm"].rolling(window=window).sum()
        df[f"temp_mean_{window}d"] = df["mean_temp_c"].rolling(window=window).mean()
        df[f"solar_mean_{window}d"] = df["solar_radiation_kwh_m2_day"].rolling(window=window).mean()

    # Drop early rows created by shift/rolling windows containing NaNs
    df = df.dropna().reset_index(drop=True)
    return df

# ---------------------------------------------------------------------------
# EXECUTION PIPELINE
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    # Fetch and process
    raw_data = fetch_power_daily(LATITUDE, LONGITUDE, START_DATE, END_DATE, PARAMETERS, COMMUNITY)
    cleaned_df = clean_and_rename(raw_data)
    derived_df = add_agro_derivations(cleaned_df)
    ml_ready_df = add_ml_features(derived_df)

    # Export Datasets
    csv_path = "Feni_Daily_Weather_NASA_POWER_ML.csv"
    xlsx_path = "Feni_Daily_Weather_NASA_POWER_ML.xlsx"
    
    ml_ready_df.to_csv(csv_path, index=False)
    ml_ready_df.to_excel(xlsx_path, index=False)

    print(f"\n[SUCCESS] Pipeline executed successfully.")
    print(f"Total dataset shape: {ml_ready_df.shape}")
    print(f"Exported to:\n - {csv_path}\n - {xlsx_path}")
    print("\nML-Ready Columns Preview:")
    print(ml_ready_df.columns.tolist())