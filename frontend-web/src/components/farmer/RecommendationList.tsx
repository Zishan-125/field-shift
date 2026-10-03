import { useMemo, useState } from "react";

import type { FarmerPriorities } from "../../types/farmer";
import type { RotationRecommendation } from "../../types/recommendation";

import RecommendationCard from "./RecommendationCard";

interface RecommendationListProps {
  recommendations: RotationRecommendation[];
  priorities: FarmerPriorities;
  maxItems?: number;
}

interface RankedRecommendation {
  recommendation: RotationRecommendation;
  priorityFit: number;
  originalIndex: number;
}

/**
 * Convert any score into a safe 0–1 value.
 */
function score(value: unknown): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.min(1, parsed));
}

/**
 * Calculate the farmer-specific Priority Fit.
 *
 * IMPORTANT:
 * This intentionally does NOT use backend `priority_score`.
 *
 * The formula is:
 *
 *   Water score    × Water weight
 * + Soil score     × Soil weight
 * + Climate score  × Climate weight
 * + Variety score  × Variety weight
 */
function calculatePriorityFit(
  recommendation: RotationRecommendation,
  priorities: FarmerPriorities,
): number {
  const water = score(
    recommendation.water_conservation_score,
  );

  const soil = score(
    recommendation.soil_health_score,
  );

  const climate = score(
    recommendation.climate_resilience_score,
  );

  const diversity = score(
    recommendation.crop_diversity_score,
  );

  const waterContribution =
    water * priorities.water_conservation;

  const soilContribution =
    soil * priorities.soil_health;

  const climateContribution =
    climate * priorities.climate_resilience;

  const diversityContribution =
    diversity * priorities.crop_diversity;

  const priorityFit =
    waterContribution +
    soilContribution +
    climateContribution +
    diversityContribution;

  return priorityFit;
}

export default function RecommendationList({
  recommendations,
  priorities,
  maxItems = 3,
}: RecommendationListProps) {
  const [showAll, setShowAll] = useState(false);

  /*
   * ---------------------------------------------------------
   * RANKING
   * ---------------------------------------------------------
   *
   * Whenever either:
   *
   *   recommendations
   *   priorities
   *
   * changes, useMemo recalculates the ranking.
   */
  const rankedRecommendations = useMemo<RankedRecommendation[]>(() => {
    const ranked = recommendations.map(
      (recommendation, index) => {
        const priorityFit =
          calculatePriorityFit(
            recommendation,
            priorities,
          );

        return {
          recommendation,
          priorityFit,
          originalIndex: index,
        };
      },
    );

    ranked.sort((a, b) => {
      const difference =
        b.priorityFit - a.priorityFit;

      if (difference !== 0) {
        return difference;
      }

      return (
        a.originalIndex -
        b.originalIndex
      );
    });

    return ranked;
  }, [recommendations, priorities]);

  const visibleRecommendations = showAll
    ? rankedRecommendations
    : rankedRecommendations.slice(
        0,
        maxItems,
      );

  /*
   * ---------------------------------------------------------
   * EMPTY STATE
   * ---------------------------------------------------------
   */
  if (recommendations.length === 0) {
    return (
      <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
        <div className="mx-auto max-w-md text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-green-50 text-2xl">
            🌱
          </div>

          <p className="mt-5 text-xs font-black uppercase tracking-[0.18em] text-green-700">
            Decision support
          </p>

          <h3 className="mt-2 text-xl font-black text-slate-950">
            Your crop plan is not ready yet
          </h3>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            FIELD SHIFT needs your field
            information and farming priorities
            before it can compare crop rotations.
          </p>
        </div>
      </section>
    );
  }

  /*
   * ---------------------------------------------------------
   * MAIN UI
   * ---------------------------------------------------------
   */
  return (
    <section>
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-green-700">
              Your farm plan
            </p>

            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
              What should you plant?
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              FIELD SHIFT ranks these crop
              rotations using your current farming
              priorities.
            </p>
          </div>

          <div className="flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-50 text-xs">
              🌾
            </span>

            <span className="text-xs font-bold text-slate-600">
              {recommendations.length}{" "}
              {recommendations.length === 1
                ? "rotation"
                : "rotations"}{" "}
              compared
            </span>
          </div>
        </div>
      </div>

      {/* Current priority profile */}
      <div className="mb-5 rounded-2xl border border-green-100 bg-green-50/70 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-green-700">
              Current ranking weights
            </p>

            <p className="mt-1 text-xs text-green-900/70">
              These weights determine how FIELD
              SHIFT ranks the rotations.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[10px] font-black sm:grid-cols-4">
            <WeightBadge
              icon="💧"
              label="Water"
              value={
                priorities.water_conservation
              }
            />

            <WeightBadge
              icon="🌱"
              label="Soil"
              value={
                priorities.soil_health
              }
            />

            <WeightBadge
              icon="☀️"
              label="Climate"
              value={
                priorities.climate_resilience
              }
            />

            <WeightBadge
              icon="🌾"
              label="Variety"
              value={
                priorities.crop_diversity
              }
            />
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="space-y-4">
        {visibleRecommendations.map(
          (item, index) => (
            <RecommendationCard
              key={
                item.recommendation
                  .rotation_id ||
                `recommendation-${item.originalIndex}`
              }
              recommendation={
                item.recommendation
              }
              rank={index + 1}
              featured={index === 0}
              priorities={priorities}
            />
          ),
        )}
      </div>

      {/* Show all / show top */}
      {recommendations.length > maxItems && (
        <button
          type="button"
          onClick={() =>
            setShowAll(
              (current) => !current,
            )
          }
          className="mt-5 w-full rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-green-300 hover:bg-green-50 hover:text-green-700"
        >
          {showAll
            ? `Show top ${maxItems}`
            : `View all ${recommendations.length} crop rotations`}
        </button>
      )}

      {/* Disclaimer */}
      <div className="mt-5 flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-sm shadow-sm">
          ℹ️
        </div>

        <div>
          <p className="text-xs font-black text-slate-700">
            A recommendation, not a guarantee
          </p>

          <p className="mt-1 text-xs leading-5 text-slate-500">
            These rankings support your decision
            using the information available to
            FIELD SHIFT. Actual farm results can
            vary with local conditions, management
            and seasonal changes.
          </p>
        </div>
      </div>
    </section>
  );
}

/*
 * ---------------------------------------------------------
 * WEIGHT BADGE
 * ---------------------------------------------------------
 */

interface WeightBadgeProps {
  icon: string;
  label: string;
  value: number;
}

function WeightBadge({
  icon,
  label,
  value,
}: WeightBadgeProps) {
  return (
    <div className="rounded-xl bg-white px-2.5 py-2 shadow-sm">
      <div className="flex items-center gap-1.5 text-slate-500">
        <span>{icon}</span>

        <span>{label}</span>
      </div>

      <p className="mt-0.5 text-sm font-black text-green-700">
        {Math.round(value * 100)}%
      </p>
    </div>
  );
}