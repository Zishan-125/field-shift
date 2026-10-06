"""
FIELD SHIFT — Scientific Normalization Utilities

Purpose
-------
Convert heterogeneous environmental indicators into bounded
[0, 1] suitability scores.

IMPORTANT
---------
These functions distinguish between:

1. Raw environmental measurements
2. Stress/anomaly indicators
3. Suitability scores

A score of 1.0 means higher suitability for the corresponding
decision objective.

A score of 0.0 means lower suitability.

This module does NOT claim that a normalized score is a
probability, yield prediction, causal effect, or observed
agronomic outcome.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import math


EPSILON = 1e-12


def clamp01(value: float) -> float:
    """
    Clamp a numeric value into [0, 1].

    Non-finite values are rejected instead of silently becoming
    zero because missing observations must not be interpreted
    as environmental failure.
    """

    value = float(value)

    if not math.isfinite(value):
        raise ValueError(
            f"Cannot normalize non-finite value: {value}"
        )

    return max(0.0, min(1.0, value))


def minmax(
    value: float,
    minimum: float,
    maximum: float,
) -> float:
    """
    Standard min-max normalization.

    x_norm = (x - min) / (max - min)

    Output:
        0 -> minimum
        1 -> maximum
    """

    value = float(value)
    minimum = float(minimum)
    maximum = float(maximum)

    if not all(
        math.isfinite(v)
        for v in (value, minimum, maximum)
    ):
        raise ValueError(
            "minmax received a non-finite value."
        )

    if maximum <= minimum:
        raise ValueError(
            "Normalization maximum must be greater "
            "than minimum."
        )

    return clamp01(
        (value - minimum)
        / (maximum - minimum)
    )


def inverse_minmax(
    value: float,
    minimum: float,
    maximum: float,
) -> float:
    """
    Inverse min-max normalization.

    Used when LOWER raw values indicate BETTER suitability.

    x_norm = 1 - ((x - min) / (max - min))
    """

    return clamp01(
        1.0
        - minmax(
            value,
            minimum,
            maximum,
        )
    )


def zscore(
    value: float,
    mean: float,
    std: float,
) -> float:
    """
    Standard z-score.

    z = (x - mean) / std

    This returns an unbounded anomaly value.

    It should NOT be used directly as a suitability score.
    """

    value = float(value)
    mean = float(mean)
    std = float(std)

    if not all(
        math.isfinite(v)
        for v in (value, mean, std)
    ):
        raise ValueError(
            "zscore received a non-finite value."
        )

    if std <= EPSILON:
        raise ValueError(
            "Standard deviation must be positive."
        )

    return (value - mean) / std


def sigmoid(
    value: float,
    midpoint: float = 0.0,
    scale: float = 1.0,
) -> float:
    """
    Convert an unbounded anomaly/stress value into [0, 1].

    This is useful when an environmental indicator is naturally
    represented as a continuous anomaly.

    Higher positive values approach 1.

    IMPORTANT:
        This function alone does not define whether a positive
        anomaly is good or bad. Direction must be chosen by the
        calling function.
    """

    value = float(value)
    midpoint = float(midpoint)
    scale = float(scale)

    if scale <= EPSILON:
        raise ValueError(
            "Sigmoid scale must be positive."
        )

    exponent = -(
        (value - midpoint) / scale
    )

    exponent = max(
        -60.0,
        min(60.0, exponent),
    )

    return 1.0 / (
        1.0 + math.exp(exponent)
    )


def stress_to_suitability(
    stress: float,
    low_stress: float,
    high_stress: float,
) -> float:
    """
    Convert a stress indicator into suitability.

    LOW stress -> HIGH suitability
    HIGH stress -> LOW suitability

    stress = low_stress  -> 1.0
    stress = high_stress -> 0.0
    """

    return inverse_minmax(
        stress,
        low_stress,
        high_stress,
    )


def anomaly_to_resilience(
    anomaly: float,
    tolerance: float,
) -> float:
    """
    Convert absolute environmental anomaly into a resilience
    suitability score.

    anomaly near 0 -> high suitability
    large anomaly -> lower suitability

    The function is symmetric around the reference condition.

    Example:
        anomaly = 0       -> 1.0
        anomaly = ±tolerance -> 0.0
    """

    anomaly = abs(float(anomaly))
    tolerance = float(tolerance)

    if tolerance <= EPSILON:
        raise ValueError(
            "Tolerance must be positive."
        )

    return clamp01(
        1.0 - anomaly / tolerance
    )


def weighted_score(
    scores: dict[str, float],
    weights: dict[str, float],
) -> float:
    """
    Weighted combination of already-normalized scores.

    The function normalizes the supplied weights first.

    Every score must already be in [0, 1].
    """

    if not scores:
        raise ValueError(
            "At least one score is required."
        )

    if set(scores) != set(weights):
        raise ValueError(
            "Scores and weights must contain "
            "the same keys."
        )

    clean_scores = {
        key: clamp01(value)
        for key, value in scores.items()
    }

    clean_weights = {
        key: max(0.0, float(value))
        for key, value in weights.items()
    }

    total_weight = sum(
        clean_weights.values()
    )

    if total_weight <= EPSILON:
        raise ValueError(
            "At least one weight must be greater than zero."
        )

    normalized_weights = {
        key: value / total_weight
        for key, value in clean_weights.items()
    }

    return sum(
        clean_scores[key]
        * normalized_weights[key]
        for key in clean_scores
    )


@dataclass(frozen=True)
class NormalizedIndicator:
    """
    Auditable representation of a normalized indicator.
    """

    name: str
    raw_value: float
    score: float
    direction: str
    transformation: str
    unit: Optional[str] = None

    def as_dict(self) -> dict:
        return {
            "name": self.name,
            "raw_value": self.raw_value,
            "score": self.score,
            "direction": self.direction,
            "transformation": self.transformation,
            "unit": self.unit,
        }