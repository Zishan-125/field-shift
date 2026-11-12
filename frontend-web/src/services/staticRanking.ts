/**
 * Re-rank an exported pattern-recommendation response for new farmer
 * priorities, with no server. Mirrors backend/offline/server.py
 * pattern_recommendations(): the only part that depends on the priorities
 * is score = sum(indicator x normalised weight), then a stable sort by score
 * over the server's own pattern order. Feasibility, field-risk components,
 * comparisons and "why" drivers do not depend on the weights and are kept
 * as exported. Parity with the API is tested in staticRanking.test.ts.
 */

import type {
  PatternPriorities,
  PatternRecommendationResponse,
  RecommendedPattern,
  ScoredPattern,
} from "../types/pattern";

export type StaticRecommendations = PatternRecommendationResponse & { pattern_order: string[] };

// Same key order as PRIORITY_TO_INDICATOR in server.py (sum order matters for floats).
const PRIORITY_TO_INDICATOR = [
  ["food_production", "food_production_score"],
  ["water_productivity", "water_productivity_score"],
  ["soil_health", "soil_health_score"],
  ["climate_resilience", "climate_resilience_score"],
  ["crop_diversity", "crop_diversity_score"],
] as const;

// Python's round(x, 6) rounds the exact binary value; toFixed does the same
// (Math.round(x * 1e6) would round a perturbed product and can differ by 1e-6).
function round6(value: number): number {
  return Number(value.toFixed(6));
}

export function normalizePriorities(priorities: PatternPriorities): Record<string, number> {
  const total = PRIORITY_TO_INDICATOR.reduce((sum, [key]) => sum + (Number(priorities[key]) || 0), 0);
  if (total <= 0) {
    throw new Error("At least one farmer priority must be greater than zero.");
  }
  return Object.fromEntries(PRIORITY_TO_INDICATOR.map(([key]) => [key, (Number(priorities[key]) || 0) / total]));
}

function score(pattern: ScoredPattern, weights: Record<string, number>) {
  if (!pattern.indicators) return { score: null, contributions: null };
  const contributions: Record<string, number> = {};
  let total = 0;
  for (const [priority, indicator] of PRIORITY_TO_INDICATOR) {
    const value = (pattern.indicators as unknown as Record<string, number>)[indicator] * weights[priority];
    contributions[priority] = round6(value);
    total += value;
  }
  return { score: round6(total), contributions };
}

export function rerank(base: StaticRecommendations, priorities: PatternPriorities): PatternRecommendationResponse {
  const weights = normalizePriorities(priorities);
  const order = new Map(base.pattern_order.map((id, i) => [id, i]));

  const currentScored = score(base.current, weights);
  const current = { ...base.current, score: currentScored.score, priority_contributions: currentScored.contributions };

  const results: RecommendedPattern[] = base.results
    .map((pattern) => {
      const s = score(pattern, weights);
      return {
        ...pattern,
        score: s.score,
        priority_contributions: s.contributions,
        score_change: s.score !== null && current.score !== null ? round6(s.score - current.score) : null,
      };
    })
    .sort((a, b) => (order.get(a.pattern_id) ?? 0) - (order.get(b.pattern_id) ?? 0))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .map((pattern, i) => ({ ...pattern, rank: i + 1 }));

  return { ...base, priority_profile: weights, current, results };
}
