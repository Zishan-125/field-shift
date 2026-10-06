import { useMemo, useState } from "react";

import type { FarmerPriorities } from "../../types/farmer";
import type { RotationRecommendation } from "../../types/recommendation";
import type { NormalizedCrop } from "../../types/crop";

import RecommendationCard from "./RecommendationCard";

import bn from "../../i18n/bn";
import en from "../../i18n/en";

interface RecommendationListProps {
  recommendations: RotationRecommendation[];
  priorities: FarmerPriorities;
  maxItems?: number;
  language?: "bn" | "en";
  crops?: NormalizedCrop[];
}

function clampScore(value: unknown): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(1, parsed),
  );
}

function calculatePriorityFit(
  recommendation: RotationRecommendation,
  priorities: FarmerPriorities,
): number {
  return (
    clampScore(
      recommendation.water_conservation_score,
    ) *
      priorities.water_conservation +
    clampScore(
      recommendation.soil_health_score,
    ) *
      priorities.soil_health +
    clampScore(
      recommendation.climate_resilience_score,
    ) *
      priorities.climate_resilience +
    clampScore(
      recommendation.crop_diversity_score,
    ) *
      priorities.crop_diversity
  );
}

export default function RecommendationList({
  recommendations,
  priorities,
  maxItems = 3,
  language = "bn",
  crops = [],
}: RecommendationListProps) {
  const t =
    language === "bn" ? bn : en;

  const recommendationText = {
    rankingWeights:
      "rankingWeights" in
      t.recommendations
        ? t.recommendations
            .rankingWeights
        : language === "bn"
          ? "র‍্যাংকিং অগ্রাধিকার"
          : "Ranking priorities",

    rankingDescription:
      "rankingDescription" in
      t.recommendations
        ? t.recommendations
            .rankingDescription
        : language === "bn"
          ? "আপনার নির্বাচিত অগ্রাধিকারের ওজন অনুযায়ী rotation-গুলো র‍্যাংক করা হয়েছে।"
          : "Rotations are ranked according to the weights of your selected priorities.",

    showMore:
      language === "bn"
        ? "আরও দেখুন"
        : "Show more",

    showLess:
      language === "bn"
        ? "কম দেখুন"
        : "Show less",
  };

  const [visibleCount, setVisibleCount] =
    useState(maxItems);

  const ranked = useMemo(() => {
    return recommendations
      .map(
        (
          recommendation,
          index,
        ) => ({
          recommendation,
          priorityFit:
            calculatePriorityFit(
              recommendation,
              priorities,
            ),
          originalIndex: index,
        }),
      )
      .sort(
        (a, b) =>
          b.priorityFit -
            a.priorityFit ||
          a.originalIndex -
            b.originalIndex,
      );
  }, [
    recommendations,
    priorities,
  ]);

  const visible =
    ranked.slice(
      0,
      Math.min(
        visibleCount,
        ranked.length,
      ),
    );

  const hasMore =
    visibleCount <
    ranked.length;

  const remainingCount =
    Math.max(
      0,
      ranked.length -
        visibleCount,
    );

  const handleShowMore =
    () => {
      setVisibleCount(
        (current) =>
          Math.min(
            current + 10,
            ranked.length,
          ),
      );
    };

  const handleShowLess =
    () => {
      setVisibleCount(
        maxItems,
      );

      window.requestAnimationFrame(
        () => {
          window.scrollTo({
            top: 0,
            behavior: "smooth",
          });
        },
      );
    };

  return (
    <div>
      <div className="mb-5 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              {
                recommendationText.rankingWeights
              }
            </p>

            <p className="mt-1 text-sm text-slate-500">
              {
                recommendationText.rankingDescription
              }
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-blue-50 p-3">
            <p className="text-xs font-black text-blue-700">
              💧{" "}
              {language === "bn"
                ? "পানি"
                : "Water"}
            </p>

            <p className="mt-1 text-lg font-black text-blue-900">
              {Math.round(
                priorities.water_conservation *
                  100,
              )}
              %
            </p>
          </div>

          <div className="rounded-xl bg-green-50 p-3">
            <p className="text-xs font-black text-green-700">
              🌱{" "}
              {language === "bn"
                ? "মাটি"
                : "Soil"}
            </p>

            <p className="mt-1 text-lg font-black text-green-900">
              {Math.round(
                priorities.soil_health *
                  100,
              )}
              %
            </p>
          </div>

          <div className="rounded-xl bg-amber-50 p-3">
            <p className="text-xs font-black text-amber-700">
              ☀️{" "}
              {language === "bn"
                ? "জলবায়ু"
                : "Climate"}
            </p>

            <p className="mt-1 text-lg font-black text-amber-900">
              {Math.round(
                priorities.climate_resilience *
                  100,
              )}
              %
            </p>
          </div>

          <div className="rounded-xl bg-purple-50 p-3">
            <p className="text-xs font-black text-purple-700">
              🌾{" "}
              {language === "bn"
                ? "বৈচিত্র্য"
                : "Variety"}
            </p>

            <p className="mt-1 text-lg font-black text-purple-900">
              {Math.round(
                priorities.crop_diversity *
                  100,
              )}
              %
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-5">
        {visible.map(
          (
            {
              recommendation,
            },
            index,
          ) => (
            <RecommendationCard
              key={
                recommendation.rotation_id ??
                index
              }
              recommendation={
                recommendation
              }
              rank={index + 1}
              featured={
                index === 0
              }
              priorities={
                priorities
              }
              language={
                language
              }
              crops={crops}
            />
          ),
        )}
      </div>

      {ranked.length >
        maxItems && (
        <div className="mt-6">
          {hasMore ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-center text-sm font-black text-slate-700">
                {language === "bn"
                  ? `আরও ${remainingCount}টি matching rotation রয়েছে`
                  : `${remainingCount} more matching rotations`}
              </p>

              <button
                type="button"
                onClick={
                  handleShowMore
                }
                className="mx-auto mt-3 flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-xs font-black text-white transition hover:bg-slate-800 active:scale-[0.98]"
              >
                {
                  recommendationText.showMore
                }

                <span className="ml-2 text-base">
                  ↓
                </span>
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
              <p className="text-center text-sm font-black text-green-800">
                {language === "bn"
                  ? `সব ${ranked.length}টি matching rotation দেখানো হচ্ছে`
                  : `All ${ranked.length} matching rotations are shown`}
              </p>

              <button
                type="button"
                onClick={
                  handleShowLess
                }
                className="mx-auto mt-3 flex items-center justify-center rounded-xl border border-green-200 bg-white px-5 py-3 text-xs font-black text-green-700 transition hover:bg-green-100 active:scale-[0.98]"
              >
                ↑{" "}
                {
                  recommendationText.showLess
                }
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}





