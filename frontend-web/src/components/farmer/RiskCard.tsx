interface RiskCardProps {
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

interface StatusInfo {
  label: string;
  icon: string;
  description: string;
  className: string;
}

const STATUS_INFO: Record<
  Status,
  StatusInfo
> = {
  good: {
    label: "Looking stable",
    icon: "✓",
    description:
      "No major signal currently needs your attention.",
    className:
      "bg-green-50 text-green-700",
  },

  moderate: {
    label: "Keep an eye on it",
    icon: "👀",
    description:
      "Some conditions are worth monitoring as they change.",
    className:
      "bg-amber-50 text-amber-700",
  },

  attention: {
    label: "Needs attention",
    icon: "⚠️",
    description:
      "At least one field condition deserves closer attention.",
    className:
      "bg-red-50 text-red-700",
  },
};

export default function RiskCard({
  soilStatus,
  waterStatus,
  climateStatus,
}: RiskCardProps) {
  const statuses: Status[] = [
    soilStatus,
    waterStatus,
    climateStatus,
  ];

  const attentionCount =
    statuses.filter(
      (status) => status === "attention",
    ).length;

  const moderateCount =
    statuses.filter(
      (status) => status === "moderate",
    ).length;

  const overallStatus: Status =
    attentionCount > 0
      ? "attention"
      : moderateCount > 0
        ? "moderate"
        : "good";

  const info =
    STATUS_INFO[overallStatus];

  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${info.className}`}
          >
            <span className="text-lg">
              {info.icon}
            </span>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
              Field watch
            </p>

            <h3 className="mt-1 text-lg font-black text-slate-900">
              Anything to watch?
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              FIELD SHIFT checks the main signals
              available for this field.
            </p>
          </div>
        </div>

        <span
          className={`w-fit rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wide ${info.className}`}
        >
          {info.label}
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <StatusItem
          icon="🌱"
          label="Soil"
          status={soilStatus}
        />

        <StatusItem
          icon="💧"
          label="Water"
          status={waterStatus}
        />

        <StatusItem
          icon="☀️"
          label="Climate"
          status={climateStatus}
        />
      </div>

      <div
        className={`mt-4 rounded-2xl p-4 ${info.className}`}
      >
        <p className="text-sm font-bold">
          {info.description}
        </p>

        <p className="mt-1 text-xs leading-5 opacity-75">
          These are decision-support indicators,
          not crop-specific agronomic diagnoses.
        </p>
      </div>
    </div>
  );
}

interface StatusItemProps {
  icon: string;
  label: string;
  status: Status;
}

function StatusItem({
  icon,
  label,
  status,
}: StatusItemProps) {
  const info =
    STATUS_INFO[status];

  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span>{icon}</span>

          <p className="text-sm font-bold text-slate-800">
            {label}
          </p>
        </div>

        <span
          className={`rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-wide ${info.className}`}
        >
          {status === "good"
            ? "Good"
            : status === "moderate"
              ? "Watch"
              : "Attention"}
        </span>
      </div>
    </div>
  );
}