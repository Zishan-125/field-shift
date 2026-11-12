import { useEffect, useState } from "react";

import { getPatternRecommendations } from "../../services/api";

import {
  DEFAULT_CURRENT_PATTERN_ID,
  DEFAULT_PATTERN_PRIORITIES,
  type PatternRecommendationResponse,
  type RecommendedPattern,
  type ScoredPattern,
} from "../../types/pattern";

import bn from "../../i18n/bn";
import en from "../../i18n/en";

type Language = "bn" | "en";
type Verdict = "keep" | "adjust" | "shift";

// A UI rule, not data: the best pattern must beat the current one by at
// least this much of the 0-1 score before we suggest any change.
const KEEP_MARGIN = 0.02;
const SEASONS = ["rabi", "kharif1", "kharif2"] as const;

function strings(language: Language) {
  return language === "bn" ? bn.verdict : en.verdict;
}

function fill(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((text, [key, value]) => text.split(`{${key}}`).join(String(value)), template);
}

function num(value: number, language: Language, digits = 0): string {
  return value.toLocaleString(language === "bn" ? "bn-BD" : "en-GB", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function patternName(pattern: ScoredPattern, language: Language): string {
  return SEASONS.map((s) => (language === "bn" ? pattern.seasons[s].name_bn : pattern.seasons[s].name_en)).join(" – ");
}

export function verdictFor(data: PatternRecommendationResponse): Verdict {
  const best = data.results[0];
  if (!best || best.score === null || data.current.score === null) return "keep";
  if (best.score - data.current.score < KEEP_MARGIN) return "keep";
  const changed = best.season_changes.filter((c) => c.change !== "same").length;
  return changed <= 1 ? "adjust" : "shift";
}

/** One plain line pointing at the evidence behind a recommendation. */
export function whyLine(pattern: RecommendedPattern, current: ScoredPattern, language: Language): string {
  const t = strings(language);
  const driver = pattern.risk_driver;

  if (driver) {
    const e = driver.evidence;
    return fill(t.why[driver.hazard], {
      crop: language === "bn" ? e.name_bn : e.name_en,
      n: num(e.n_hit, language),
      m: num(e.n_years, language),
    });
  }

  const food = pattern.production.rice_equivalent_t_ha ?? 0;
  const foodNow = current.production.rice_equivalent_t_ha ?? 0;
  const water = pattern.water.irrigation_mm ?? 0;
  const waterNow = current.water.irrigation_mm ?? 0;
  return fill(t.whyFoodWater, {
    food: num(food, language, 1),
    foodNow: num(foodNow, language, 1),
    water: num(water, language),
    waterNow: num(waterNow, language),
  });
}

function Row({
  pattern,
  current,
  language,
  highlight,
}: {
  pattern: ScoredPattern | RecommendedPattern;
  current: ScoredPattern;
  language: Language;
  highlight?: string;
}) {
  const t = strings(language);
  const isCurrent = pattern.pattern_id === current.pattern_id;

  return (
    <li className={`rounded-2xl border p-3 ${isCurrent ? "border-slate-300 bg-slate-50" : "border-slate-200 bg-white"}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="text-sm font-black text-slate-900">
          {highlight && <span className="mr-1 text-orange-700">{highlight}</span>}
          {patternName(pattern, language)}
        </p>
        {isCurrent && <span className="text-[11px] font-bold text-slate-500">{t.now}</span>}
      </div>
      <div className="mt-1 grid grid-cols-2 gap-2 text-xs text-slate-700">
        <span>
          🍚 {t.food}: <b>{num(pattern.production.rice_equivalent_t_ha ?? 0, language, 1)}</b> {t.foodUnit}
        </span>
        <span>
          💧 {t.irrigation}: <b>{num(pattern.water.irrigation_mm ?? 0, language)}</b> {t.mm}
        </span>
      </div>
      {!isCurrent && (
        <p className="mt-1 text-xs leading-5 text-slate-700">
          <span className="font-black">{t.whyLabel}</span> {whyLine(pattern as RecommendedPattern, current, language)}
        </p>
      )}
    </li>
  );
}

export default function VerdictCard({
  fieldId,
  fieldName,
  language,
  sameTopEverywhere = false,
}: {
  fieldId: string;
  fieldName: string;
  language: Language;
  sameTopEverywhere?: boolean;
}) {
  const t = strings(language);
  const [data, setData] = useState<PatternRecommendationResponse | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setData(null);
    setError(false);
    getPatternRecommendations(fieldId, DEFAULT_PATTERN_PRIORITIES, DEFAULT_CURRENT_PATTERN_ID)
      .then((response) => active && setData(response))
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, [fieldId]);

  if (error) return <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">{t.error}</p>;
  if (!data) return <div className="h-56 animate-pulse rounded-[2rem] bg-slate-100" />;

  const verdict = verdictFor(data);
  const best = data.results[0];
  const top = data.results.slice(0, 3);
  const changed = best ? best.season_changes.filter((c) => c.change !== "same") : [];
  const seasonName = (s: string) => t.season[s as keyof typeof t.season] ?? s;

  let sentence: string;
  if (verdict === "keep" || !best) {
    sentence = fill(t.keepSentence, { current: patternName(data.current, language) });
  } else if (verdict === "adjust") {
    const c = changed[0];
    sentence = fill(t.adjustSentence, {
      season: seasonName(c.season),
      from: language === "bn" ? c.from.name_bn : c.from.name_en,
      to: language === "bn" ? c.to.name_bn : c.to.name_en,
      why: whyLine(best, data.current, language),
    });
  } else {
    sentence = fill(t.shiftSentence, { best: patternName(best, language), why: whyLine(best, data.current, language) });
  }

  const badge = { keep: "bg-emerald-600", adjust: "bg-amber-500", shift: "bg-orange-600" }[verdict];

  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-700">
        {fill(t.eyebrow, { field: fieldName })}
      </p>
      <div className="mt-2 flex items-center gap-3">
        <span className={`rounded-xl px-3 py-1.5 text-lg font-black text-white ${badge}`}>{t.label[verdict]}</span>
        <span className="text-xs text-slate-500">{t.labelOther[verdict]}</span>
      </div>
      <p className="mt-3 text-base font-bold leading-7 text-slate-900">{sentence}</p>

      <ul className="mt-4 space-y-2">
        <Row pattern={data.current} current={data.current} language={language} />
        {top.map((pattern, i) => (
          <Row key={pattern.pattern_id} pattern={pattern} current={data.current} language={language} highlight={`${num(i + 1, language)}.`} />
        ))}
      </ul>

      {data.field_observation?.never_cropped && (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950">
          🚫 {fill(t.notObservedReason, { n: num(data.field_observation.readable, language) })}{" "}
          ({fill(t.notObservedTitle, { n: num(data.not_observed_on_field?.length ?? 0, language) })})
        </p>
      )}

      {sameTopEverywhere && (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-950">⚠️ {t.sameTop}</p>
      )}

      <details className="mt-3 text-[11px] leading-5 text-slate-500">
        <summary className="cursor-pointer font-black text-blue-700">{t.howTitle}</summary>
        <p className="mt-1">{t.howText}</p>
      </details>
    </div>
  );
}
