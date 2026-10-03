"""
Build monthly feature layer from the canonical native observation layer.

Input:
    data-pipeline/output/canonical/field_observations_2019_2024.csv

Output:
    data-pipeline/output/features/monthly_features_2019_2024.csv

Design principles:
    - Preserve the canonical layer unchanged.
    - Aggregate each dataset according to its physical meaning.
    - Do not fabricate missing observations.
    - Preserve observation counts and coverage indicators.
    - Produce one row per field-month.
    - Keep native observation coverage transparent.
    - Normalize dataset labels before filtering.
    - Validate expected canonical dataset counts before aggregation.
    - Preserve MODIS NDVI and EVI as separate variables.
    - Never duplicate one MODIS measurement into both NDVI and EVI.
    - Do not create a generic MODIS feature.
    - Preserve missingness as NaN.
"""


from pathlib import Path

import pandas as pd


# ---------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent

INPUT_FILE = (
    BASE_DIR
    / "output"
    / "canonical"
    / "field_observations_2019_2024.csv"
)

OUTPUT_DIR = BASE_DIR / "output" / "features"

OUTPUT_FILE = (
    OUTPUT_DIR
    / "monthly_features_2019_2024.csv"
)


# ---------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------

# These represent the five remote-sensing source streams.
#
# MODIS contains two separate variables:
#     MODIS_NDVI
#     MODIS_EVI
#
# They are intentionally counted as ONE remote-sensing dataset
# for remote_sensing_dataset_count.

DATASET_CONFIG = {
    "GPM": {
        "prefix": "gpm",
        "description": "Precipitation / rainfall accumulation",
    },
    "SMAP": {
        "prefix": "smap",
        "description": "Surface soil moisture",
    },
    "MODIS": {
        "prefix": "modis",
        "description": "MODIS vegetation indices",
        "members": [
            "MODIS_NDVI",
            "MODIS_EVI",
        ],
    },
    "ECOSTRESS": {
        "prefix": "ecostress",
        "description": "Land surface temperature",
    },
    "GRACE_TWS_ANOMALY_MASCON": {
        "prefix": "grace",
        "description": "Terrestrial water storage anomaly",
    },
}


# ---------------------------------------------------------------------
# Expected counts from the repaired canonical layer
# ---------------------------------------------------------------------

EXPECTED_CANONICAL_COUNTS = {
    "GPM": 305,
    "SMAP": 305,
    "MODIS_NDVI": 89,
    "MODIS_EVI": 89,
    "ECOSTRESS": 131,
    "GRACE_TWS_ANOMALY_MASCON": 69,
}


# ---------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------

def safe_numeric(series):
    """Convert a pandas Series to numeric values safely."""

    return pd.to_numeric(
        series,
        errors="coerce",
    )


def normalize_dataset_name(value):
    """
    Normalize dataset labels so harmless whitespace/casing differences
    do not cause valid observations to disappear.
    """

    if pd.isna(value):
        return value

    return str(value).strip().upper()


def validate_canonical_dataset_counts(df):
    """
    Validate the dataset distribution in the canonical layer.

    This function does not modify the canonical file.
    """

    print()
    print("-" * 70)
    print("CANONICAL DATASET VALIDATION")
    print("-" * 70)

    actual_counts = (
        df["dataset"]
        .value_counts()
        .sort_index()
    )

    print()
    print("Dataset counts found in canonical layer:")

    for dataset, count in actual_counts.items():

        print(
            f"  {dataset:<32}: {count}"
        )

    print()
    print("Expected validated counts:")

    validation_failed = False

    for dataset, expected in EXPECTED_CANONICAL_COUNTS.items():

        actual = int(
            (
                df["dataset"] == dataset
            ).sum()
        )

        status = (
            "OK"
            if actual == expected
            else "CHECK"
        )

        print(
            f"  {dataset:<32}: "
            f"{actual} / expected {expected} "
            f"[{status}]"
        )

        if actual != expected:
            validation_failed = True

    print()

    # Unexpected dataset labels are important because a generic
    # MODIS label must not silently enter the feature layer.

    expected_labels = set(
        EXPECTED_CANONICAL_COUNTS.keys()
    )

    actual_labels = set(
        df["dataset"]
        .dropna()
        .unique()
    )

    unexpected_labels = (
        actual_labels - expected_labels
    )

    if unexpected_labels:

        print(
            "[WARN] Unexpected dataset labels found:"
        )

        for label in sorted(unexpected_labels):

            count = int(
                (
                    df["dataset"] == label
                ).sum()
            )

            print(
                f"       {label}: {count}"
            )

        # A generic MODIS dataset is specifically prohibited because
        # it cannot safely be assigned to NDVI or EVI.

        if "MODIS" in unexpected_labels:

            raise ValueError(
                "Generic 'MODIS' observations were found in the "
                "canonical layer. The repaired canonical layer must "
                "contain 'MODIS_NDVI' and 'MODIS_EVI' separately. "
                "Do not duplicate generic MODIS values into both "
                "variables."
            )

    if validation_failed:

        print(
            "[WARN] Canonical dataset counts differ "
            "from the previously validated counts."
        )

        print(
            "[WARN] The monthly layer will still be built "
            "from the actual canonical data."
        )

    else:

        print(
            "[OK] Canonical dataset counts match "
            "the validated layer."
        )


def aggregate_standard_dataset(
    data,
    prefix,
    aggregation,
):
    """
    Aggregate a standard single-variable dataset.

    Parameters
    ----------
    data : pandas.DataFrame
    prefix : str
    aggregation : str
        'sum' or 'mean'
    """

    if aggregation == "sum":

        agg = (
            data
            .groupby(
                [
                    "field_id",
                    "month",
                ],
                as_index=False,
            )
            .agg(
                **{
                    f"{prefix}_value": (
                        "value",
                        "sum",
                    ),
                    f"{prefix}_obs_count": (
                        "value",
                        "count",
                    ),
                    f"{prefix}_mean_observation": (
                        "value",
                        "mean",
                    ),
                    f"{prefix}_max_observation": (
                        "value",
                        "max",
                    ),
                }
            )
        )

    elif aggregation == "mean":

        agg = (
            data
            .groupby(
                [
                    "field_id",
                    "month",
                ],
                as_index=False,
            )
            .agg(
                **{
                    f"{prefix}_value": (
                        "value",
                        "mean",
                    ),
                    f"{prefix}_obs_count": (
                        "value",
                        "count",
                    ),
                    f"{prefix}_min": (
                        "value",
                        "min",
                    ),
                    f"{prefix}_max": (
                        "value",
                        "max",
                    ),
                    f"{prefix}_std": (
                        "value",
                        "std",
                    ),
                }
            )
        )

    else:

        raise ValueError(
            f"Unsupported aggregation: {aggregation}"
        )

    return agg


def aggregate_modis_variable(
    data,
    dataset_name,
    prefix,
):
    """
    Aggregate one explicit MODIS variable.

    dataset_name:
        MODIS_NDVI or MODIS_EVI

    prefix:
        modis_ndvi or modis_evi
    """

    variable_data = data.loc[
        data["dataset"] == dataset_name
    ].copy()

    print(
        f"       {dataset_name}: "
        f"native rows={len(variable_data)}"
    )

    if variable_data.empty:

        return pd.DataFrame()

    variable_data["value"] = safe_numeric(
        variable_data["value"]
    )

    variable_data["observation_date"] = pd.to_datetime(
        variable_data["observation_date"],
        errors="coerce",
    )

    variable_data = variable_data.dropna(
        subset=[
            "field_id",
            "observation_date",
            "value",
        ]
    )

    if variable_data.empty:

        return pd.DataFrame()

    variable_data["month"] = (
        variable_data["observation_date"]
        .dt.to_period("M")
    )

    agg = (
        variable_data
        .groupby(
            [
                "field_id",
                "month",
            ],
            as_index=False,
        )
        .agg(
            **{
                f"{prefix}_value": (
                    "value",
                    "mean",
                ),
                f"{prefix}_obs_count": (
                    "value",
                    "count",
                ),
                f"{prefix}_min": (
                    "value",
                    "min",
                ),
                f"{prefix}_max": (
                    "value",
                    "max",
                ),
                f"{prefix}_std": (
                    "value",
                    "std",
                ),
            }
        )
    )

    print(
        f"       {dataset_name}: "
        f"{len(variable_data)} native rows → "
        f"{len(agg)} monthly rows"
    )

    return agg


def aggregate_modis(data):
    """
    Aggregate MODIS NDVI and EVI independently.

    IMPORTANT:
        MODIS_NDVI and MODIS_EVI are already explicit dataset
        identities in the repaired canonical layer.

    No discriminator column is required.

    No generic MODIS fallback is allowed.
    No observation is duplicated between NDVI and EVI.
    """

    print()
    print(
        "       MODIS variable preservation:"
    )

    ndvi = aggregate_modis_variable(
        data=data,
        dataset_name="MODIS_NDVI",
        prefix="modis_ndvi",
    )

    evi = aggregate_modis_variable(
        data=data,
        dataset_name="MODIS_EVI",
        prefix="modis_evi",
    )

    if ndvi.empty and evi.empty:

        raise RuntimeError(
            "No usable MODIS_NDVI or MODIS_EVI observations "
            "were found in the canonical layer."
        )

    # Start from whichever variable exists.
    if not ndvi.empty:

        modis = ndvi.copy()

    else:

        modis = evi.copy()

    # Add the other variable without duplicating observations.
    if not evi.empty and not ndvi.empty:

        modis = modis.merge(
            evi,
            on=[
                "field_id",
                "month",
            ],
            how="outer",
        )

    print()
    print(
        "[OK] MODIS NDVI and EVI remain separate."
    )

    print(
        "     No generic modis_value feature is created."
    )

    return modis


def aggregate_dataset(
    df,
    dataset,
):
    """
    Aggregate one canonical dataset into monthly features.
    """

    prefix = (
        DATASET_CONFIG[dataset]["prefix"]
    )

    # -------------------------------------------------------------
    # MODIS is represented by two explicit canonical datasets.
    # -------------------------------------------------------------

    if dataset == "MODIS":

        return aggregate_modis(df)

    # -------------------------------------------------------------
    # Standard dataset filtering
    # -------------------------------------------------------------

    data = df.loc[
        df["dataset"] == dataset
    ].copy()

    print(
        f"       Filtered rows={len(data)} "
        f"for dataset='{dataset}'"
    )

    if data.empty:

        return pd.DataFrame()

    # -------------------------------------------------------------
    # Normalize observation fields
    # -------------------------------------------------------------

    data["value"] = safe_numeric(
        data["value"]
    )

    data["observation_date"] = pd.to_datetime(
        data["observation_date"],
        errors="coerce",
    )

    data = data.dropna(
        subset=[
            "field_id",
            "observation_date",
            "value",
        ]
    )

    if data.empty:

        return pd.DataFrame()

    # -------------------------------------------------------------
    # Create monthly period
    # -------------------------------------------------------------

    data["month"] = (
        data["observation_date"]
        .dt.to_period("M")
    )

    # -------------------------------------------------------------
    # Dataset-specific aggregation
    # -------------------------------------------------------------

    if dataset == "GPM":

        # Rainfall is an accumulation.
        # Monthly rainfall = SUM.

        agg = aggregate_standard_dataset(
            data=data,
            prefix=prefix,
            aggregation="sum",
        )

    elif dataset == "SMAP":

        # Soil moisture is a state variable.
        # Monthly representation = MEAN.

        agg = aggregate_standard_dataset(
            data=data,
            prefix=prefix,
            aggregation="mean",
        )

    elif dataset == "ECOSTRESS":

        # LST is a thermal state variable.
        # Monthly representation = MEAN.

        agg = aggregate_standard_dataset(
            data=data,
            prefix=prefix,
            aggregation="mean",
        )

    elif dataset == "GRACE_TWS_ANOMALY_MASCON":

        # GRACE is already approximately monthly.
        #
        # If multiple observations occur in a month,
        # retain their monthly mean.

        agg = (
            data
            .groupby(
                [
                    "field_id",
                    "month",
                ],
                as_index=False,
            )
            .agg(
                grace_value=(
                    "value",
                    "mean",
                ),
                grace_obs_count=(
                    "value",
                    "count",
                ),
                grace_min=(
                    "value",
                    "min",
                ),
                grace_max=(
                    "value",
                    "max",
                ),
            )
        )

    else:

        raise ValueError(
            f"Unsupported dataset: {dataset}"
        )

    return agg


# ---------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------

def main():

    print("=" * 70)
    print("MONTHLY FEATURE LAYER BUILDER")
    print("=" * 70)

    print(
        f"Input : {INPUT_FILE}"
    )

    print(
        f"Output: {OUTPUT_FILE}"
    )

    print()

    # -------------------------------------------------------------
    # Check input
    # -------------------------------------------------------------

    if not INPUT_FILE.exists():

        raise FileNotFoundError(
            f"Canonical input not found:\n{INPUT_FILE}"
        )

    OUTPUT_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    # -------------------------------------------------------------
    # Load canonical layer
    # -------------------------------------------------------------

    df = pd.read_csv(
        INPUT_FILE
    )

    print(
        f"[INFO] Canonical rows loaded: {len(df)}"
    )

    print(
        f"[INFO] Canonical columns: {len(df.columns)}"
    )

    # -------------------------------------------------------------
    # Validate required columns
    # -------------------------------------------------------------

    required_columns = {
        "field_id",
        "dataset",
        "observation_date",
        "value",
        "unit",
    }

    missing = (
        required_columns
        - set(df.columns)
    )

    if missing:

        raise ValueError(
            "Missing required columns: "
            f"{sorted(missing)}"
        )

    # -------------------------------------------------------------
    # Normalize dataset labels
    # -------------------------------------------------------------

    df["dataset"] = (
        df["dataset"]
        .apply(normalize_dataset_name)
    )

    # -------------------------------------------------------------
    # Normalize dates and values
    # -------------------------------------------------------------

    df["observation_date"] = pd.to_datetime(
        df["observation_date"],
        errors="coerce",
    )

    df["value"] = safe_numeric(
        df["value"]
    )

    # -------------------------------------------------------------
    # Remove invalid observation rows
    # -------------------------------------------------------------

    before_drop = len(df)

    df = df.dropna(
        subset=[
            "field_id",
            "dataset",
            "observation_date",
            "value",
        ]
    ).copy()

    after_drop = len(df)

    removed = (
        before_drop
        - after_drop
    )

    if removed > 0:

        print(
            f"[WARN] Removed {removed} invalid canonical rows."
        )

    # -------------------------------------------------------------
    # Date range
    # -------------------------------------------------------------

    print(
        "[INFO] Date range:",
        df["observation_date"].min().date(),
        "→",
        df["observation_date"].max().date(),
    )

    # -------------------------------------------------------------
    # Validate canonical distribution
    # -------------------------------------------------------------

    validate_canonical_dataset_counts(
        df
    )

    # -------------------------------------------------------------
    # Print exact normalized dataset labels
    # -------------------------------------------------------------

    print()
    print("-" * 70)
    print("NORMALIZED DATASET LABELS")
    print("-" * 70)

    for dataset in sorted(
        df["dataset"]
        .dropna()
        .unique()
    ):

        count = int(
            (
                df["dataset"]
                == dataset
            ).sum()
        )

        print(
            f"  '{dataset}' -> {count} rows"
        )

    # -------------------------------------------------------------
    # Explicit MODIS validation
    # -------------------------------------------------------------

    print()
    print("-" * 70)
    print("MODIS SCHEMA VALIDATION")
    print("-" * 70)

    modis_ndvi_count = int(
        (
            df["dataset"]
            == "MODIS_NDVI"
        ).sum()
    )

    modis_evi_count = int(
        (
            df["dataset"]
            == "MODIS_EVI"
        ).sum()
    )

    generic_modis_count = int(
        (
            df["dataset"]
            == "MODIS"
        ).sum()
    )

    print(
        f"  MODIS_NDVI: {modis_ndvi_count}"
    )

    print(
        f"  MODIS_EVI : {modis_evi_count}"
    )

    print(
        f"  Generic MODIS: {generic_modis_count}"
    )

    if generic_modis_count > 0:

        raise ValueError(
            "Generic MODIS rows are not permitted in the repaired "
            "canonical layer."
        )

    if modis_ndvi_count == 0:

        print(
            "[WARN] No MODIS_NDVI observations found."
        )

    if modis_evi_count == 0:

        print(
            "[WARN] No MODIS_EVI observations found."
        )

    if (
        modis_ndvi_count > 0
        and modis_evi_count > 0
    ):

        print(
            "[OK] MODIS NDVI/EVI are explicitly separated."
        )

    # -------------------------------------------------------------
    # Aggregate each dataset
    # -------------------------------------------------------------

    feature_tables = []

    print()
    print("-" * 70)
    print("DATASET AGGREGATION")
    print("-" * 70)

    for dataset, config in DATASET_CONFIG.items():

        print()
        print(
            f"[INFO] Processing "
            f"{dataset:<32}"
        )

        # ---------------------------------------------------------
        # MODIS consists of two explicit canonical datasets.
        # ---------------------------------------------------------

        if dataset == "MODIS":

            count = (
                modis_ndvi_count
                + modis_evi_count
            )

            print(
                f"       MODIS native rows="
                f"{count}"
            )

        else:

            count = int(
                (
                    df["dataset"]
                    == dataset
                ).sum()
            )

            print(
                f"       Native rows={count}"
            )

        table = aggregate_dataset(
            df,
            dataset,
        )

        if table.empty:

            print(
                f"[WARN] No valid observations for "
                f"{dataset}"
            )

            continue

        feature_tables.append(
            table
        )

        print(
            f"       → monthly rows={len(table)}"
        )

        if "month" in table.columns:

            print(
                f"       → coverage="
                f"{table['month'].min()} "
                f"→ "
                f"{table['month'].max()}"
            )

    # -------------------------------------------------------------
    # Ensure at least one dataset was processed
    # -------------------------------------------------------------

    if not feature_tables:

        raise RuntimeError(
            "No dataset produced monthly features."
        )

    # -------------------------------------------------------------
    # Merge dataset feature tables
    # -------------------------------------------------------------

    monthly = feature_tables[0].copy()

    for table in feature_tables[1:]:

        monthly = monthly.merge(
            table,
            on=[
                "field_id",
                "month",
            ],
            how="outer",
        )

    # -------------------------------------------------------------
    # Build complete field-month calendar
    # -------------------------------------------------------------

    min_month = (
        monthly["month"].min()
    )

    max_month = (
        monthly["month"].max()
    )

    all_months = pd.period_range(
        min_month,
        max_month,
        freq="M",
    )

    fields = (
        monthly["field_id"]
        .drop_duplicates()
        .tolist()
    )

    calendar = (
        pd.MultiIndex.from_product(
            [
                fields,
                all_months,
            ],
            names=[
                "field_id",
                "month",
            ],
        )
        .to_frame(
            index=False
        )
    )

    monthly = calendar.merge(
        monthly,
        on=[
            "field_id",
            "month",
        ],
        how="left",
    )

    # -------------------------------------------------------------
    # Date columns
    # -------------------------------------------------------------

    monthly["year"] = (
        monthly["month"]
        .dt.year
    )

    monthly["month_number"] = (
        monthly["month"]
        .dt.month
    )

    monthly["month_start"] = (
        monthly["month"]
        .dt.to_timestamp(
            how="start"
        )
        .dt.strftime(
            "%Y-%m-%d"
        )
    )

    monthly["month_end"] = (
        monthly["month"]
        .dt.to_timestamp(
            how="end"
        )
        .dt.strftime(
            "%Y-%m-%d"
        )
    )

    # -------------------------------------------------------------
    # Availability indicators
    # -------------------------------------------------------------

    # -------------------------------------------------------------
    # GPM
    # -------------------------------------------------------------

    monthly["gpm_available"] = (
        monthly["gpm_obs_count"]
        .fillna(0)
        .gt(0)
        .astype(int)
        if "gpm_obs_count" in monthly.columns
        else 0
    )

    # -------------------------------------------------------------
    # SMAP
    # -------------------------------------------------------------

    monthly["smap_available"] = (
        monthly["smap_obs_count"]
        .fillna(0)
        .gt(0)
        .astype(int)
        if "smap_obs_count" in monthly.columns
        else 0
    )

    # -------------------------------------------------------------
    # MODIS NDVI
    # -------------------------------------------------------------

    if "modis_ndvi_obs_count" in monthly.columns:

        monthly["modis_ndvi_available"] = (
            monthly["modis_ndvi_obs_count"]
            .fillna(0)
            .gt(0)
            .astype(int)
        )

    else:

        monthly["modis_ndvi_available"] = 0

    # -------------------------------------------------------------
    # MODIS EVI
    # -------------------------------------------------------------

    if "modis_evi_obs_count" in monthly.columns:

        monthly["modis_evi_available"] = (
            monthly["modis_evi_obs_count"]
            .fillna(0)
            .gt(0)
            .astype(int)
        )

    else:

        monthly["modis_evi_available"] = 0

    # -------------------------------------------------------------
    # MODIS source-level availability
    #
    # NDVI/EVI are two variables from the same MODIS source.
    # Therefore MODIS contributes only ONE dataset to the
    # remote_sensing_dataset_count.
    # -------------------------------------------------------------

    monthly["modis_available"] = (
        (
            monthly["modis_ndvi_available"]
            + monthly["modis_evi_available"]
        )
        .gt(0)
        .astype(int)
    )

    # -------------------------------------------------------------
    # ECOSTRESS
    # -------------------------------------------------------------

    monthly["ecostress_available"] = (
        monthly["ecostress_obs_count"]
        .fillna(0)
        .gt(0)
        .astype(int)
        if "ecostress_obs_count" in monthly.columns
        else 0
    )

    # -------------------------------------------------------------
    # GRACE
    # -------------------------------------------------------------

    monthly["grace_available"] = (
        monthly["grace_obs_count"]
        .fillna(0)
        .gt(0)
        .astype(int)
        if "grace_obs_count" in monthly.columns
        else 0
    )

    # -------------------------------------------------------------
    # Overall remote sensing coverage
    # -------------------------------------------------------------

    availability_columns = [
        "gpm_available",
        "smap_available",
        "modis_available",
        "ecostress_available",
        "grace_available",
    ]

    monthly[
        "remote_sensing_dataset_count"
    ] = (
        monthly[
            availability_columns
        ]
        .fillna(0)
        .sum(axis=1)
        .astype(int)
    )

    # Five source datasets:
    #
    #   1. GPM
    #   2. SMAP
    #   3. MODIS
    #   4. ECOSTRESS
    #   5. GRACE

    monthly[
        "remote_sensing_complete"
    ] = (
        monthly[
            "remote_sensing_dataset_count"
        ]
        == len(availability_columns)
    ).astype(int)

    # -------------------------------------------------------------
    # Sort
    # -------------------------------------------------------------

    monthly = (
        monthly
        .sort_values(
            [
                "field_id",
                "month",
            ]
        )
        .reset_index(drop=True)
    )

    # -------------------------------------------------------------
    # Convert Period to string
    # -------------------------------------------------------------

    monthly["month"] = (
        monthly["month"]
        .astype(str)
    )

    # -------------------------------------------------------------
    # Column ordering
    # -------------------------------------------------------------

    first_columns = [
        "field_id",
        "month",
        "month_start",
        "month_end",
        "year",
        "month_number",
    ]

    remaining_columns = [
        column
        for column in monthly.columns
        if column not in first_columns
    ]

    monthly = monthly[
        first_columns
        + remaining_columns
    ]

    # -------------------------------------------------------------
    # Save
    # -------------------------------------------------------------

    monthly.to_csv(
        OUTPUT_FILE,
        index=False,
        float_format="%.6f",
    )

    # -------------------------------------------------------------
    # Validation
    # -------------------------------------------------------------

    print()
    print("=" * 70)
    print(
        "[SUCCESS] MONTHLY FEATURE LAYER CREATED"
    )
    print("=" * 70)

    print(
        f"Rows   : {len(monthly)}"
    )

    print(
        f"Columns: {len(monthly.columns)}"
    )

    print(
        f"Output : {OUTPUT_FILE}"
    )

    # -------------------------------------------------------------
    # Monthly coverage
    # -------------------------------------------------------------

    print()
    print("Monthly coverage:")

    print(
        f"  {monthly['month'].min()} "
        f"→ "
        f"{monthly['month'].max()}"
    )

    # -------------------------------------------------------------
    # Expected calendar size
    # -------------------------------------------------------------

    expected_rows = (
        len(fields)
        * len(all_months)
    )

    print()
    print(
        f"Expected field-month rows: "
        f"{expected_rows}"
    )

    print(
        f"Actual field-month rows  : "
        f"{len(monthly)}"
    )

    if len(monthly) == expected_rows:

        print(
            "[OK] Complete field-month calendar."
        )

    else:

        print(
            "[WARN] Field-month calendar size "
            "does not match expectation."
        )

    # -------------------------------------------------------------
    # MODIS feature validation
    # -------------------------------------------------------------

    print()
    print("MODIS feature availability:")

    if "modis_ndvi_value" in monthly.columns:

        ndvi_available = int(
            monthly[
                "modis_ndvi_available"
            ].sum()
        )

        print(
            f"  NDVI: "
            f"{ndvi_available} / "
            f"{len(monthly)} months"
        )

    else:

        print(
            "  NDVI: NOT AVAILABLE"
        )

    if "modis_evi_value" in monthly.columns:

        evi_available = int(
            monthly[
                "modis_evi_available"
            ].sum()
        )

        print(
            f"  EVI : "
            f"{evi_available} / "
            f"{len(monthly)} months"
        )

    else:

        print(
            "  EVI : NOT AVAILABLE"
        )

    # -------------------------------------------------------------
    # Explicitly verify generic MODIS feature is absent
    # -------------------------------------------------------------

    if "modis_value" in monthly.columns:

        raise RuntimeError(
            "Invalid schema: generic 'modis_value' was created. "
            "MODIS must remain separated into NDVI and EVI."
        )

    else:

        print(
            "  Generic MODIS value: NOT CREATED [OK]"
        )

    # -------------------------------------------------------------
    # Dataset availability
    # -------------------------------------------------------------

    print()
    print("Dataset availability:")

    dataset_availability = [
        ("GPM", "gpm_available"),
        ("SMAP", "smap_available"),
        ("MODIS", "modis_available"),
        ("ECOSTRESS", "ecostress_available"),
        ("GRACE", "grace_available"),
    ]

    for dataset, available_col in dataset_availability:

        available = int(
            monthly[
                available_col
            ].sum()
        )

        print(
            f"  {dataset:<12}: "
            f"{available} / "
            f"{len(monthly)} months"
        )

    # -------------------------------------------------------------
    # Complete remote-sensing months
    # -------------------------------------------------------------

    complete_months = int(
        monthly[
            "remote_sensing_complete"
        ].sum()
    )

    print()
    print(
        "Fully observed remote-sensing months:"
    )

    print(
        f"  {complete_months} / "
        f"{len(monthly)} months"
    )

    # -------------------------------------------------------------
    # Coverage distribution
    # -------------------------------------------------------------

    print()
    print(
        "Remote-sensing dataset coverage "
        "distribution:"
    )

    coverage_distribution = (
        monthly[
            "remote_sensing_dataset_count"
        ]
        .value_counts()
        .sort_index()
    )

    for dataset_count, month_count in (
        coverage_distribution.items()
    ):

        print(
            f"  {dataset_count} datasets available: "
            f"{month_count} months"
        )

    # -------------------------------------------------------------
    # Check duplicate field-month rows
    # -------------------------------------------------------------

    duplicate_count = int(
        monthly.duplicated(
            subset=[
                "field_id",
                "month",
            ]
        ).sum()
    )

    print()

    if duplicate_count == 0:

        print(
            "[OK] No duplicate field-month rows."
        )

    else:

        raise RuntimeError(
            f"Found {duplicate_count} duplicate "
            "field-month rows."
        )

    # -------------------------------------------------------------
    # Preview
    # -------------------------------------------------------------

    print()
    print("Preview:")

    preview_columns = [
        "field_id",
        "month",
        "gpm_value",
        "smap_value",
        "modis_ndvi_value",
        "modis_evi_value",
        "ecostress_value",
        "grace_value",
        "remote_sensing_dataset_count",
        "remote_sensing_complete",
    ]

    preview_columns = [
        column
        for column in preview_columns
        if column in monthly.columns
    ]

    print(
        monthly[
            preview_columns
        ]
        .head(5)
        .to_string(
            index=False
        )
    )

    # -------------------------------------------------------------
    # Tail
    # -------------------------------------------------------------

    print()
    print("Tail:")

    print(
        monthly[
            preview_columns
        ]
        .tail(5)
        .to_string(
            index=False
        )
    )

    # -------------------------------------------------------------
    # Canonical protection confirmation
    # -------------------------------------------------------------

    print()
    print(
        "[OK] Canonical layer was not modified."
    )


# ---------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------

if __name__ == "__main__":
    main()