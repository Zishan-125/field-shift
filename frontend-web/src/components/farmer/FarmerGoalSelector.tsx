import { useMemo, useState } from "react";

import type { PatternPriorities } from "../../types/pattern";
import { DEFAULT_PATTERN_PRIORITIES } from "../../types/pattern";

interface FarmerGoalSelectorProps {
  priorities: PatternPriorities;
  onChange: (priorities: PatternPriorities) => void;
  onApply?: () =>
    | Promise<boolean | void>
    | boolean
    | void;
  loading?: boolean;
  language?: "bn" | "en";
}

type GoalKey = keyof PatternPriorities;

interface Goal {
  key: GoalKey;
  icon: string;
  titleBn: string;
  titleEn: string;
  descriptionBn: string;
  descriptionEn: string;
}

const GOALS: Goal[] = [
  {
    key: "food_production",
    icon: "🍚",
    titleBn: "বেশি খাদ্য উৎপাদন",
    titleEn: "Grow more food",
    descriptionBn:
      "জমি থেকে বছরে বেশি খাদ্য পেতে চাই",
    descriptionEn:
      "More food from your land each year",
  },
  {
    key: "water_productivity",
    icon: "💧",
    titleBn: "পানির সদ্ব্যবহার",
    titleEn: "More food per drop",
    descriptionBn:
      "যতটুকু পানি লাগে, তা থেকে বেশি ফসল চাই",
    descriptionEn:
      "Get more food from the water your crops need",
  },
  {
    key: "soil_health",
    icon: "🌱",
    titleBn: "মাটির স্বাস্থ্য",
    titleEn: "Protect soil",
    descriptionBn:
      "মাটির স্বাস্থ্য ভালো রাখতে চাই",
    descriptionEn:
      "Keep your soil healthy",
  },
  {
    key: "climate_resilience",
    icon: "☀️",
    titleBn: "জলবায়ু মোকাবিলা",
    titleEn: "Handle climate",
    descriptionBn:
      "পরিবর্তনশীল আবহাওয়ার জন্য প্রস্তুত থাকতে চাই",
    descriptionEn:
      "Prepare for changing weather",
  },
  {
    key: "crop_diversity",
    icon: "🌾",
    titleBn: "ফসলের বৈচিত্র্য",
    titleEn: "More crop variety",
    descriptionBn:
      "বিভিন্ন ধরনের ফসল চাষ করতে চাই",
    descriptionEn:
      "Maintain crop diversity",
  },
];

const KEYS = GOALS.map((goal) => goal.key);

const STEP = 0.1;

function normalize(
  priorities: PatternPriorities,
): PatternPriorities {
  const values = KEYS.map((key) => {
    const value = Number(priorities[key]);
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  });

  const total = values.reduce(
    (sum, value) => sum + value,
    0,
  );

  if (total <= 0) {
    return {
      ...DEFAULT_PATTERN_PRIORITIES,
    };
  }

  const next = { ...DEFAULT_PATTERN_PRIORITIES };

  KEYS.forEach((key, index) => {
    next[key] = values[index] / total;
  });

  return next;
}

/** Make one goal the main goal (40 %) and share the rest as in the default. */
function buildPriorities(
  selected: GoalKey,
): PatternPriorities {
  const remainingKeys = KEYS.filter(
    (key) => key !== selected,
  );

  const remainingBase = remainingKeys.reduce(
    (sum, key) =>
      sum + DEFAULT_PATTERN_PRIORITIES[key],
    0,
  );

  const next: PatternPriorities = {
    ...DEFAULT_PATTERN_PRIORITIES,
  };

  for (const key of remainingKeys) {
    next[key] =
      (DEFAULT_PATTERN_PRIORITIES[key] /
        remainingBase) *
      0.6;
  }

  next[selected] = 0.4;

  return normalize(next);
}

/** Raise or lower one goal by a step; the others keep their proportions. */
function adjust(
  priorities: PatternPriorities,
  key: GoalKey,
  direction: 1 | -1,
): PatternPriorities {
  const current = normalize(priorities);
  const target = Math.min(1, Math.max(0, current[key] + direction * STEP));
  const othersTotal = 1 - current[key];

  const next = { ...current, [key]: target };

  for (const other of KEYS) {
    if (other === key) continue;

    next[other] =
      othersTotal > 0
        ? (current[other] / othersTotal) * (1 - target)
        : (1 - target) / (KEYS.length - 1);
  }

  return normalize(next);
}

export default function FarmerGoalSelector({
  priorities,
  onChange,
  onApply,
  loading = false,
  language = "bn",
}: FarmerGoalSelectorProps) {
  const [dirty, setDirty] = useState(false);

  const selectedGoal = useMemo(() => {
    let selected: GoalKey = "food_production";
    let highest = -Infinity;

    for (const goal of GOALS) {
      const value = Number(priorities[goal.key]);

      if (Number.isFinite(value) && value > highest) {
        highest = value;
        selected = goal.key;
      }
    }

    return selected;
  }, [priorities]);

  function selectGoal(key: GoalKey) {
    onChange(buildPriorities(key));
    setDirty(true);
  }

  function step(key: GoalKey, direction: 1 | -1) {
    onChange(adjust(priorities, key, direction));
    setDirty(true);
  }

  function resetGoals() {
    onChange({
      ...DEFAULT_PATTERN_PRIORITIES,
    });

    setDirty(true);
  }

  async function applyGoal() {
    if (!onApply || loading) {
      return;
    }

    const result = await onApply();

    if (result !== false) {
      setDirty(false);
    }
  }

  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-green-600">
            {language === "bn"
              ? "আপনার অগ্রাধিকার"
              : "Your priorities"}
          </p>

          <h2 className="mt-1 text-base font-black text-slate-900 sm:text-xl">
            {language === "bn"
              ? "কোন বিষয়টি আপনার কাছে বেশি গুরুত্বপূর্ণ?"
              : "What matters most to you?"}
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            {language === "bn"
              ? "একটি প্রধান লক্ষ্য বেছে নিন, অথবা – / + দিয়ে যেকোনো লক্ষ্য কমান বা বাড়ান।"
              : "Pick a main goal, or use – / + to lower or raise any goal."}
          </p>
        </div>

        <button
          type="button"
          onClick={resetGoals}
          disabled={loading}
          className="w-fit rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"
        >
          {language === "bn"
            ? "ডিফল্ট"
            : "Reset"}
        </button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {GOALS.map((goal) => {
          const active = selectedGoal === goal.key;
          const weight = Number(priorities[goal.key]) || 0;
          const title = language === "bn" ? goal.titleBn : goal.titleEn;

          return (
            <div
              key={goal.key}
              className={[
                "flex items-center gap-2 rounded-xl border px-2.5 py-2 transition",
                active
                  ? "border-green-500 bg-green-50 ring-2 ring-green-100"
                  : "border-slate-200 bg-white",
                loading ? "opacity-60" : "",
              ].join(" ")}
            >
              <button
                type="button"
                onClick={() => selectGoal(goal.key)}
                disabled={loading}
                className="flex min-w-0 flex-1 items-center gap-2 text-left disabled:cursor-not-allowed"
                title={language === "bn" ? goal.descriptionBn : goal.descriptionEn}
              >
                <span className="shrink-0 text-lg" aria-hidden>
                  {goal.icon}
                </span>
                <span className="min-w-0 text-sm font-black leading-5 text-slate-900">{title}</span>
              </button>

              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => step(goal.key, -1)}
                  disabled={loading || weight <= 0}
                  aria-label={`${title} −`}
                  className="h-8 w-8 rounded-lg border border-slate-200 bg-white text-sm font-black text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                >
                  −
                </button>

                <span
                  className={[
                    "min-w-12 rounded-full px-2 py-1 text-center text-[11px] font-black",
                    active
                      ? "bg-green-600 text-white"
                      : "bg-slate-100 text-slate-600",
                  ].join(" ")}
                >
                  {Math.round(weight * 100)}%
                </span>

                <button
                  type="button"
                  onClick={() => step(goal.key, 1)}
                  disabled={loading || weight >= 1}
                  aria-label={`${title} +`}
                  className="h-8 w-8 rounded-lg border border-slate-200 bg-white text-sm font-black text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={applyGoal}
        disabled={loading || !dirty}
        className="fs-primary-button mt-3 w-full disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading
          ? language === "bn"
            ? "পরিকল্পনা তৈরি হচ্ছে..."
            : "Building plan..."
          : language === "bn"
            ? "পরিকল্পনা তৈরি করুন"
            : "Build my plan"}
      </button>
    </div>
  );
}
