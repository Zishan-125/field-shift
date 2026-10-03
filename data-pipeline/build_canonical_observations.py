"""
Build canonical native observations from validated historical datasets.

The canonical layer preserves each dataset's native temporal semantics.

Windowed datasets:
    GPM          -> source observation date + 7-day accumulation window
    SMAP         -> source observation date + 7-day aggregation window
    MODIS_NDVI   -> source observation date + 16-day composite/window
    MODIS_EVI    -> source observation date + 16-day composite/window
    ECOSTRESS    -> source observation date + 7-day search window

Instant/monthly observation:
    GRACE        -> actual system:time_start observation date

Important:
    MODIS_NDVI and MODIS_EVI are preserved as separate dataset identities.
    They must never be collapsed into a generic "MODIS" dataset because
    NDVI and EVI are different measurements.

No interpolation is performed.
No missing observation is converted to zero.
No synthetic dates are created.
"""

from pathlib import Path
import argparse
import sys

import pandas as pd


# ---------------------------------------------------------------------
# Dataset configuration
# ---------------------------------------------------------------------

DATASET_CONFIG = {
    "gpm": {
        "name": "GPM",
        "window_days": 7,
    },
    "smap": {
        "name": "SMAP",
        "window_days": 7,
    },
    "modis": {
        # MODIS is special because the source CSV contains a native
        # dataset discriminator:
        #
        #   MODIS_NDVI
        #   MODIS_EVI
        #
        # Therefore the "name" value below is only a fallback and is
        # NOT used when a valid MODIS dataset column exists.
        "name": "MODIS",
        "window_days": 16,
        "allowed_names": {
            "MODIS_NDVI",
            "MODIS_EVI",
        },
    },
    "ecostress": {
        "name": "ECOSTRESS",
        "window_days": 7,
    },
    "grace": {
        "name": "GRACE_TWS_ANOMALY_MASCON",
        "window_days": None,
    },
}


# ---------------------------------------------------------------------
# Canonical schema
# ---------------------------------------------------------------------

CANONICAL_COLUMNS = [
    "field_id",
    "dataset",
    "observation_date",
    "window_start",
    "window_end",
    "value",
    "unit",
    "observation_count",
    "quality",
    "spatial_support",
    "sampling_method",
    "source_file",
    "source_row",
]


# ---------------------------------------------------------------------
# Argument parser
# ---------------------------------------------------------------------

def parse_args():
    parser = argparse.ArgumentParser(
        description="Build canonical observation layer."
    )

    parser.add_argument(
        "--input-dir",
        default="data-pipeline/output/historical",
        help="Historical ingestion directory.",
    )

    parser.add_argument(
        "--output",
        default=(
            "data-pipeline/output/canonical/"
            "field_observations_2019_2024.csv"
        ),
        help="Canonical CSV output path.",
    )

    return parser.parse_args()


# ---------------------------------------------------------------------
# Historical file discovery
# ---------------------------------------------------------------------

def discover_files(input_dir):
    """
    Discover validated historical CSV files.

    Smoke-test files are excluded automatically when their filename
    follows the known *_2019_01.csv pattern.
    """

    files = []

    for dataset_folder in DATASET_CONFIG:

        folder = input_dir / dataset_folder

        if not folder.exists():

            print(
                f"[WARN] Missing directory: {folder}"
            )

            continue

        for path in sorted(folder.glob("*.csv")):

            filename = path.name.lower()

            # Exclude known January 2019 smoke-test artifacts.
            #
            # Examples:
            #   gpm_2019_01.csv
            #   modis_2019_01.csv
            #   smap_2019_01.csv
            #   ecostress_2019_01.csv
            #   grace_2019_01.csv
            if filename.endswith("_2019_01.csv"):

                print(
                    f"[INFO] Skipping smoke-test artifact: "
                    f"{path.name}"
                )

                continue

            files.append(
                (dataset_folder, path)
            )

    return files


# ---------------------------------------------------------------------
# MODIS dataset identity handling
# ---------------------------------------------------------------------

def resolve_dataset_names(
    dataset_folder,
    df,
    path,
):
    """
    Resolve canonical dataset names.

    For normal datasets, the dataset identity comes from DATASET_CONFIG.

    For MODIS, the source ingestion CSV must preserve the native
    discriminator:

        MODIS_NDVI
        MODIS_EVI

    This prevents NDVI and EVI from being collapsed into a generic
    "MODIS" dataset.
    """

    config = DATASET_CONFIG[dataset_folder]

    # -------------------------------------------------------------
    # MODIS requires explicit dataset identity.
    # -------------------------------------------------------------

    if dataset_folder == "modis":

        if "dataset" not in df.columns:

            raise ValueError(
                f"{path} is a MODIS file but does not contain "
                "the required 'dataset' column. "
                "Expected MODIS_NDVI / MODIS_EVI."
            )

        dataset_values = (
            df["dataset"]
            .astype("string")
            .str.strip()
        )

        # Detect missing dataset identities.

        if dataset_values.isna().any():

            missing_count = int(
                dataset_values.isna().sum()
            )

            raise ValueError(
                f"{path} contains {missing_count} MODIS rows "
                "without a dataset discriminator."
            )

        # Detect empty strings.

        empty_mask = (
            dataset_values.str.len() == 0
        )

        if empty_mask.any():

            empty_count = int(
                empty_mask.sum()
            )

            raise ValueError(
                f"{path} contains {empty_count} MODIS rows "
                "with an empty dataset discriminator."
            )

        # Only the expected MODIS measurements are allowed.

        allowed_modis = config["allowed_names"]

        invalid_mask = (
            ~dataset_values.isin(
                allowed_modis
            )
        )

        if invalid_mask.any():

            invalid_values = sorted(
                dataset_values.loc[
                    invalid_mask
                ]
                .unique()
                .tolist()
            )

            raise ValueError(
                f"{path} contains invalid MODIS dataset "
                f"values: {invalid_values}. "
                f"Expected only: "
                f"{sorted(allowed_modis)}"
            )

        return dataset_values

    # -------------------------------------------------------------
    # All other datasets use their configured canonical name.
    # -------------------------------------------------------------

    return pd.Series(
        config["name"],
        index=df.index,
        dtype="string",
    )


# ---------------------------------------------------------------------
# Normalize one historical CSV
# ---------------------------------------------------------------------

def normalize_file(dataset_folder, path):
    """
    Normalize one historical ingestion CSV into canonical format.
    """

    config = DATASET_CONFIG[dataset_folder]

    df = pd.read_csv(path)

    if df.empty:

        print(
            f"[WARN] Empty file: {path}"
        )

        return None

    # -------------------------------------------------------------
    # Required source columns
    # -------------------------------------------------------------

    required = [
        "field_id",
        "date",
        "value",
    ]

    missing = [
        column
        for column in required
        if column not in df.columns
    ]

    if missing:

        raise ValueError(
            f"{path} is missing columns: {missing}"
        )

    # -------------------------------------------------------------
    # Parse source observation dates
    # -------------------------------------------------------------

    dates = pd.to_datetime(
        df["date"],
        errors="coerce",
    )

    if dates.isna().any():

        invalid_count = int(
            dates.isna().sum()
        )

        raise ValueError(
            f"{path} contains {invalid_count} invalid dates."
        )

    # -------------------------------------------------------------
    # Parse measurement values
    # -------------------------------------------------------------

    values = pd.to_numeric(
        df["value"],
        errors="coerce",
    )

    if values.isna().any():

        invalid_count = int(
            values.isna().sum()
        )

        raise ValueError(
            f"{path} contains {invalid_count} "
            "non-numeric values."
        )

    # -------------------------------------------------------------
    # Create output dataframe
    # -------------------------------------------------------------

    out = pd.DataFrame(
        index=df.index
    )

    # -------------------------------------------------------------
    # Basic identity
    # -------------------------------------------------------------

    out["field_id"] = (
        df["field_id"].astype(str)
    )

    # IMPORTANT:
    #
    # MODIS_NDVI and MODIS_EVI are preserved here.
    #
    # Previously this was:
    #
    #     out["dataset"] = config["name"]
    #
    # which collapsed both into "MODIS".
    #
    # That information loss prevented downstream reconstruction
    # of separate NDVI and EVI features.

    out["dataset"] = resolve_dataset_names(
        dataset_folder,
        df,
        path,
    )

    # -------------------------------------------------------------
    # Temporal semantics
    # -------------------------------------------------------------

    # Every dataset retains the actual source observation date.
    #
    # For GRACE:
    #     observation_date = actual observation date
    #     window_start     = NA
    #     window_end       = NA
    #
    # For GPM / SMAP / MODIS / ECOSTRESS:
    #     observation_date = actual source observation date
    #     window_start     = beginning of native window
    #     window_end       = end of native window

    out["observation_date"] = (
        dates.dt.strftime("%Y-%m-%d")
    )

    if dataset_folder == "grace":

        out["window_start"] = pd.NA
        out["window_end"] = pd.NA

    else:

        out["window_start"] = (
            dates.dt.strftime("%Y-%m-%d")
        )

        end_dates = (
            dates
            + pd.to_timedelta(
                config["window_days"],
                unit="D",
            )
        )

        out["window_end"] = (
            end_dates.dt.strftime("%Y-%m-%d")
        )

    # -------------------------------------------------------------
    # Measurement
    # -------------------------------------------------------------

    out["value"] = values

    # -------------------------------------------------------------
    # Metadata: unit
    # -------------------------------------------------------------

    if "unit" in df.columns:

        out["unit"] = df["unit"]

    else:

        out["unit"] = pd.NA

    # -------------------------------------------------------------
    # Metadata: observation count
    # -------------------------------------------------------------

    if "observation_count" in df.columns:

        out["observation_count"] = pd.to_numeric(
            df["observation_count"],
            errors="coerce",
        )

    else:

        out["observation_count"] = pd.NA

    # -------------------------------------------------------------
    # Metadata: quality
    # -------------------------------------------------------------

    if "quality" in df.columns:

        out["quality"] = (
            df["quality"].astype("string")
        )

    else:

        out["quality"] = pd.NA

    # -------------------------------------------------------------
    # Metadata: spatial support
    # -------------------------------------------------------------

    if "spatial_support" in df.columns:

        out["spatial_support"] = (
            df["spatial_support"].astype("string")
        )

    else:

        out["spatial_support"] = pd.NA

    # -------------------------------------------------------------
    # Metadata: sampling method
    # -------------------------------------------------------------

    if "sampling_method" in df.columns:

        out["sampling_method"] = (
            df["sampling_method"].astype("string")
        )

    else:

        out["sampling_method"] = pd.NA

    # -------------------------------------------------------------
    # Provenance
    # -------------------------------------------------------------

    out["source_file"] = str(path)

    # Original CSV row number, excluding header.

    out["source_row"] = range(
        1,
        len(df) + 1,
    )

    return out


# ---------------------------------------------------------------------
# Canonical validation
# ---------------------------------------------------------------------

def validate(df):
    """
    Validate the canonical observation dataframe.
    """

    # -------------------------------------------------------------
    # Schema validation
    # -------------------------------------------------------------

    missing = [
        column
        for column in CANONICAL_COLUMNS
        if column not in df.columns
    ]

    if missing:

        raise ValueError(
            f"Missing canonical columns: {missing}"
        )

    # -------------------------------------------------------------
    # Required values
    # -------------------------------------------------------------

    for column in [
        "field_id",
        "dataset",
        "observation_date",
        "value",
    ]:

        if df[column].isna().any():

            raise ValueError(
                f"Missing values detected in {column}"
            )

    # -------------------------------------------------------------
    # Dataset identity validation
    # -------------------------------------------------------------

    # Valid canonical dataset names.

    allowed_datasets = {
        "GPM",
        "SMAP",
        "MODIS_NDVI",
        "MODIS_EVI",
        "ECOSTRESS",
        "GRACE_TWS_ANOMALY_MASCON",
    }

    actual_datasets = set(
        df["dataset"]
        .astype(str)
        .unique()
    )

    unexpected_datasets = (
        actual_datasets
        - allowed_datasets
    )

    if unexpected_datasets:

        raise ValueError(
            "Unexpected canonical dataset names detected: "
            f"{sorted(unexpected_datasets)}"
        )

    # Explicitly reject generic MODIS.
    #
    # This is an important guard against accidentally reintroducing
    # the original information-loss bug.

    if "MODIS" in actual_datasets:

        raise ValueError(
            'Generic "MODIS" dataset detected in canonical '
            "layer. MODIS must be represented as "
            "MODIS_NDVI or MODIS_EVI."
        )

    # -------------------------------------------------------------
    # Observation date validation
    # -------------------------------------------------------------

    parsed_dates = pd.to_datetime(
        df["observation_date"],
        errors="coerce",
    )

    if parsed_dates.isna().any():

        invalid_count = int(
            parsed_dates.isna().sum()
        )

        raise ValueError(
            f"{invalid_count} canonical rows contain "
            "invalid observation_date values."
        )

    # -------------------------------------------------------------
    # GRACE temporal validation
    # -------------------------------------------------------------

    grace = df[
        df["dataset"]
        == "GRACE_TWS_ANOMALY_MASCON"
    ]

    if not grace.empty:

        if grace["observation_date"].isna().any():

            raise ValueError(
                "GRACE rows missing observation_date."
            )

        if grace["window_start"].notna().any():

            raise ValueError(
                "GRACE must not have window_start."
            )

        if grace["window_end"].notna().any():

            raise ValueError(
                "GRACE must not have window_end."
            )

    # -------------------------------------------------------------
    # Windowed dataset validation
    # -------------------------------------------------------------

    windowed = df[
        df["dataset"]
        != "GRACE_TWS_ANOMALY_MASCON"
    ]

    if not windowed.empty:

        # Every windowed observation must retain its
        # original source observation date.

        if windowed["observation_date"].isna().any():

            raise ValueError(
                "Windowed observations missing "
                "observation_date."
            )

        # Windowed datasets must have a valid start.

        if windowed["window_start"].isna().any():

            raise ValueError(
                "Windowed observations missing "
                "window_start."
            )

        # Windowed datasets must have a valid end.

        if windowed["window_end"].isna().any():

            raise ValueError(
                "Windowed observations missing "
                "window_end."
            )

        # Validate chronological order.

        window_start = pd.to_datetime(
            windowed["window_start"],
            errors="coerce",
        )

        window_end = pd.to_datetime(
            windowed["window_end"],
            errors="coerce",
        )

        if window_start.isna().any():

            raise ValueError(
                "Windowed observations contain "
                "invalid window_start dates."
            )

        if window_end.isna().any():

            raise ValueError(
                "Windowed observations contain "
                "invalid window_end dates."
            )

        if (window_end < window_start).any():

            raise ValueError(
                "Windowed observations contain "
                "window_end earlier than window_start."
            )

    # -------------------------------------------------------------
    # MODIS-specific validation
    # -------------------------------------------------------------

    modis = df[
        df["dataset"].isin(
            [
                "MODIS_NDVI",
                "MODIS_EVI",
            ]
        )
    ]

    if not modis.empty:

        # Both MODIS variables must use the same unit.

        modis_units = (
            modis["unit"]
            .dropna()
            .astype(str)
            .unique()
            .tolist()
        )

        if modis_units and modis_units != ["index"]:

            unexpected_units = [
                unit
                for unit in modis_units
                if unit != "index"
            ]

            if unexpected_units:

                raise ValueError(
                    "Unexpected MODIS units detected: "
                    f"{unexpected_units}. "
                    "Expected 'index'."
                )

        # Ensure no generic MODIS identity survives.

        if (
            modis["dataset"]
            .astype(str)
            .eq("MODIS")
            .any()
        ):

            raise ValueError(
                "Generic MODIS rows detected after "
                "MODIS-specific validation."
            )

    # -------------------------------------------------------------
    # Duplicate validation
    # -------------------------------------------------------------

    duplicate_columns = [
        "field_id",
        "dataset",
        "observation_date",
        "window_start",
        "window_end",
        "value",
    ]

    duplicates = df.duplicated(
        subset=duplicate_columns,
        keep=False,
    )

    if duplicates.any():

        duplicate_count = int(
            duplicates.sum()
        )

        print(
            f"[WARN] {duplicate_count} "
            "duplicate canonical rows detected."
        )

    else:

        print(
            "[OK] No duplicate canonical observations detected."
        )


# ---------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------

def print_summary(canonical):
    """
    Print useful validation summary.
    """

    print()
    print("=" * 70)
    print("CANONICAL OBSERVATION SUMMARY")
    print("=" * 70)

    print()
    print("Rows by dataset:")

    counts = (
        canonical["dataset"]
        .value_counts()
        .sort_index()
    )

    print(
        counts.to_string()
    )

    print()
    print(
        f"Total rows: {len(canonical)}"
    )

    print()
    print("Temporal coverage:")

    for dataset_name, group in canonical.groupby(
        "dataset",
        sort=True,
    ):

        dates = pd.to_datetime(
            group["observation_date"],
            errors="coerce",
        )

        print(
            f"  {dataset_name}: "
            f"{dates.min().date()} -> "
            f"{dates.max().date()} "
            f"({len(group)} rows)"
        )

    print()
    print("Units by dataset:")

    for dataset_name, group in canonical.groupby(
        "dataset",
        sort=True,
    ):

        units = (
            group["unit"]
            .dropna()
            .astype(str)
            .unique()
            .tolist()
        )

        print(
            f"  {dataset_name}: "
            f"{units}"
        )

    print()
    print("Canonical columns:")

    for column in CANONICAL_COLUMNS:

        print(
            f"  - {column}"
        )


# ---------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------

def main():

    args = parse_args()

    input_dir = Path(
        args.input_dir
    )

    output_path = Path(
        args.output
    )

    # -------------------------------------------------------------
    # Input validation
    # -------------------------------------------------------------

    if not input_dir.exists():

        print(
            f"[ERROR] Input directory does not exist: "
            f"{input_dir}"
        )

        sys.exit(1)

    files = discover_files(
        input_dir
    )

    if not files:

        print(
            "[ERROR] No historical CSV files found."
        )

        sys.exit(1)

    # -------------------------------------------------------------
    # Header
    # -------------------------------------------------------------

    print("=" * 70)
    print("CANONICAL NATIVE OBSERVATION BUILDER")
    print("=" * 70)

    print(
        f"Input : {input_dir}"
    )

    print(
        f"Output: {output_path}"
    )

    print()

    # -------------------------------------------------------------
    # Normalize all files
    # -------------------------------------------------------------

    frames = []

    for dataset_folder, path in files:

        print(
            f"[INFO] Processing "
            f"{dataset_folder.upper():10s} "
            f"{path.name}"
        )

        try:

            result = normalize_file(
                dataset_folder,
                path,
            )

        except Exception as exc:

            print(
                f"[ERROR] Failed: {path}"
            )

            print(
                f"        {exc}"
            )

            sys.exit(1)

        if result is not None:

            frames.append(result)

    if not frames:

        print(
            "[ERROR] No observations generated."
        )

        sys.exit(1)

    # -------------------------------------------------------------
    # Combine
    # -------------------------------------------------------------

    canonical = pd.concat(
        frames,
        ignore_index=True,
    )

    canonical = canonical[
        CANONICAL_COLUMNS
    ]

    # -------------------------------------------------------------
    # Validate before writing
    # -------------------------------------------------------------

    validate(
        canonical
    )

    # -------------------------------------------------------------
    # Sort
    # -------------------------------------------------------------

    # All datasets now have a real observation_date.

    sort_date = pd.to_datetime(
        canonical["observation_date"],
        errors="coerce",
    )

    canonical["_sort_date"] = sort_date

    canonical = (
        canonical
        .sort_values(
            [
                "field_id",
                "dataset",
                "_sort_date",
            ]
        )
        .drop(
            columns="_sort_date"
        )
        .reset_index(
            drop=True
        )
    )

    # -------------------------------------------------------------
    # Output
    # -------------------------------------------------------------

    output_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    canonical.to_csv(
        output_path,
        index=False,
        encoding="utf-8",
    )

    # -------------------------------------------------------------
    # Final summary
    # -------------------------------------------------------------

    print()
    print("=" * 70)
    print(
        "[SUCCESS] Canonical observation layer created"
    )
    print("=" * 70)

    print(
        f"Rows   : {len(canonical)}"
    )

    print(
        f"Output : {output_path}"
    )

    print_summary(
        canonical
    )


if __name__ == "__main__":
    main()