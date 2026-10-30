import { useMemo, useState } from "react";

import type { FarmerPriorities } from "../../types/farmer";
import { DEFAULT_PRIORITIES } from "../../types/farmer";

interface FarmerGoalSelectorProps {
  priorities: FarmerPriorities;
  onChange: (priorities: FarmerPriorities) => void;
  onApply?: () => Promise<boolean | void> | boolean | void;
  loading?: boolean;
  language?: "bn" | "en";
}

type GoalKey = keyof FarmerPriorities;

interface Goal {
  key: GoalKey;
  titleBn: string;
  titleEn: string;
  descriptionBn: string;
  descriptionEn: string;
}

const GOALS: Goal[] = [
  {
    key: "water_conservation",
    titleBn: "পানি সাশ্রয়",
    titleEn: "Save water",
    descriptionBn: "কম সেচের পানি ব্যবহার করতে চাই",
    descriptionEn: "Use less irrigation water",
  },
  {
    key: "soil_health",
    titleBn: "মাটির স্বাস্থ্য",
    titleEn: "Protect soil",
    descriptionBn: "মাটির স্বাস্থ্য ভালো রাখতে চাই",
    descriptionEn: "Keep your soil healthy",
  },
  {
    key: "climate_resilience",
    titleBn: "জলবায়ু মোকাবিলা",
    titleEn: "Handle climate",
    descriptionBn: "পরিবর্তনশীল আবহাওয়ার জন্য প্রস্তুত থাকতে চাই",
    descriptionEn: "Prepare for changing weather",
  },
  {
    key: "crop_diversity",
    titleBn: "ফসলের বৈচিত্র্য",
    titleEn: "More crop variety",
    descriptionBn: "বিভিন্ন ধরনের ফসল চাষ করতে চাই",
    descriptionEn: "Maintain crop diversity",
  },
];

function normalize(priorities: FarmerPriorities): FarmerPriorities {
  const values = Object.values(priorities).map((value) =>
    Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0,
  );

  const total = values.reduce((sum, value) => sum + value, 0);

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
    water_conservation: values[keys.indexOf("water_conservation")] / total,
    soil_health: values[keys.indexOf("soil_health")] / total,
    climate_resilience: values[keys.indexOf("climate_resilience")] / total,
    crop_diversity: values[keys.indexOf("crop_diversity")] / total,
  };
}

function buildPriorities(selected: GoalKey): FarmerPriorities {
  const remainingKeys = (
    Object.keys(DEFAULT_PRIORITIES) as GoalKey[]
  ).filter((key) => key !== selected);

  const remainingBase = remainingKeys.reduce(
    (sum, key) => sum + DEFAULT_PRIORITIES[key],
    0,
  );

  const next: FarmerPriorities = {
    ...DEFAULT_PRIORITIES,
  };

  for (const key of remainingKeys) {
    next[key] = (DEFAULT_PRIORITIES[key] / remainingBase) * 0.6;
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
    let selected: GoalKey = "water_conservation";

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
    <section className="fs-panel-block" aria-labelledby="priorities-title">
      <div className="fs-panel-head">
        <div>
          <h2 id="priorities-title" className="fs-panel-title">
            {language === "bn"
              ? "কোন বিষয়টি আপনার কাছে বেশি গুরুত্বপূর্ণ?"
              : "What matters most to you?"}
          </h2>

          <p className="fs-panel-sub">
            {language === "bn"
              ? "একটি প্রধান লক্ষ্য নির্বাচন করুন। FIELD SHIFT সেই অনুযায়ী rotation-এর score পরিবর্তন করবে।"
              : "Choose your main goal. FIELD SHIFT will adjust the rotation scores accordingly."}
          </p>
        </div>

        <button
          type="button"
          className="fs-button-quiet"
          onClick={resetGoals}
          disabled={loading}
        >
          {language === "bn" ? "ডিফল্ট" : "Reset"}
        </button>
      </div>

      <div className="fs-priorities">
        {GOALS.map((goal) => {
          const active = selectedGoal === goal.key;

          const weight = Number(priorities[goal.key]) || 0;

          const percent = Math.round(weight * 100);

          return (
            <button
              key={goal.key}
              type="button"
              onClick={() => selectGoal(goal.key)}
              disabled={loading}
              aria-pressed={active}
              className="fs-priority"
            >
              <span className="fs-priority-text">
                <span className="fs-priority-name">
                  {language === "bn" ? goal.titleBn : goal.titleEn}
                </span>
              </span>

              <span className="fs-priority-pct">{percent}%</span>

              <span className="fs-priority-bar" aria-hidden="true">
                <span style={{ width: `${percent}%` }} />
              </span>
            </button>
          );
        })}
      </div>

      <div className="fs-panel-actions">
        <button
          type="button"
          className="fs-button"
          onClick={applyGoal}
          disabled={loading || !dirty}
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
    </section>
  );
}
