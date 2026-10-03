export interface PriorityContributions {
  water_conservation?: number;
  soil_health?: number;
  climate_resilience?: number;
  crop_diversity?: number;
}

export interface RotationRecommendation {
  rotation_id: string;

  crop_1_name?: string;
  crop_2_name?: string;
  crop_3_name?: string;

  priority_score?: number;
  farmer_priority_score?: number;

  // Rotation-specific factor scores
  water_conservation_score?: number;
  soil_health_score?: number;
  climate_resilience_score?: number;
  crop_diversity_score?: number;

  // Backend-provided contributions, if available
  water_conservation_contribution?: number;
  soil_health_contribution?: number;
  climate_resilience_contribution?: number;
  crop_diversity_contribution?: number;

  priority_contributions?: PriorityContributions;

  // Optional backend priority profile
  priority_profile?: {
    water_conservation?: number;
    soil_health?: number;
    climate_resilience?: number;
    crop_diversity?: number;
  };

  explainability?: unknown;
  formula?: string;

  [key: string]: unknown;
}

export interface RecommendationResponse {
  field: {
    field_id: string;
    name: string;
  };

  priority_profile: {
    water_conservation: number;
    soil_health: number;
    climate_resilience: number;
    crop_diversity: number;
  };

  scenario_count: number;

  results: RotationRecommendation[];
}