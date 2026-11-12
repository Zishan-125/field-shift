"""
The composite score model. Two design decisions carried over
deliberately from the last file and from backend/app/services/
scoring_engine.py, not reinvented here:

1. Feature engineering (pivoting the long CSVs, rolling means, trend
   deltas) is IMPORTED from stress_risk_model.py, not copy-pasted.
   Two models computing "the rolling mean of SMAP" slightly
   differently because someone edited one file and not the other is
   exactly the kind of drift the earlier data-pipeline decision was
   trying to avoid — same principle, applied one layer up.

2. This model does not invent a new definition of "shift score."
   Its training target is scoring_engine.py's own weighted formula
   (`_stress_contribution` / `_composite_score`), computed here on
   full historical data. In other words: the rule-based scorer
   already IN PRODUCTION is the teacher: this regressor's job is to
   learn to approximate and smooth that same score, including filling
   in a reasonable estimate on rows where a signal is temporarily
   missing — something the live rule engine currently handles crudely
   (a flat "neutral 50" fallback). That's a real, explainable
   improvement, and it means swapping this in later doesn't change
   what the score MEANS to a farmer, only how accurately it's
   estimated when data is incomplete.

Run as: python ml-models/shift_score_model.py
Input:  ml-models/data/raw/field_*_history.csv
Output: ml-models/saved_models/shift_score_model.joblib
"""

import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import GroupShuffleSplit
from xgboost import XGBRegressor

sys.path.insert(0, str(Path(__file__).parent))  # allow `import stress_risk_model` as a sibling script
from stress_risk_model import (  # noqa: E402
    FEATURE_COLUMNS,
    RAW_DATA_DIR,
    engineer_features,
    load_long_format,
    pivot_to_wide,
)

SAVED_MODEL_DIR = Path("ml-models/saved_models")

# Mirrors backend/app/services/scoring_engine.py's SIGNAL_WEIGHTS
# exactly. If you tune the weights there after validating against
# real events, update this constant too and retrain — this is the one
# place in ml-models/ that has to stay in sync with the backend by hand,
# since it's a training-time constant, not something importable across
# the repo boundary without adding a shared package.
SIGNAL_WEIGHTS = {
    "SMAP": 0.30,
    "MODIS": 0.20,
    "GPM": 0.20,
    "ECOSTRESS": 0.20,
    "GRACE-FO": 0.10,
}


def _stress_contribution(value: float, field_mean: float) -> float:
    """Same shape as scoring_engine.py's per-signal stress mapping,
    just computed from a historical mean instead of a live anomaly_pct
    (this file doesn't have NASA's true multi-year climatology handy,
    only the field's own history window — a reasonable proxy for
    bootstrapping a training label)."""
    if pd.isna(value) or pd.isna(field_mean) or field_mean == 0:
        return 50.0
    anomaly_pct = (value - field_mean) / field_mean * 100
    magnitude = min(abs(anomaly_pct), 100.0)
    return magnitude if anomaly_pct < 0 else max(0.0, magnitude * 0.3)


def compute_bootstrap_target(wide: pd.DataFrame) -> pd.Series:
    """The teacher label: scoring_engine.py's weighted composite,
    computed per row against that field's own historical mean per
    signal."""
    contributions = pd.DataFrame(index=wide.index)
    weight_total = pd.Series(0.0, index=wide.index)

    for signal, weight in SIGNAL_WEIGHTS.items():
        if signal not in wide.columns:
            continue
        field_mean = wide.groupby("field_id")[signal].transform("mean")
        contributions[signal] = wide.apply(
            lambda _row, s=signal, fm=field_mean: None, axis=1
        )  # placeholder to keep column order predictable
        contributions[signal] = [
            _stress_contribution(v, m) for v, m in zip(wide[signal], field_mean)
        ]
        present = wide[signal].notna()
        weight_total += present.astype(float) * weight

    weighted_sum = sum(contributions[s] * SIGNAL_WEIGHTS[s] for s in contributions.columns)
    weight_total = weight_total.replace(0, np.nan)
    return (weighted_sum / weight_total).clip(0, 100).fillna(50.0).round()


def train(wide: pd.DataFrame) -> tuple[XGBRegressor, list[str]]:
    feature_cols = [c for c in wide.columns if c.endswith(("_rolling3", "_trend")) or c in FEATURE_COLUMNS]
    y = compute_bootstrap_target(wide)
    X = wide[feature_cols].fillna(wide[feature_cols].median())

    splitter = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=42)
    train_idx, test_idx = next(splitter.split(X, y, groups=wide["field_id"]))

    model = XGBRegressor(
        n_estimators=250,
        max_depth=4,
        learning_rate=0.05,
        objective="reg:squarederror",
    )
    model.fit(X.iloc[train_idx], y.iloc[train_idx])

    predictions = model.predict(X.iloc[test_idx])
    mae = mean_absolute_error(y.iloc[test_idx], predictions)
    r2 = r2_score(y.iloc[test_idx], predictions)
    print("--- held-out evaluation (grouped by field, no leakage) ---")
    print(f"MAE vs rule-based teacher score: {mae:.1f} points (out of 0-100)")
    print(f"R^2: {r2:.3f}")

    return model, feature_cols


def main() -> None:
    long_df = load_long_format(RAW_DATA_DIR)
    wide = pivot_to_wide(long_df)
    wide = engineer_features(wide)

    model, feature_cols = train(wide)

    SAVED_MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, SAVED_MODEL_DIR / "shift_score_model.joblib")
    with open(SAVED_MODEL_DIR / "shift_score_model_features.json", "w") as f:
        json.dump(feature_cols, f, indent=2)

    print(f"\nSaved model + feature list to {SAVED_MODEL_DIR}/")
    print(
        "\nTo wire this into the live API: load this .joblib in "
        "scoring_engine.py behind a settings flag (e.g. USE_ML_SCORER), "
        "and fall back to the existing rule-based _composite_score() "
        "whenever a feature is missing or the model file isn't present "
        "— never let a missing model file take the /shift-advice "
        "endpoint down."
    )


if __name__ == "__main__":
    main()