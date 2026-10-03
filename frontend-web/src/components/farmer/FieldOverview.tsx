import type { Field } from "../../types/field";

interface FieldOverviewProps {
  field?: Field | null;
  fieldName?: string;
  healthLabel?: string;
  healthScore?: number;
  [key: string]: unknown;
}

function formatCoordinate(
  value: number | undefined,
  suffix: string,
): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "—";
  }

  return `${Math.abs(value).toFixed(3)}° ${suffix}`;
}

export default function FieldOverview({
  field,
  fieldName,
  healthLabel = "Good condition",
  healthScore,
}: FieldOverviewProps) {
  const name =
    fieldName ||
    field?.name ||
    "Your field";

  const score =
    typeof healthScore === "number"
      ? Math.round(healthScore)
      : null;

  const latitude = field?.centroid_lat;
  const longitude = field?.centroid_lon;

  return (
    <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
      <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
        {/* Information side */}
        <div className="p-6 sm:p-8 lg:p-10">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-green-500 shadow-[0_0_0_4px_rgba(34,197,94,0.12)]" />

            <p className="text-xs font-bold uppercase tracking-[0.18em] text-green-700">
              Active field
            </p>
          </div>

          <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            {name}
          </h2>

          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500 sm:text-base">
            Your field intelligence is ready. FIELD SHIFT
            combines local soil, environmental conditions
            and farm priorities to help you decide what to
            do next.
          </p>

          <div className="mt-7 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Field status
              </p>

              <p className="mt-2 text-sm font-black text-slate-900">
                {healthLabel}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Health score
              </p>

              <p className="mt-2 text-sm font-black text-slate-900">
                {score !== null ? `${score}/100` : "Analyzing"}
              </p>
            </div>
          </div>

          {(latitude !== undefined ||
            longitude !== undefined) && (
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-400">
              <span>
                {formatCoordinate(latitude, "N")}
              </span>

              <span>
                {formatCoordinate(longitude, "E")}
              </span>
            </div>
          )}
        </div>

        {/* Field visual */}
        <div className="relative min-h-[280px] overflow-hidden bg-[#dfe9d7] lg:min-h-full">
          {/* Decorative field rows */}
          <div className="absolute inset-0 opacity-70">
            <div className="absolute -left-20 top-8 h-20 w-[150%] rotate-[-10deg] rounded-[50%] border-[16px] border-green-700/20" />
            <div className="absolute -left-20 top-20 h-20 w-[150%] rotate-[-10deg] rounded-[50%] border-[16px] border-emerald-700/15" />
            <div className="absolute -left-20 top-32 h-20 w-[150%] rotate-[-10deg] rounded-[50%] border-[16px] border-lime-700/20" />
            <div className="absolute -left-20 top-44 h-20 w-[150%] rotate-[-10deg] rounded-[50%] border-[16px] border-green-800/15" />
            <div className="absolute -left-20 top-56 h-20 w-[150%] rotate-[-10deg] rounded-[50%] border-[16px] border-emerald-800/20" />
          </div>

          <div className="absolute inset-0 bg-gradient-to-br from-green-900/5 via-transparent to-green-950/20" />

          {/* Field marker */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-green-700 shadow-xl">
              <div className="h-3 w-3 rounded-full bg-white" />
            </div>

            <div className="mt-3 rounded-full bg-white/95 px-4 py-2 text-center text-xs font-bold text-slate-800 shadow-lg backdrop-blur">
              Your field
            </div>
          </div>

          <div className="absolute bottom-4 left-4 rounded-xl bg-white/90 px-3 py-2 text-[11px] font-semibold text-slate-600 shadow-sm backdrop-blur">
            Local field intelligence
          </div>
        </div>
      </div>
    </section>
  );
}