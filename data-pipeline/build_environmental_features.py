"""
Build the combined monthly environmental feature layer for Field Shift.

Inputs
------
1. Monthly remote-sensing features:
   data-pipeline/output/features/monthly_features_2019_2024.csv

2. NASA POWER monthly features:
   data-pipeline/output/features/nasa_power_monthly_2019_2024.csv

Output
------
data-pipeline/output/features/monthly_environmental_features_2019_2024.csv

Purpose
-------
Combine the validated remote-sensing and NASA POWER monthly layers into
one deterministic environmental feature table.

Pipeline
--------
Canonical observations
        ↓
Monthly remote-sensing features
        +
NASA POWER monthly features
        ↓
Combined monthly environmental features
        ↓
Soil + crop features
        ↓
ML dataset
        ↓
Rotation decision engine

Important
---------
This script does NOT:
    - modify the canonical observation layer
    - modify the monthly remote-sensing layer
    - modify the NASA POWER layer
    - fill missing remote-sensing observations
    - interpolate missing sensor values
    - train ML models

Missing remote-sensing observations remain NaN, with their existing
availability indicators preserved.

MODIS handling
--------------
MODIS NDVI and EVI are preserved as separate variables.

    MODIS_NDVI -> modis_ndvi_*
    MODIS_EVI  -> modis_evi_*

No generic "modis_value" column is created or accepted.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd


# ============================================================================
# CONFIGURATION
# ============================================================================

PROJECT_ROOT = Path(__file__).resolve().parents[1]

FEATURE_DIR = (
    PROJECT_ROOT
    / "data-pipeline"
    / "output"
    / "features"
)

REMOTE_SENSING_FILE = (
    FEATURE_DIR
    / "monthly_features_2019_2024.csv"
)

NASA_POWER_FILE = (
    FEATURE_DIR
    / "nasa_power_monthly_2019_2024.csv"
)

OUTPUT_FILE = (
    FEATURE_DIR
    / "monthly_environmental_features_2019_2024.csv"
)

FIELD_ID = "426e9d97-78cf-45d2-82ae-8131040b5ee7"

START_MONTH = "2019-01"
END_MONTH = "2024-09"

EXPECTED_MONTH_COUNT = 69


# ============================================================================
# EXPECTED COLUMNS
# ============================================================================

REMOTE_SENSING_REQUIRED = [
    # Identity / time
    "field_id",
    "month",
    "month_start",
    "month_end",
    "year",
    "month_number",

    # GPM
    "gpm_value",
    "gpm_obs_count",
    "gpm_mean_observation",
    "gpm_max_observation",

    # SMAP
    "smap_value",
    "smap_obs_count",
    "smap_min",
    "smap_max",
    "smap_std",

    # MODIS NDVI
    "modis_ndvi_value",
    "modis_ndvi_obs_count",
    "modis_ndvi_min",
    "modis_ndvi_max",
    "modis_ndvi_std",

    # MODIS EVI
    "modis_evi_value",
    "modis_evi_obs_count",
    "modis_evi_min",
    "modis_evi_max",
    "modis_evi_std",

    # ECOSTRESS
    "ecostress_value",
    "ecostress_obs_count",
    "ecostress_min",
    "ecostress_max",
    "ecostress_std",

    # GRACE
    "grace_value",
    "grace_obs_count",
    "grace_min",
    "grace_max",

    # Availability
    "gpm_available",
    "smap_available",
    "modis_ndvi_available",
    "modis_evi_available",
    "modis_available",
    "ecostress_available",
    "grace_available",

    # Remote-sensing quality
    "remote_sensing_dataset_count",
    "remote_sensing_complete",
]


NASA_POWER_REQUIRED = [
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


# ============================================================================
# HELPERS
# ============================================================================

def print_header(title: str) -> None:
    print()
    print("=" * 70)
    print(title)
    print("=" * 70)


def validate_columns(
    df: pd.DataFrame,
    required_columns: list[str],
    dataset_name: str,
) -> None:
    """Ensure all required columns exist."""

    missing = [
        column
        for column in required_columns
        if column not in df.columns
    ]

    if missing:
        raise RuntimeError(
            f"{dataset_name} is missing required columns:\n"
            + "\n".join(f"  - {column}" for column in missing)
        )


def validate_no_generic_modis(
    df: pd.DataFrame,
    dataset_name: str,
) -> None:
    """
    Ensure the obsolete generic MODIS schema is not present.

    MODIS must be represented explicitly as:
        MODIS_NDVI
        MODIS_EVI
    """

    forbidden_columns = [
        "modis_value",
        "modis_obs_count",
        "modis_min",
        "modis_max",
        "modis_std",
    ]

    present = [
        column
        for column in forbidden_columns
        if column in df.columns
    ]

    if present:
        raise RuntimeError(
            f"{dataset_name} contains obsolete generic MODIS columns:\n"
            + "\n".join(f"  - {column}" for column in present)
            + "\n"
            "Expected explicit MODIS_NDVI and MODIS_EVI columns instead."
        )

    print(
        "[OK] No obsolete generic MODIS columns detected."
    )


def validate_basic_layer(
    df: pd.DataFrame,
    dataset_name: str,
) -> None:
    """Validate field/month structure before merging."""

    if df.empty:
        raise RuntimeError(
            f"{dataset_name} is empty."
        )

    if df["field_id"].nunique() != 1:
        raise RuntimeError(
            f"{dataset_name} contains "
            f"{df['field_id'].nunique()} field IDs; expected exactly 1."
        )

    actual_field_id = str(df["field_id"].iloc[0])

    if actual_field_id != FIELD_ID:
        raise RuntimeError(
            f"{dataset_name} has unexpected field_id: "
            f"{actual_field_id}"
        )

    if df["month"].duplicated().any():
        duplicates = (
            df.loc[df["month"].duplicated(keep=False), "month"]
            .astype(str)
            .tolist()
        )

        raise RuntimeError(
            f"{dataset_name} contains duplicate months: "
            + ", ".join(duplicates)
        )

    expected_months = pd.period_range(
        START_MONTH,
        END_MONTH,
        freq="M",
    ).astype(str)

    actual_months = df["month"].astype(str).tolist()

    missing_months = sorted(
        set(expected_months) - set(actual_months)
    )

    unexpected_months = sorted(
        set(actual_months) - set(expected_months)
    )

    if missing_months:
        raise RuntimeError(
            f"{dataset_name} is missing months: "
            + ", ".join(missing_months)
        )

    if unexpected_months:
        raise RuntimeError(
            f"{dataset_name} contains unexpected months: "
            + ", ".join(unexpected_months)
        )

    if len(df) != EXPECTED_MONTH_COUNT:
        raise RuntimeError(
            f"{dataset_name}: expected "
            f"{EXPECTED_MONTH_COUNT} rows, found {len(df)}."
        )

    print(
        f"[OK] {dataset_name}: "
        f"{len(df)} rows, "
        f"{actual_months[0]} → {actual_months[-1]}"
    )


def load_input(
    path: Path,
    dataset_name: str,
    required_columns: list[str],
) -> pd.DataFrame:
    """Load and validate one input layer."""

    if not path.exists():
        raise FileNotFoundError(
            f"{dataset_name} file not found:\n{path}"
        )

    print(
        f"[INFO] Loading {dataset_name}:"
    )

    print(
        f"       {path}"
    )

    df = pd.read_csv(path)

    print(
        f"       Rows loaded: {len(df)}"
    )

    validate_columns(
        df,
        required_columns,
        dataset_name,
    )

    if dataset_name == "Monthly remote-sensing features":
        validate_no_generic_modis(
            df,
            dataset_name,
        )

    validate_basic_layer(
        df,
        dataset_name,
    )

    return df


def validate_date_columns(
    df: pd.DataFrame,
    dataset_name: str,
) -> None:
    """Validate month date columns."""

    for column in [
        "month_start",
        "month_end",
    ]:
        df[column] = pd.to_datetime(
            df[column],
            errors="coerce",
        )

        if df[column].isna().any():
            raise RuntimeError(
                f"{dataset_name} contains invalid "
                f"values in '{column}'."
            )

    expected_start = pd.to_datetime(
        df["month"].astype(str) + "-01",
        errors="coerce",
    )

    if expected_start.isna().any():
        raise RuntimeError(
            f"{dataset_name} contains invalid month values."
        )

    if not df["month_start"].equals(expected_start):
        raise RuntimeError(
            f"{dataset_name}: month_start does not match month."
        )

    expected_end = (
        expected_start
        + pd.offsets.MonthEnd(1)
    )

    if not df["month_end"].equals(expected_end):
        raise RuntimeError(
            f"{dataset_name}: month_end does not match month."
        )


def validate_merge_keys(
    remote_sensing: pd.DataFrame,
    power: pd.DataFrame,
) -> None:
    """Ensure the two datasets have identical month keys."""

    rs_months = set(
        remote_sensing["month"].astype(str)
    )

    power_months = set(
        power["month"].astype(str)
    )

    if rs_months != power_months:
        missing_in_power = sorted(
            rs_months - power_months
        )

        missing_in_rs = sorted(
            power_months - rs_months
        )

        message = [
            "Monthly merge keys do not match."
        ]

        if missing_in_power:
            message.append(
                "Missing in NASA POWER: "
                + ", ".join(missing_in_power)
            )

        if missing_in_rs:
            message.append(
                "Missing in remote sensing: "
                + ", ".join(missing_in_rs)
            )

        raise RuntimeError(
            "\n".join(message)
        )

    print(
        "[OK] Remote-sensing and POWER month keys match."
    )


def validate_modis_availability(
    df: pd.DataFrame,
) -> None:
    """
    Validate the explicit MODIS NDVI/EVI availability schema.

    Rules:
        modis_ndvi_available == 1 -> NDVI value must exist
        modis_ndvi_available == 0 -> NDVI value must be NaN

        modis_evi_available == 1 -> EVI value must exist
        modis_evi_available == 0 -> EVI value must be NaN

        modis_available == 1 -> at least one of NDVI/EVI is available
        modis_available == 0 -> neither NDVI nor EVI is available
    """

    print()
    print("MODIS NDVI/EVI SCHEMA VALIDATION:")

    # ------------------------------------------------------------------
    # NDVI
    # ------------------------------------------------------------------

    invalid_ndvi_missing = (
        (df["modis_ndvi_available"] == 1)
        & df["modis_ndvi_value"].isna()
    ).sum()

    invalid_ndvi_present = (
        (df["modis_ndvi_available"] == 0)
        & df["modis_ndvi_value"].notna()
    ).sum()

    if invalid_ndvi_missing:
        raise RuntimeError(
            "MODIS NDVI: availability=1 but value is NaN."
        )

    if invalid_ndvi_present:
        raise RuntimeError(
            "MODIS NDVI: availability=0 but value exists."
        )

    print(
        "  MODIS NDVI availability/value consistency: [OK]"
    )

    # ------------------------------------------------------------------
    # EVI
    # ------------------------------------------------------------------

    invalid_evi_missing = (
        (df["modis_evi_available"] == 1)
        & df["modis_evi_value"].isna()
    ).sum()

    invalid_evi_present = (
        (df["modis_evi_available"] == 0)
        & df["modis_evi_value"].notna()
    ).sum()

    if invalid_evi_missing:
        raise RuntimeError(
            "MODIS EVI: availability=1 but value is NaN."
        )

    if invalid_evi_present:
        raise RuntimeError(
            "MODIS EVI: availability=0 but value exists."
        )

    print(
        "  MODIS EVI availability/value consistency: [OK]"
    )

    # ------------------------------------------------------------------
    # Combined MODIS availability
    # ------------------------------------------------------------------

    expected_modis_available = (
        (
            df["modis_ndvi_available"] == 1
        )
        |
        (
            df["modis_evi_available"] == 1
        )
    ).astype(int)

    if not (
        expected_modis_available
        == df["modis_available"]
    ).all():
        raise RuntimeError(
            "modis_available is inconsistent with "
            "MODIS NDVI/EVI availability."
        )

    print(
        "  Combined MODIS availability: [OK]"
    )

    # ------------------------------------------------------------------
    # Report
    # ------------------------------------------------------------------

    ndvi_available = int(
        df["modis_ndvi_available"].sum()
    )

    evi_available = int(
        df["modis_evi_available"].sum()
    )

    modis_available = int(
        df["modis_available"].sum()
    )

    print(
        f"  NDVI available: {ndvi_available} / {len(df)}"
    )

    print(
        f"  EVI available : {evi_available} / {len(df)}"
    )

    print(
        f"  MODIS available: {modis_available} / {len(df)}"
    )


def merge_layers(
    remote_sensing: pd.DataFrame,
    power: pd.DataFrame,
) -> pd.DataFrame:
    """Merge the two validated monthly layers."""

    print_header(
        "MERGING MONTHLY ENVIRONMENTAL LAYERS"
    )

    # Keep the remote-sensing layer as the structural base.
    merged = remote_sensing.merge(
        power[
            [
                "field_id",
                "month",

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
        ],
        on=[
            "field_id",
            "month",
        ],
        how="inner",
        validate="one_to_one",
    )

    if len(merged) != EXPECTED_MONTH_COUNT:
        raise RuntimeError(
            "Merged dataset has unexpected row count: "
            f"{len(merged)} "
            f"(expected {EXPECTED_MONTH_COUNT})."
        )

    print(
        f"[OK] Merged rows: {len(merged)}"
    )

    return merged


def validate_combined_layer(
    df: pd.DataFrame,
) -> None:
    """Perform final validation of the combined environmental layer."""

    print_header(
        "COMBINED ENVIRONMENTAL LAYER VALIDATION"
    )

    # ------------------------------------------------------------------
    # Generic MODIS protection
    # ------------------------------------------------------------------

    validate_no_generic_modis(
        df,
        "Combined environmental layer",
    )

    # ------------------------------------------------------------------
    # Required explicit MODIS columns
    # ------------------------------------------------------------------

    required_modis_columns = [
        "modis_ndvi_value",
        "modis_ndvi_obs_count",
        "modis_ndvi_min",
        "modis_ndvi_max",
        "modis_ndvi_std",

        "modis_evi_value",
        "modis_evi_obs_count",
        "modis_evi_min",
        "modis_evi_max",
        "modis_evi_std",

        "modis_ndvi_available",
        "modis_evi_available",
        "modis_available",
    ]

    validate_columns(
        df,
        required_modis_columns,
        "Combined environmental layer",
    )

    # ------------------------------------------------------------------
    # Row count
    # ------------------------------------------------------------------

    if len(df) != EXPECTED_MONTH_COUNT:
        raise RuntimeError(
            f"Expected {EXPECTED_MONTH_COUNT} rows, "
            f"found {len(df)}."
        )

    print(
        f"[OK] Row count: {len(df)}"
    )

    # ------------------------------------------------------------------
    # Field ID
    # ------------------------------------------------------------------

    if df["field_id"].nunique() != 1:
        raise RuntimeError(
            "Combined dataset contains multiple field IDs."
        )

    if str(df["field_id"].iloc[0]) != FIELD_ID:
        raise RuntimeError(
            "Combined dataset contains an unexpected field ID."
        )

    print(
        "[OK] Single validated field ID."
    )

    # ------------------------------------------------------------------
    # Month uniqueness
    # ------------------------------------------------------------------

    if df["month"].duplicated().any():
        raise RuntimeError(
            "Combined dataset contains duplicate months."
        )

    print(
        "[OK] No duplicate months."
    )

    # ------------------------------------------------------------------
    # Coverage
    # ------------------------------------------------------------------

    expected_months = pd.period_range(
        START_MONTH,
        END_MONTH,
        freq="M",
    ).astype(str)

    actual_months = (
        df["month"]
        .astype(str)
        .tolist()
    )

    if actual_months != list(expected_months):
        raise RuntimeError(
            "Combined monthly sequence is not exactly "
            f"{START_MONTH} → {END_MONTH}."
        )

    print(
        f"[OK] Monthly coverage: "
        f"{START_MONTH} → {END_MONTH}"
    )

    # ------------------------------------------------------------------
    # Date columns
    # ------------------------------------------------------------------

    validate_date_columns(
        df,
        "Combined environmental layer",
    )

    print(
        "[OK] month_start/month_end validated."
    )

    # ------------------------------------------------------------------
    # POWER completeness
    # ------------------------------------------------------------------

    power_complete = int(
        df["power_complete"].sum()
    )

    power_available = int(
        df["power_available"].sum()
    )

    print()
    print("NASA POWER:")

    print(
        f"  Complete months : "
        f"{power_complete} / {len(df)}"
    )

    print(
        f"  Available months: "
        f"{power_available} / {len(df)}"
    )

    if power_complete != EXPECTED_MONTH_COUNT:
        raise RuntimeError(
            "NASA POWER does not have complete daily coverage "
            "for every expected month."
        )

    # ------------------------------------------------------------------
    # Remote-sensing availability
    # ------------------------------------------------------------------

    print()
    print("REMOTE-SENSING AVAILABILITY:")

    availability_columns = [
        "gpm_available",
        "smap_available",
        "modis_available",
        "ecostress_available",
        "grace_available",
    ]

    for column in availability_columns:
        available = int(
            df[column].sum()
        )

        print(
            f"  {column:<25}: "
            f"{available:2d} / {len(df)}"
        )

    # Explicit MODIS variables
    validate_modis_availability(
        df
    )

    # ------------------------------------------------------------------
    # Missing-value behavior
    # ------------------------------------------------------------------

    print()
    print("REMOTE-SENSING MISSINGNESS CHECK:")

    sensor_pairs = [
        (
            "gpm_value",
            "gpm_available",
        ),
        (
            "smap_value",
            "smap_available",
        ),
        (
            "modis_ndvi_value",
            "modis_ndvi_available",
        ),
        (
            "modis_evi_value",
            "modis_evi_available",
        ),
        (
            "ecostress_value",
            "ecostress_available",
        ),
        (
            "grace_value",
            "grace_available",
        ),
    ]

    for value_column, availability_column in sensor_pairs:

        invalid_missing_flags = (
            (
                df[availability_column] == 1
            )
            & df[value_column].isna()
        ).sum()

        invalid_present_flags = (
            (
                df[availability_column] == 0
            )
            & df[value_column].notna()
        ).sum()

        if invalid_missing_flags:
            raise RuntimeError(
                f"{value_column}: "
                "availability=1 but value is NaN."
            )

        if invalid_present_flags:
            raise RuntimeError(
                f"{value_column}: "
                "availability=0 but value exists."
            )

        print(
            f"  {value_column:<25}: [OK]"
        )

    # ------------------------------------------------------------------
    # Dataset count consistency
    # ------------------------------------------------------------------

    expected_dataset_count = (
        df[
            availability_columns
        ]
        .sum(axis=1)
    )

    if not (
        expected_dataset_count
        == df["remote_sensing_dataset_count"]
    ).all():

        raise RuntimeError(
            "remote_sensing_dataset_count is inconsistent "
            "with individual availability flags."
        )

    print(
        "[OK] Remote-sensing dataset counts are consistent."
    )

    # ------------------------------------------------------------------
    # Complete flag consistency
    # ------------------------------------------------------------------

    expected_complete = (
        expected_dataset_count == 5
    ).astype(int)

    if not (
        expected_complete
        == df["remote_sensing_complete"]
    ).all():

        raise RuntimeError(
            "remote_sensing_complete is inconsistent "
            "with dataset availability."
        )

    print(
        "[OK] remote_sensing_complete flags are consistent."
    )

    # ------------------------------------------------------------------
    # Numeric sanity checks
    # ------------------------------------------------------------------

    print()
    print("BASIC NUMERIC SANITY CHECKS:")

    if (
        df["power_precipitation"] < 0
    ).any():

        raise RuntimeError(
            "Negative monthly POWER precipitation detected."
        )

    if (
        df["power_solar_radiation"] < 0
    ).any():

        raise RuntimeError(
            "Negative monthly POWER solar radiation detected."
        )

    if (
        df["power_wind_speed"] < 0
    ).any():

        raise RuntimeError(
            "Negative POWER wind speed detected."
        )

    print(
        "[OK] POWER precipitation is non-negative."
    )

    print(
        "[OK] POWER solar radiation is non-negative."
    )

    print(
        "[OK] POWER wind speed is non-negative."
    )

    # ------------------------------------------------------------------
    # MODIS range sanity checks
    # ------------------------------------------------------------------

    print()
    print("MODIS SANITY CHECKS:")

    # MODIS NDVI/EVI are scaled indices and should normally lie within
    # the physical range -1 to +1 after the ingestion scale factor.
    for column in [
        "modis_ndvi_value",
        "modis_evi_value",
    ]:

        valid = df[column].dropna()

        if not valid.empty:

            if (valid < -1).any() or (valid > 1).any():
                raise RuntimeError(
                    f"{column} contains values outside "
                    "the expected -1 to +1 range."
                )

            print(
                f"[OK] {column}: "
                f"range {valid.min():.6f} → {valid.max():.6f}"
            )

        else:
            print(
                f"[INFO] {column}: no valid observations."
            )

    print()
    print(
        "[SUCCESS] Combined environmental layer validation passed."
    )


def reorder_columns(
    df: pd.DataFrame,
) -> pd.DataFrame:
    """Place columns in a logical environmental-feature order."""

    columns = [
        # ==================================================================
        # Identity / time
        # ==================================================================

        "field_id",
        "month",
        "month_start",
        "month_end",
        "year",
        "month_number",

        # ==================================================================
        # Remote sensing
        # ==================================================================

        # GPM
        "gpm_value",
        "gpm_obs_count",
        "gpm_mean_observation",
        "gpm_max_observation",
        "gpm_available",

        # SMAP
        "smap_value",
        "smap_obs_count",
        "smap_min",
        "smap_max",
        "smap_std",
        "smap_available",

        # MODIS NDVI
        "modis_ndvi_value",
        "modis_ndvi_obs_count",
        "modis_ndvi_min",
        "modis_ndvi_max",
        "modis_ndvi_std",
        "modis_ndvi_available",

        # MODIS EVI
        "modis_evi_value",
        "modis_evi_obs_count",
        "modis_evi_min",
        "modis_evi_max",
        "modis_evi_std",
        "modis_evi_available",

        # Combined MODIS availability
        "modis_available",

        # ECOSTRESS
        "ecostress_value",
        "ecostress_obs_count",
        "ecostress_min",
        "ecostress_max",
        "ecostress_std",
        "ecostress_available",

        # GRACE
        "grace_value",
        "grace_obs_count",
        "grace_min",
        "grace_max",
        "grace_available",

        # Remote sensing quality
        "remote_sensing_dataset_count",
        "remote_sensing_complete",

        # ==================================================================
        # NASA POWER
        # ==================================================================

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

    missing = [
        column
        for column in columns
        if column not in df.columns
    ]

    if missing:
        raise RuntimeError(
            "Cannot reorder columns. Missing:\n"
            + "\n".join(
                f"  - {column}"
                for column in missing
            )
        )

    return df[columns]


def save_output(
    df: pd.DataFrame,
) -> None:
    """Save the combined environmental feature layer."""

    FEATURE_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    df.to_csv(
        OUTPUT_FILE,
        index=False,
    )

    print_header(
        "OUTPUT"
    )

    print(
        "[OK] Combined environmental feature layer saved:"
    )

    print(
        f"     {OUTPUT_FILE}"
    )

    print()

    print(
        f"     Rows    : {len(df)}"
    )

    print(
        f"     Columns : {len(df.columns)}"
    )


def print_preview(
    df: pd.DataFrame,
) -> None:
    """Print compact preview."""

    print_header(
        "PREVIEW"
    )

    preview_columns = [
        "month",

        # Remote sensing
        "gpm_value",
        "smap_value",
        "modis_ndvi_value",
        "modis_evi_value",
        "ecostress_value",
        "grace_value",

        # NASA POWER
        "power_precipitation",
        "power_temperature_mean",
        "power_temperature_max",
        "power_temperature_min",
        "power_solar_radiation",
        "power_wind_speed",

        # Quality
        "remote_sensing_dataset_count",
        "remote_sensing_complete",
        "power_complete",
    ]

    print(
        df[
            preview_columns
        ]
        .head(5)
        .to_string(index=False)
    )

    print()
    print("Tail:")

    print(
        df[
            preview_columns
        ]
        .tail(5)
        .to_string(index=False)
    )


# ============================================================================
# MAIN
# ============================================================================

def main() -> int:

    print_header(
        "BUILD MONTHLY ENVIRONMENTAL FEATURES"
    )

    print(
        f"Project root : {PROJECT_ROOT}"
    )

    print(
        f"Field ID     : {FIELD_ID}"
    )

    print(
        f"Coverage     : {START_MONTH} → {END_MONTH}"
    )

    print(
        f"Expected rows: {EXPECTED_MONTH_COUNT}"
    )

    # ------------------------------------------------------------------
    # 1. Load remote sensing layer
    # ------------------------------------------------------------------

    remote_sensing = load_input(
        REMOTE_SENSING_FILE,
        "Monthly remote-sensing features",
        REMOTE_SENSING_REQUIRED,
    )

    # ------------------------------------------------------------------
    # 2. Load NASA POWER layer
    # ------------------------------------------------------------------

    power = load_input(
        NASA_POWER_FILE,
        "NASA POWER monthly features",
        NASA_POWER_REQUIRED,
    )

    # ------------------------------------------------------------------
    # 3. Validate dates independently
    # ------------------------------------------------------------------

    validate_date_columns(
        remote_sensing,
        "Monthly remote-sensing features",
    )

    validate_date_columns(
        power,
        "NASA POWER monthly features",
    )

    print(
        "[OK] Both input layers have valid monthly date boundaries."
    )

    # ------------------------------------------------------------------
    # 4. Validate merge keys
    # ------------------------------------------------------------------

    validate_merge_keys(
        remote_sensing,
        power,
    )

    # ------------------------------------------------------------------
    # 5. Merge
    # ------------------------------------------------------------------

    combined = merge_layers(
        remote_sensing,
        power,
    )

    # ------------------------------------------------------------------
    # 6. Reorder
    # ------------------------------------------------------------------

    combined = reorder_columns(
        combined
    )

    # ------------------------------------------------------------------
    # 7. Final validation
    # ------------------------------------------------------------------

    validate_combined_layer(
        combined
    )

    # ------------------------------------------------------------------
    # 8. Save
    # ------------------------------------------------------------------

    save_output(
        combined
    )

    # ------------------------------------------------------------------
    # 9. Preview
    # ------------------------------------------------------------------

    print_preview(
        combined
    )

    # ------------------------------------------------------------------
    # 10. Final protection statement
    # ------------------------------------------------------------------

    print_header(
        "SUCCESS"
    )

    print(
        "[SUCCESS] Monthly environmental feature layer created."
    )

    print(
        "[OK] Canonical observation layer was not modified."
    )

    print(
        "[OK] Monthly remote-sensing feature layer was not modified."
    )

    print(
        "[OK] NASA POWER monthly layer was not modified."
    )

    print(
        "[OK] MODIS NDVI and EVI remain separate."
    )

    print(
        "[OK] Generic modis_value was not created."
    )

    print(
        "[OK] No missing remote-sensing values were fabricated."
    )

    return 0


if __name__ == "__main__":

    try:
        raise SystemExit(
            main()
        )

    except KeyboardInterrupt:

        print(
            "\n[STOPPED] Interrupted by user."
        )

        raise SystemExit(130)

    except Exception as exc:

        print()
        print("=" * 70)
        print("ERROR")
        print("=" * 70)
        print(
            f"[ERROR] {exc}"
        )

        raise SystemExit(1)