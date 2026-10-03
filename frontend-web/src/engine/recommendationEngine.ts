import type { FarmerPriorities } from "../types/priority";
import type { RotationRecommendation } from "../types/recommendation";

export function calculateRecommendationScore(
  result: RotationRecommendation,
  priorities: FarmerPriorities,
): number {
  const water = result.water_conservation_score ?? 0;
  const soil = result.soil_health_score ?? 0;
  const climate = result.climate_resilience_score ?? 0;
  const diversity = result.crop_diversity_score ?? 0;

  return (
    water * priorities.water_conservation +
    soil * priorities.soil_health +
    climate * priorities.climate_resilience +
    diversity * priorities.crop_diversity
  );
}

export function rankRecommendations(
  results: RotationRecommendation[],
  priorities: FarmerPriorities,
): RotationRecommendation[] {
  return [...results]
    .map((result) => ({
      ...result,
      priority_score: calculateRecommendationScore(
        result,
        priorities,
      ),
    }))
    .sort(
      (a, b) =>
        (b.priority_score ?? 0) -
        (a.priority_score ?? 0),
    );
}