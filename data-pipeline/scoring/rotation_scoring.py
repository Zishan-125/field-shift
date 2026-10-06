"""
FIELD SHIFT — Rotation Scoring

This module defines the scientific contract between environmental
indicators and the four farmer-facing decision dimensions:

1. Water conservation
2. Soil health
3. Climate resilience
4. Crop diversity

The outputs are scenario indicators in [0, 1].

They are NOT:
    - crop yield predictions
    - profit predictions
    - causal treatment effects
    - irrigation requirements
    - probabilities of success
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from .normalization import (
    anomaly_to_resilience,
    clamp01,
    inverse_minmax,
    minmax,
    stress_to_suitability,
)


@dataclass(frozen=True)
class EnvironmentalReference:
    """
    Reference ranges used for documented normalization.

    IMPORTANT:
    These bounds should come from the empirical Feni
    reference period / validated domain literature rather
    than arbitrary UI values.
    """

    soil_moisture_low: float
    soil_moisture_high: float

    rainfall_deficit_low: float
    rainfall_deficit_high: float

    temperature_anomaly_tolerance: float

    thermal_stress_low: float
    thermal_stress_high: float


def water_conservation_score(
    *,
    crop_water_requirement: float,
    soil_moisture: Optional[float],
    rainfall_deficit: Optional[float],
    reference: EnvironmentalReference,
) -> float:
    """
    Estimate a water-conservation suitability indicator.

    Components:

    1. Crop water requirement:
       lower requirement -> higher water-conservation suitability.

    2. Soil moisture:
       greater available root-zone moisture -> lower water stress.

    3. Rainfall deficit:
       greater deficit -> greater water stress.

    Missing observations are excluded rather than interpreted
    as zero.
    """

    components: list[float] = []

    # Lower crop water requirement is preferred.
    components.append(
        inverse_minmax(
            crop_water_requirement,
            0.0,
            max(
                crop_water_requirement,
                1.0,
            ),
        )
    )

    if soil_moisture is not None:
        components.append(
            minmax(
                soil_moisture,
                reference.soil_moisture_low,
                reference.soil_moisture_high,
            )
        )

    if rainfall_deficit is not None:
        components.append(
            stress_to_suitability(
                rainfall_deficit,
                reference.rainfall_deficit_low,
                reference.rainfall_deficit_high,
            )
        )

    if not components:
        raise ValueError(
            "No valid water indicators available."
        )

    return clamp01(
        sum(components)
        / len(components)
    )


def climate_resilience_score(
    *,
    temperature_anomaly: Optional[float],
    thermal_stress: Optional[float],
    reference: EnvironmentalReference,
) -> float:
    """
    Estimate climate-resilience suitability.

    Smaller absolute climate anomalies and lower thermal stress
    correspond to higher suitability.

    This intentionally does NOT claim that a rotation causes
    resilience. It represents environmental compatibility
    under the current scenario.
    """

    components: list[float] = []

    if temperature_anomaly is not None:
        components.append(
            anomaly_to_resilience(
                temperature_anomaly,
                reference.temperature_anomaly_tolerance,
            )
        )

    if thermal_stress is not None:
        components.append(
            stress_to_suitability(
                thermal_stress,
                reference.thermal_stress_low,
                reference.thermal_stress_high,
            )
        )

    if not components:
        raise ValueError(
            "No valid climate indicators available."
        )

    return clamp01(
        sum(components)
        / len(components)
    )


def soil_health_score(
    *,
    crop_soil_contribution: float,
) -> float:
    """
    Use the validated crop/rotation soil contribution.

    The supplied value must already have a documented
    transformation into [0, 1].
    """

    return clamp01(
        crop_soil_contribution
    )


def crop_diversity_score(
    *,
    unique_crop_count: int,
    maximum_supported_crop_count: int,
) -> float:
    """
    Convert number of unique crops in a rotation to a bounded
    diversity indicator.

    This is intentionally a simple structural diversity measure.

    It should not be described as biodiversity or ecosystem
    biodiversity.
    """

    if unique_crop_count < 1:
        return 0.0

    if maximum_supported_crop_count < 1:
        raise ValueError(
            "maximum_supported_crop_count must be positive."
        )

    return clamp01(
        unique_crop_count
        / maximum_supported_crop_count
    )