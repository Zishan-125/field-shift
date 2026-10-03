import type { FarmerPriorities } from "../types/farmer";
import type { RotationRecommendation } from "../types/recommendation";

function getScore(
  recommendation: RotationRecommendation,
  primary: keyof RotationRecommendation,
  fallback: keyof RotationRecommendation,
) {
  const value =
    recommendation[primary] ??
    recommendation[fallback];

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function scoreLabel(score: number | null): string {
  if (score === null) {
    return "Not available";
  }

  if (score >= 0.8) {
    return "Strong";
  }

  if (score >= 0.6) {
    return "Good";
  }

  if (score >= 0.4) {
    return "Moderate";
  }

  return "Lower";
}

export interface RecommendationExplanation {
  water: string;
  soil: string;
  climate: string;
  diversity: string;
  summary: string;
}

export function explainRecommendation(
  recommendation: RotationRecommendation,
  priorities: FarmerPriorities,
): RecommendationExplanation {
  const water = getScore(
    recommendation,
    "water_conservation_score",
    "water_score",
  );

  const soil = getScore(
    recommendation,
    "soil_health_score",
    "soil_score",
  );

  const climate = getScore(
    recommendation,
    "climate_resilience_score",
    "climate_score",
  );

  const diversity = getScore(
    recommendation,
    "crop_diversity_score",
    "diversity_score",
  );

  const factors = [
    {
      key: "water",
      score: water,
      weight: priorities.water_conservation,
    },
    {
      key: "soil",
      score: soil,
      weight: priorities.soil_health,
    },
    {
      key: "climate",
      score: climate,
      weight: priorities.climate_resilience,
    },
    {
      key: "diversity",
      score: diversity,
      weight: priorities.crop_diversity,
    },
  ];

  const availableFactors = factors.filter(
    (factor) => factor.score !== null,
  );

  availableFactors.sort(
    (a, b) =>
      b.score! * b.weight -
      a.score! * a.weight,
  );

  const strongest = availableFactors[0];

  let summary =
    "This rotation matches the current farmer priority profile.";

  if (strongest) {
    if (strongest.key === "water") {
      summary =
        "This rotation receives strong support from its water-conservation performance under the current priority profile.";
    }

    if (strongest.key === "soil") {
      summary =
        "This rotation receives strong support from its soil-health performance under the current priority profile.";
    }

    if (strongest.key === "climate") {
      summary =
        "This rotation receives strong support from its climate-resilience performance under the current priority profile.";
    }

    if (strongest.key === "diversity") {
      summary =
        "This rotation receives strong support from its crop-diversity performance under the current priority profile.";
    }
  }

  return {
    water: scoreLabel(water),
    soil: scoreLabel(soil),
    climate: scoreLabel(climate),
    diversity: scoreLabel(diversity),
    summary,
  };
}