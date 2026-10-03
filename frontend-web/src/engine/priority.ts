import type {
  FarmerPriorities,
  PriorityLevel,
} from "../types/priority";

const LEVEL_VALUE: Record<PriorityLevel, number> = {
  low: 0.1,
  medium: 0.5,
  high: 1,
};

export function normalizePriorities(
  priorities: FarmerPriorities,
): FarmerPriorities {
  const total =
    priorities.water_conservation +
    priorities.soil_health +
    priorities.climate_resilience +
    priorities.crop_diversity;

  if (total === 0) {
    return {
      water_conservation: 0.4,
      soil_health: 0.3,
      climate_resilience: 0.2,
      crop_diversity: 0.1,
    };
  }

  return {
    water_conservation: priorities.water_conservation / total,
    soil_health: priorities.soil_health / total,
    climate_resilience: priorities.climate_resilience / total,
    crop_diversity: priorities.crop_diversity / total,
  };
}

export function priorityFromLevels(
  levels: Record<keyof FarmerPriorities, PriorityLevel>,
): FarmerPriorities {
  return normalizePriorities({
    water_conservation: LEVEL_VALUE[levels.water_conservation],
    soil_health: LEVEL_VALUE[levels.soil_health],
    climate_resilience: LEVEL_VALUE[levels.climate_resilience],
    crop_diversity: LEVEL_VALUE[levels.crop_diversity],
  });
}