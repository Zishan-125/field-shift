import { useState } from "react";
import type { FarmerPriorities } from "../../types/priority";

interface FarmerGoalSelectorProps {
  priorities: FarmerPriorities;
  onChange: (priorities: FarmerPriorities) => void;
  onApply?: () => Promise<void> | void;
  loading?: boolean;
}

interface Goal {
  key: keyof FarmerPriorities;
  icon: string;
  title: string;
  description: string;
  activeClass: string;
  iconClass: string;
}

const DEFAULT_PRIORITIES: FarmerPriorities = {
  water_conservation: 0.4,
  soil_health: 0.3,
  climate_resilience: 0.2,
  crop_diversity: 0.1,
};

const goals: Goal[] = [
  {
    key: "water_conservation",
    icon: "💧",
    title: "Save water",
    description: "Use less irrigation water",
    activeClass:
      "border-blue-300 bg-blue-50 ring-2 ring-blue-100",
    iconClass: "bg-blue-100 text-blue-700",
  },
  {
    key: "soil_health",
    icon: "🌱",
    title: "Protect soil",
    description: "Keep your soil healthy",
    activeClass:
      "border-green-300 bg-green-50 ring-2 ring-green-100",
    iconClass: "bg-green-100 text-green-700",
  },
  {
    key: "climate_resilience",
    icon: "☀️",
    title: "Handle climate",
    description: "Prepare for changing weather",
    activeClass:
      "border-amber-300 bg-amber-50 ring-2 ring-amber-100",
    iconClass: "bg-amber-100 text-amber-700",
  },
  {
    key: "crop_diversity",
    icon: "🌾",
    title: "More crop variety",
    description: "Keep your crops diverse",
    activeClass:
      "border-purple-300 bg-purple-50 ring-2 ring-purple-100",
    iconClass: "bg-purple-100 text-purple-700",
  },
];

export default function FarmerGoalSelector({
  priorities,
  onChange,
  onApply,
  loading = false,
}: FarmerGoalSelectorProps) {
  const [dirty, setDirty] = useState(false);

  function selectGoal(
    key: keyof FarmerPriorities,
  ) {
    const updated = buildPriorities(key);

    onChange(updated);
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

    await onApply();
    setDirty(false);
  }

  const selectedGoal = getSelectedGoal(
    priorities,
  );

  return (
    <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm sm:rounded-[2.5rem]">
      <div className="p-5 sm:p-7 lg:p-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-green-50 text-sm">
                🎯
              </span>

              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-green-700">
                Your farming priorities
              </p>
            </div>

            <h2 className="mt-4 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
              What matters most to you?
            </h2>

            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
              Choose the goal you want FIELD SHIFT
              to focus on when comparing crop
              rotations.
            </p>
          </div>

          <button
            type="button"
            onClick={resetGoals}
            disabled={loading}
            className="w-fit rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-500 transition hover:border-green-200 hover:bg-green-50 hover:text-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reset
          </button>
        </div>

        {/* Current goal */}
        {selectedGoal && (
          <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-green-100 bg-green-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-lg shadow-sm">
                {selectedGoal.icon}
              </div>

              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-green-700">
                  Main goal
                </p>

                <p className="mt-0.5 text-sm font-black text-green-950">
                  {selectedGoal.title}
                </p>
              </div>
            </div>

            <span className="w-fit rounded-full bg-white px-3 py-1.5 text-xs font-black text-green-700">
              {Math.round(
                priorities[selectedGoal.key] * 100,
              )}
              % priority
            </span>
          </div>
        )}

        {/* Goal choices */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {goals.map((goal) => {
            const selected =
              selectedGoal?.key === goal.key;

            const percentage = Math.round(
              priorities[goal.key] * 100,
            );

            return (
              <button
                key={goal.key}
                type="button"
                aria-pressed={selected}
                onClick={() =>
                  selectGoal(goal.key)
                }
                disabled={loading}
                className={[
                  "group rounded-2xl border p-4 text-left transition-all",
                  "disabled:cursor-not-allowed disabled:opacity-60",
                  selected
                    ? goal.activeClass
                    : "border-slate-200 bg-slate-50 hover:border-green-200 hover:bg-white hover:shadow-sm",
                ].join(" ")}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={[
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl",
                      selected
                        ? goal.iconClass
                        : "bg-white",
                    ].join(" ")}
                  >
                    {goal.icon}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-black text-slate-900">
                          {goal.title}
                        </h3>

                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {goal.description}
                        </p>
                      </div>

                      {selected && (
                        <span className="shrink-0 text-sm font-black text-green-700">
                          ✓
                        </span>
                      )}
                    </div>

                    <div className="mt-4">
                      <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wide">
                        <span className="text-slate-400">
                          Priority
                        </span>

                        <span className="text-slate-600">
                          {percentage}%
                        </span>
                      </div>

                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className={[
                            "h-full rounded-full transition-all duration-500",
                            selected
                              ? "bg-green-600"
                              : "bg-slate-300",
                          ].join(" ")}
                          style={{
                            width: `${percentage}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Apply */}
        <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black text-slate-700">
              Ready to compare?
            </p>

            <p className="mt-1 text-xs text-slate-400">
              FIELD SHIFT will recalculate your crop
              rotation recommendations.
            </p>
          </div>

          <button
            type="button"
            onClick={applyGoal}
            disabled={!dirty || loading}
            className="fs-primary-button w-full sm:w-auto"
          >
            {loading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Updating...
              </>
            ) : (
              <>
                <span>↻</span>
                Update recommendations
              </>
            )}
          </button>
        </div>

        <p className="mt-4 text-center text-[10px] font-medium leading-5 text-slate-400">
          Your priority changes the weighting used to
          rank the available crop rotations.
        </p>
      </div>
    </section>
  );
}

function buildPriorities(
  selectedKey: keyof FarmerPriorities,
): FarmerPriorities {
  const selectedWeight = 0.4;

  const remainingWeight = 1 - selectedWeight;

  const otherKeys = goals
    .map((goal) => goal.key)
    .filter((key) => key !== selectedKey);

  const currentOtherTotal =
    otherKeys.reduce(
      (sum, key) =>
        sum +
        DEFAULT_PRIORITIES[key],
      0,
    );

  const next: FarmerPriorities = {
    ...DEFAULT_PRIORITIES,
    [selectedKey]: selectedWeight,
  };

  if (currentOtherTotal <= 0) {
    const equalWeight =
      remainingWeight /
      otherKeys.length;

    for (const key of otherKeys) {
      next[key] = equalWeight;
    }

    return normalize(next);
  }

  for (const key of otherKeys) {
    next[key] =
      (DEFAULT_PRIORITIES[key] /
        currentOtherTotal) *
      remainingWeight;
  }

  return normalize(next);
}

function normalize(
  priorities: FarmerPriorities,
): FarmerPriorities {
  const keys: (keyof FarmerPriorities)[] = [
    "water_conservation",
    "soil_health",
    "climate_resilience",
    "crop_diversity",
  ];

  const total = keys.reduce(
    (sum, key) =>
      sum + priorities[key],
    0,
  );

  if (!Number.isFinite(total) || total <= 0) {
    return {
      ...DEFAULT_PRIORITIES,
    };
  }

  return {
    water_conservation:
      priorities.water_conservation /
      total,

    soil_health:
      priorities.soil_health /
      total,

    climate_resilience:
      priorities.climate_resilience /
      total,

    crop_diversity:
      priorities.crop_diversity /
      total,
  };
}

function getSelectedGoal(
  priorities: FarmerPriorities,
): Goal | null {
  let selected: Goal | null = null;
  let highest = -Infinity;

  for (const goal of goals) {
    const value =
      priorities[goal.key];

    if (value > highest) {
      highest = value;
      selected = goal;
    }
  }

  return selected;
}