"""
FIELD SHIFT — Farmer Priority Scenario Evaluator v2

Purpose
-------
Evaluate previously generated crop-rotation scenarios according to
farmer-defined priorities using:

    1. Historical environmental context
    2. Field-level soil context
    3. Crop-profile scenario priors
    4. Rotation structure
    5. Farmer-controlled priority weights

IMPORTANT
---------
This is a transparent decision-support layer.

It does NOT:
    - predict crop yield
    - create synthetic yield labels
    - claim an agronomic optimum
    - require internet access at runtime

The resulting score is a farmer-preference-weighted
scenario indicator.

Inputs
------
data-pipeline/output/features/agricultural_features_2019_2024.csv
data-pipeline/output/crop/crop_profiles.csv
data-pipeline/output/scenarios/rotation_scenarios.csv

Output
------
data-pipeline/output/scenarios/evaluated_rotation_scenarios.csv

Methodology
-----------
farmer_priority_v2

Default farmer priorities:
    water_conservation : 0.40
    soil_health        : 0.30
    climate_resilience : 0.20
    crop_diversity     : 0.10
"""

from __future__ import annotations

from pathlib import Path
from typing import Dict, List

import numpy as np
import pandas as pd


# ============================================================
# CONFIGURATION
# ============================================================

METHODOLOGY_VERSION = "farmer_priority_v2"

DEFAULT_PRIORITIES = {
    "water_conservation": 0.40,
    "soil_health": 0.30,
    "climate_resilience": 0.20,
    "crop_diversity": 0.10,
}

BASE_DIR = Path(__file__).resolve().parent

AGRICULTURAL_FEATURES = (
    BASE_DIR
    / "output"
    / "features"
    / "agricultural_features_2019_2024.csv"
)

CROP_PROFILES = (
    BASE_DIR
    / "output"
    / "crop"
    / "crop_profiles.csv"
)

ROTATION_SCENARIOS = (
    BASE_DIR
    / "output"
    / "scenarios"
    / "rotation_scenarios.csv"
)

OUTPUT_DIR = (
    BASE_DIR
    / "output"
    / "scenarios"
)

OUTPUT_FILE = (
    OUTPUT_DIR
    / "evaluated_rotation_scenarios.csv"
)


# ============================================================
# REQUIRED COLUMNS
# ============================================================

REQUIRED_AGRICULTURAL_COLUMNS = [
    "field_id",
    "observation_month",

    "ag_rainfall_mm",
    "ag_soil_moisture",

    "ag_environmental_resilience_proxy",

    "soil_topsoil_fertility_proxy",

    "rainfall_available",
    "soil_moisture_available",
]

REQUIRED_CROP_COLUMNS = [
    "crop_id",
    "crop_name",

    "water_demand_index",
    "drought_tolerance",
    "heat_tolerance",
    "waterlogging_tolerance",

    "soil_fertility_dependency",

    "rotation_group",
    "legume",
]

REQUIRED_ROTATION_COLUMNS = [
    "rotation_id",

    "crop_1_id",
    "crop_1_name",

    "crop_2_id",
    "crop_2_name",

    "crop_3_id",
    "crop_3_name",

    "legume_in_rotation",

    "rotation_environmental_compatibility",
    "rotation_diversity_score",
]


# ============================================================
# GENERAL UTILITIES
# ============================================================

def require_columns(
    df: pd.DataFrame,
    required: List[str],
    dataset_name: str,
) -> None:

    missing = [
        column
        for column in required
        if column not in df.columns
    ]

    if missing:
        raise ValueError(
            f"{dataset_name} is missing required columns:\n"
            + "\n".join(
                f"  - {column}"
                for column in missing
            )
        )


def numeric(
    series: pd.Series,
) -> pd.Series:

    return pd.to_numeric(
        series,
        errors="coerce",
    )


def minmax_normalize(
    series: pd.Series,
    neutral_value: float = 0.5,
) -> pd.Series:
    """
    Normalize a historical numeric series to [0,1].

    Missing values remain missing.

    If all valid observations are identical,
    valid observations receive neutral_value.
    """

    values = numeric(series)

    valid = values.dropna()

    if valid.empty:
        result = pd.Series(
            np.nan,
            index=series.index,
            dtype=float,
        )
        return result

    minimum = valid.min()
    maximum = valid.max()

    if np.isclose(
        minimum,
        maximum,
    ):
        result = pd.Series(
            neutral_value,
            index=series.index,
            dtype=float,
        )

        result.loc[
            values.isna()
        ] = np.nan

        return result

    result = (
        values - minimum
    ) / (
        maximum - minimum
    )

    return result.clip(
        0.0,
        1.0,
    )


def safe_mean(
    series: pd.Series,
    default: float = 0.5,
) -> float:

    values = numeric(series).dropna()

    if values.empty:
        return float(default)

    value = float(
        values.mean()
    )

    if not np.isfinite(value):
        return float(default)

    return float(
        np.clip(
            value,
            0.0,
            1.0,
        )
    )


def normalize_priorities(
    priorities: Dict[str, float],
) -> Dict[str, float]:

    expected = set(
        DEFAULT_PRIORITIES.keys()
    )

    unknown = (
        set(priorities.keys())
        - expected
    )

    if unknown:
        raise ValueError(
            "Unknown farmer priority keys: "
            + ", ".join(
                sorted(unknown)
            )
        )

    merged = (
        DEFAULT_PRIORITIES.copy()
    )

    merged.update(
        priorities
    )

    clean = {}

    for key, value in merged.items():

        value = float(value)

        if not np.isfinite(value):
            raise ValueError(
                f"Priority '{key}' "
                "must be finite."
            )

        if value < 0:
            raise ValueError(
                f"Priority '{key}' "
                "cannot be negative."
            )

        clean[key] = value

    total = sum(
        clean.values()
    )

    if total <= 0:
        raise ValueError(
            "At least one farmer "
            "priority must be > 0."
        )

    return {
        key: value / total
        for key, value in clean.items()
    }


# ============================================================
# LOAD INPUTS
# ============================================================

def load_inputs():

    print(
        "\nFIELD SHIFT — FARMER PRIORITY "
        "SCENARIO EVALUATOR v2"
    )

    print("=" * 64)

    for path, label in [
        (
            AGRICULTURAL_FEATURES,
            "Agricultural features",
        ),
        (
            CROP_PROFILES,
            "Crop profiles",
        ),
        (
            ROTATION_SCENARIOS,
            "Rotation scenarios",
        ),
    ]:

        if not path.exists():
            raise FileNotFoundError(
                f"{label} file not found:\n"
                f"{path}"
            )

    agricultural = pd.read_csv(
        AGRICULTURAL_FEATURES
    )

    crops = pd.read_csv(
        CROP_PROFILES
    )

    rotations = pd.read_csv(
        ROTATION_SCENARIOS
    )

    print(
        f"[INPUT] Agricultural features: "
        f"{agricultural.shape}"
    )

    print(
        f"[INPUT] Crop profiles: "
        f"{crops.shape}"
    )

    print(
        f"[INPUT] Rotation scenarios: "
        f"{rotations.shape}"
    )

    require_columns(
        agricultural,
        REQUIRED_AGRICULTURAL_COLUMNS,
        "Agricultural features",
    )

    require_columns(
        crops,
        REQUIRED_CROP_COLUMNS,
        "Crop profiles",
    )

    require_columns(
        rotations,
        REQUIRED_ROTATION_COLUMNS,
        "Rotation scenarios",
    )

    print(
        "[OK] Input schemas validated."
    )

    return (
        agricultural,
        crops,
        rotations,
    )


# ============================================================
# BUILD HISTORICAL FIELD CONTEXT
# ============================================================

def build_historical_context(
    agricultural: pd.DataFrame,
) -> Dict[str, float]:

    print(
        "\nBUILDING HISTORICAL FIELD CONTEXT"
    )

    print("-" * 64)

    df = agricultural.copy()

    # --------------------------------------------------------
    # Historical rainfall context
    # --------------------------------------------------------

    rainfall = numeric(
        df["ag_rainfall_mm"]
    )

    rainfall_normalized = (
        minmax_normalize(
            rainfall
        )
    )

    # --------------------------------------------------------
    # Historical soil moisture context
    # --------------------------------------------------------

    soil_moisture = numeric(
        df["ag_soil_moisture"]
    )

    soil_moisture_normalized = (
        minmax_normalize(
            soil_moisture
        )
    )

    # --------------------------------------------------------
    # Water availability context
    #
    # Both rainfall and soil moisture are used.
    #
    # We only average observations that actually exist.
    # --------------------------------------------------------

    water_context_components = pd.concat(
        [
            rainfall_normalized.rename(
                "rainfall"
            ),
            soil_moisture_normalized.rename(
                "soil_moisture"
            ),
        ],
        axis=1,
    )

    water_availability_history = (
        water_context_components.mean(
            axis=1,
            skipna=True,
        )
    )

    historical_water_context = safe_mean(
        water_availability_history
    )

    # --------------------------------------------------------
    # Environmental resilience context
    #
    # This may be an anomaly/proxy rather than a [0,1]
    # variable, so normalize it first.
    # --------------------------------------------------------

    environmental_resilience = numeric(
        df[
            "ag_environmental_resilience_proxy"
        ]
    )

    environmental_resilience_normalized = (
        minmax_normalize(
            environmental_resilience
        )
    )

    historical_climate_context = safe_mean(
        environmental_resilience_normalized
    )

    # --------------------------------------------------------
    # Soil fertility context
    #
    # Again normalize before treating it as a score.
    # --------------------------------------------------------

    soil_fertility = numeric(
        df[
            "soil_topsoil_fertility_proxy"
        ]
    )

    soil_fertility_normalized = (
        minmax_normalize(
            soil_fertility
        )
    )

    historical_soil_context = safe_mean(
        soil_fertility_normalized
    )

    # --------------------------------------------------------
    # Availability rates
    # --------------------------------------------------------

    rainfall_available = (
        numeric(
            df[
                "rainfall_available"
            ]
        )
        .fillna(0)
        .astype(int)
    )

    soil_moisture_available = (
        numeric(
            df[
                "soil_moisture_available"
            ]
        )
        .fillna(0)
        .astype(int)
    )

    rainfall_coverage = float(
        rainfall_available.mean()
    )

    soil_moisture_coverage = float(
        soil_moisture_available.mean()
    )

    print(
        f"  Rainfall coverage: "
        f"{rainfall_coverage:.3f}"
    )

    print(
        f"  Soil-moisture coverage: "
        f"{soil_moisture_coverage:.3f}"
    )

    print(
        f"  Historical water context: "
        f"{historical_water_context:.4f}"
    )

    print(
        f"  Historical climate context: "
        f"{historical_climate_context:.4f}"
    )

    print(
        f"  Historical soil context: "
        f"{historical_soil_context:.4f}"
    )

    return {
        "water_context": (
            historical_water_context
        ),
        "climate_context": (
            historical_climate_context
        ),
        "soil_context": (
            historical_soil_context
        ),
        "rainfall_coverage": (
            rainfall_coverage
        ),
        "soil_moisture_coverage": (
            soil_moisture_coverage
        ),
    }


# ============================================================
# CROP LOOKUP
# ============================================================

def build_crop_lookup(
    crops: pd.DataFrame,
) -> Dict[str, Dict]:

    if crops[
        "crop_id"
    ].duplicated().any():

        duplicates = (
            crops.loc[
                crops[
                    "crop_id"
                ].duplicated(),
                "crop_id",
            ]
            .astype(str)
            .unique()
            .tolist()
        )

        raise ValueError(
            "Duplicate crop IDs: "
            + ", ".join(
                duplicates
            )
        )

    lookup = {}

    for _, row in crops.iterrows():

        crop_id = str(
            row["crop_id"]
        )

        lookup[crop_id] = {
            "crop_name": row[
                "crop_name"
            ],

            "water_demand_index": float(
                row[
                    "water_demand_index"
                ]
            ),

            "drought_tolerance": float(
                row[
                    "drought_tolerance"
                ]
            ),

            "heat_tolerance": float(
                row[
                    "heat_tolerance"
                ]
            ),

            "waterlogging_tolerance": float(
                row[
                    "waterlogging_tolerance"
                ]
            ),

            "soil_fertility_dependency": float(
                row[
                    "soil_fertility_dependency"
                ]
            ),

            "rotation_group": row[
                "rotation_group"
            ],

            "legume": int(
                row["legume"]
            ),
        }

    return lookup


# ============================================================
# EXTRACT CROPS FROM ROTATION
# ============================================================

def get_rotation_crop_ids(
    row: pd.Series,
) -> List[str]:

    crop_ids = []

    for column in [
        "crop_1_id",
        "crop_2_id",
        "crop_3_id",
    ]:

        value = row.get(
            column
        )

        if pd.isna(value):
            continue

        value = str(
            value
        ).strip()

        if value:
            crop_ids.append(
                value
            )

    return crop_ids


# ============================================================
# CALCULATE SCENARIO COMPONENTS
# ============================================================

def calculate_scenario_components(
    agricultural: pd.DataFrame,
    crops: pd.DataFrame,
    rotations: pd.DataFrame,
    context: Dict[str, float],
) -> pd.DataFrame:

    crop_lookup = (
        build_crop_lookup(
            crops
        )
    )

    results = []

    for _, rotation in rotations.iterrows():

        rotation_id = str(
            rotation[
                "rotation_id"
            ]
        )

        crop_ids = (
            get_rotation_crop_ids(
                rotation
            )
        )

        if not crop_ids:
            raise ValueError(
                f"Rotation '{rotation_id}' "
                "contains no crops."
            )

        profiles = []

        for crop_id in crop_ids:

            if crop_id not in crop_lookup:
                raise ValueError(
                    f"Crop '{crop_id}' "
                    f"from rotation "
                    f"'{rotation_id}' "
                    "is missing from "
                    "crop profiles."
                )

            profiles.append(
                crop_lookup[
                    crop_id
                ]
            )

        # ----------------------------------------------------
        # Crop characteristics
        # ----------------------------------------------------

        water_demand = np.array(
            [
                profile[
                    "water_demand_index"
                ]
                for profile in profiles
            ],
            dtype=float,
        )

        drought = np.array(
            [
                profile[
                    "drought_tolerance"
                ]
                for profile in profiles
            ],
            dtype=float,
        )

        heat = np.array(
            [
                profile[
                    "heat_tolerance"
                ]
                for profile in profiles
            ],
            dtype=float,
        )

        waterlogging = np.array(
            [
                profile[
                    "waterlogging_tolerance"
                ]
                for profile in profiles
            ],
            dtype=float,
        )

        fertility_dependency = np.array(
            [
                profile[
                    "soil_fertility_dependency"
                ]
                for profile in profiles
            ],
            dtype=float,
        )

        legume = np.array(
            [
                profile[
                    "legume"
                ]
                for profile in profiles
            ],
            dtype=float,
        )

        # ----------------------------------------------------
        # Water conservation
        #
        # Low crop water demand increases conservation.
        #
        # Historical water context modifies the indicator:
        #
        # If historical water availability is relatively low,
        # low-water-demand rotations receive greater value.
        #
        # This is still a scenario indicator, NOT irrigation
        # requirement prediction.
        # ----------------------------------------------------

        mean_water_demand = float(
            np.nanmean(
                water_demand
            )
        )

        crop_water_efficiency = (
            1.0
            - np.clip(
                mean_water_demand,
                0.0,
                1.0,
            )
        )

        historical_water_scarcity = (
            1.0
            - context[
                "water_context"
            ]
        )

        water_conservation_score = (
            0.70
            * crop_water_efficiency
            + 0.30
            * (
                crop_water_efficiency
                * historical_water_scarcity
                + (
                    1.0
                    - historical_water_scarcity
                )
                * 0.5
            )
        )

        # ----------------------------------------------------
        # Legume score
        # ----------------------------------------------------

        legume_score = float(
            np.nanmean(
                legume
            )
        )

        # ----------------------------------------------------
        # Rotation diversity
        # ----------------------------------------------------

        rotation_groups = [
            profile[
                "rotation_group"
            ]
            for profile in profiles
        ]

        unique_groups = len(
            set(
                rotation_groups
            )
        )

        crop_count = len(
            rotation_groups
        )

        calculated_diversity = (
            unique_groups
            / crop_count
            if crop_count
            else 0.0
        )

        existing_diversity = float(
            rotation[
                "rotation_diversity_score"
            ]
        )

        rotation_diversity_score = float(
            np.clip(
                (
                    0.5
                    * calculated_diversity
                    + 0.5
                    * existing_diversity
                ),
                0.0,
                1.0,
            )
        )

        # ----------------------------------------------------
        # Soil health
        #
        # Combines:
        #   historical soil context
        #   legume contribution
        #   rotation diversity
        #   fertility-demand balance
        # ----------------------------------------------------

        mean_fertility_dependency = float(
            np.nanmean(
                fertility_dependency
            )
        )

        fertility_demand_balance = (
            1.0
            - np.clip(
                mean_fertility_dependency,
                0.0,
                1.0,
            )
        )

        soil_health_score = (
            0.40
            * context[
                "soil_context"
            ]
            + 0.30
            * legume_score
            + 0.20
            * rotation_diversity_score
            + 0.10
            * fertility_demand_balance
        )

        # ----------------------------------------------------
        # Climate resilience
        #
        # Combines crop tolerances, existing rotation
        # environmental compatibility, and normalized
        # historical environmental resilience context.
        # ----------------------------------------------------

        drought_score = float(
            np.nanmean(
                drought
            )
        )

        heat_score = float(
            np.nanmean(
                heat
            )
        )

        waterlogging_score = float(
            np.nanmean(
                waterlogging
            )
        )

        environmental_compatibility = float(
            rotation[
                "rotation_environmental_compatibility"
            ]
        )

        climate_resilience_score = (
            0.20
            * drought_score
            + 0.20
            * heat_score
            + 0.15
            * waterlogging_score
            + 0.25
            * environmental_compatibility
            + 0.20
            * context[
                "climate_context"
            ]
        )

        # ----------------------------------------------------
        # Build output row
        # ----------------------------------------------------

        result = {
            "rotation_id": rotation[
                "rotation_id"
            ],

            "crop_1_id": rotation[
                "crop_1_id"
            ],

            "crop_1_name": rotation[
                "crop_1_name"
            ],

            "crop_2_id": rotation[
                "crop_2_id"
            ],

            "crop_2_name": rotation[
                "crop_2_name"
            ],

            "crop_3_id": rotation[
                "crop_3_id"
            ],

            "crop_3_name": rotation[
                "crop_3_name"
            ],

            "legume_in_rotation": int(
                rotation[
                    "legume_in_rotation"
                ]
            ),

            # Scenario indicators
            "water_conservation_score":
                float(
                    np.clip(
                        water_conservation_score,
                        0.0,
                        1.0,
                    )
                ),

            "soil_health_score":
                float(
                    np.clip(
                        soil_health_score,
                        0.0,
                        1.0,
                    )
                ),

            "climate_resilience_score":
                float(
                    np.clip(
                        climate_resilience_score,
                        0.0,
                        1.0,
                    )
                ),

            "crop_diversity_score":
                rotation_diversity_score,

            "drought_resilience_score":
                float(
                    np.clip(
                        drought_score,
                        0.0,
                        1.0,
                    )
                ),

            "heat_resilience_score":
                float(
                    np.clip(
                        heat_score,
                        0.0,
                        1.0,
                    )
                ),

            "waterlogging_resilience_score":
                float(
                    np.clip(
                        waterlogging_score,
                        0.0,
                        1.0,
                    )
                ),

            "environmental_compatibility_score":
                float(
                    np.clip(
                        environmental_compatibility,
                        0.0,
                        1.0,
                    )
                ),

            "legume_score":
                float(
                    np.clip(
                        legume_score,
                        0.0,
                        1.0,
                    )
                ),

            "rotation_diversity_score":
                rotation_diversity_score,

            # Historical contexts
            "historical_water_context":
                context[
                    "water_context"
                ],

            "historical_soil_context":
                context[
                    "soil_context"
                ],

            "historical_climate_context":
                context[
                    "climate_context"
                ],

            "rainfall_coverage":
                context[
                    "rainfall_coverage"
                ],

            "soil_moisture_coverage":
                context[
                    "soil_moisture_coverage"
                ],

            # Reproducibility
            "methodology_version":
                METHODOLOGY_VERSION,

            "score_type":
                "scenario_indicator_not_yield_prediction",

            "synthetic_yield_target":
                0,

            "internet_required":
                0,
        }

        results.append(
            result
        )

    return pd.DataFrame(
        results
    )


# ============================================================
# APPLY FARMER PRIORITIES
# ============================================================

def apply_farmer_priorities(
    scenarios: pd.DataFrame,
    priorities: Dict[str, float],
) -> pd.DataFrame:

    priorities = normalize_priorities(
        priorities
    )

    print(
        "\nNORMALIZED FARMER PRIORITIES"
    )

    for key, value in priorities.items():

        print(
            f"  {key}: "
            f"{value:.4f}"
        )

    # --------------------------------------------------------
    # Individual weighted contributions
    # --------------------------------------------------------

    scenarios[
        "priority_water_contribution"
    ] = (
        scenarios[
            "water_conservation_score"
        ]
        * priorities[
            "water_conservation"
        ]
    )

    scenarios[
        "priority_soil_contribution"
    ] = (
        scenarios[
            "soil_health_score"
        ]
        * priorities[
            "soil_health"
        ]
    )

    scenarios[
        "priority_climate_contribution"
    ] = (
        scenarios[
            "climate_resilience_score"
        ]
        * priorities[
            "climate_resilience"
        ]
    )

    scenarios[
        "priority_diversity_contribution"
    ] = (
        scenarios[
            "crop_diversity_score"
        ]
        * priorities[
            "crop_diversity"
        ]
    )

    # --------------------------------------------------------
    # Final farmer-controlled score
    # --------------------------------------------------------

    scenarios[
        "farmer_priority_score"
    ] = (
        scenarios[
            "priority_water_contribution"
        ]
        + scenarios[
            "priority_soil_contribution"
        ]
        + scenarios[
            "priority_climate_contribution"
        ]
        + scenarios[
            "priority_diversity_contribution"
        ]
    )

    scenarios[
        "farmer_priority_score"
    ] = scenarios[
        "farmer_priority_score"
    ].clip(
        0.0,
        1.0,
    )

    # --------------------------------------------------------
    # Store exact weights
    # --------------------------------------------------------

    scenarios[
        "priority_weight_water_conservation"
    ] = priorities[
        "water_conservation"
    ]

    scenarios[
        "priority_weight_soil_health"
    ] = priorities[
        "soil_health"
    ]

    scenarios[
        "priority_weight_climate_resilience"
    ] = priorities[
        "climate_resilience"
    ]

    scenarios[
        "priority_weight_crop_diversity"
    ] = priorities[
        "crop_diversity"
    ]

    scenarios[
        "priority_profile"
    ] = (
        "water_"
        + str(
            round(
                priorities[
                    "water_conservation"
                ],
                2,
            )
        )
        + "_soil_"
        + str(
            round(
                priorities[
                    "soil_health"
                ],
                2,
            )
        )
        + "_climate_"
        + str(
            round(
                priorities[
                    "climate_resilience"
                ],
                2,
            )
        )
        + "_diversity_"
        + str(
            round(
                priorities[
                    "crop_diversity"
                ],
                2,
            )
        )
    )

    return scenarios


# ============================================================
# VALIDATE
# ============================================================

def validate_output(
    result: pd.DataFrame,
) -> None:

    print(
        "\nVALIDATING FARMER PRIORITY OUTPUT"
    )

    if result.empty:
        raise ValueError(
            "Output is empty."
        )

    print(
        f"[OK] Scenarios: "
        f"{len(result)}"
    )

    # --------------------------------------------------------
    # Duplicate IDs
    # --------------------------------------------------------

    if result[
        "rotation_id"
    ].duplicated().any():

        raise ValueError(
            "Duplicate rotation IDs detected."
        )

    print(
        "[OK] No duplicate rotation IDs."
    )

    # --------------------------------------------------------
    # Score range
    # --------------------------------------------------------

    score_columns = [
        "water_conservation_score",
        "soil_health_score",
        "climate_resilience_score",
        "crop_diversity_score",
        "drought_resilience_score",
        "heat_resilience_score",
        "waterlogging_resilience_score",
        "environmental_compatibility_score",
        "legume_score",
        "farmer_priority_score",
    ]

    for column in score_columns:

        values = numeric(
            result[column]
        )

        if values.isna().any():
            raise ValueError(
                f"NaN found in score "
                f"column: {column}"
            )

        if (
            (values < 0).any()
            or
            (values > 1).any()
        ):
            raise ValueError(
                f"Score outside [0,1]: "
                f"{column}"
            )

    print(
        "[OK] All score columns "
        "are within [0,1]."
    )

    # --------------------------------------------------------
    # Contribution arithmetic
    # --------------------------------------------------------

    calculated = (
        result[
            [
                "priority_water_contribution",
                "priority_soil_contribution",
                "priority_climate_contribution",
                "priority_diversity_contribution",
            ]
        ]
        .sum(axis=1)
    )

    difference = (
        calculated
        - result[
            "farmer_priority_score"
        ]
    ).abs().max()

    if difference > 1e-10:
        raise ValueError(
            "Priority contribution "
            "arithmetic failed."
        )

    print(
        "[OK] Priority contribution "
        "arithmetic validated."
    )

    # --------------------------------------------------------
    # Priority weights
    # --------------------------------------------------------

    weight_columns = [
        "priority_weight_water_conservation",
        "priority_weight_soil_health",
        "priority_weight_climate_resilience",
        "priority_weight_crop_diversity",
    ]

    weight_sum = (
        result[
            weight_columns
        ].iloc[0].sum()
    )

    if not np.isclose(
        weight_sum,
        1.0,
        atol=1e-10,
    ):
        raise ValueError(
            "Priority weights do not sum to 1."
        )

    print(
        "[OK] Priority weights sum to 1."
    )

    # --------------------------------------------------------
    # Methodology
    # --------------------------------------------------------

    if (
        result[
            "methodology_version"
        ]
        != METHODOLOGY_VERSION
    ).any():

        raise ValueError(
            "Unexpected methodology version."
        )

    print(
        f"[OK] Methodology: "
        f"{METHODOLOGY_VERSION}"
    )

    # --------------------------------------------------------
    # Yield protection
    # --------------------------------------------------------

    if (
        result[
            "synthetic_yield_target"
        ] != 0
    ).any():

        raise ValueError(
            "Synthetic yield target detected."
        )

    print(
        "[OK] No synthetic yield target."
    )

    # --------------------------------------------------------
    # Offline protection
    # --------------------------------------------------------

    if (
        result[
            "internet_required"
        ] != 0
    ).any():

        raise ValueError(
            "Offline-first violation."
        )

    print(
        "[OK] Runtime evaluation "
        "is offline-first."
    )

    # --------------------------------------------------------
    # Semantic protection
    # --------------------------------------------------------

    expected_score_type = (
        "scenario_indicator_not_yield_prediction"
    )

    if (
        result[
            "score_type"
        ]
        != expected_score_type
    ).any():

        raise ValueError(
            "Unexpected score_type."
        )

    print(
        "[OK] Score semantics preserved."
    )


# ============================================================
# SAVE
# ============================================================

def save_output(
    result: pd.DataFrame,
) -> None:

    OUTPUT_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    preferred_columns = [
        "rotation_id",

        "crop_1_id",
        "crop_1_name",

        "crop_2_id",
        "crop_2_name",

        "crop_3_id",
        "crop_3_name",

        "legume_in_rotation",

        "farmer_priority_score",

        "water_conservation_score",
        "soil_health_score",
        "climate_resilience_score",
        "crop_diversity_score",

        "drought_resilience_score",
        "heat_resilience_score",
        "waterlogging_resilience_score",

        "environmental_compatibility_score",
        "legume_score",
        "rotation_diversity_score",

        "priority_water_contribution",
        "priority_soil_contribution",
        "priority_climate_contribution",
        "priority_diversity_contribution",

        "priority_weight_water_conservation",
        "priority_weight_soil_health",
        "priority_weight_climate_resilience",
        "priority_weight_crop_diversity",

        "priority_profile",

        "historical_water_context",
        "historical_soil_context",
        "historical_climate_context",

        "rainfall_coverage",
        "soil_moisture_coverage",

        "methodology_version",
        "score_type",
        "synthetic_yield_target",
        "internet_required",
    ]

    existing = [
        column
        for column in preferred_columns
        if column in result.columns
    ]

    remaining = [
        column
        for column in result.columns
        if column not in existing
    ]

    result = result[
        existing + remaining
    ]

    result.to_csv(
        OUTPUT_FILE,
        index=False,
        encoding="utf-8",
    )

    print(
        f"\n[OUTPUT] {OUTPUT_FILE}"
    )

    print(
        f"[OUTPUT] Shape: "
        f"{result.shape}"
    )


# ============================================================
# PREVIEW
# ============================================================

def print_preview(
    result: pd.DataFrame,
) -> None:

    print(
        "\nSCENARIO PREVIEW"
    )

    print("-" * 64)

    columns = [
        "rotation_id",
        "crop_1_name",
        "crop_2_name",
        "crop_3_name",
        "farmer_priority_score",
        "water_conservation_score",
        "soil_health_score",
        "climate_resilience_score",
        "crop_diversity_score",
    ]

    print(
        result[
            columns
        ]
        .head(10)
        .to_string(
            index=False
        )
    )

    print(
        "\nSCORE RANGE"
    )

    print(
        f"  Farmer priority: "
        f"{result['farmer_priority_score'].min():.4f}"
        f" → "
        f"{result['farmer_priority_score'].max():.4f}"
    )

    print(
        f"  Water conservation: "
        f"{result['water_conservation_score'].min():.4f}"
        f" → "
        f"{result['water_conservation_score'].max():.4f}"
    )

    print(
        f"  Soil health: "
        f"{result['soil_health_score'].min():.4f}"
        f" → "
        f"{result['soil_health_score'].max():.4f}"
    )

    print(
        f"  Climate resilience: "
        f"{result['climate_resilience_score'].min():.4f}"
        f" → "
        f"{result['climate_resilience_score'].max():.4f}"
    )

    print(
        f"  Crop diversity: "
        f"{result['crop_diversity_score'].min():.4f}"
        f" → "
        f"{result['crop_diversity_score'].max():.4f}"
    )


# ============================================================
# MAIN
# ============================================================

def main():

    (
        agricultural,
        crops,
        rotations,
    ) = load_inputs()

    context = (
        build_historical_context(
            agricultural
        )
    )

    scenarios = (
        calculate_scenario_components(
            agricultural=agricultural,
            crops=crops,
            rotations=rotations,
            context=context,
        )
    )

    scenarios = (
        apply_farmer_priorities(
            scenarios=scenarios,
            priorities=DEFAULT_PRIORITIES,
        )
    )

    validate_output(
        scenarios
    )

    save_output(
        scenarios
    )

    print_preview(
        scenarios
    )

    print(
        "\n[SUCCESS] Farmer priority "
        "scenario evaluation v2 complete."
    )

    print(
        "[INFO] No crop-yield prediction generated."
    )

    print(
        "[INFO] No synthetic target generated."
    )

    print(
        "[INFO] No internet access required."
    )

    print(
        f"[INFO] Methodology version: "
        f"{METHODOLOGY_VERSION}"
    )


if __name__ == "__main__":
    main()