import { Fragment, useState } from "react";

import { ChevronDown } from "lucide-react";

import type { NormalizedCrop } from "../../types/crop";

import { getBanglaCropName } from "../../types/crop";

import type { FarmerPriorities } from "../../types/farmer";

import type { RotationRecommendation } from "../../types/recommendation";

import { getCropImage } from "./cropImages";

interface RecommendationCardProps {
  recommendation: RotationRecommendation;
  rank: number;
  featured?: boolean;
  priorities: FarmerPriorities;
  language?: "bn" | "en";
  crops?: NormalizedCrop[];
}

function normalizeCropName(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, " ");
}

function getDisplayCropName(
  cropName: string,
  language: "bn" | "en",
  crops: NormalizedCrop[],
): string {
  if (language === "en") {
    return cropName;
  }

  const normalizedInput = normalizeCropName(cropName);

  /*
   * First try the crop list returned by the API.
   * This preserves an API-provided Bangla name
   * when one exists.
   */
  const apiMatch = crops.find((crop) => {
    const englishName = normalizeCropName(crop.englishName);

    const banglaName = normalizeCropName(crop.banglaName);

    return englishName === normalizedInput || banglaName === normalizedInput;
  });

  if (
    apiMatch?.banglaName &&
    apiMatch.banglaName.trim() &&
    normalizeCropName(apiMatch.banglaName) !==
      normalizeCropName(apiMatch.englishName)
  ) {
    return apiMatch.banglaName;
  }

  /*
   * Then use the centralized local
   * Bangla crop dictionary.
   */
  const translated = getBanglaCropName(cropName);

  if (translated && normalizeCropName(translated) !== normalizedInput) {
    return translated;
  }

  /*
   * Final fallback: keep the original API value.
   */
  return cropName;
}

function clampScore(value: unknown): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.min(1, parsed));
}

function formatPercent(value: unknown): number {
  return Math.round(clampScore(value) * 100);
}

export default function RecommendationCard({
  recommendation,
  rank,
  featured = false,
  priorities,
  language = "bn",
  crops = [],
}: RecommendationCardProps) {
  const [showDetails, setShowDetails] = useState(false);

  const rotation = [
    recommendation.crop_1_name,
    recommendation.crop_2_name,
    recommendation.crop_3_name,
  ]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .map((raw) => ({
      raw,
      name: getDisplayCropName(raw, language, crops),
      image: getCropImage(raw),
    }));

  const priorityFit =
    clampScore(recommendation.water_conservation_score) *
      priorities.water_conservation +
    clampScore(recommendation.soil_health_score) * priorities.soil_health +
    clampScore(recommendation.climate_resilience_score) *
      priorities.climate_resilience +
    clampScore(recommendation.crop_diversity_score) * priorities.crop_diversity;

  const priorityFitPercent = formatPercent(priorityFit);

  const text =
    language === "bn"
      ? {
          bestMatch: "আপনার অগ্রাধিকারের সেরা মিল",
          rank: "তম",
          priorityMatch: "অগ্রাধিকার মিল",
          priorityDescription:
            "আপনার নির্বাচিত অগ্রাধিকার অনুযায়ী এই ফসল পরিকল্পনার স্কোর হিসাব করা হয়েছে।",
          legend: "স্কোর × ওজন = অবদান",
          details: "বিস্তারিত",
          hideDetails: "লুকান",
          waterScore: "পানি সংরক্ষণ",
          soilScore: "মাটি স্বাস্থ্য",
          climateScore: "জলবায়ু সহনশীলতা",
          diversityScore: "ফসল বৈচিত্র্য",
          total: "মোট অগ্রাধিকার স্কোর",
        }
      : {
          bestMatch: "Best match for your priorities",
          rank: "th",
          priorityMatch: "Priority fit",
          priorityDescription:
            "This crop plan score is calculated using your selected priorities.",
          legend: "Score × your weight = contribution",
          details: "Details",
          hideDetails: "Hide",
          waterScore: "Water conservation",
          soilScore: "Soil health",
          climateScore: "Climate resilience",
          diversityScore: "Crop diversity",
          total: "Total priority score",
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
      score: recommendation.water_conservation_score,
      weight: priorities.water_conservation,
    },
    {
      label: text.soilScore,
      score: recommendation.soil_health_score,
      weight: priorities.soil_health,
    },
    {
      label: text.climateScore,
      score: recommendation.climate_resilience_score,
      weight: priorities.climate_resilience,
    },
    {
      label: text.diversityScore,
      score: recommendation.crop_diversity_score,
      weight: priorities.crop_diversity,
    },
  ];

  const detailId = `rotation-detail-${rank}`;

  return (
    <Fragment>
      <tr className={featured ? "fs-row is-top" : "fs-row"}>
        <td className="fs-cell-rank">
          <span className="fs-rank">{rankLabel}</span>
        </td>

        <td className="fs-cell-plan">
          {rotation.length > 0 ? (
            <ol className="fs-sequence">
              {rotation.map((crop, index) => (
                <li key={`${crop.raw}-${index}`}>
                  {crop.image ? (
                    <img
                      className="fs-crop-thumb"
                      src={crop.image}
                      alt=""
                      width={28}
                      height={28}
                      loading="lazy"
                    />
                  ) : null}

                  <span className="fs-sequence-name">{crop.name}</span>
                </li>
              ))}
            </ol>
          ) : (
            <span className="fs-sequence-name">—</span>
          )}

          {featured ? <p className="fs-top-note">{text.bestMatch}</p> : null}
        </td>

        <td className="fs-cell-fit">
          <span className="fs-fit">
            {priorityFitPercent}
            <span className="fs-fit-unit">%</span>
          </span>

          <span className="fs-fit-note">{text.priorityMatch}</span>
        </td>

        <td className="fs-cell-toggle">
          <button
            type="button"
            className="fs-disclosure"
            onClick={() => setShowDetails((current) => !current)}
            aria-expanded={showDetails}
            aria-controls={showDetails ? detailId : undefined}
          >
            {showDetails ? text.hideDetails : text.details}

            <ChevronDown size={14} strokeWidth={2} aria-hidden="true" />
          </button>
        </td>
      </tr>

      {showDetails ? (
        <tr className="fs-more">
          <td colSpan={4}>
            <div id={detailId} className="fs-factors">
              <p className="fs-factors-note">
                {text.priorityDescription} {text.legend}
              </p>

              <div className="fs-factor-list">
                {scoreRows.map((row) => {
                  const score = clampScore(row.score);

                  const weight = clampScore(row.weight);

                  const contribution = score * weight;

                  return (
                    <div key={row.label} className="fs-factor">
                      <span className="fs-factor-name">{row.label}</span>

                      <span className="fs-factor-calc">
                        {Math.round(score * 100)}% ×{" "}
                        {Math.round(weight * 100)}% = +
                        {Math.round(contribution * 100)}%
                      </span>

                      <span className="fs-factor-bar" aria-hidden="true">
                        <span
                          style={{
                            width: `${Math.min(contribution * 100, 100)}%`,
                          }}
                        />
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="fs-factor-total">
                <span>{text.total}</span>

                <strong>{priorityFitPercent}%</strong>
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </Fragment>
  );
}
