import { useState } from "react";

import type {
  NormalizedCrop,
} from "../../types/crop";

import {
  getBanglaCropName,
  getCropIcon,
} from "../../types/crop";

import type {
  FarmerPriorities,
} from "../../types/farmer";

import type {
  RotationRecommendation,
} from "../../types/recommendation";

interface RecommendationCardProps {
  recommendation: RotationRecommendation;
  rank: number;
  featured?: boolean;
  priorities: FarmerPriorities;
  language?: "bn" | "en";
  crops?: NormalizedCrop[];
}

function normalizeCropName(
  value: string,
): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, " ");
}

function getDisplayCropName(
  cropName: string,
  language: "bn" | "en",
  crops: NormalizedCrop[],
): string {
  if (language === "en") {
    return cropName;
  }

  const normalizedInput =
    normalizeCropName(cropName);

  /*
   * First try the crop list returned by
   * the API. This preserves an API-provided
   * Bangla name when one exists.
   */
  const apiMatch = crops.find(
    (crop) => {
      const englishName =
        normalizeCropName(
          crop.englishName,
        );

      const banglaName =
        normalizeCropName(
          crop.banglaName,
        );

      return (
        englishName ===
          normalizedInput ||
        banglaName ===
          normalizedInput
      );
    },
  );

  if (
    apiMatch?.banglaName &&
    apiMatch.banglaName.trim() &&
    normalizeCropName(
      apiMatch.banglaName,
    ) !==
      normalizeCropName(
        apiMatch.englishName,
      )
  ) {
    return apiMatch.banglaName;
  }

  /*
   * Then use the centralized local
   * Bangla crop dictionary.
   */
  const translated =
    getBanglaCropName(cropName);

  if (
    translated &&
    normalizeCropName(translated) !==
      normalizedInput
  ) {
    return translated;
  }

  /*
   * Final fallback:
   * keep the original API value.
   */
  return cropName;
}

function getDisplayCropIcon(
  cropName: string,
  crops: NormalizedCrop[],
): string {
  const normalizedInput =
    normalizeCropName(cropName);

  const apiMatch = crops.find(
    (crop) =>
      normalizeCropName(
        crop.englishName,
      ) === normalizedInput ||
      normalizeCropName(
        crop.banglaName,
      ) === normalizedInput,
  );

  if (
    apiMatch?.icon &&
    apiMatch.icon !== "🌱"
  ) {
    return apiMatch.icon;
  }

  return getCropIcon(cropName);
}

function clampScore(
  value: unknown,
): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(1, parsed),
  );
}

function formatPercent(
  value: unknown,
): number {
  return Math.round(
    clampScore(value) * 100,
  );
}

export default function RecommendationCard({
  recommendation,
  rank,
  featured = false,
  priorities,
  language = "bn",
  crops = [],
}: RecommendationCardProps) {
  const [showDetails, setShowDetails] =
    useState(false);

  const crop1Raw = String(
    recommendation.crop_1_name ?? "",
  ).trim();

  const crop2Raw = String(
    recommendation.crop_2_name ?? "",
  ).trim();

  const crop1 =
    getDisplayCropName(
      crop1Raw,
      language,
      crops,
    );

  const crop2 =
    getDisplayCropName(
      crop2Raw,
      language,
      crops,
    );

  const crop1Icon =
    getDisplayCropIcon(
      crop1Raw,
      crops,
    );

  const crop2Icon =
    getDisplayCropIcon(
      crop2Raw,
      crops,
    );

  const priorityFit =
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
      priorities.crop_diversity;

  const priorityFitPercent =
    formatPercent(priorityFit);

  const text =
    language === "bn"
      ? {
          bestMatch:
            "আপনার অগ্রাধিকারের সেরা মিল",

          rank: "তম",

          cropPlan:
            "ফসল পরিকল্পনা",

          rankedDescription:
            "আপনার বর্তমান অগ্রাধিকার অনুযায়ী র‍্যাংক করা হয়েছে",

          priorityMatch:
            "অগ্রাধিকার মিল",

          start: "শুরু",

          end: "শেষ",

          priorityCalculation:
            "অগ্রাধিকার হিসাব",

          priorityDescription:
            "আপনার নির্বাচিত অগ্রাধিকার অনুযায়ী এই ফসল পরিকল্পনার স্কোর হিসাব করা হয়েছে।",

          details:
            "বিস্তারিত ↓",

          hideDetails:
            "লুকান ↑",

          water: "পানি",

          soil: "মাটি",

          climate: "জলবায়ু",

          diversity: "বৈচিত্র্য",

          score:
            "স্কোর",

          weight:
            "ওজন",

          contribution:
            "অবদান",

          calculation:
            "স্কোর হিসাব",

          priorityWeights:
            "আপনার অগ্রাধিকার",

          waterScore:
            "পানি সংরক্ষণ",

          soilScore:
            "মাটি স্বাস্থ্য",

          climateScore:
            "জলবায়ু সহনশীলতা",

          diversityScore:
            "ফসল বৈচিত্র্য",

          total:
            "মোট অগ্রাধিকার স্কোর",
        }
      : {
          bestMatch:
            "Best match for your priorities",

          rank: "th",

          cropPlan:
            "Crop plan",

          rankedDescription:
            "Ranked according to your current priorities",

          priorityMatch:
            "Priority match",

          start: "Start",

          end: "End",

          priorityCalculation:
            "Priority calculation",

          priorityDescription:
            "This crop plan score is calculated using your selected priorities.",

          details:
            "Details ↓",

          hideDetails:
            "Hide ↑",

          water: "Water",

          soil: "Soil",

          climate: "Climate",

          diversity: "Diversity",

          score: "Score",

          weight: "Weight",

          contribution:
            "Contribution",

          calculation:
            "Score calculation",

          priorityWeights:
            "Your priorities",

          waterScore:
            "Water conservation",

          soilScore:
            "Soil health",

          climateScore:
            "Climate resilience",

          diversityScore:
            "Crop diversity",

          total:
            "Total priority score",
        };

  const rankLabel =
    rank === 1
      ? language === "bn"
        ? "১ম"
        : "1st"
      : rank === 2
        ? language === "bn"
          ? "২য়"
          : "2nd"
        : rank === 3
          ? language === "bn"
            ? "৩য়"
            : "3rd"
          : `${rank}${text.rank}`;

  const scoreRows = [
    {
      label: text.waterScore,
      shortLabel: text.water,
      icon: "💧",
      score:
        recommendation.water_conservation_score,
      weight:
        priorities.water_conservation,
      color:
        "text-blue-700",
      bg:
        "bg-blue-50",
    },

    {
      label: text.soilScore,
      shortLabel: text.soil,
      icon: "🌱",
      score:
        recommendation.soil_health_score,
      weight:
        priorities.soil_health,
      color:
        "text-green-700",
      bg:
        "bg-green-50",
    },

    {
      label: text.climateScore,
      shortLabel: text.climate,
      icon: "☀️",
      score:
        recommendation.climate_resilience_score,
      weight:
        priorities.climate_resilience,
      color:
        "text-amber-700",
      bg:
        "bg-amber-50",
    },

    {
      label: text.diversityScore,
      shortLabel: text.diversity,
      icon: "🌾",
      score:
        recommendation.crop_diversity_score,
      weight:
        priorities.crop_diversity,
      color:
        "text-purple-700",
      bg:
        "bg-purple-50",
    },
  ];

  return (
    <article
      className={[
        "relative overflow-hidden rounded-[2rem] border bg-white shadow-sm transition-all",
        featured
          ? "border-green-300 shadow-md"
          : "border-slate-200",
      ].join(" ")}
    >
      {featured && (
        <div className="bg-green-700 px-5 py-2.5 text-center text-xs font-black text-white">
          ✓ {text.bestMatch}
        </div>
      )}

      <div className="p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex items-center gap-3">
              <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-xl bg-slate-900 px-2 text-xs font-black text-white">
                {rankLabel}
              </span>

              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                {text.cropPlan}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">
                  {crop1Icon}
                </span>

                <span className="text-xl font-black text-slate-900 sm:text-2xl">
                  {crop1}
                </span>
              </div>

              <span className="text-xl font-black text-slate-300">
                →
              </span>

              <div className="flex items-center gap-2">
                <span className="text-2xl">
                  {crop2Icon}
                </span>

                <span className="text-xl font-black text-slate-900 sm:text-2xl">
                  {crop2}
                </span>
              </div>
            </div>

            <p className="mt-2 text-sm text-slate-500">
              {text.rankedDescription}
            </p>
          </div>

          <div className="shrink-0 rounded-2xl bg-green-50 px-5 py-4 text-center">
            <p className="text-3xl font-black text-green-700">
              {priorityFitPercent}%
            </p>

            <p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-green-600">
              {text.priorityMatch}
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                {text.priorityCalculation}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                {text.priorityDescription}
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setShowDetails(
                  (current) =>
                    !current,
                )
              }
              aria-expanded={
                showDetails
              }
              className="self-start rounded-xl border border-green-200 bg-white px-4 py-2.5 text-xs font-black text-green-700 shadow-sm transition hover:bg-green-50 active:scale-[0.98] sm:self-auto"
            >
              {showDetails
                ? text.hideDetails
                : text.details}
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-white p-3">
              <p className="text-xs font-black text-blue-700">
                💧 {text.water}
              </p>

              <p className="mt-1 text-lg font-black text-slate-900">
                {formatPercent(
                  recommendation.water_conservation_score,
                )}
                %
              </p>
            </div>

            <div className="rounded-xl bg-white p-3">
              <p className="text-xs font-black text-green-700">
                🌱 {text.soil}
              </p>

              <p className="mt-1 text-lg font-black text-slate-900">
                {formatPercent(
                  recommendation.soil_health_score,
                )}
                %
              </p>
            </div>

            <div className="rounded-xl bg-white p-3">
              <p className="text-xs font-black text-amber-700">
                ☀️ {text.climate}
              </p>

              <p className="mt-1 text-lg font-black text-slate-900">
                {formatPercent(
                  recommendation.climate_resilience_score,
                )}
                %
              </p>
            </div>

            <div className="rounded-xl bg-white p-3">
              <p className="text-xs font-black text-purple-700">
                🌾 {text.diversity}
              </p>

              <p className="mt-1 text-lg font-black text-slate-900">
                {formatPercent(
                  recommendation.crop_diversity_score,
                )}
                %
              </p>
            </div>
          </div>

          {showDetails && (
            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-4 py-4">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                  {text.calculation}
                </p>
              </div>

              <div className="divide-y divide-slate-100">
                {scoreRows.map(
                  (row) => {
                    const score =
                      clampScore(
                        row.score,
                      );

                    const weight =
                      clampScore(
                        row.weight,
                      );

                    const contribution =
                      score * weight;

                    return (
                      <div
                        key={
                          row.label
                        }
                        className="p-4"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={[
                              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg",
                              row.bg,
                            ].join(
                              " ",
                            )}
                          >
                            {
                              row.icon
                            }
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                              <p className="text-sm font-black text-slate-800">
                                {
                                  row.label
                                }
                              </p>

                              <p
                                className={[
                                  "text-sm font-black",
                                  row.color,
                                ].join(
                                  " ",
                                )}
                              >
                                +
                                {Math.round(
                                  contribution *
                                    100,
                                )}
                                %
                              </p>
                            </div>

                            <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] font-bold">
                              <div className="rounded-lg bg-slate-50 p-2">
                                <span className="block text-slate-400">
                                  {
                                    text.score
                                  }
                                </span>

                                <strong className="text-slate-700">
                                  {Math.round(
                                    score *
                                      100,
                                  )}
                                  %
                                </strong>
                              </div>

                              <div className="rounded-lg bg-slate-50 p-2">
                                <span className="block text-slate-400">
                                  {
                                    text.weight
                                  }
                                </span>

                                <strong className="text-slate-700">
                                  {Math.round(
                                    weight *
                                      100,
                                  )}
                                  %
                                </strong>
                              </div>

                              <div className="rounded-lg bg-slate-50 p-2">
                                <span className="block text-slate-400">
                                  {
                                    text.contribution
                                  }
                                </span>

                                <strong
                                  className={
                                    row.color
                                  }
                                >
                                  +
                                  {Math.round(
                                    contribution *
                                      100,
                                  )}
                                  %
                                </strong>
                              </div>
                            </div>

                            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className={[
                                  "h-full rounded-full transition-all duration-500",
                                  row.color
                                    .replace(
                                      "text-",
                                      "bg-",
                                    ),
                                ].join(
                                  " ",
                                )}
                                style={{
                                  width: `${Math.min(
                                    contribution *
                                      100,
                                    100,
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  },
                )}
              </div>

              <div className="border-t border-slate-100 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                      {text.total}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {language ===
                      "bn"
                        ? "আপনার নির্বাচিত অগ্রাধিকার অনুযায়ী মোট স্কোর"
                        : "Total score based on your selected priorities"}
                    </p>
                  </div>

                  <div className="rounded-xl bg-green-100 px-4 py-2 text-center">
                    <p className="text-xl font-black text-green-700">
                      {
                        priorityFitPercent
                      }
                      %
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-50 text-xl">
              {crop1Icon}
            </div>

            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                {text.start}
              </p>

              <p className="font-black text-slate-900">
                {crop1}
              </p>
            </div>
          </div>

          <div className="hidden text-slate-300 sm:block">
            →
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-xl">
              {crop2Icon}
            </div>

            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                {text.end}
              </p>

              <p className="font-black text-slate-900">
                {crop2}
              </p>
            </div>
          </div>

          <div className="hidden text-right sm:block">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
              {text.score}
            </p>

            <p className="font-black text-green-700">
              {priorityFitPercent}%
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}