"""
The ML-backed alternative to scoring_engine.py's rule-based
_composite_score(). Everything in this file is designed around one
rule that is non-negotiable: a problem here must NEVER take down the
live /shift-advice endpoint. Missing model file, malformed features,
a version mismatch after retraining — every failure mode falls back
to `None`, and scoring_engine.py is responsible for treating `None`
as "use the rule-based score instead." This file never raises.

Feature order and construction here must match ml-models/
stress_risk_model.py and shift_score_model.py exactly — both trained
on [raw signal] + [3-window rolling mean] + [1-step trend] per source.
If you retrain with different features, update FEATURE_ORDER here too,
or the model will silently receive columns in the wrong order and
produce confident-looking garbage predictions with no error at all.
"""

import logging
from pathlib import Path

import joblib
import numpy as np

from app.core.config import settings

logger = logging.getLogger(__name__)

SOURCES = ["SMAP", "MODIS", "GPM", "ECOSTRESS", "GRACE-FO"]
# Must match the column order stress_risk_model.py / shift_score_model.py
# trained on: raw values first, then _rolling3, then _trend, both in
# the same SOURCES order.
FEATURE_ORDER = (
    SOURCES
    + [f"{s}_rolling3" for s in SOURCES]
    + [f"{s}_trend" for s in SOURCES]
)

_stress_model = None
_shift_score_model = None
_models_loaded = False


def _load_models() -> None:
    """Lazy, once-per-process load. A missing/corrupt model file is
    logged and leaves the relevant model as None — checked by every
    public function below before use."""
    global _stress_model, _shift_score_model, _models_loaded
    if _models_loaded:
        return

    model_dir = Path(settings.ML_MODEL_DIR)
    try:
        _stress_model = joblib.load(model_dir / "stress_risk_model.joblib")
    except (FileNotFoundError, OSError) as exc:
        logger.warning("stress_risk_model not available (%s) — ML stress path disabled", exc)

    try:
        _shift_score_model = joblib.load(model_dir / "shift_score_model.joblib")
    except (FileNotFoundError, OSError) as exc:
        logger.warning("shift_score_model not available (%s) — falling back to rule-based scorer", exc)

    _models_loaded = True


def build_feature_vector(current_values: dict[str, float], history: dict[str, list[float]]) -> np.ndarray | None:
    """
    current_values: {"SMAP": 0.24, "MODIS": 0.51, ...} — this scoring run's live readings
    history: {"SMAP": [older, ..., newest_before_this], ...} — from SignalReading,
             most recent last, NOT including current_values

    Rolling-3 and trend are computed the same way for a field with rich
    history and a brand-new field with none: recent-history-aware where
    data exists, degrading gracefully to "just the current value" where
    it doesn't. That degradation is a deliberate, documented
    approximation for new fields — accuracy improves automatically as
    SignalReading accumulates real history, with no code change needed.
    """
    if any(source not in current_values for source in SOURCES):
        return None  # a live NASA pull is missing a required signal entirely — don't guess

    features = []
    for source in SOURCES:
        features.append(current_values[source])

    for source in SOURCES:
        recent = (history.get(source) or []) + [current_values[source]]
        window = recent[-3:]
        features.append(sum(window) / len(window))

    for source in SOURCES:
        recent = (history.get(source) or []) + [current_values[source]]
        trend = recent[-1] - recent[-2] if len(recent) >= 2 else 0.0
        features.append(trend)

    return np.array(features, dtype=np.float32).reshape(1, -1)


def predict_shift_score(feature_vector: np.ndarray) -> int | None:
    _load_models()
    if _shift_score_model is None:
        return None
    try:
        prediction = _shift_score_model.predict(feature_vector)[0]
        return int(round(float(np.clip(prediction, 0, 100))))
    except Exception as exc:  # noqa: BLE001 — deliberately broad: ANY ML failure must fall back, never propagate
        logger.warning("shift_score_model prediction failed (%s) — falling back to rule-based scorer", exc)
        return None


def predict_stress_probability(feature_vector: np.ndarray) -> float | None:
    """Not currently surfaced in the API response — kept available for
    a future 'stress risk' badge without needing another model-loading
    path when that's built."""
    _load_models()
    if _stress_model is None:
        return None
    try:
        return float(_stress_model.predict_proba(feature_vector)[0][1])
    except Exception as exc:  # noqa: BLE001
        logger.warning("stress_risk_model prediction failed (%s)", exc)
        return None