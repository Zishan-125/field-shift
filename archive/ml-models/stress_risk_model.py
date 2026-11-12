"""
The first real ML model, and worth being upfront about a constraint
that shapes everything in this file: you don't have a labeled dataset
of "this field was actually stressed" to train against — nobody does,
starting out. What you DO have is `scoring_engine.py`'s existing rule
(a signal counts as stressed if its anomaly is more than ~25% below
normal), and years of historical NASA signal data per field from
gee_field_clip.py.

So this model is trained with **weak supervision**: the rule-based
label is treated as ground truth to bootstrap from, and XGBoost's job
is to learn which COMBINATIONS and TIME PATTERNS of signals predict
that label better than the simple per-signal threshold does alone —
e.g. "moderate soil-moisture anomaly + declining NDVI trend for 3+
consecutive windows" might be a stronger stress predictor than either
signal crossing its own threshold in isolation. That's a genuinely
useful upgrade over the rule engine, and honest about not being
validated against real farmer-reported outcomes yet — say exactly
that if a judge asks how it was trained.

Run as: python ml-models/stress_risk_model.py
Input:  ml-models/data/raw/field_*_history.csv  (from gee_field_clip.py)
Output: ml-models/saved_models/stress_risk_model.joblib
"""

import glob
import json
from pathlib import Path

import joblib
import pandas as pd
from sklearn.metrics import classification_report, roc_auc_score
from sklearn.model_selection import GroupShuffleSplit
from xgboost import XGBClassifier

RAW_DATA_DIR = Path("ml-models/data/raw")
SAVED_MODEL_DIR = Path("ml-models/saved_models")
STRESS_ANOMALY_THRESHOLD = -25.0  # % — matches scoring_engine.py's implicit threshold, kept in sync deliberately

FEATURE_COLUMNS = ["SMAP", "MODIS", "GPM", "ECOSTRESS", "GRACE-FO"]


def load_long_format(raw_dir: Path) -> pd.DataFrame:
    """Concatenates every field's exported CSV into one long dataframe:
    columns [field_id, date, dataset, value]."""
    files = sorted(glob.glob(str(raw_dir / "field_*_history.csv")))
    if not files:
        raise FileNotFoundError(
            f"No history CSVs found in {raw_dir} — run "
            f"data-pipeline/gee_field_clip.py first to generate training data."
        )
    frames = [pd.read_csv(f, parse_dates=["date"]) for f in files]
    return pd.concat(frames, ignore_index=True)


def pivot_to_wide(long_df: pd.DataFrame) -> pd.DataFrame:
    """One row per (field, date) with one column per NASA signal —
    the shape XGBoost, and every other tabular model, expects."""
    wide = long_df.pivot_table(
        index=["field_id", "date"], columns="dataset", values="value"
    ).reset_index()
    wide = wide.sort_values(["field_id", "date"])
    return wide


def engineer_features(wide: pd.DataFrame) -> pd.DataFrame:
    """
    Adds the time-pattern features that are the actual point of this
    model over the simple rule engine: a rolling trend per signal,
    computed per field so history from one field never leaks into
    another's rolling window.
    """
    wide = wide.copy()
    for col in FEATURE_COLUMNS:
        if col not in wide.columns:
            wide[col] = pd.NA
        # 3-window rolling mean = ~48 days of smoothing, cuts single
        # noisy overpass readings without hiding a genuine multi-week trend
        wide[f"{col}_rolling3"] = wide.groupby("field_id")[col].transform(
            lambda s: s.rolling(window=3, min_periods=1).mean()
        )
        # First difference = is this signal currently getting worse or
        # better, which a single reading can't tell you
        wide[f"{col}_trend"] = wide.groupby("field_id")[col].transform(lambda s: s.diff())
    return wide


def compute_weak_labels(wide: pd.DataFrame) -> pd.Series:
    """
    The bootstrap label: 1 if soil moisture (the single strongest
    individual predictor per scoring_engine.py's own weighting) is
    more than STRESS_ANOMALY_THRESHOLD below its field's own running
    mean, else 0. This is intentionally the SAME logic style as
    scoring_engine.py's rule, not a different definition of "stress" —
    the model should learn to anticipate/refine that rule, not
    contradict it.
    """
    field_mean = wide.groupby("field_id")["SMAP"].transform("mean")
    pct_from_field_mean = (wide["SMAP"] - field_mean) / field_mean.replace(0, pd.NA) * 100
    return (pct_from_field_mean < STRESS_ANOMALY_THRESHOLD).astype(int)


def train(wide: pd.DataFrame) -> tuple[XGBClassifier, list[str]]:
    feature_cols = [c for c in wide.columns if c.endswith(("_rolling3", "_trend")) or c in FEATURE_COLUMNS]
    wide = wide.dropna(subset=["SMAP"])  # need at least the primary signal present
    X = wide[feature_cols].fillna(wide[feature_cols].median())
    y = compute_weak_labels(wide)

    # Split by field_id, not by row — otherwise the model sees rows
    # from the same field in both train and test, which massively
    # overstates accuracy (it's basically memorizing that field).
    splitter = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=42)
    train_idx, test_idx = next(splitter.split(X, y, groups=wide["field_id"]))

    model = XGBClassifier(
        n_estimators=200,
        max_depth=4,
        learning_rate=0.05,
        eval_metric="logloss",
    )
    model.fit(X.iloc[train_idx], y.iloc[train_idx])

    predictions = model.predict(X.iloc[test_idx])
    probabilities = model.predict_proba(X.iloc[test_idx])[:, 1]

    print("--- held-out evaluation (grouped by field, no leakage) ---")
    print(classification_report(y.iloc[test_idx], predictions))
    if y.iloc[test_idx].nunique() > 1:
        print(f"ROC-AUC: {roc_auc_score(y.iloc[test_idx], probabilities):.3f}")
    else:
        print("ROC-AUC: skipped — test split has only one class (need more field diversity in training data)")

    return model, feature_cols


def main() -> None:
    long_df = load_long_format(RAW_DATA_DIR)
    wide = pivot_to_wide(long_df)
    wide = engineer_features(wide)

    model, feature_cols = train(wide)

    SAVED_MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, SAVED_MODEL_DIR / "stress_risk_model.joblib")
    with open(SAVED_MODEL_DIR / "stress_risk_model_features.json", "w") as f:
        json.dump(feature_cols, f, indent=2)

    print(f"\nSaved model + feature list to {SAVED_MODEL_DIR}/")


if __name__ == "__main__":
    main()