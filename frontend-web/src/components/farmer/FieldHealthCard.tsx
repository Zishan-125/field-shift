
interface FieldHealthCardProps {
  soilStatus:
    | "good"
    | "moderate"
    | "attention";

  waterStatus:
    | "good"
    | "moderate"
    | "attention";

  climateStatus:
    | "good"
    | "moderate"
    | "attention";
}

type Status =
  | "good"
  | "moderate"
  | "attention";

interface StatusConfig {
  label: string;
  shortLabel: string;
  description: string;
  icon: string;
}

const STATUS_CONFIG: Record<
  Status,
  StatusConfig
> = {
  good: {
    label: "Looking good",
    shortLabel: "Good",
    description:
      "The available field signals look stable right now.",
    icon: "✓",
  },

  moderate: {
    label: "Keep an eye on it",
    shortLabel: "Watch",
    description:
      "Some field conditions are worth monitoring as they change.",
    icon: "👀",
  },

  attention: {
    label: "Needs attention",
    shortLabel: "Attention",
    description:
      "At least one available field signal needs closer attention.",
    icon: "⚠️",
  },
};

function getOverallStatus(
  statuses: Status[],
): Status {
  if (
    statuses.includes("attention")
  ) {
    return "attention";
  }

  if (
    statuses.includes("moderate")
  ) {
    return "moderate";
  }

  return "good";
}

function getHealthScore(
  statuses: Status[],
): number {
  const values: Record<Status, number> = {
    good: 100,
    moderate: 70,
    attention: 40,
  };

  if (statuses.length === 0) {
    return 0;
  }

  const total = statuses.reduce(
    (sum, status) => sum + values[status],
    0,
  );

  return Math.round(
    total / statuses.length,
  );
}

export default function FieldHealthCard({
  soilStatus,
  waterStatus,
  climateStatus,
}: FieldHealthCardProps) {
  const statuses: Status[] = [
    soilStatus,
    waterStatus,
    climateStatus,
  ];

  const overallStatus =
    getOverallStatus(statuses);

  const healthScore =
    getHealthScore(statuses);

  const overall =
    STATUS_CONFIG[overallStatus];

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-green-200 bg-white shadow-lg shadow-green-100/40 sm:rounded-[2.5rem]">
      {/* Decorative field background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-green-100/60 blur-3xl" />

        <div className="absolute -bottom-32 -left-24 h-72 w-72 rounded-full bg-lime-100/40 blur-3xl" />

        <div
          className="absolute inset-x-0 bottom-0 h-28 opacity-40"
          style={{
            backgroundImage:
              "repeating-linear-gradient(172deg, transparent 0px, transparent 13px, rgba(39,131,77,0.08) 14px, transparent 15px)",
          }}
        />
      </div>

      <div className="relative p-5 sm:p-7 lg:p-8">
        {/* Top label */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-green-100 text-sm">
                🌱
              </span>

              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-green-700">
                Today's field health
              </p>
            </div>

            <h1 className="mt-4 max-w-xl text-2xl font-black tracking-tight text-slate-950 sm:text-3xl lg:text-4xl">
              How is your field?
            </h1>

            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500 sm:text-[15px]">
              A simple view of the main soil, water
              and climate signals available for your
              field.
            </p>
          </div>

          {/* Status badge */}
          <div
            className={[
              "flex w-fit items-center gap-2 rounded-full px-3.5 py-2 text-xs font-black",
              overallStatus === "good"
                ? "bg-green-100 text-green-800"
                : overallStatus === "moderate"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-red-100 text-red-800",
            ].join(" ")}
          >
            <span>{overall.icon}</span>

            <span>{overall.label}</span>
          </div>
        </div>

        {/* Main health area */}
        <div className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,1fr)_1.25fr]">
          {/* Score */}
          <div
            className={[
              "relative overflow-hidden rounded-[1.75rem] p-6 sm:p-7",
              overallStatus === "good"
                ? "bg-green-700"
                : overallStatus === "moderate"
                  ? "bg-amber-600"
                  : "bg-red-600",
            ].join(" ")}
          >
            {/* Decorative circle */}
            <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10" />

            <div className="relative">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/65">
                Field signal
              </p>

              <div className="mt-3 flex items-end gap-2">
                <span className="text-6xl font-black leading-none tracking-[-0.06em] text-white sm:text-7xl">
                  {healthScore}
                </span>

                <span className="pb-1 text-sm font-bold text-white/60">
                  / 100
                </span>
              </div>

              <p className="mt-4 text-xl font-black text-white">
                {overall.label}
              </p>

              <p className="mt-1 max-w-sm text-xs leading-5 text-white/70">
                {overall.description}
              </p>

              {/* Score bar */}
              <div className="mt-6 h-2 overflow-hidden rounded-full bg-black/10">
                <div
                  className="h-full rounded-full bg-white/90 transition-all duration-700"
                  style={{
                    width: `${healthScore}%`,
                  }}
                />
              </div>

              <p className="mt-2 text-[10px] font-bold text-white/55">
                Based on available field signals
              </p>
            </div>
          </div>

          {/* Three signals */}
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <Signal
              icon="🌱"
              label="Soil"
              status={soilStatus}
              description={getSignalDescription(
                "soil",
                soilStatus,
              )}
            />

            <Signal
              icon="💧"
              label="Water"
              status={waterStatus}
              description={getSignalDescription(
                "water",
                waterStatus,
              )}
            />

            <Signal
              icon="☀️"
              label="Climate"
              status={climateStatus}
              description={getSignalDescription(
                "climate",
                climateStatus,
              )}
            />
          </div>
        </div>

        {/* Farmer takeaway */}
        <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-green-100 bg-green-50/80 p-4 sm:flex-row sm:items-center">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-lg shadow-sm">
            🌾
          </div>

          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-green-800">
              What this means
            </p>

            <p className="mt-1 text-sm leading-6 text-green-900/75">
              FIELD SHIFT uses these signals to help
              compare crop rotations that fit your
              field and your farming priorities.
            </p>
          </div>
        </div>

        {/* Disclaimer */}
        <p className="mt-4 text-center text-[10px] font-medium leading-5 text-slate-400">
          This is a decision-support indicator, not
          a crop-specific agronomic diagnosis.
        </p>
      </div>
    </section>
  );
}

interface SignalProps {
  icon: string;
  label: string;
  status: Status;
  description: string;
}

function Signal({
  icon,
  label,
  status,
  description,
}: SignalProps) {
  const config =
    STATUS_CONFIG[status];

  const statusClass =
    status === "good"
      ? "bg-green-50 text-green-700"
      : status === "moderate"
        ? "bg-amber-50 text-amber-700"
        : "bg-red-50 text-red-700";

  return (
    <div className="group rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-green-200 hover:shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-xl transition group-hover:bg-green-50">
          {icon}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-black text-slate-800">
              {label}
            </p>

            <span
              className={[
                "rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-wide",
                statusClass,
              ].join(" ")}
            >
              {config.shortLabel}
            </span>
          </div>

          <p className="mt-1 text-xs leading-5 text-slate-400">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}

function getSignalDescription(
  type: "soil" | "water" | "climate",
  status: Status,
): string {
  if (type === "soil") {
    if (status === "good") {
      return "Soil signal looks stable.";
    }

    if (status === "moderate") {
      return "Soil conditions should be monitored.";
    }

    return "Soil conditions need attention.";
  }

  if (type === "water") {
    if (status === "good") {
      return "Water conditions look stable.";
    }

    if (status === "moderate") {
      return "Water conditions should be monitored.";
    }

    return "Water conditions need attention.";
  }

  if (status === "good") {
    return "Climate conditions look stable.";
  }

  if (status === "moderate") {
    return "Weather conditions should be monitored.";
  }

  return "Climate conditions need attention.";
}

