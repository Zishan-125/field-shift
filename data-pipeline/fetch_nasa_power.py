
"""
NASA POWER historical weather ingestion for Field Shift.

Purpose
-------
Download daily NASA POWER Agroclimatology data for the Field Shift field
and aggregate it into monthly agricultural-environmental features.

Pipeline position
-----------------
NASA POWER Daily API
        ↓
Daily local CSV
        ↓
Monthly aggregation
        ↓
Monthly POWER feature CSV

This script does NOT modify:
    - canonical observations
    - monthly remote-sensing features

Field Shift target period:
    2019-01 → 2024-09

Location:
    Field centroid
    Latitude  : 23.0159
    Longitude : 91.3976

Parameters
----------
PRECTOTCORR
    Corrected precipitation, mm/day

T2M
    Air temperature at 2 m, °C

T2M_MAX
    Maximum air temperature at 2 m, °C

T2M_MIN
    Minimum air temperature at 2 m, °C

ALLSKY_SFC_SW_DWN
    All-sky surface shortwave downward radiation, kWh/m²/day

WS10M
    Wind speed at 10 m, m/s

Aggregation
-----------
PRECTOTCORR       → monthly SUM
T2M               → monthly MEAN
T2M_MAX           → monthly MAX
T2M_MIN           → monthly MIN
ALLSKY_SFC_SW_DWN → monthly SUM
WS10M             → monthly MEAN

The daily data is retained locally so the monthly layer can be
reproduced without another API request.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd
import requests


# ============================================================================
# CONFIGURATION
# ============================================================================

PROJECT_ROOT = Path(__file__).resolve().parents[1]

OUTPUT_DIR = (
    PROJECT_ROOT
    / "data-pipeline"
    / "output"
    / "features"
)

DAILY_OUTPUT = (
    OUTPUT_DIR
    / "nasa_power_daily_2019_2024.csv"
)

MONTHLY_OUTPUT = (
    OUTPUT_DIR
    / "nasa_power_monthly_2019_2024.csv"
)

# Field centroid
LATITUDE = 23.0159
LONGITUDE = 91.3976

START_DATE = "20190101"
END_DATE = "20240930"

START_MONTH = "2019-01"
END_MONTH = "2024-09"

FIELD_ID = "426e9d97-78cf-45d2-82ae-8131040b5ee7"

# NASA POWER Agroclimatology community
COMMUNITY = "AG"

PARAMETERS = [
    "PRECTOTCORR",
    "T2M",
    "T2M_MAX",
    "T2M_MIN",
    "ALLSKY_SFC_SW_DWN",
    "WS10M",
]

PARAMETER_UNITS = {
    "PRECTOTCORR": "mm/day",
    "T2M": "degC",
    "T2M_MAX": "degC",
    "T2M_MIN": "degC",
    "ALLSKY_SFC_SW_DWN": "kWh/m2/day",
    "WS10M": "m/s",
}

API_URL = (
    "https://power.larc.nasa.gov/api/temporal/daily/point"
)


# ============================================================================
# HELPERS
# ============================================================================

def print_header(title: str) -> None:
    print()
    print("=" * 70)
    print(title)
    print("=" * 70)


def build_api_url() -> str:
    """Build the NASA POWER Daily API request URL."""

    return API_URL + "?" + "&".join(
        [
            f"parameters={','.join(PARAMETERS)}",
            f"community={COMMUNITY}",
            f"longitude={LONGITUDE}",
            f"latitude={LATITUDE}",
            f"start={START_DATE}",
            f"end={END_DATE}",
            "format=JSON",
            "time-standard=UTC",
        ]
    )


def request_power_data() -> dict:
    """Download NASA POWER data."""

    url = build_api_url()

    print("[INFO] Requesting NASA POWER Daily API...")
    print(f"       Latitude  : {LATITUDE}")
    print(f"       Longitude : {LONGITUDE}")
    print(f"       Period    : {START_DATE} → {END_DATE}")
    print(f"       Community : {COMMUNITY}")
    print(f"       Parameters: {', '.join(PARAMETERS)}")

    try:
        response = requests.get(
            url,
            timeout=120,
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        raise RuntimeError(
            f"NASA POWER API request failed: {exc}"
        ) from exc

    try:
        payload = response.json()
    except ValueError as exc:
        raise RuntimeError(
            "NASA POWER returned a response that is not valid JSON."
        ) from exc

    if "properties" not in payload:
        raise RuntimeError(
            "NASA POWER response does not contain 'properties'."
        )

    if "parameter" not in payload["properties"]:
        raise RuntimeError(
            "NASA POWER response does not contain 'parameter'."
        )

    print("[OK] NASA POWER response received.")

    return payload


def power_json_to_dataframe(payload: dict) -> pd.DataFrame:
    """Convert NASA POWER JSON parameter dictionary to a daily DataFrame."""

    parameter_data = payload["properties"]["parameter"]

    if not parameter_data:
        raise RuntimeError(
            "NASA POWER returned an empty parameter dictionary."
        )

    # POWER JSON uses YYYYMMDD as dictionary keys.
    all_dates = set()

    for values in parameter_data.values():
        all_dates.update(values.keys())

    if not all_dates:
        raise RuntimeError(
            "NASA POWER response contains no daily observations."
        )

    df = pd.DataFrame(
        {
            parameter: pd.Series(values, dtype="float64")
            for parameter, values in parameter_data.items()
        }
    )

    df.index = pd.to_datetime(
        df.index,
        format="%Y%m%d",
        errors="coerce",
    )

    df.index.name = "date"

    df = df.reset_index()

    # Add Field Shift metadata.
    df.insert(0, "field_id", FIELD_ID)

    return df


def validate_daily_data(df: pd.DataFrame) -> None:
    """Validate the downloaded daily POWER dataset."""

    print_header("DAILY DATA VALIDATION")

    required_columns = [
        "field_id",
        "date",
        *PARAMETERS,
    ]

    missing_columns = [
        column
        for column in required_columns
        if column not in df.columns
    ]

    if missing_columns:
        raise RuntimeError(
            "Missing required POWER columns: "
            + ", ".join(missing_columns)
        )

    if df.empty:
        raise RuntimeError(
            "NASA POWER daily dataset is empty."
        )

    if df["date"].isna().any():
        raise RuntimeError(
            "Daily dataset contains invalid dates."
        )

    duplicate_dates = df["date"].duplicated().sum()

    if duplicate_dates:
        raise RuntimeError(
            f"Found {duplicate_dates} duplicate daily dates."
        )

    actual_start = df["date"].min()
    actual_end = df["date"].max()

    expected_start = pd.Timestamp("2019-01-01")
    expected_end = pd.Timestamp("2024-09-30")

    print(f"[INFO] Daily rows : {len(df)}")
    print(f"[INFO] Date range : {actual_start.date()} → {actual_end.date()}")

    if actual_start != expected_start:
        raise RuntimeError(
            f"Unexpected start date: {actual_start.date()} "
            f"(expected {expected_start.date()})"
        )

    if actual_end != expected_end:
        raise RuntimeError(
            f"Unexpected end date: {actual_end.date()} "
            f"(expected {expected_end.date()})"
        )

    print()
    print("Missing values:")

    for parameter in PARAMETERS:
        missing = int(df[parameter].isna().sum())
        available = len(df) - missing

        print(
            f"  {parameter:<22}: "
            f"{available:4d}/{len(df)} available"
            f" ({missing} missing)"
        )

    # POWER uses -999 as a missing-data flag in some output formats.
    # Treat any remaining sentinel values as invalid rather than real data.
    for parameter in PARAMETERS:
        sentinel_count = int(
            (df[parameter] <= -999).sum()
        )

        if sentinel_count:
            raise RuntimeError(
                f"{parameter} contains {sentinel_count} "
                "possible POWER missing-value sentinels."
            )

    print()
    print("[OK] Daily POWER dataset validation passed.")


def aggregate_monthly(df: pd.DataFrame) -> pd.DataFrame:
    """Aggregate daily POWER observations into monthly features."""

    print_header("MONTHLY AGGREGATION")

    working = df.copy()

    working["month"] = (
        working["date"]
        .dt.to_period("M")
        .astype(str)
    )

    monthly = (
        working
        .groupby("month", as_index=False)
        .agg(
            power_precipitation=(
                "PRECTOTCORR",
                "sum",
            ),
            power_precipitation_obs=(
                "PRECTOTCORR",
                "count",
            ),

            power_temperature_mean=(
                "T2M",
                "mean",
            ),
            power_temperature_max=(
                "T2M_MAX",
                "max",
            ),
            power_temperature_min=(
                "T2M_MIN",
                "min",
            ),
            power_temperature_obs=(
                "T2M",
                "count",
            ),

            power_solar_radiation=(
                "ALLSKY_SFC_SW_DWN",
                "sum",
            ),
            power_solar_radiation_obs=(
                "ALLSKY_SFC_SW_DWN",
                "count",
            ),

            power_wind_speed=(
                "WS10M",
                "mean",
            ),
            power_wind_speed_obs=(
                "WS10M",
                "count",
            ),
        )
    )

    monthly["month_start"] = pd.to_datetime(
        monthly["month"] + "-01"
    )

    monthly["month_end"] = (
        monthly["month_start"]
        + pd.offsets.MonthEnd(1)
    )

    monthly["year"] = monthly["month_start"].dt.year
    monthly["month_number"] = monthly["month_start"].dt.month

    monthly.insert(0, "field_id", FIELD_ID)

    # Expected 69 months.
    expected_months = pd.period_range(
        START_MONTH,
        END_MONTH,
        freq="M",
    ).astype(str)

    actual_months = monthly["month"].tolist()

    missing_months = sorted(
        set(expected_months) - set(actual_months)
    )

    unexpected_months = sorted(
        set(actual_months) - set(expected_months)
    )

    if missing_months:
        raise RuntimeError(
            "Missing monthly POWER periods: "
            + ", ".join(missing_months)
        )

    if unexpected_months:
        raise RuntimeError(
            "Unexpected monthly POWER periods: "
            + ", ".join(unexpected_months)
        )

    if len(monthly) != len(expected_months):
        raise RuntimeError(
            f"Expected {len(expected_months)} months, "
            f"found {len(monthly)}."
        )

    monthly["power_available"] = (
        monthly[
            [
                "power_precipitation_obs",
                "power_temperature_obs",
                "power_solar_radiation_obs",
                "power_wind_speed_obs",
            ]
        ]
        .gt(0)
        .all(axis=1)
        .astype(int)
    )

    # Number of days represented by each month.
    monthly["expected_days"] = (
        monthly["month_end"]
        - monthly["month_start"]
    ).dt.days + 1

    monthly["power_days_observed"] = (
        working
        .groupby("month")["date"]
        .nunique()
        .reindex(monthly["month"])
        .values
    )

    monthly["power_complete"] = (
        monthly["power_days_observed"]
        == monthly["expected_days"]
    ).astype(int)

    # Keep a clean, deterministic column order.
    monthly = monthly[
        [
            "field_id",
            "month",
            "month_start",
            "month_end",
            "year",
            "month_number",

            "power_precipitation",
            "power_precipitation_obs",

            "power_temperature_mean",
            "power_temperature_max",
            "power_temperature_min",
            "power_temperature_obs",

            "power_solar_radiation",
            "power_solar_radiation_obs",

            "power_wind_speed",
            "power_wind_speed_obs",

            "power_days_observed",
            "expected_days",

            "power_available",
            "power_complete",
        ]
    ]

    print(
        f"[INFO] Monthly rows: {len(monthly)}"
    )

    print(
        f"[INFO] Coverage: "
        f"{monthly['month'].iloc[0]} → "
        f"{monthly['month'].iloc[-1]}"
    )

    print()
    print("Monthly POWER availability:")

    print(
        f"  Complete months : "
        f"{monthly['power_complete'].sum()} / {len(monthly)}"
    )

    print(
        f"  Available months: "
        f"{monthly['power_available'].sum()} / {len(monthly)}"
    )

    return monthly


def save_outputs(
    daily: pd.DataFrame,
    monthly: pd.DataFrame,
) -> None:
    """Save daily and monthly POWER datasets."""

    OUTPUT_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    daily.to_csv(
        DAILY_OUTPUT,
        index=False,
    )

    monthly.to_csv(
        MONTHLY_OUTPUT,
        index=False,
    )

    print_header("OUTPUT")

    print(f"[OK] Daily output:")
    print(f"     {DAILY_OUTPUT}")

    print()
    print(f"[OK] Monthly output:")
    print(f"     {MONTHLY_OUTPUT}")


def print_preview(monthly: pd.DataFrame) -> None:
    """Print useful validation previews."""

    print_header("MONTHLY POWER PREVIEW")

    print(
        monthly[
            [
                "month",
                "power_precipitation",
                "power_temperature_mean",
                "power_temperature_max",
                "power_temperature_min",
                "power_solar_radiation",
                "power_wind_speed",
                "power_days_observed",
                "power_complete",
            ]
        ]
        .head(5)
        .to_string(index=False)
    )

    print()
    print("Tail:")

    print(
        monthly[
            [
                "month",
                "power_precipitation",
                "power_temperature_mean",
                "power_temperature_max",
                "power_temperature_min",
                "power_solar_radiation",
                "power_wind_speed",
                "power_days_observed",
                "power_complete",
            ]
        ]
        .tail(5)
        .to_string(index=False)
    )


# ============================================================================
# MAIN
# ============================================================================

def main() -> int:
    print_header("NASA POWER INGESTION — FIELD SHIFT")

    print(f"Project root : {PROJECT_ROOT}")
    print(f"Field ID     : {FIELD_ID}")
    print(f"Latitude     : {LATITUDE}")
    print(f"Longitude    : {LONGITUDE}")
    print(f"Period       : 2019-01-01 → 2024-09-30")

    # ------------------------------------------------------------------
    # 1. Download
    # ------------------------------------------------------------------

    payload = request_power_data()

    # ------------------------------------------------------------------
    # 2. Convert JSON → daily DataFrame
    # ------------------------------------------------------------------

    daily = power_json_to_dataframe(payload)

    # ------------------------------------------------------------------
    # 3. Validate
    # ------------------------------------------------------------------

    validate_daily_data(daily)

    # ------------------------------------------------------------------
    # 4. Monthly aggregation
    # ------------------------------------------------------------------

    monthly = aggregate_monthly(daily)

    # ------------------------------------------------------------------
    # 5. Save
    # ------------------------------------------------------------------

    save_outputs(
        daily=daily,
        monthly=monthly,
    )

    # ------------------------------------------------------------------
    # 6. Preview
    # ------------------------------------------------------------------

    print_preview(monthly)

    print_header("SUCCESS")

    print(
        "[SUCCESS] NASA POWER daily and monthly layers created."
    )

    print(
        "[OK] Canonical observation layer was not modified."
    )

    print(
        "[OK] Monthly remote-sensing feature layer was not modified."
    )

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\n[STOPPED] Interrupted by user.")
        raise SystemExit(130)
    except Exception as exc:
        print()
        print("=" * 70)
        print("ERROR")
        print("=" * 70)
        print(f"[ERROR] {exc}")
        raise SystemExit(1)

