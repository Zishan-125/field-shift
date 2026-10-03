export interface FarmerPriorities {
  water_conservation: number;
  soil_health: number;
  climate_resilience: number;
  crop_diversity: number;
}

export const DEFAULT_PRIORITIES: FarmerPriorities = {
  water_conservation: 0.4,
  soil_health: 0.3,
  climate_resilience: 0.2,
  crop_diversity: 0.1,
};

export type PriorityLevel = "low" | "medium" | "high";

export interface FarmerPriorityOption {
  key: keyof FarmerPriorities;
  label: string;
  description: string;
  icon: string;
}