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
  selectedCropNames?: string[];
}

function clampScore(value: unknown): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.min(1, parsed));
}

function calculatePriorityFit(
  recommendation: RotationRecommendation,
  priorities: FarmerPriorities,
): number {
  return (
    clampScore(recommendation.water_conservation_score) *
      priorities.water_conservation +
    clampScore(recommendation.soil_health_score) * priorities.soil_health +
    clampScore(recommendation.climate_resilience_score) *
      priorities.climate_resilience +
    clampScore(recommendation.crop_diversity_score) * priorities.crop_diversity
  );
}

export default function RecommendationList({
  recommendations,
  priorities,
  maxItems = 3,
  language = "bn",
  crops = [],
  selectedCropNames = [],
}: RecommendationListProps) {
  const t = language === "bn" ? bn : en;

  const rotationUnit =
    "rotations" in t.recommendations
      ? t.recommendations.rotations
      : language === "bn"
        ? "rotation"
        : "rotations";

  const rotationDescription =
    "description" in t.recommendations
      ? t.recommendations.description
      : "subtitle" in t.recommendations
        ? t.recommendations.subtitle
        : "";

  const showMore = language === "bn" ? "আরও দেখুন" : "Show more";

  const showLess = language === "bn" ? "কম দেখুন" : "Show less";

  const [visibleCount, setVisibleCount] = useState(maxItems);

  const ranked = useMemo(() => {
    return recommendations
      .map((recommendation, index) => ({
        recommendation,
        priorityFit: calculatePriorityFit(recommendation, priorities),
        originalIndex: index,
      }))
      .sort(
        (a, b) =>
          b.priorityFit - a.priorityFit || a.originalIndex - b.originalIndex,
      );
  }, [recommendations, priorities]);

  const visible = ranked.slice(0, Math.min(visibleCount, ranked.length));

  const hasMore = visibleCount < ranked.length;

  const remainingCount = Math.max(0, ranked.length - visibleCount);

  function handleShowMore() {
    setVisibleCount((current) => Math.min(current + 10, ranked.length));
  }

  function handleShowLess() {
    setVisibleCount(maxItems);

    window.requestAnimationFrame(() => {
      const target = document.getElementById("recommendations");

      if (!target) {
        return;
      }

      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      target.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "start",
      });
    });
  }

  return (
    <>
      <div className="fs-head">
        <div>
          <h2 id="rotations-title">{t.recommendations.title}</h2>

          <p>{rotationDescription}</p>

          {selectedCropNames.length > 0 ? (
            <p className="fs-head-filter">
              <span>{language === "bn" ? "নির্বাচিত" : "Filtered by"}</span>{" "}
              {selectedCropNames.join(" · ")}
            </p>
          ) : null}
        </div>

        <span className="fs-head-meta">
          <span className="fs-figure">{ranked.length}</span>
          {rotationUnit}
        </span>
      </div>

      {ranked.length > 0 ? (
        <div className="fs-panel">
          <table className="fs-table fs-rotations">
            <caption className="fs-sr-only">
              {t.recommendations.title}
            </caption>

            <thead>
              <tr>
                <th scope="col" className="fs-col-rank">
                  #
                </th>

                <th scope="col">
                  {language === "bn" ? "ফসলের ক্রম" : "Rotation"}
                </th>

                <th scope="col" className="fs-col-fit">
                  {language === "bn" ? "অগ্রাধিকার মিল" : "Priority fit"}
                </th>

                <th scope="col" className="fs-col-toggle">
                  <span className="fs-sr-only">
                    {language === "bn" ? "হিসাব" : "Calculation"}
                  </span>
                </th>
              </tr>
            </thead>

            <tbody>
              {visible.map(({ recommendation }, index) => (
                <RecommendationCard
                  key={recommendation.rotation_id ?? index}
                  recommendation={recommendation}
                  rank={index + 1}
                  featured={index === 0}
                  priorities={priorities}
                  language={language}
                  crops={crops}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="fs-empty">
          <h3>{t.recommendations.noMatch}</h3>

          <p>{t.recommendations.changeCrops}</p>
        </div>
      )}

      {ranked.length > maxItems ? (
        <div className="fs-more-bar">
          {hasMore ? (
            <>
              <p>
                {language === "bn" ? (
                  <>
                    আরও <strong>{remainingCount}</strong>টি matching rotation
                    রয়েছে
                  </>
                ) : (
                  <>
                    <strong>{remainingCount}</strong> more matching rotations
                  </>
                )}
              </p>

              <button type="button" className="fs-button" onClick={handleShowMore}>
                {showMore}
              </button>
            </>
          ) : (
            <>
              <p>
                {language === "bn" ? (
                  <>
                    সব <strong>{ranked.length}</strong>টি matching rotation
                    দেখানো হচ্ছে
                  </>
                ) : (
                  <>
                    All <strong>{ranked.length}</strong> matching rotations are
                    shown
                  </>
                )}
              </p>

              <button
                type="button"
                className="fs-button-quiet"
                onClick={handleShowLess}
              >
                {showLess}
              </button>
            </>
          )}
        </div>
      ) : null}
    </>
  );
}
