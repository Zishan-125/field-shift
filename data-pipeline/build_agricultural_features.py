"""
Build the offline agricultural feature layer for Field Shift.

Inputs
------
1. Monthly environmental features:
   data-pipeline/output/features/monthly_environmental_features_2019_2024.csv

2. Field-level SoilGrids profile:
   data-pipeline/output/soil/field_soil_profile.csv

Output
------
data-pipeline/output/features/agricultural_features_2019_2024.csv

Design
------
- Keeps monthly environmental observations intact.
- Joins one field-level SoilGrids profile to every monthly record.
- Does NOT create synthetic crop-yield targets.
- Does NOT modify canonical observations.
- Creates deterministic agricultural indicators.
- Preserves existing environmental missingness.
- Validates the actual YYYY-MM monthly schema.
- Preserves source environmental columns for traceability.
- Stores soil provenance.
- Treats SoilGrids values as modelled predictions.
- Designed for the offline-first Field Shift architecture.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd


# =====================================================================
# PATHS
# =====================================================================

ROOT = Path(__file__).resolve().parents[1]

ENVIRONMENTAL_FILE = (
    ROOT
    / "data-pipeline"
    / "output"
    / "features"
    / "monthly_environmental_features_2019_2024.csv"
)

SOIL_FILE = (
    ROOT
    / "data-pipeline"
    / "output"
    / "soil"
    / "field_soil_profile.csv"
)

OUTPUT_FILE = (
    ROOT
    / "data-pipeline"
    / "output"
    / "features"
    / "agricultural_features_2019_2024.csv"
)


# =====================================================================
# EXPECTED DATASET CONFIGURATION
# =====================================================================

EXPECTED_START = "2019-01"
EXPECTED_END = "2024-09"
EXPECTED_MONTH_COUNT = 69


# =====================================================================
# SOIL CONFIGURATION
# =====================================================================

SOIL_PROPERTIES = [
    "soil_ph",
    "soil_organic_carbon",
    "soil_clay",
    "soil_sand",
    "soil_silt",
    "soil_bulk_density",
    "soil_cec",
    "soil_nitrogen",
]

TOPSOIL_DEPTH = "0-5cm"


def soil_column(property_name: str) -> str:
    """
    Return the SoilGrids CSV column for the topsoil depth.
    """
    return f"{property_name}_{TOPSOIL_DEPTH}"


# =====================================================================
# UTILITY FUNCTIONS
# =====================================================================

def require_file(path: Path) -> None:
    """
    Ensure a required input file exists.
    """
    if not path.exists():
        raise FileNotFoundError(
            f"Required input file does not exist:\n{path}"
        )


def find_first_column(
    columns: list[str],
    exact_names: list[str] | None = None,
    prefixes: list[str] | None = None,
) -> str | None:
    """
    Find the first matching source column.

    Matching priority:
        1. exact name
        2. prefix

    Matching is case-insensitive.
    """

    exact_names = exact_names or []
    prefixes = prefixes or []

    normalized = {
        column.lower(): column
        for column in columns
    }

    # -------------------------------------------------------------
    # Exact matches
    # -------------------------------------------------------------

    for name in exact_names:
        match = normalized.get(name.lower())

        if match is not None:
            return match

    # -------------------------------------------------------------
    # Prefix matches
    # -------------------------------------------------------------

    for prefix in prefixes:
        prefix_lower = prefix.lower()

        for column in columns:
            if column.lower().startswith(prefix_lower):
                return column

    return None


def numeric_series(
    df: pd.DataFrame,
    column: str | None,
) -> pd.Series:
    """
    Convert a source column to numeric.

    If the source column does not exist, return an all-NaN series.

    Missing source data is intentionally preserved.
    """

    if column is None:
        return pd.Series(
            np.nan,
            index=df.index,
            dtype="float64",
        )

    return pd.to_numeric(
        df[column],
        errors="coerce",
    )


def safe_zscore(
    series: pd.Series,
) -> pd.Series:
    """
    Calculate a standardized anomaly.

    Uses the valid observations in the available historical series.

    Returns NaN if:
    - fewer than two observations exist, or
    - standard deviation is zero/non-finite.
    """

    valid = series.dropna()

    if len(valid) < 2:
        return pd.Series(
            np.nan,
            index=series.index,
            dtype="float64",
        )

    mean = valid.mean()
    std = valid.std(ddof=0)

    if not np.isfinite(std) or std == 0:
        return pd.Series(
            np.nan,
            index=series.index,
            dtype="float64",
        )

    return (series - mean) / std


def safe_ratio(
    numerator: pd.Series,
    denominator: pd.Series,
) -> pd.Series:
    """
    Calculate a ratio safely.

    Zero denominators become NaN.
    """

    denominator = denominator.replace(
        0,
        np.nan,
    )

    return numerator / denominator


def add_source_status(
    df: pd.DataFrame,
    source_column: str | None,
    output_column: str,
) -> None:
    """
    Add a 0/1 source availability indicator.
    """

    if source_column is None:
        df[output_column] = np.int8(0)
        return

    df[output_column] = (
        pd.to_numeric(
            df[source_column],
            errors="coerce",
        )
        .notna()
        .astype("int8")
    )


def detect_month_column(
    df: pd.DataFrame,
) -> str:
    """
    Detect the monthly period column.

    The current Field Shift dataset stores months as:

        2019-01
        2019-02
        ...

    The source column may be named "month", "date",
    "observation_month", etc.
    """

    columns = list(df.columns)

    # -------------------------------------------------------------
    # Preferred known names
    # -------------------------------------------------------------

    preferred_names = [
        "month",
        "observation_month",
        "date",
        "period",
        "month_date",
    ]

    for name in preferred_names:

        if name not in df.columns:
            continue

        sample = (
            df[name]
            .dropna()
            .astype(str)
            .str.strip()
            .head(20)
        )

        if sample.empty:
            continue

        parsed = pd.to_datetime(
            sample,
            format="%Y-%m",
            errors="coerce",
        )

        if parsed.notna().all():
            return name

    # -------------------------------------------------------------
    # Fallback automatic detection
    # -------------------------------------------------------------

    candidates = []

    for column in columns:

        sample = (
            df[column]
            .dropna()
            .astype(str)
            .str.strip()
            .head(20)
        )

        if sample.empty:
            continue

        parsed = pd.to_datetime(
            sample,
            format="%Y-%m",
            errors="coerce",
        )

        if parsed.notna().all():
            candidates.append(column)

    if len(candidates) == 1:
        return candidates[0]

    raise ValueError(
        "Could not uniquely identify the monthly period column.\n"
        f"Detected candidates: {candidates}\n"
        f"Available columns: {columns}"
    )


def normalize_monthly_calendar(
    df: pd.DataFrame,
) -> pd.DataFrame:
    """
    Normalize the actual Field Shift monthly schema.

    Input:
        month = "2019-01"

    Output:
        year = 2019
        month = 1
        observation_month = "2019-01"
    """

    month_column = detect_month_column(df)

    print(
        f"[INFO] Detected monthly period column: "
        f"{month_column}"
    )

    monthly_period = pd.to_datetime(
        df[month_column]
        .astype(str)
        .str.strip(),
        format="%Y-%m",
        errors="coerce",
    )

    # -------------------------------------------------------------
    # Reject invalid dates
    # -------------------------------------------------------------

    if monthly_period.isna().any():

        invalid_values = (
            df.loc[
                monthly_period.isna(),
                month_column,
            ]
            .astype(str)
            .unique()
            .tolist()
        )

        raise ValueError(
            "Invalid YYYY-MM values found in monthly period column.\n"
            f"Column: {month_column}\n"
            f"Examples: {invalid_values[:10]}"
        )

    # -------------------------------------------------------------
    # Create numeric year/month
    # -------------------------------------------------------------

    df["year"] = monthly_period.dt.year.astype(int)

    df["month"] = monthly_period.dt.month.astype(int)

    df["observation_month"] = (
        monthly_period
        .dt
        .to_period("M")
        .astype(str)
    )

    # -------------------------------------------------------------
    # Validate month range
    # -------------------------------------------------------------

    if not df["month"].between(1, 12).all():

        invalid_months = sorted(
            df.loc[
                ~df["month"].between(1, 12),
                "month",
            ]
            .unique()
            .tolist()
        )

        raise ValueError(
            f"Invalid month numbers found: {invalid_months}"
        )

    # -------------------------------------------------------------
    # Sort chronologically
    # -------------------------------------------------------------

    df = (
        df.sort_values(
            ["year", "month"],
            kind="stable",
        )
        .reset_index(drop=True)
    )

    return df


# =====================================================================
# ENVIRONMENTAL SOURCE MAPPING
# =====================================================================

def detect_environmental_sources(
    df: pd.DataFrame,
) -> dict[str, str | None]:
    """
    Detect the source columns in the actual monthly environmental
    feature layer.

    Exact names are preferred where possible.

    The function deliberately does not fail merely because an
    optional source is missing. Missing source observations are
    represented as NaN and availability indicators.
    """

    columns = list(df.columns)

    sources = {

        # ---------------------------------------------------------
        # GPM precipitation
        # ---------------------------------------------------------

        "rainfall": find_first_column(
            columns,
            exact_names=[
                "gpm_precipitation_mm",
                "gpm_rainfall_mm",
                "gpm_monthly_precipitation_mm",
                "gpm_monthly_rainfall_mm",
            ],
            prefixes=[
                "gpm_",
            ],
        ),

        # ---------------------------------------------------------
        # SMAP soil moisture
        # ---------------------------------------------------------

        "soil_moisture": find_first_column(
            columns,
            exact_names=[
                "smap_soil_moisture",
                "smap_soil_moisture_m3_m3",
                "smap_moisture",
            ],
            prefixes=[
                "smap_",
            ],
        ),

        # ---------------------------------------------------------
        # MODIS NDVI
        # ---------------------------------------------------------

        "ndvi": find_first_column(
            columns,
            exact_names=[
                "modis_ndvi",
                "modis_ndvi_mean",
            ],
            prefixes=[
                "modis_ndvi",
            ],
        ),

        # ---------------------------------------------------------
        # MODIS EVI
        # ---------------------------------------------------------

        "evi": find_first_column(
            columns,
            exact_names=[
                "modis_evi",
                "modis_evi_mean",
            ],
            prefixes=[
                "modis_evi",
            ],
        ),

        # ---------------------------------------------------------
        # ECOSTRESS LST
        # ---------------------------------------------------------

        "lst": find_first_column(
            columns,
            exact_names=[
                "ecostress_lst_c",
                "ecostress_lst",
                "ecostress_land_surface_temperature_c",
            ],
            prefixes=[
                "ecostress_",
            ],
        ),

        # ---------------------------------------------------------
        # GRACE / GRACE-FO
        # ---------------------------------------------------------

        "grace": find_first_column(
            columns,
            exact_names=[
                "grace_tws_anomaly_cm",
                "grace_tws_anomaly",
                "grace_lwe_thickness_cm",
            ],
            prefixes=[
                "grace_",
            ],
        ),

        # ---------------------------------------------------------
        # NASA POWER temperature
        # ---------------------------------------------------------

        "temperature": find_first_column(
            columns,
            exact_names=[
                "nasa_power_temperature_c",
                "nasa_power_temp_c",
                "nasa_power_temperature_mean_c",
                "power_temperature_c",
                "power_temp_c",
                "power_temperature",
                "power_temp",
            ],
            prefixes=[
                "nasa_power_temp",
                "nasa_power_temperature",
                "power_temp",
                "power_temperature",
            ],
        ),

        # ---------------------------------------------------------
        # NASA POWER solar radiation
        # ---------------------------------------------------------

        "solar": find_first_column(
            columns,
            exact_names=[
                "nasa_power_solar_kwh_m2_day",
                "nasa_power_solar",
                "power_solar_kwh_m2_day",
                "power_solar",
            ],
            prefixes=[
                "nasa_power_solar",
                "power_solar",
            ],
        ),

        # ---------------------------------------------------------
        # NASA POWER wind
        # ---------------------------------------------------------

        "wind": find_first_column(
            columns,
            exact_names=[
                "nasa_power_wind_m_s",
                "nasa_power_wind",
                "power_wind_m_s",
                "power_wind",
            ],
            prefixes=[
                "nasa_power_wind",
                "power_wind",
            ],
        ),
    }

    return sources


# =====================================================================
# AGRICULTURAL FEATURE CONSTRUCTION
# =====================================================================

def build_agricultural_features(
    environmental: pd.DataFrame,
    soil: pd.DataFrame,
) -> pd.DataFrame:

    # =================================================================
    # ENVIRONMENTAL VALIDATION
    # =================================================================

    if environmental.empty:
        raise ValueError(
            "Environmental feature layer is empty."
        )

    if "field_id" not in environmental.columns:
        raise ValueError(
            "Environmental feature layer does not contain "
            "'field_id'."
        )

    # =================================================================
    # SOIL VALIDATION
    # =================================================================

    if soil.empty:
        raise ValueError(
            "Soil profile is empty."
        )

    if len(soil) != 1:
        raise ValueError(
            "Expected exactly one field-level soil profile row, "
            f"but found {len(soil)}."
        )

    if "field_id" not in soil.columns:
        raise ValueError(
            "Soil profile does not contain 'field_id'."
        )

    soil_row = soil.iloc[0]

    # =================================================================
    # FIELD ID CONSISTENCY
    # =================================================================

    environmental_field_ids = (
        environmental["field_id"]
        .dropna()
        .astype(str)
        .unique()
    )

    soil_field_id = str(
        soil_row["field_id"]
    )

    if len(environmental_field_ids) > 0:

        if soil_field_id not in environmental_field_ids:

            raise ValueError(
                "Field ID mismatch between environmental "
                "and soil layers.\n"
                f"Environmental field_id(s): "
                f"{environmental_field_ids.tolist()}\n"
                f"Soil field_id: {soil_field_id}"
            )

    # =================================================================
    # COPY ENVIRONMENTAL LAYER
    # =================================================================

    df = environmental.copy()

    # =================================================================
    # NORMALIZE MONTHLY CALENDAR
    # =================================================================

    df = normalize_monthly_calendar(df)

    # =================================================================
    # DETECT ENVIRONMENTAL SOURCES
    # =================================================================

    sources = detect_environmental_sources(df)

    print()
    print("[INFO] Environmental source mapping:")

    for name, column in sources.items():

        if column is None:
            print(
                f"  {name}: NOT FOUND"
            )
        else:
            print(
                f"  {name}: {column}"
            )

    # =================================================================
    # SOURCE SERIES
    # =================================================================

    rainfall = numeric_series(
        df,
        sources["rainfall"],
    )

    soil_moisture = numeric_series(
        df,
        sources["soil_moisture"],
    )

    ndvi = numeric_series(
        df,
        sources["ndvi"],
    )

    evi = numeric_series(
        df,
        sources["evi"],
    )

    lst = numeric_series(
        df,
        sources["lst"],
    )

    grace = numeric_series(
        df,
        sources["grace"],
    )

    temperature = numeric_series(
        df,
        sources["temperature"],
    )

    solar = numeric_series(
        df,
        sources["solar"],
    )

    wind = numeric_series(
        df,
        sources["wind"],
    )

    # =================================================================
    # SOURCE AVAILABILITY
    # =================================================================

    add_source_status(
        df,
        sources["rainfall"],
        "rainfall_available",
    )

    add_source_status(
        df,
        sources["soil_moisture"],
        "soil_moisture_available",
    )

    add_source_status(
        df,
        sources["ndvi"],
        "ndvi_available",
    )

    add_source_status(
        df,
        sources["evi"],
        "evi_available",
    )

    add_source_status(
        df,
        sources["lst"],
        "lst_available",
    )

    add_source_status(
        df,
        sources["grace"],
        "grace_available",
    )

    add_source_status(
        df,
        sources["temperature"],
        "temperature_available",
    )

    add_source_status(
        df,
        sources["solar"],
        "solar_available",
    )

    add_source_status(
        df,
        sources["wind"],
        "wind_available",
    )

    # =================================================================
    # AGRICULTURAL ENVIRONMENTAL VARIABLES
    # =================================================================

    df["ag_rainfall_mm"] = rainfall

    df["ag_soil_moisture"] = soil_moisture

    df["ag_temperature_c"] = temperature

    df["ag_lst_c"] = lst

    df["ag_solar_kwh_m2_day"] = solar

    df["ag_wind_m_s"] = wind

    df["ag_grace_tws_anomaly_cm"] = grace

    # =================================================================
    # HISTORICAL ANOMALIES
    # =================================================================

    df["ag_rainfall_anomaly_z"] = safe_zscore(
        rainfall
    )

    df["ag_soil_moisture_anomaly_z"] = safe_zscore(
        soil_moisture
    )

    df["ag_temperature_anomaly_z"] = safe_zscore(
        temperature
    )

    df["ag_lst_anomaly_z"] = safe_zscore(
        lst
    )

    df["ag_ndvi"] = ndvi

    df["ag_evi"] = evi

    df["ag_ndvi_anomaly_z"] = safe_zscore(
        ndvi
    )

    df["ag_evi_anomaly_z"] = safe_zscore(
        evi
    )

    # =================================================================
    # WATER STRESS PROXY
    # =================================================================

    # Higher values indicate relatively greater environmental
    # water stress within this historical field record.
    #
    # This is explicitly a proxy, not a crop-specific water-demand
    # model and not evapotranspiration.

    water_components = pd.concat(
        [
            df["ag_rainfall_anomaly_z"],
            df["ag_soil_moisture_anomaly_z"],
        ],
        axis=1,
    )

    df["ag_water_stress_proxy"] = (
        -water_components.mean(
            axis=1,
            skipna=True,
        )
    )

    # If both components are missing, preserve NaN.
    both_missing = water_components.isna().all(
        axis=1
    )

    df.loc[
        both_missing,
        "ag_water_stress_proxy",
    ] = np.nan

    # =================================================================
    # HEAT STRESS PROXY
    # =================================================================

    thermal_components = pd.concat(
        [
            df["ag_temperature_anomaly_z"],
            df["ag_lst_anomaly_z"],
        ],
        axis=1,
    )

    df["ag_heat_stress_proxy"] = (
        thermal_components.mean(
            axis=1,
            skipna=True,
        )
    )

    both_missing = thermal_components.isna().all(
        axis=1
    )

    df.loc[
        both_missing,
        "ag_heat_stress_proxy",
    ] = np.nan

    # =================================================================
    # ENVIRONMENTAL RESILIENCE PROXY
    # =================================================================

    vegetation_components = pd.concat(
        [
            df["ag_ndvi_anomaly_z"],
            df["ag_evi_anomaly_z"],
        ],
        axis=1,
    )

    vegetation_signal = vegetation_components.mean(
        axis=1,
        skipna=True,
    )

    climate_stability_signal = (
        -df["ag_water_stress_proxy"]
        -df["ag_heat_stress_proxy"]
    ) / 2.0

    df["ag_environmental_resilience_proxy"] = (
        vegetation_signal
        + climate_stability_signal
    ) / 2.0

    # Do not manufacture resilience when no relevant signal exists.
    all_resilience_missing = (
        vegetation_components.isna().all(axis=1)
        & df["ag_water_stress_proxy"].isna()
        & df["ag_heat_stress_proxy"].isna()
    )

    df.loc[
        all_resilience_missing,
        "ag_environmental_resilience_proxy",
    ] = np.nan

    # =================================================================
    # SOIL PROFILE
    # =================================================================

    for property_name in SOIL_PROPERTIES:

        source_column = soil_column(
            property_name
        )

        if source_column not in soil.columns:

            raise ValueError(
                "Required SoilGrids feature is missing:\n"
                f"{source_column}"
            )

        value = pd.to_numeric(
            soil_row[source_column],
            errors="coerce",
        )

        if pd.isna(value):

            raise ValueError(
                "Required SoilGrids feature contains NULL:\n"
                f"{source_column}"
            )

        output_column = (
            "soil_topsoil_"
            + property_name.removeprefix("soil_")
        )

        df[output_column] = float(value)

    # =================================================================
    # SOIL TEXTURE CHECK
    # =================================================================

    df["soil_topsoil_texture_sum_pct"] = (
        df["soil_topsoil_clay"]
        + df["soil_topsoil_sand"]
        + df["soil_topsoil_silt"]
    )

    # =================================================================
    # SOIL C:N PROXY
    # =================================================================

    df["soil_topsoil_cn_proxy"] = safe_ratio(
        df["soil_topsoil_organic_carbon"],
        df["soil_topsoil_nitrogen"],
    )

    # =================================================================
    # SOIL pH DISTANCE FROM NEUTRAL
    # =================================================================

    df["soil_topsoil_ph_distance_from_neutral"] = (
        df["soil_topsoil_ph"] - 7.0
    ).abs()

    # =================================================================
    # SOIL FERTILITY PROXY
    # =================================================================

    # Intentionally unavailable for now.
    #
    # We have one field-level soil profile, so a statistical
    # population-normalized fertility score would be meaningless.
    #
    # Crop-specific suitability will be introduced later using
    # crop profiles and explicit agronomic thresholds.

    df["soil_topsoil_fertility_proxy"] = np.nan

    # =================================================================
    # SEASONAL FEATURES
    # =================================================================

    df["ag_month_sin"] = np.sin(
        2.0
        * np.pi
        * df["month"].astype(float)
        / 12.0
    )

    df["ag_month_cos"] = np.cos(
        2.0
        * np.pi
        * df["month"].astype(float)
        / 12.0
    )

    # =================================================================
    # CLIMATE SEASON
    # =================================================================

    def classify_season(
        month: int,
    ) -> str:

        if month in (12, 1, 2):
            return "winter"

        if month in (3, 4, 5):
            return "pre_monsoon"

        if month in (6, 7, 8, 9):
            return "monsoon"

        return "post_monsoon"

    df["ag_climate_season"] = (
        df["month"]
        .map(classify_season)
    )

    # =================================================================
    # SOIL PROVENANCE
    # =================================================================

    soil_metadata_columns = [
        "soil_source",
        "soil_source_access",
        "soil_spatial_support",
        "soil_aggregation",
        "soil_resolution_m",
        "soil_valid_pixel_count",
    ]

    for column in soil_metadata_columns:

        if column in soil.columns:
            df[column] = soil_row[column]

    # =================================================================
    # FIELD SOIL SPATIAL METADATA
    # =================================================================

    spatial_columns = [
        "field_centroid_lat",
        "field_centroid_lon",
        "field_min_lat",
        "field_max_lat",
        "field_min_lon",
        "field_max_lon",
    ]

    for column in spatial_columns:

        if column in soil.columns:
            df[column] = soil_row[column]

    # =================================================================
    # PROVENANCE
    # =================================================================

    df["agricultural_feature_layer"] = (
        "monthly_environmental + field_soil_profile"
    )

    df["agricultural_feature_version"] = "1.0"

    df["synthetic_targets_used"] = False

    df["soil_values_are_modelled_predictions"] = True

    # =================================================================
    # FINAL COLUMN ORDER
    # =================================================================

    identity_columns = [
        "field_id",
        "year",
        "month",
        "observation_month",
    ]

    provenance_columns = [
        "agricultural_feature_layer",
        "agricultural_feature_version",
        "synthetic_targets_used",
        "soil_values_are_modelled_predictions",
    ]

    availability_columns = [
        "rainfall_available",
        "soil_moisture_available",
        "ndvi_available",
        "evi_available",
        "lst_available",
        "grace_available",
        "temperature_available",
        "solar_available",
        "wind_available",
    ]

    derived_columns = [
        "ag_rainfall_mm",
        "ag_soil_moisture",
        "ag_temperature_c",
        "ag_lst_c",
        "ag_solar_kwh_m2_day",
        "ag_wind_m_s",
        "ag_grace_tws_anomaly_cm",
        "ag_rainfall_anomaly_z",
        "ag_soil_moisture_anomaly_z",
        "ag_temperature_anomaly_z",
        "ag_lst_anomaly_z",
        "ag_ndvi",
        "ag_evi",
        "ag_ndvi_anomaly_z",
        "ag_evi_anomaly_z",
        "ag_water_stress_proxy",
        "ag_heat_stress_proxy",
        "ag_environmental_resilience_proxy",
        "soil_topsoil_ph",
        "soil_topsoil_organic_carbon",
        "soil_topsoil_clay",
        "soil_topsoil_sand",
        "soil_topsoil_silt",
        "soil_topsoil_bulk_density",
        "soil_topsoil_cec",
        "soil_topsoil_nitrogen",
        "soil_topsoil_texture_sum_pct",
        "soil_topsoil_cn_proxy",
        "soil_topsoil_ph_distance_from_neutral",
        "soil_topsoil_fertility_proxy",
        "ag_month_sin",
        "ag_month_cos",
        "ag_climate_season",
    ]

    soil_metadata_columns = [
        "soil_source",
        "soil_source_access",
        "soil_spatial_support",
        "soil_aggregation",
        "soil_resolution_m",
        "soil_valid_pixel_count",
        "field_centroid_lat",
        "field_centroid_lon",
        "field_min_lat",
        "field_max_lat",
        "field_min_lon",
        "field_max_lon",
    ]

    ordered = []

    for column in (
        identity_columns
        + provenance_columns
        + availability_columns
        + derived_columns
        + soil_metadata_columns
    ):

        if (
            column in df.columns
            and column not in ordered
        ):
            ordered.append(column)

    # -------------------------------------------------------------
    # Preserve every original environmental feature.
    # -------------------------------------------------------------

    remaining = [
        column
        for column in df.columns
        if column not in ordered
    ]

    df = df[
        ordered + remaining
    ]

    return df


# =====================================================================
# VALIDATION
# =====================================================================

def validate_output(
    output: pd.DataFrame,
    environmental: pd.DataFrame,
    soil: pd.DataFrame,
) -> None:

    print()
    print("=" * 72)
    print("VALIDATING AGRICULTURAL FEATURE LAYER")
    print("=" * 72)

    # -----------------------------------------------------------------
    # Basic checks
    # -----------------------------------------------------------------

    if output.empty:
        raise ValueError(
            "Agricultural feature output is empty."
        )

    if len(output) != len(environmental):
        raise ValueError(
            "Output row count changed unexpectedly.\n"
            f"Input rows:  {len(environmental)}\n"
            f"Output rows: {len(output)}"
        )

    # -----------------------------------------------------------------
    # Expected current dataset size
    # -----------------------------------------------------------------

    if len(output) != EXPECTED_MONTH_COUNT:

        raise ValueError(
            f"Expected {EXPECTED_MONTH_COUNT} monthly records "
            f"for {EXPECTED_START} through {EXPECTED_END}, "
            f"but found {len(output)}."
        )

    # -----------------------------------------------------------------
    # Duplicate field-month records
    # -----------------------------------------------------------------

    duplicates = output.duplicated(
        subset=[
            "field_id",
            "year",
            "month",
        ]
    )

    duplicate_count = int(
        duplicates.sum()
    )

    if duplicate_count > 0:

        raise ValueError(
            "Duplicate field-month records found: "
            f"{duplicate_count}"
        )

    # -----------------------------------------------------------------
    # Calendar continuity
    # -----------------------------------------------------------------

    actual_dates = pd.to_datetime(
        output["year"].astype(str)
        + "-"
        + output["month"].astype(str)
        + "-01",
        format="%Y-%m-%d",
    )

    expected_dates = pd.date_range(
        start=f"{EXPECTED_START}-01",
        end=f"{EXPECTED_END}-01",
        freq="MS",
    )

    actual_dates = (
        actual_dates
        .reset_index(drop=True)
    )

    expected_dates = pd.Series(
        expected_dates
    )

    if not actual_dates.equals(
        expected_dates
    ):

        raise ValueError(
            "Monthly calendar is not the expected continuous "
            f"{EXPECTED_START} through {EXPECTED_END} sequence."
        )

    # -----------------------------------------------------------------
    # Soil feature validation
    # -----------------------------------------------------------------

    soil_columns = [
        "soil_topsoil_ph",
        "soil_topsoil_organic_carbon",
        "soil_topsoil_clay",
        "soil_topsoil_sand",
        "soil_topsoil_silt",
        "soil_topsoil_bulk_density",
        "soil_topsoil_cec",
        "soil_topsoil_nitrogen",
    ]

    missing_soil_columns = [
        column
        for column in soil_columns
        if column not in output.columns
    ]

    if missing_soil_columns:

        raise ValueError(
            "Missing agricultural soil features:\n"
            + "\n".join(
                missing_soil_columns
            )
        )

    null_soil = int(
        output[soil_columns]
        .isna()
        .sum()
        .sum()
    )

    if null_soil:

        raise ValueError(
            "Agricultural output contains "
            f"{null_soil} NULL soil values."
        )

    # -----------------------------------------------------------------
    # Texture validation
    # -----------------------------------------------------------------

    texture_sum = (
        output[
            "soil_topsoil_texture_sum_pct"
        ]
        .to_numpy(
            dtype=float
        )
    )

    if not np.allclose(
        texture_sum,
        100.0,
        atol=2.0,
    ):

        raise ValueError(
            "Soil texture percentages do not sum "
            "to approximately 100%."
        )

    # -----------------------------------------------------------------
    # Soil provenance
    # -----------------------------------------------------------------

    if "soil_source" in output.columns:

        if output[
            "soil_source"
        ].isna().any():

            raise ValueError(
                "Missing soil provenance."
            )

    # -----------------------------------------------------------------
    # Field ID consistency
    # -----------------------------------------------------------------

    output_field_ids = (
        output["field_id"]
        .astype(str)
        .unique()
        .tolist()
    )

    soil_field_id = str(
        soil.iloc[0]["field_id"]
    )

    if output_field_ids != [
        soil_field_id
    ]:

        raise ValueError(
            "Output field ID does not match "
            "the soil profile field ID.\n"
            f"Output: {output_field_ids}\n"
            f"Soil:   {soil_field_id}"
        )

    # -----------------------------------------------------------------
    # No synthetic targets
    # -----------------------------------------------------------------

    forbidden_target_patterns = [
        "yield",
        "crop_yield",
        "production_target",
        "harvest_target",
    ]

    suspicious_columns = [
        column
        for column in output.columns
        if any(
            token in column.lower()
            for token in forbidden_target_patterns
        )
    ]

    if suspicious_columns:

        raise ValueError(
            "Potential synthetic target columns detected:\n"
            + "\n".join(
                suspicious_columns
            )
        )

    # -----------------------------------------------------------------
    # Provenance flags
    # -----------------------------------------------------------------

    if not (
        output[
            "synthetic_targets_used"
        ]
        == False
    ).all():

        raise ValueError(
            "synthetic_targets_used must remain False."
        )

    if not (
        output[
            "soil_values_are_modelled_predictions"
        ]
        == True
    ).all():

        raise ValueError(
            "soil_values_are_modelled_predictions "
            "must remain True."
        )

    # -----------------------------------------------------------------
    # Report
    # -----------------------------------------------------------------

    print(
        "[OK] Output is non-empty."
    )

    print(
        f"[OK] Monthly records: {len(output)}"
    )

    print(
        "[OK] No duplicate field-month records."
    )

    print(
        f"[OK] Calendar: {EXPECTED_START} → {EXPECTED_END}"
    )

    print(
        "[OK] Soil profile successfully attached."
    )

    print(
        "[OK] All topsoil values are non-null."
    )

    print(
        "[OK] Soil texture sums to approximately 100%."
    )

    print(
        "[OK] Soil provenance preserved."
    )

    print(
        "[OK] No synthetic crop-yield target generated."
    )

    print(
        "[OK] Soil values explicitly marked as "
        "modelled predictions."
    )


# =====================================================================
# MAIN
# =====================================================================

def main() -> None:

    print("=" * 72)
    print("FIELD SHIFT — BUILD AGRICULTURAL FEATURES")
    print("=" * 72)

    # -----------------------------------------------------------------
    # Check inputs
    # -----------------------------------------------------------------

    require_file(
        ENVIRONMENTAL_FILE
    )

    require_file(
        SOIL_FILE
    )

    print(
        f"[INPUT] Environmental:\n"
        f"        {ENVIRONMENTAL_FILE}"
    )

    print(
        f"[INPUT] Soil profile:\n"
        f"        {SOIL_FILE}"
    )

    # -----------------------------------------------------------------
    # Load inputs
    # -----------------------------------------------------------------

    environmental = pd.read_csv(
        ENVIRONMENTAL_FILE
    )

    soil = pd.read_csv(
        SOIL_FILE
    )

    print()
    print(
        f"[INFO] Environmental shape: "
        f"{environmental.shape}"
    )

    print(
        f"[INFO] Soil profile shape: "
        f"{soil.shape}"
    )

    # -----------------------------------------------------------------
    # Build
    # -----------------------------------------------------------------

    output = build_agricultural_features(
        environmental,
        soil,
    )

    # -----------------------------------------------------------------
    # Validate
    # -----------------------------------------------------------------

    validate_output(
        output,
        environmental,
        soil,
    )

    # -----------------------------------------------------------------
    # Write
    # -----------------------------------------------------------------

    OUTPUT_FILE.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    output.to_csv(
        OUTPUT_FILE,
        index=False,
        float_format="%.8f",
    )

    # -----------------------------------------------------------------
    # Final report
    # -----------------------------------------------------------------

    print()
    print("=" * 72)
    print("AGRICULTURAL FEATURE BUILD COMPLETE")
    print("=" * 72)

    print(
        f"[OK] Output:\n"
        f"     {OUTPUT_FILE}"
    )

    print(
        f"[INFO] Output shape: "
        f"{output.shape}"
    )

    print(
        f"[INFO] Total columns: "
        f"{len(output.columns)}"
    )

    print()
    print("Feature availability:")

    feature_columns = [
        "ag_rainfall_mm",
        "ag_soil_moisture",
        "ag_ndvi",
        "ag_evi",
        "ag_lst_c",
        "ag_grace_tws_anomaly_cm",
        "ag_temperature_c",
        "ag_solar_kwh_m2_day",
        "ag_wind_m_s",
        "ag_water_stress_proxy",
        "ag_heat_stress_proxy",
        "ag_environmental_resilience_proxy",
    ]

    for column in feature_columns:

        if column not in output.columns:
            print(
                f"  {column}: NOT CREATED"
            )
            continue

        available = int(
            output[column]
            .notna()
            .sum()
        )

        print(
            f"  {column}: "
            f"{available}/{len(output)}"
        )

    print()
    print("Topsoil features:")

    topsoil_columns = [
        "soil_topsoil_ph",
        "soil_topsoil_organic_carbon",
        "soil_topsoil_clay",
        "soil_topsoil_sand",
        "soil_topsoil_silt",
        "soil_topsoil_bulk_density",
        "soil_topsoil_cec",
        "soil_topsoil_nitrogen",
    ]

    for column in topsoil_columns:

        value = output[
            column
        ].iloc[0]

        print(
            f"  {column}: "
            f"{value:.6f}"
        )

    print()
    print(
        "[INFO] Missing environmental observations "
        "were preserved."
    )

    print(
        "[INFO] Canonical observations were not modified."
    )

    print(
        "[INFO] Synthetic crop-yield targets were not created."
    )

    print()
    print("=" * 72)
    print("DONE")
    print("=" * 72)


if __name__ == "__main__":
    main()