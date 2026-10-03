import { useMemo, useState } from "react";

import type { FarmerPriorities } from "../../types/farmer";
import type { RotationRecommendation } from "../../types/recommendation";

import RecommendationReason from "./RecommendationReason";

interface RecommendationCardProps {
  recommendation: RotationRecommendation;
  rank?: number;
  featured?: boolean;
  priorities: FarmerPriorities;
}

interface Metric {
  key:
    | "water_conservation"
    | "soil_health"
    | "climate_resilience"
    | "crop_diversity";

  icon: string;
  label: string;

  // Rotation-specific score
  score: number;

  // Current farmer-selected weight
  weight: number;

  // score × weight
  contribution: number;

  tone: "blue" | "green" | "amber" | "purple";
}

function clampScore(value: unknown): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.min(1, parsed));
}

function clampWeight(value: unknown): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.min(1, parsed));
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function getCrops(
  recommendation: RotationRecommendation,
): string[] {
  return [
    recommendation.crop_1_name,
    recommendation.crop_2_name,
    recommendation.crop_3_name,
  ].filter(
    (crop): crop is string =>
      typeof crop === "string" &&
      crop.trim().length > 0,
  );
}

function getCropIcon(index: number): string {
  const icons = ["🌾", "🌱", "🥬"];

  return icons[index] ?? "🌿";
}

/**
 * Build the scoring dimensions for ONE specific rotation.
 *
 * IMPORTANT:
 *
 * score  = quality of this rotation for that factor
 * weight = current farmer preference
 *
 * contribution = score × weight
 *
 * Therefore:
 *
 * Priority Fit =
 *   Water contribution
 *   + Soil contribution
 *   + Climate contribution
 *   + Variety contribution
 */
function buildMetrics(
  recommendation: RotationRecommendation,
  priorities: FarmerPriorities,
): Metric[] {
  const waterScore = clampScore(
    recommendation.water_conservation_score,
  );

  const soilScore = clampScore(
    recommendation.soil_health_score,
  );

  const climateScore = clampScore(
    recommendation.climate_resilience_score,
  );

  const diversityScore = clampScore(
    recommendation.crop_diversity_score,
  );

  const waterWeight = clampWeight(
    priorities.water_conservation,
  );

  const soilWeight = clampWeight(
    priorities.soil_health,
  );

  const climateWeight = clampWeight(
    priorities.climate_resilience,
  );

  const diversityWeight = clampWeight(
    priorities.crop_diversity,
  );

  return [
    {
      key: "water_conservation",
      icon: "💧",
      label: "Water",
      score: waterScore,
      weight: waterWeight,
      contribution: waterScore * waterWeight,
      tone: "blue",
    },

    {
      key: "soil_health",
      icon: "🌱",
      label: "Soil",
      score: soilScore,
      weight: soilWeight,
      contribution: soilScore * soilWeight,
      tone: "green",
    },

    {
      key: "climate_resilience",
      icon: "☀️",
      label: "Climate",
      score: climateScore,
      weight: climateWeight,
      contribution: climateScore * climateWeight,
      tone: "amber",
    },

    {
      key: "crop_diversity",
      icon: "🌾",
      label: "Variety",
      score: diversityScore,
      weight: diversityWeight,
      contribution: diversityScore * diversityWeight,
      tone: "purple",
    },
  ];
}

export default function RecommendationCard({
  recommendation,
  rank = 1,
  featured = false,
  priorities,
}: RecommendationCardProps) {
  const [showDetails, setShowDetails] =
    useState(featured);

  const crops = getCrops(recommendation);

  /**
   * IMPORTANT:
   *
   * Rebuild whenever either:
   * 1. this crop rotation changes
   * 2. farmer priorities change
   *
   * This prevents the Priority Calculation
   * from behaving like a static block.
   */
  const metrics = useMemo(
    () =>
      buildMetrics(
        recommendation,
        priorities,
      ),
    [recommendation, priorities],
  );

  /**
   * Final farmer-specific score.
   *
   * This is the value shown as:
   *
   * Priority Fit
   */
  const priorityFit = useMemo(
    () =>
      metrics.reduce(
        (total, metric) =>
          total + metric.contribution,
        0,
      ),
    [metrics],
  );

  const hasScoringData = metrics.some(
    (metric) => metric.score > 0,
  );

  const allScoresEqual =
    hasScoringData &&
    metrics.every(
      (metric) =>
        metric.score === metrics[0]?.score,
    );

  return (
    <article
      className={[
        "overflow-hidden rounded-[2rem] border bg-white transition-all duration-300",
        featured
          ? "border-green-300 shadow-lg shadow-green-100/60"
          : "border-slate-200 shadow-sm hover:border-green-200 hover:shadow-md",
      ].join(" ")}
    >
      {/* =====================================================
          FEATURED BANNER
      ====================================================== */}
      {featured && (
        <div className="flex items-center justify-center gap-2 bg-green-700 px-5 py-3 text-center text-xs font-black uppercase tracking-[0.14em] text-white">
          <span>✓</span>

          <span>
            Top match for your priorities
          </span>
        </div>
      )}

      <div className="p-5 sm:p-6">
        {/* =====================================================
            HEADER
        ====================================================== */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            {/* Rank */}
            <div
              className={[
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xs font-black",
                featured
                  ? "bg-green-100 text-green-700"
                  : "bg-slate-100 text-slate-600",
              ].join(" ")}
            >
              {rank === 1
                ? "1st"
                : `#${rank}`}
            </div>

            {/* Rotation title */}
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                Crop rotation
              </p>

              <h3 className="mt-1 break-words text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
                {crops.length > 0
                  ? crops.join(" → ")
                  : "Recommended rotation"}
              </h3>

              <p className="mt-1 text-xs font-medium text-slate-400">
                Ranked using your current priorities
              </p>
            </div>
          </div>

          {/* =================================================
              DYNAMIC PRIORITY FIT
          ================================================== */}
          <div
            className={[
              "shrink-0 rounded-2xl px-3 py-2 text-center transition-all duration-300",
              featured
                ? "bg-green-50"
                : "bg-slate-50",
            ].join(" ")}
          >
            <p className="text-xl font-black tracking-tight text-green-700 sm:text-2xl">
              {percent(priorityFit)}
            </p>

            <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">
              priority fit
            </p>
          </div>
        </div>

        {/* =====================================================
            CROP JOURNEY
        ====================================================== */}
        {crops.length > 0 && (
          <div className="mt-6 rounded-2xl bg-slate-50 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
              Your crop journey
            </p>

            <div className="mt-4 flex items-center overflow-x-auto">
              {crops.map((crop, index) => (
                <div
                  key={`${recommendation.rotation_id}-${crop}-${index}`}
                  className="flex min-w-0 items-center"
                >
                  <div className="flex min-w-[82px] flex-col items-center">
                    <div
                      className={[
                        "flex h-12 w-12 items-center justify-center rounded-2xl border text-xl",
                        index === 0
                          ? "border-green-200 bg-green-50"
                          : "border-slate-200 bg-white",
                      ].join(" ")}
                    >
                      {getCropIcon(index)}
                    </div>

                    <p className="mt-2 max-w-[90px] truncate text-center text-xs font-bold text-slate-700">
                      {crop}
                    </p>

                    <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                      {index === 0
                        ? "Start"
                        : index ===
                            crops.length - 1
                          ? "Next"
                          : `Step ${index + 1}`}
                    </p>
                  </div>

                  {index <
                    crops.length - 1 && (
                    <div className="mx-1 flex min-w-[28px] flex-1 items-center justify-center">
                      <div className="h-px w-full bg-slate-200" />

                      <span className="mx-1 text-xs text-green-600">
                        →
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* =====================================================
            PRIORITY CALCULATION
        ====================================================== */}
        <div className="mt-6 overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white">
          {/* Section header */}
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-4 sm:p-5">
            <div>
              <p className="text-sm font-black tracking-tight text-slate-900">
                Priority calculation
              </p>

              <p className="mt-1 max-w-md text-xs leading-5 text-slate-500">
                Your weights change each factor&apos;s
                contribution to this crop rotation.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setShowDetails(
                  (current) => !current,
                )
              }
              aria-expanded={showDetails}
              className="shrink-0 rounded-xl px-3 py-2 text-xs font-black text-green-700 transition hover:bg-green-50"
            >
              {showDetails
                ? "Hide ↑"
                : "Details ↓"}
            </button>
          </div>

          {/* =================================================
              FACTOR CARDS
          ================================================== */}
          {showDetails && (
            <div className="p-4 sm:p-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {metrics.map((metric) => (
                  <Score
                    key={`${recommendation.rotation_id}-${metric.key}`}
                    metric={metric}
                  />
                ))}
              </div>

              {/* =================================================
                  TOTAL PRIORITY FIT
              ================================================== */}
              <div className="mt-4 rounded-2xl bg-slate-950 p-4 text-white">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/50">
                      Priority fit
                    </p>

                    <p className="mt-1 text-xs leading-5 text-white/60">
                      Score for this rotation using
                      your current priorities.
                    </p>
                  </div>

                  <p className="shrink-0 text-3xl font-black text-green-300">
                    {percent(priorityFit)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* =====================================================
            DATA WARNING
        ====================================================== */}
        {!hasScoringData && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <span className="text-lg">
                ⚠️
              </span>

              <div>
                <p className="text-xs font-black text-amber-800">
                  Rotation scoring data is missing
                </p>

                <p className="mt-1 text-xs leading-5 text-amber-700">
                  This rotation does not contain
                  usable Water, Soil, Climate, or
                  Variety scores.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================
            EQUAL SCORE INFORMATION
        ====================================================== */}
        {allScoresEqual && (
          <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <div className="flex items-start gap-3">
              <span className="text-lg">
                ℹ️
              </span>

              <div>
                <p className="text-xs font-black text-blue-800">
                  Equal factor scores
                </p>

                <p className="mt-1 text-xs leading-5 text-blue-700">
                  This rotation currently has the
                  same score across all factors.
                  Changing priorities will change
                  the contribution breakdown, but
                  the total Priority Fit will remain
                  the same when all factor scores are
                  identical.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================
            EXPLANATION
        ====================================================== */}
        {showDetails && (
          <div className="mt-5 overflow-hidden rounded-2xl border border-green-100 bg-green-50/60">
            <div className="border-b border-green-100 px-4 py-4 sm:px-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-lg shadow-sm">
                  💡
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-green-800">
                    Why this rotation?
                  </p>

                  <p className="mt-1 text-sm leading-5 text-green-900/70">
                    The factor scores describe this
                    rotation. Your selected priorities
                    determine how strongly each factor
                    contributes to the final score.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-5">
              <RecommendationReason
                recommendation={recommendation}
              />

              {/* =================================================
                  LIVE CALCULATION
              ================================================== */}
              <div className="mt-5 border-t border-green-100 pt-5">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-green-800">
                    Current calculation
                  </p>

                  <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-green-700">
                    Live
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  {metrics.map((metric) => (
                    <CalculationRow
                      key={`${recommendation.rotation_id}-${metric.key}`}
                      metric={metric}
                    />
                  ))}
                </div>

                {/* =================================================
                    FORMULA
                ================================================== */}
                <div className="mt-5 rounded-2xl bg-white p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                    Priority Fit
                  </p>

                  <p className="mt-2 break-words font-mono text-xs leading-6 text-slate-600">
                    {metrics
                      .map(
                        (metric) =>
                          `${percent(
                            metric.score,
                          )} × ${percent(
                            metric.weight,
                          )}`,
                      )
                      .join(" + ")}

                    {" = "}

                    <strong className="text-green-700">
                      {percent(priorityFit)}
                    </strong>
                  </p>
                </div>

                {/* =================================================
                    CURRENT FARMER PROFILE
                ================================================== */}
                <div className="mt-4">
                  <p className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-green-800">
                    Your current priorities
                  </p>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <PriorityMini
                      icon="💧"
                      label="Water"
                      value={
                        priorities.water_conservation
                      }
                    />

                    <PriorityMini
                      icon="🌱"
                      label="Soil"
                      value={
                        priorities.soil_health
                      }
                    />

                    <PriorityMini
                      icon="☀️"
                      label="Climate"
                      value={
                        priorities.climate_resilience
                      }
                    />

                    <PriorityMini
                      icon="🌾"
                      label="Variety"
                      value={
                        priorities.crop_diversity
                      }
                    />
                  </div>
                </div>

                {/* =================================================
                    TECHNICAL CALCULATION
                ================================================== */}
                <details className="mt-5 border-t border-green-100 pt-4">
                  <summary className="cursor-pointer text-xs font-black text-green-800">
                    Technical calculation
                  </summary>

                  <div className="mt-3 rounded-xl bg-white p-4">
                    <p className="text-xs leading-5 text-slate-500">
                      Each factor score for this
                      rotation is multiplied by the
                      farmer-selected weight for that
                      factor. The four contributions are
                      then added together.
                    </p>

                    <p className="mt-3 text-[10px] leading-5 text-slate-400">
                      This is a decision-support score,
                      not a guaranteed yield or
                      agronomic diagnosis.
                    </p>
                  </div>
                </details>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================
            CONFIRMATION
        ====================================================== */}
        <div className="mt-5 flex items-start gap-2 rounded-xl bg-green-50 px-3.5 py-3">
          <span className="mt-0.5 text-sm text-green-600">
            ✓
          </span>

          <p className="text-xs leading-5 text-green-800/80">
            Priority Fit is calculated from this
            rotation&apos;s factor scores and your
            current farmer priorities.
          </p>
        </div>
      </div>
    </article>
  );
}

/* =============================================================
   PRIORITY MINI
============================================================= */

interface PriorityMiniProps {
  icon: string;
  label: string;
  value: number;
}

function PriorityMini({
  icon,
  label,
  value,
}: PriorityMiniProps) {
  return (
    <div className="rounded-xl bg-white p-3">
      <div className="flex items-center gap-2">
        <span className="text-sm">
          {icon}
        </span>

        <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">
          {label}
        </p>
      </div>

      <p className="mt-2 text-sm font-black text-green-700">
        {percent(value)}
      </p>
    </div>
  );
}

/* =============================================================
   SCORE CARD
============================================================= */

interface ScoreProps {
  metric: Metric;
}

function Score({ metric }: ScoreProps) {
  const styles = {
    blue: {
      box: "border-blue-100 bg-blue-50/70",
      icon: "bg-white",
      text: "text-blue-700",
      bar: "bg-blue-500",
    },

    green: {
      box: "border-green-100 bg-green-50/70",
      icon: "bg-white",
      text: "text-green-700",
      bar: "bg-green-500",
    },

    amber: {
      box: "border-amber-100 bg-amber-50/70",
      icon: "bg-white",
      text: "text-amber-700",
      bar: "bg-amber-500",
    },

    purple: {
      box: "border-purple-100 bg-purple-50/70",
      icon: "bg-white",
      text: "text-purple-700",
      bar: "bg-purple-500",
    },
  };

  const current = styles[metric.tone];

  return (
    <div
      className={[
        "rounded-2xl border p-3.5 transition-all duration-300",
        "hover:-translate-y-0.5 hover:shadow-sm",
        current.box,
      ].join(" ")}
    >
      {/* Icon + factor */}
      <div className="flex items-center gap-2">
        <div
          className={[
            "flex h-8 w-8 items-center justify-center rounded-xl text-sm shadow-sm",
            current.icon,
          ].join(" ")}
        >
          {metric.icon}
        </div>

        <p
          className={[
            "text-[10px] font-black uppercase tracking-wide",
            current.text,
          ].join(" ")}
        >
          {metric.label}
        </p>
      </div>

      {/* Rotation-specific score */}
      <p
        className={[
          "mt-3 text-2xl font-black tracking-tight",
          current.text,
        ].join(" ")}
      >
        {percent(metric.score)}
      </p>

      <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-400">
        rotation score
      </p>

      {/* Farmer weight */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-[9px] font-bold text-slate-400">
          Weight
        </span>

        <span
          className={[
            "text-[11px] font-black",
            current.text,
          ].join(" ")}
        >
          {percent(metric.weight)}
        </span>
      </div>

      {/* Weighted contribution */}
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[9px] font-bold text-slate-400">
          Contribution
        </span>

        <span
          className={[
            "text-[11px] font-black",
            current.text,
          ].join(" ")}
        >
          +{percent(metric.contribution)}
        </span>
      </div>

      {/* Contribution bar */}
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white">
        <div
          className={[
            "h-full rounded-full transition-all duration-500 ease-out",
            current.bar,
          ].join(" ")}
          style={{
            width: `${Math.min(
              metric.contribution * 100,
              100,
            )}%`,
          }}
        />
      </div>
    </div>
  );
}

/* =============================================================
   CALCULATION ROW
============================================================= */

interface CalculationRowProps {
  metric: Metric;
}

function CalculationRow({
  metric,
}: CalculationRowProps) {
  return (
    <div className="rounded-xl bg-white p-3">
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-sm">
          {metric.icon}
        </div>

        <div className="min-w-0 flex-1">
          {/* Label + contribution */}
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-bold text-slate-700">
              {metric.label}
            </p>

            <p className="text-xs font-black text-green-700">
              +{percent(metric.contribution)}
            </p>
          </div>

          {/* Formula */}
          <div className="mt-2 flex items-center gap-2 text-[10px] font-bold text-slate-400">
            <span>
              Score {percent(metric.score)}
            </span>

            <span>×</span>

            <span>
              Weight {percent(metric.weight)}
            </span>

            <span>=</span>

            <span className="font-black text-green-700">
              +{percent(metric.contribution)}
            </span>
          </div>

          {/* Contribution bar */}
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-green-500 transition-all duration-500"
              style={{
                width: `${Math.min(
                  metric.contribution * 100,
                  100,
                )}%`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}