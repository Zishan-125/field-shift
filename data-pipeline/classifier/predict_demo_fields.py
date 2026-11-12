"""
FIELD SHIFT — classifier labels for the six demo fields (season timeline only)

Applies the trained LightGBM model (train_lightgbm.py) to the demo-field
dekads. Used ONLY for the "What satellites saw on six Feni fields" timeline,
never in the pattern ranking (docs/ml/crop_classifier.md).

Output: data-pipeline/derived/demo_field_predictions.csv
    field_id, season, year, predicted, confidence, uncertain

Run:
    python data-pipeline/classifier/predict_demo_fields.py
"""

from __future__ import annotations

import sys
from pathlib import Path

import lightgbm as lgb
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "data-pipeline" / "classifier"))

from features import build_samples, feature_columns  # noqa: E402
from train_lightgbm import CLASSES, MODEL_DIR, predict  # noqa: E402

UNCERTAIN_BELOW = 0.6


def main() -> None:
    dekads = pd.read_csv(ROOT / "data-pipeline" / "data" / "processed" / "demo_field_dekads.csv")
    samples = build_samples(dekads)
    model = lgb.Booster(model_file=str(MODEL_DIR / "lightgbm.txt"))
    proba = predict(model, samples, feature_columns(samples))

    out = samples[["point_id", "season", "year"]].rename(columns={"point_id": "field_id"})
    out["predicted"] = [CLASSES[i] for i in proba.argmax(axis=1)]
    out["confidence"] = proba.max(axis=1).round(3)
    out["uncertain"] = (out["confidence"] < UNCERTAIN_BELOW).astype(int)
    path = ROOT / "data-pipeline" / "derived" / "demo_field_predictions.csv"
    out.to_csv(path, index=False)
    print(out.pivot_table(index=["season", "year"], columns="field_id", values="predicted", aggfunc="first").to_string())


if __name__ == "__main__":
    main()
