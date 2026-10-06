import { useMemo, useState } from "react";

import type { FarmerPriorities } from "../../types/farmer";
import { DEFAULT_PRIORITIES } from "../../types/farmer";

interface FarmerGoalSelectorProps {
  priorities: FarmerPriorities;
  onChange: (priorities: FarmerPriorities) => void;
  onApply?: () =>
    | Promise<boolean | void>
    | boolean
    | void;
  loading?: boolean;
  language?: "bn" | "en";
}

type GoalKey = keyof FarmerPriorities;

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
    key: "water_conservation",
    icon: "💧",
    titleBn: "পানি সাশ্রয়",
    titleEn: "Save water",
    descriptionBn:
      "কম সেচের পানি ব্যবহার করতে চাই",
    descriptionEn:
      "Use less irrigation water",
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
    titleBn: "জলবায়ু মোকাবিলা",
    titleEn: "Handle climate",
    descriptionBn:
      "পরিবর্তনশীল আবহাওয়ার জন্য প্রস্তুত থাকতে চাই",
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

function normalize(
  priorities: FarmerPriorities,
): FarmerPriorities {
  const values = Object.values(priorities).map(
    (value) =>
      Number.isFinite(Number(value))
        ? Math.max(0, Number(value))
        : 0,
  );

  const total = values.reduce(
    (sum, value) => sum + value,
    0,
  );

  if (total <= 0) {
    return {
      ...DEFAULT_PRIORITIES,
    };
  }

  const keys: GoalKey[] = [
    "water_conservation",
    "soil_health",
    "climate_resilience",
    "crop_diversity",
  ];

  return {
    water_conservation:
      values[keys.indexOf("water_conservation")] /
      total,

    soil_health:
      values[keys.indexOf("soil_health")] /
      total,

    climate_resilience:
      values[keys.indexOf("climate_resilience")] /
      total,

    crop_diversity:
      values[keys.indexOf("crop_diversity")] /
      total,
  };
}

function buildPriorities(
  selected: GoalKey,
): FarmerPriorities {
  const remainingKeys = (
    Object.keys(DEFAULT_PRIORITIES) as GoalKey[]
  ).filter((key) => key !== selected);

  const remainingBase = remainingKeys.reduce(
    (sum, key) =>
      sum + DEFAULT_PRIORITIES[key],
    0,
  );

  const next: FarmerPriorities = {
    ...DEFAULT_PRIORITIES,
  };

  for (const key of remainingKeys) {
    next[key] =
      (DEFAULT_PRIORITIES[key] /
        remainingBase) *
      0.6;
  }

  next[selected] = 0.4;

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
    let selected: GoalKey =
      "water_conservation";

    let highest = -Infinity;

    for (const goal of GOALS) {
      const value = Number(
        priorities[goal.key],
      );

      if (
        Number.isFinite(value) &&
        value > highest
      ) {
        highest = value;
        selected = goal.key;
      }
    }

    return selected;
  }, [priorities]);

  function selectGoal(key: GoalKey) {
    const next = buildPriorities(key);

    onChange(next);
    setDirty(true);
  }

  function resetGoals() {
    onChange({
      ...DEFAULT_PRIORITIES,
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
    <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-green-600">
            {language === "bn"
              ? "আপনার অগ্রাধিকার"
              : "Your priorities"}
          </p>

          <h2 className="mt-2 text-xl font-black text-slate-900 sm:text-2xl">
            {language === "bn"
              ? "কোন বিষয়টি আপনার কাছে বেশি গুরুত্বপূর্ণ?"
              : "What matters most to you?"}
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            {language === "bn"
              ? "একটি প্রধান লক্ষ্য নির্বাচন করুন। FIELD SHIFT সেই অনুযায়ী rotation-এর score পরিবর্তন করবে।"
              : "Choose your main goal. FIELD SHIFT will adjust the rotation scores accordingly."}
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

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {GOALS.map((goal) => {
          const active =
            selectedGoal === goal.key;

          const weight =
            Number(priorities[goal.key]) || 0;

          return (
            <button
              key={goal.key}
              type="button"
              onClick={() =>
                selectGoal(goal.key)
              }
              disabled={loading}
              className={[
                "rounded-2xl border p-4 text-left transition",
                active
                  ? "border-green-500 bg-green-50 ring-2 ring-green-100"
                  : "border-slate-200 bg-white hover:border-green-300 hover:bg-green-50/40",
                loading
                  ? "cursor-not-allowed opacity-60"
                  : "",
              ].join(" ")}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-xl">
                  {goal.icon}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-slate-900">
                        {language === "bn"
                          ? goal.titleBn
                          : goal.titleEn}
                      </p>

                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {language === "bn"
                          ? goal.descriptionBn
                          : goal.descriptionEn}
                      </p>
                    </div>

                    <span
                      className={[
                        "shrink-0 rounded-full px-2 py-1 text-[10px] font-black",
                        active
                          ? "bg-green-600 text-white"
                          : "bg-slate-100 text-slate-500",
                      ].join(" ")}
                    >
                      {Math.round(
                        weight * 100,
                      )}
                      %
                    </span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-5 rounded-2xl bg-slate-50 p-4">
        <div className="flex flex-wrap gap-2">
          {GOALS.map((goal) => (
            <span
              key={goal.key}
              className="rounded-full bg-white px-3 py-1.5 text-[10px] font-black text-slate-500 shadow-sm"
            >
              {language === "bn"
                ? goal.titleBn
                : goal.titleEn}{" "}
              {Math.round(
                (Number(
                  priorities[goal.key],
                ) || 0) * 100,
              )}
              %
            </span>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={applyGoal}
        disabled={loading || !dirty}
        className="fs-primary-button mt-5 w-full disabled:cursor-not-allowed disabled:opacity-50"
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