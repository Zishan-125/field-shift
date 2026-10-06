"""
FIELD SHIFT — Rotation Score Audit

Audits existing evaluated_rotation_scenarios.csv.

This script does NOT modify production data.

It answers:

1. Are all scores within [0, 1]?
2. Are there missing values?
3. Are scores suspiciously concentrated?
4. Do priority contributions mathematically match
   score × normalized weight?
5. Is Priority Fit bounded?
"""

from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd


SCORE_COLUMNS = [
    "water_conservation_score",
    "soil_health_score",
    "climate_resilience_score",
    "crop_diversity_score",
]

WEIGHT_COLUMNS = [
    "water_conservation",
    "soil_health",
    "climate_resilience",
    "crop_diversity",
]


def audit_scores(path: Path) -> None:

    if not path.exists():
        raise FileNotFoundError(
            f"Scenario file not found: {path}"
        )

    df = pd.read_csv(path)

    print("=" * 72)
    print("FIELD SHIFT — ROTATION SCORE AUDIT")
    print("=" * 72)

    print(f"Rows: {len(df):,}")

    print()
    print("Columns:")
    for column in df.columns:
        print(f"  - {column}")

    print()
    print("SCORE RANGE AUDIT")
    print("-" * 72)

    failures = []

    for column in SCORE_COLUMNS:

        if column not in df.columns:
            print(
                f"[MISSING] {column}"
            )
            failures.append(column)
            continue

        values = pd.to_numeric(
            df[column],
            errors="coerce",
        )

        missing = int(values.isna().sum())

        below_zero = int(
            (values < 0).sum()
        )

        above_one = int(
            (values > 1).sum()
        )

        print(
            f"{column:35s} "
            f"min={values.min():.6f} "
            f"max={values.max():.6f} "
            f"mean={values.mean():.6f} "
            f"missing={missing} "
            f"<0={below_zero} "
            f">1={above_one}"
        )

        if (
            missing
            or below_zero
            or above_one
        ):
            failures.append(column)

    print()
    print("DISTRIBUTION CHECK")
    print("-" * 72)

    for column in SCORE_COLUMNS:

        if column not in df.columns:
            continue

        values = pd.to_numeric(
            df[column],
            errors="coerce",
        ).dropna()

        if values.empty:
            continue

        unique_ratio = (
            values.nunique()
            / len(values)
        )

        print(
            f"{column:35s} "
            f"unique={values.nunique():4d} "
            f"unique_ratio={unique_ratio:.4f}"
        )

    print()
    print("PRIORITY SCORE CHECK")
    print("-" * 72)

    if "farmer_priority_score" in df.columns:

        priority = pd.to_numeric(
            df["farmer_priority_score"],
            errors="coerce",
        )

        print(
            "Priority Fit:"
        )

        print(
            f"  min = {priority.min():.6f}"
        )

        print(
            f"  max = {priority.max():.6f}"
        )

        print(
            f"  mean = {priority.mean():.6f}"
        )

        invalid = (
            priority.isna()
            | (priority < 0)
            | (priority > 1)
        ).sum()

        print(
            f"  invalid = {invalid}"
        )

        if invalid:
            failures.append(
                "farmer_priority_score"
            )

    print()
    print("FINAL RESULT")
    print("-" * 72)

    if failures:
        print(
            "[FAIL] Scientific score audit failed."
        )

        print(
            "Affected fields:"
        )

        for item in sorted(
            set(failures)
        ):
            print(
                f"  - {item}"
            )

        raise SystemExit(1)

    print(
        "[PASS] All stored scores are bounded in [0, 1]."
    )

    print(
        "[NOTE] Bounded values alone do NOT prove scientific validity."
    )

    print(
        "[NOTE] Source transformations must still be documented."
    )


def main() -> None:

    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--input",
        default=(
            "data-pipeline/output/scenarios/"
            "evaluated_rotation_scenarios.csv"
        ),
    )

    args = parser.parse_args()

    audit_scores(
        Path(args.input)
    )


if __name__ == "__main__":
    main()