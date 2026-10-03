import type { FarmerPriorities } from "../../types/priority";

interface PrioritySelectorProps {
  priorities: FarmerPriorities;
  onChange: (priorities: FarmerPriorities) => void;
}

const labels: Record<
  keyof FarmerPriorities,
  {
    title: string;
    icon: string;
  }
> = {
  water_conservation: {
    title: "Save water",
    icon: "💧",
  },
  soil_health: {
    title: "Protect soil",
    icon: "🌱",
  },
  climate_resilience: {
    title: "Handle climate",
    icon: "☀️",
  },
  crop_diversity: {
    title: "Crop variety",
    icon: "🌾",
  },
};

export default function PrioritySelector({
  priorities,
}: PrioritySelectorProps) {
  const items = Object.entries(priorities)
    .map(([key, value]) => ({
      key: key as keyof FarmerPriorities,
      value: Number(value),
    }))
    .sort((a, b) => b.value - a.value);

  const mainGoal = items[0];

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
            Recommendation settings
          </p>

          <h2 className="mt-1 text-lg font-black text-slate-950">
            Your priorities
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            FIELD SHIFT uses these priorities when comparing
            crop rotations.
          </p>
        </div>

        {mainGoal && (
          <div className="flex items-center gap-2 rounded-2xl bg-green-50 px-4 py-3">
            <span className="text-lg">
              {labels[mainGoal.key].icon}
            </span>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-green-600">
                Main goal
              </p>

              <p className="text-sm font-black text-green-800">
                {labels[mainGoal.key].title}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map((item) => {
          const label = labels[item.key];

          return (
            <div
              key={item.key}
              className="rounded-2xl bg-slate-50 p-3"
            >
              <div className="flex items-center gap-2">
                <span className="text-base">
                  {label.icon}
                </span>

                <p className="text-xs font-bold text-slate-700">
                  {label.title}
                </p>
              </div>

              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-green-600"
                  style={{
                    width: `${Math.round(
                      item.value * 100,
                    )}%`,
                  }}
                />
              </div>

              <p className="mt-2 text-[10px] font-semibold text-slate-400">
                {Math.round(item.value * 100)}% influence
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}