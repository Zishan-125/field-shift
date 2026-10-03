
import type { SoilProfile } from "../../types/soil";

interface SoilSummaryProps {
  soil: SoilProfile;
}

function number(
  value: unknown,
  decimals = 2,
): string {
  const n = Number(value);

  return Number.isFinite(n)
    ? n.toFixed(decimals)
    : "—";
}

function getPhMessage(
  value: unknown,
): string {
  const ph = Number(value);

  if (!Number.isFinite(ph)) {
    return "pH information is not available.";
  }

  if (ph < 5.5) {
    return "The surface soil is on the acidic side.";
  }

  if (ph <= 7.5) {
    return "The surface soil pH is within a moderate range.";
  }

  return "The surface soil is on the alkaline side.";
}

function getPhStatus(
  value: unknown,
): "good" | "moderate" | "attention" {
  const ph = Number(value);

  if (!Number.isFinite(ph)) {
    return "moderate";
  }

  if (ph >= 5.5 && ph <= 7.5) {
    return "good";
  }

  if (ph >= 5 && ph <= 8) {
    return "moderate";
  }

  return "attention";
}

function getStatusLabel(
  status:
    | "good"
    | "moderate"
    | "attention",
): string {
  if (status === "good") {
    return "Stable";
  }

  if (status === "moderate") {
    return "Watch";
  }

  return "Attention";
}

export default function SoilSummary({
  soil,
}: SoilSummaryProps) {
  const ph =
    soil["soil_ph_0-5cm"];

  const organicCarbon =
    soil["soil_organic_carbon_0-5cm"];

  const phStatus =
    getPhStatus(ph);

  const depths: [string, unknown][] = [
    ["0–5 cm", soil["soil_ph_0-5cm"]],
    ["5–15 cm", soil["soil_ph_5-15cm"]],
    ["15–30 cm", soil["soil_ph_15-30cm"]],
    ["30–60 cm", soil["soil_ph_30-60cm"]],
    ["60–100 cm", soil["soil_ph_60-100cm"]],
    ["100–200 cm", soil["soil_ph_100-200cm"]],
  ];

  const availableDepths =
    depths.filter(([, value]) =>
      Number.isFinite(Number(value)),
    );

  return (
    <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm sm:rounded-[2.5rem]">
      <div className="p-5 sm:p-7 lg:p-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-green-50 text-sm">
                🌱
              </span>

              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-green-700">
                Soil intelligence
              </p>
            </div>

            <h2 className="mt-4 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
              What is your soil like?
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              A simple view of the soil information
              available for your field.
            </p>
          </div>

          <span className="w-fit rounded-full border border-green-100 bg-green-50 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-green-700">
            Soil profile
          </span>
        </div>

        {/* Main soil summary */}
        <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          {/* pH feature */}
          <div className="relative overflow-hidden rounded-[1.75rem] bg-green-700 p-6 sm:p-7">
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10" />

            <div className="relative">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/60">
                    Surface soil
                  </p>

                  <p className="mt-2 text-sm font-bold text-white/80">
                    Soil pH
                  </p>
                </div>

                <span className="rounded-full bg-white/15 px-3 py-1.5 text-[9px] font-black uppercase tracking-wide text-white">
                  {getStatusLabel(
                    phStatus,
                  )}
                </span>
              </div>

              <div className="mt-5 flex items-end gap-2">
                <span className="text-6xl font-black leading-none tracking-[-0.06em] text-white sm:text-7xl">
                  {number(ph)}
                </span>

                <span className="pb-1 text-xs font-bold text-white/55">
                  pH
                </span>
              </div>

              <p className="mt-4 max-w-md text-xs leading-5 text-white/70">
                {getPhMessage(ph)}
              </p>

              {/* pH visual scale */}
              <div className="mt-6">
                <div className="flex h-2 overflow-hidden rounded-full">
                  <div className="w-1/4 bg-orange-300" />
                  <div className="w-1/2 bg-green-300" />
                  <div className="w-1/4 bg-blue-300" />
                </div>

                <div className="mt-2 flex justify-between text-[9px] font-bold text-white/45">
                  <span>Acidic</span>
                  <span>Moderate</span>
                  <span>Alkaline</span>
                </div>
              </div>
            </div>
          </div>

          {/* Secondary metrics */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <SoilMetric
              icon="🌿"
              label="Organic carbon"
              value={number(
                organicCarbon,
              )}
              detail="Surface soil"
              tone="green"
            />

            <SoilMetric
              icon="📏"
              label="Profile depth"
              value="200 cm"
              detail={
                availableDepths.length > 0
                  ? `${availableDepths.length} depth levels available`
                  : "Depth information available"
              }
              tone="earth"
            />
          </div>
        </div>

        {/* Farmer interpretation */}
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-green-100 bg-green-50 p-4 sm:p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-lg shadow-sm">
            🌾
          </div>

          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-green-800">
              Why soil matters
            </p>

            <p className="mt-1 text-sm leading-6 text-green-900/70">
              FIELD SHIFT uses available soil information
              as one part of the decision-support process
              when comparing crop rotations.
            </p>
          </div>
        </div>

        {/* Depth details */}
        <details className="fs-details mt-6">
          <summary className="px-1 py-4">
            View soil profile by depth
          </summary>

          <div className="grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-3 lg:grid-cols-6">
            {depths.map(
              ([depth, value]) => (
                <div
                  key={depth}
                  className="rounded-2xl border border-slate-100 bg-slate-50 p-4 transition hover:border-green-100 hover:bg-green-50/40"
                >
                  <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">
                    {depth}
                  </p>

                  <p className="mt-2 text-xl font-black tracking-tight text-slate-800">
                    {number(value)}
                  </p>

                  <p className="mt-1 text-[9px] font-semibold text-slate-400">
                    pH
                  </p>
                </div>
              ),
            )}
          </div>
        </details>

        {/* Source */}
        <div className="mt-5 flex items-center justify-between gap-4 border-t border-slate-100 pt-4">
          <p className="text-[10px] font-semibold text-slate-400">
            Soil profile data
          </p>

          <span className="rounded-full bg-slate-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-slate-400">
            SoilGrids
          </span>
        </div>
      </div>
    </section>
  );
}

interface SoilMetricProps {
  icon: string;
  label: string;
  value: string;
  detail: string;
  tone: "green" | "earth";
}

function SoilMetric({
  icon,
  label,
  value,
  detail,
  tone,
}: SoilMetricProps) {
  const styles = {
    green: {
      icon: "bg-green-50",
      text: "text-green-700",
    },

    earth: {
      icon: "bg-amber-50",
      text: "text-amber-700",
    },
  };

  const current = styles[tone];

  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-5">
      <div className="flex items-center gap-3">
        <div
          className={[
            "flex h-11 w-11 items-center justify-center rounded-xl text-lg",
            current.icon,
          ].join(" ")}
        >
          {icon}
        </div>

        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">
            {label}
          </p>

          <p
            className={[
              "mt-1 text-2xl font-black tracking-tight",
              current.text,
            ].join(" ")}
          >
            {value}
          </p>
        </div>
      </div>

      <p className="mt-3 text-xs font-medium text-slate-400">
        {detail}
      </p>
    </div>
  );
}

