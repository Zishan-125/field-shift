export interface FarmerPriorities {
  water_conservation: number;
  soil_health: number;
  climate_resilience: number;
  crop_diversity: number;
}

export type FarmerGoal =
  | "water_conservation"
  | "soil_health"
  | "climate_resilience"
  | "crop_diversity";

export const DEFAULT_PRIORITIES: FarmerPriorities = {
  water_conservation: 0.4,
  soil_health: 0.3,
  climate_resilience: 0.2,
  crop_diversity: 0.1,
};

export const GOAL_LABELS: Record<FarmerGoal, string> = {
  water_conservation: "Save water",
  soil_health: "Protect soil",
  climate_resilience: "Handle climate changes",
  crop_diversity: "Increase crop diversity",
};