import { useState } from "react";

import type {
  CroppingPattern,
  PatternIndicators,
  PatternRecommendationResponse,
  RecommendedPattern,
  ScoredPattern,
  Season,
} from "../../types/pattern";

import SeasonStrip from "./SeasonStrip";

import bn from "../../i18n/bn";
import en from "../../i18n/en";

type Language = "bn" | "en";

interface PatternRecommendationListProps {
  data: PatternRecommendationResponse;
  results: RecommendedPattern[];
  language?: Language;
  initialItems?: number;
}

const SEASONS: Season[] = ["rabi", "kharif1", "kharif2"];

const INDICATOR_KEYS: (keyof PatternIndicators)[] = [
  "food_production_score",
  "water_productivity_score",
  "soil_health_score",
  "climate_resilience_score",
  "crop_diversity_score",
];

function oneDecimal(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : value.toFixed(1);
}

function signedPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const rounded = Math.round(value);
  return rounded > 0 ? `+${rounded}%` : `${rounded}%`;
}

/** Both sides of a change: food produced and irrigation water, now vs. plan. */
function FoodWaterComparison({
  pattern,
  current,
  language,
}: {
  pattern: CroppingPattern;
  current: CroppingPattern;
  language: Language;
}) {
  const t = strings(language);

  const foodNow = current.production.rice_equivalent_t_ha;
  const foodPlan = pattern.production.rice_equivalent_t_ha;
  const waterNow = current.water.irrigation_mm;
  const waterPlan = pattern.water.irrigation_mm;

  const foodPct =
    foodNow && foodPlan !== null ? ((foodPlan - foodNow) / foodNow) * 100 : null;
  const waterChange =
    waterNow !== null && waterPlan !== null ? waterPlan - waterNow : null;

  const tile = (
    icon: string,
    label: string,
    now: string,
    plan: string,
    unit: string,
    change: string,
    good: boolean | null,
  ) => (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <p className="text-[11px] font-black text-slate-500">
        {icon} {label}
      </p>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <p className="text-xs text-slate-500">
          {t.now}: <span className="font-black text-slate-700">{now}</span>
        </p>
        <p className="text-xs text-slate-500">
          {t.withPlan}: <span className="text-base font-black text-slate-900">{plan}</span>
        </p>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <p className="text-[10px] text-slate-400">{unit}</p>
        {change && (
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-black ${good === null ? "bg-slate-100 text-slate-600" : good ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
          >
            {change}
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {tile(
        "🍚",
        t.foodProduced,
        oneDecimal(foodNow),
        oneDecimal(foodPlan),
        t.riceEquivalent,
        signedPercent(foodPct),
        foodPct === null || Math.round(foodPct) === 0 ? null : foodPct > 0,
      )}
      {tile(
        "💧",
        t.waterNeeded,
        waterNow === null ? "—" : String(Math.round(waterNow)),
        waterPlan === null ? "—" : String(Math.round(waterPlan)),
        t.irrigationUnit,
        waterChange === null ? "" : `${waterChange > 0 ? "+" : ""}${Math.round(waterChange)} mm`,
        waterChange === null || Math.round(waterChange) === 0 ? null : waterChange < 0,
      )}
    </div>
  );
}

function strings(language: Language) {
  return language === "bn" ? bn.patterns : en.patterns;
}

function fill(
  template: string,
  values: Record<string, string | number>,
): string {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, String(value)),
    template,
  );
}

function points(value: number | null | undefined): string {
  return value === null || value === undefined
    ? "—"
    : String(Math.round(value * 100));
}

function signedPoints(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "—";
  }

  const rounded = Math.round(value * 100);
  return rounded > 0 ? `+${rounded}` : String(rounded);
}

function patternName(
  pattern: CroppingPattern,
  language: Language,
): string {
  return SEASONS.map((season) => {
    const crop = pattern.seasons[season];
    return language === "bn" ? crop.name_bn : crop.name_en;
  }).join(" – ");
}

function SeasonChips({
  pattern,
  language,
}: {
  pattern: CroppingPattern;
  language: Language;
}) {
  const t = strings(language);

  return (
    <div className="grid grid-cols-3 gap-2">
      {SEASONS.map((season) => {
        const crop = pattern.seasons[season];

        return (
          <div
            key={season}
            className={`rounded-xl px-2.5 py-2 ${crop.is_fallow ? "bg-slate-50" : "bg-green-50"}`}
          >
            <p className="truncate text-[10px] font-bold text-slate-400">
              {t.seasons[season]}
            </p>
            <p
              className={`mt-0.5 truncate text-sm font-black ${crop.is_fallow ? "text-slate-400" : "text-green-900"}`}
            >
              {language === "bn" ? crop.name_bn : crop.name_en}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function AdoptionLine({
  pattern,
  language,
}: {
  pattern: CroppingPattern;
  language: Language;
}) {
  const t = strings(language);
  const adoption = pattern.adoption;

  const line =
    adoption.region_pct_nca !== null
      ? fill(t.adoptionRegion, {
          pct: adoption.region_pct_nca,
          n: adoption.region_upazila_count ?? "—",
        })
      : adoption.national_pct_nca !== null
        ? fill(t.adoptionNational, { pct: adoption.national_pct_nca })
        : null;

  return (
    <div className="text-xs leading-5 text-slate-500">
      {line && <p>📍 {line}</p>}

      {adoption.feni_upazilas.length > 0 && (
        <p>
          {t.inFeni}{" "}
          {adoption.feni_upazilas
            .map((item) => item.upazila)
            .join(", ")}
        </p>
      )}
    </div>
  );
}

function ScheduleDetails({
  pattern,
  language,
}: {
  pattern: CroppingPattern;
  language: Language;
}) {
  const t = strings(language);

  return (
    <div className="space-y-2 text-xs leading-5 text-slate-600">
      <p className="font-black text-slate-700">{t.calendarDates}</p>

      <ul className="space-y-0.5">
        {pattern.schedule.map((crop) => (
          <li key={crop.crop_id}>
            {language === "bn" ? crop.name_bn : crop.name_en}: {crop.start} → {crop.end} ({crop.field_days}d,{" "}
            {crop.variant_id})
          </li>
        ))}
      </ul>

      <p>
        {fill(t.turnaround, {
          n: pattern.feasibility.turnaround_days_assumed,
        })}
      </p>

      {pattern.notes && <p>{pattern.notes}</p>}

      <p>
        {t.source}: {pattern.adoption.source_id.replace("_", " ")} —{" "}
        {pattern.adoption.source_detail}
      </p>
    </div>
  );
}

function cropName(pattern: CroppingPattern, cropId: string | null, language: Language): string {
  const crop = pattern.per_crop.find((item) => item.crop_id === cropId);
  if (!crop) return cropId ?? "";
  return language === "bn" ? crop.name_bn : crop.name_en;
}

/** What each crop is used for, so a farmer sees why maize is not counted like rice. */
function EndUseChips({
  pattern,
  language,
}: {
  pattern: CroppingPattern;
  language: Language;
}) {
  const t = strings(language);

  return (
    <div className="flex flex-wrap gap-2 text-[11px] font-bold">
      {pattern.per_crop.map((crop) => {
        const lowShare = crop.human_food_share !== null && crop.human_food_share < 0.5;
        const share =
          crop.human_food_share === null
            ? t.endUseUnknown
            : fill(t.eatenByPeople, { pct: Math.round(crop.human_food_share * 100) });

        return (
          <span
            key={crop.crop_id}
            className={`rounded-full px-2.5 py-1 ${lowShare || crop.human_food_share === null ? "bg-orange-50 text-orange-900" : "bg-slate-50 text-slate-700"}`}
          >
            {language === "bn" ? crop.name_bn : crop.name_en}:{" "}
            {crop.end_use_class ? t.endUse[crop.end_use_class] : t.endUseUnknown} · {share}
          </span>
        );
      })}
    </div>
  );
}

/** Market-reality and yield-evidence warnings, shown on the card itself. */
function EvidenceFlags({
  pattern,
  language,
}: {
  pattern: CroppingPattern;
  language: Language;
}) {
  const t = strings(language);
  const { market_reality: market, yield_evidence: yields } = pattern.evidence_flags;

  if (market.length === 0 && yields.length === 0) {
    return null;
  }

  return (
    <div className="space-y-1 rounded-2xl border border-orange-200 bg-orange-50 p-3 text-xs leading-5 text-orange-950">
      {market.length > 0 && (
        <>
          <p className="font-black">🏪 {t.marketFlag}</p>
          {market.map((flag) => (
            <p key={`${flag.code}-${flag.crop_id}`}>
              ·{" "}
              {flag.code === "not_in_regional_survey"
                ? t.notInSurvey
                : fill(t.marketFlagCrop, {
                    crop: cropName(pattern, flag.crop_id, language),
                    area: Math.round(flag.feni_area_ha ?? 0),
                  })}
            </p>
          ))}
        </>
      )}
      {yields.map((flag) => (
        <p key={`yield-${flag.crop_id}`}>
          📏{" "}
          {fill(t.yieldFlag, {
            crop: cropName(pattern, flag.crop_id, language),
            area: Math.round(flag.feni_area_ha ?? 0),
          })}
        </p>
      ))}
    </div>
  );
}

function CurrentPatternCard({
  pattern,
  language,
}: {
  pattern: ScoredPattern;
  language: Language;
}) {
  const t = strings(language);

  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
            {t.currentTitle}
          </p>
          <h3 className="mt-1 text-lg font-black text-slate-900 sm:text-xl">
            {patternName(pattern, language)}
          </h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {t.currentSubtitle}
          </p>
        </div>

        {pattern.score !== null && (
          <div className="shrink-0 rounded-2xl bg-slate-50 px-3 py-2 text-center">
            <p className="text-xl font-black text-slate-700">
              {points(pattern.score)}
            </p>
            <p className="text-[10px] font-bold text-slate-400">
              {t.points}
            </p>
          </div>
        )}
      </div>

      <div className="mt-4">
        <SeasonChips pattern={pattern} language={language} />
      </div>

      <div className="mt-3">
        <SeasonStrip schedule={pattern.schedule} language={language} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-slate-50 p-3">
          <p className="text-[11px] font-black text-slate-500">🍚 {t.foodProduced}</p>
          <p className="text-lg font-black text-slate-900">
            {oneDecimal(pattern.production.rice_equivalent_t_ha)}
          </p>
          <p className="text-[10px] text-slate-400">{t.riceEquivalent}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3">
          <p className="text-[11px] font-black text-slate-500">💧 {t.waterNeeded}</p>
          <p className="text-lg font-black text-slate-900">
            {pattern.water.irrigation_mm === null ? "—" : Math.round(pattern.water.irrigation_mm)}
          </p>
          <p className="text-[10px] text-slate-400">{t.irrigationUnit}</p>
        </div>
      </div>

      <div className="mt-3">
        <AdoptionLine pattern={pattern} language={language} />
      </div>
    </div>
  );
}

function PerCropTable({
  pattern,
  language,
}: {
  pattern: CroppingPattern;
  language: Language;
}) {
  const t = strings(language);

  return (
    <div className="text-xs leading-5 text-slate-600">
      <p className="font-black text-slate-700">{t.perCrop}</p>
      <ul className="mt-1 space-y-0.5">
        {pattern.per_crop.map((crop) => (
          <li key={crop.crop_id}>
            {language === "bn" ? crop.name_bn : crop.name_en}:{" "}
            {crop.yield_t_ha !== undefined ? `${crop.yield_t_ha} t/ha` : "—"}
            {", "}
            {crop.irrigation_mm !== undefined ? `${Math.round(crop.irrigation_mm)} mm` : "—"}
          </li>
        ))}
      </ul>
      <p className="mt-1 text-slate-500">{t.foodNote}</p>
    </div>
  );
}

function RecommendationCard({
  pattern,
  current,
  language,
  highlight,
}: {
  pattern: RecommendedPattern;
  current: ScoredPattern;
  language: Language;
  highlight: boolean;
}) {
  const t = strings(language);
  const [open, setOpen] = useState(false);

  const comparison = pattern.comparison;
  const isTradeOff = comparison.change_kind === "trade_off";
  const changes = pattern.season_changes.filter(
    (item) => item.change !== "same",
  );

  return (
    <article
      className={`overflow-hidden rounded-[2rem] border bg-white shadow-sm ${highlight ? "border-green-300" : "border-slate-200"}`}
    >
      {highlight && (
        <div className="bg-green-700 px-5 py-1.5 text-center text-[11px] font-black text-white">
          ✓ {t.bestMatch}
        </div>
      )}

      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
              {t.plan} {pattern.rank ?? ""}
            </p>
            <h3 className="mt-1 text-lg font-black text-slate-900 sm:text-xl">
              {patternName(pattern, language)}
            </h3>
          </div>

          {pattern.score_change !== undefined && pattern.score_change !== null && (
            <div
              className={`shrink-0 rounded-2xl px-3 py-2 text-center ${pattern.score_change >= 0 ? "bg-green-50" : "bg-red-50"}`}
            >
              <p
                className={`text-xl font-black ${pattern.score_change >= 0 ? "text-green-700" : "text-red-700"}`}
              >
                {signedPoints(pattern.score_change)}
              </p>
              <p className="text-[10px] font-bold text-slate-500">
                {t.points} {t.vsNow}
              </p>
            </div>
          )}
        </div>

        {/* What changes */}
        <div className="mt-4 rounded-2xl bg-slate-50 p-4">
          <p className="text-xs font-black text-slate-700">
            {t.whatChanges}
          </p>

          <ul className="mt-2 space-y-1.5">
            {changes.map((item) => (
              <li
                key={item.season}
                className="flex flex-wrap items-center gap-x-2 text-sm"
              >
                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-slate-500">
                  {t.seasons[item.season]}
                </span>
                <span className="font-black text-slate-900">
                  {t.change[item.change]}:
                </span>
                <span className="text-slate-500 line-through">
                  {language === "bn" ? item.from.name_bn : item.from.name_en}
                </span>
                <span className="text-slate-400">→</span>
                <span className="font-black text-green-800">
                  {language === "bn" ? item.to.name_bn : item.to.name_en}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Both sides of the change */}
        <div className="mt-4 space-y-2">
          <span
            className={`inline-block rounded-full px-3 py-1 text-[11px] font-black ${isTradeOff ? "bg-amber-100 text-amber-900" : "bg-green-100 text-green-900"}`}
          >
            {isTradeOff ? `⚖️ ${t.tradeOff}` : `✓ ${t.improvement}`}
          </span>

          <FoodWaterComparison pattern={pattern} current={current} language={language} />

          {pattern.production.gross_rice_equivalent_t_ha !== null && (
            <p className="text-[11px] leading-5 text-slate-500">
              {fill(t.totalOutput, {
                value: oneDecimal(pattern.production.gross_rice_equivalent_t_ha),
              })}
            </p>
          )}

          <EndUseChips pattern={pattern} language={language} />

          <EvidenceFlags pattern={pattern} language={language} />
        </div>

        <div className="mt-4">
          <SeasonStrip schedule={pattern.schedule} language={language} />
        </div>

        {/* Facts and warnings */}
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold">
          <span className="rounded-full bg-green-50 px-2.5 py-1 text-green-800">
            🌾 {t.riceSeasons}: {pattern.facts.rice_crop_count}
          </span>

          {pattern.facts.legume_crop_count > 0 && (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-800">
              🫘 {t.pulse}
            </span>
          )}

          <span
            className={`rounded-full px-2.5 py-1 ${pattern.feasibility.status === "tight" ? "bg-orange-50 text-orange-800" : "bg-slate-50 text-slate-600"}`}
          >
            📅 {t.status[pattern.feasibility.status]}
          </span>
        </div>

        {(isTradeOff || comparison.harvests_change > 0) && (
          <div className="mt-3 space-y-1 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
            {comparison.trade_offs.map((item) => (
              <p key={item.code}>⚠️ {t.tradeOffs[item.code]}</p>
            ))}
            {comparison.harvests_change > 0 && <p>ℹ️ {t.moreHarvests}</p>}
          </div>
        )}

        <div className="mt-3">
          <AdoptionLine pattern={pattern} language={language} />
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="mt-4 text-xs font-black text-green-700"
          aria-expanded={open}
        >
          {open ? t.hideDetails : t.details} {open ? "↑" : "↓"}
        </button>

        {open && (
          <div className="mt-3 space-y-4 border-t border-slate-100 pt-4">
            {pattern.indicators && (
              <div>
                <p className="text-xs font-black text-slate-700">
                  {t.scoreParts}
                </p>

                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {INDICATOR_KEYS.map((key) => (
                    <div key={key} className="rounded-xl bg-slate-50 p-3">
                      <p className="text-[10px] font-bold text-slate-400">
                        {t.indicator[key]}
                      </p>
                      <p className="text-sm font-black text-slate-800">
                        {points(pattern.indicators?.[key])}{" "}
                        <span className="text-xs text-slate-500">
                          ({signedPoints(pattern.indicator_changes?.[key])})
                        </span>
                      </p>
                    </div>
                  ))}
                </div>

                <p className="mt-2 text-[11px] leading-5 text-slate-500">
                  {t.provisional}
                </p>
              </div>
            )}

            <PerCropTable pattern={pattern} language={language} />

            <ScheduleDetails pattern={pattern} language={language} />
          </div>
        )}
      </div>
    </article>
  );
}

function OtherPatterns({
  data,
  language,
}: {
  data: PatternRecommendationResponse;
  language: Language;
}) {
  const t = strings(language);
  const others: CroppingPattern[] = [
    ...data.not_scored,
    ...data.not_recommended,
  ];

  if (others.length === 0) {
    return null;
  }

  return (
    <details className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <summary className="cursor-pointer px-5 py-4">
        <span className="text-sm font-black text-slate-800">
          {t.otherTitle} ({others.length})
        </span>
        <span className="mt-0.5 block text-xs text-slate-500">
          {t.otherSubtitle}
        </span>
      </summary>

      <ul className="divide-y divide-slate-100 border-t border-slate-200">
        {others.map((pattern) => {
          const notScored =
            pattern.indicators === null &&
            (pattern.feasibility.status === "feasible" ||
              pattern.feasibility.status === "tight");

          return (
            <li key={pattern.pattern_id} className="px-5 py-3 text-xs leading-5">
              <p className="text-sm font-black text-slate-800">
                {patternName(pattern, language)}
              </p>
              <p className="font-bold text-slate-500">
                {notScored
                  ? t.status.notScored
                  : t.status[pattern.feasibility.status]}
              </p>
              {pattern.feasibility.reasons.map((reason) => (
                <p key={reason} className="text-slate-500">
                  {reason}
                </p>
              ))}
              {pattern.feasibility.calendar_conflict && (
                <p className="text-amber-700">{t.conflict}</p>
              )}
              {notScored &&
                pattern.production.unknown_end_use_crops.map((cropId) => (
                  <p key={cropId} className="text-orange-800">
                    {fill(t.notScoredEndUse, { crop: cropName(pattern, cropId, language) })}
                  </p>
                ))}
              <AdoptionLine pattern={pattern} language={language} />
            </li>
          );
        })}
      </ul>
    </details>
  );
}

export default function PatternRecommendationList({
  data,
  results,
  language = "bn",
  initialItems = 3,
}: PatternRecommendationListProps) {
  const t = strings(language);
  const [expanded, setExpanded] = useState(false);

  const visible = expanded ? results : results.slice(0, initialItems);

  return (
    <div className="space-y-4">
      <CurrentPatternCard pattern={data.current} language={language} />

      {results.length === 0 ? (
        <div className="rounded-[2rem] border border-amber-200 bg-amber-50 p-6 text-center text-sm font-black text-amber-950">
          {t.noMatch}
        </div>
      ) : (
        visible.map((pattern, index) => (
          <RecommendationCard
            key={pattern.pattern_id}
            pattern={pattern}
            current={data.current}
            language={language}
            highlight={index === 0}
          />
        ))
      )}

      {results.length > initialItems && (
        <div className="text-center">
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-black text-white"
          >
            {expanded ? t.showLess : `${t.showMore} (${results.length - initialItems})`}
          </button>
        </div>
      )}

      <OtherPatterns data={data} language={language} />
    </div>
  );
}
