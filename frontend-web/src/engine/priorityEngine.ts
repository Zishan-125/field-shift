import type {
  FarmerGoal,
  FarmerPriorities,
} from "../types/farmer";

import { DEFAULT_PRIORITIES } from "../types/farmer";

export function normalizePriorities(
  priorities: FarmerPriorities,
): FarmerPriorities {
  const total =
    priorities.water_conservation +
    priorities.soil_health +
    priorities.climate_resilience +
    priorities.crop_diversity;

  if (total <= 0) {
    return DEFAULT_PRIORITIES;
  }

  return {
    water_conservation:
      priorities.water_conservation / total,

    soil_health:
      priorities.soil_health / total,

    climate_resilience:
      priorities.climate_resilience / total,

    crop_diversity:
      priorities.crop_diversity / total,
  };
}

export function prioritiesFromGoals(
  goals: FarmerGoal[],
): FarmerPriorities {
  if (goals.length === 0) {
    return DEFAULT_PRIORITIES;
  }

  const result: FarmerPriorities = {
    water_conservation: 0,
    soil_health: 0,
    climate_resilience: 0,
    crop_diversity: 0,
  };

  const baseWeight = 1 / goals.length;

  for (const goal of goals) {
    result[goal] += baseWeight;
  }

  return normalizePriorities(result);
}