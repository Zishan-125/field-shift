import type { Environment } from "../../types/environment";

interface WeatherSummaryProps {
  environment: Environment;
}

function number(
  value: unknown,
  decimals = 1,
): string {
  const n = Number(value);

  return Number.isFinite(n)
    ? n.toFixed(decimals)
    : "—";
}

export default function WeatherSummary({
  environment,
}: WeatherSummaryProps) {
  const temperature =
    environment.power_temperature_mean;

  const maxTemperature =
    environment.power_temperature_max;

  const minTemperature =
    environment.power_temperature_min;

  const wind =
    environment.power_wind_speed;

  const solar =
    environment.power_solar_radiation;

  const observedDays =
    environment.power_days_observed;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Metric
        icon="🌡️"
        label="Temperature"
        value={`${number(temperature)}°C`}
        detail={
          Number.isFinite(
            Number(minTemperature),
          ) &&
          Number.isFinite(
            Number(maxTemperature),
          )
            ? `${number(minTemperature)}° – ${number(maxTemperature)}°`
            : "Recent field conditions"
        }
        tone="amber"
      />

      <Metric
        icon="☀️"
        label="Sunlight"
        value={number(solar)}
        detail="Solar energy"
        tone="orange"
      />

      <Metric
        icon="💨"
        label="Wind"
        value={`${number(wind)} m/s`}
        detail="Average wind speed"
        tone="blue"
      />

      <Metric
        icon="📅"
        label="Data coverage"
        value={
          Number.isFinite(
            Number(observedDays),
          )
            ? `${Number(observedDays)} days`
            : "—"
        }
        detail="Observed locally"
        tone="green"
      />
    </div>
  );
}

interface MetricProps {
  icon: string;
  label: string;
  value: string;
  detail: string;
  tone:
    | "amber"
    | "orange"
    | "blue"
    | "green";
}

function Metric({
  icon,
  label,
  value,
  detail,
  tone,
}: MetricProps) {
  const tones = {
    amber:
      "bg-amber-50 text-amber-700",
    orange:
      "bg-orange-50 text-orange-700",
    blue:
      "bg-blue-50 text-blue-700",
    green:
      "bg-green-50 text-green-700",
  };

  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}
        >
          <span className="text-lg">
            {icon}
          </span>
        </div>

        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
            {label}
          </p>

          <p className="mt-0.5 text-lg font-black text-slate-900">
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