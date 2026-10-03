import type { Environment } from "../../types/environment";

interface EnvironmentSummaryProps {
  environment: Environment;
}

export default function EnvironmentSummary({
  environment,
}: EnvironmentSummaryProps) {
  const temperature = Number(
    environment.power_temperature_mean,
  );

  const wind = Number(
    environment.power_wind_speed,
  );

  const solar = Number(
    environment.power_solar_radiation,
  );

  const messages: string[] = [];

  if (Number.isFinite(temperature)) {
    if (temperature >= 32) {
      messages.push(
        "The field is experiencing warm conditions.",
      );
    } else if (temperature <= 18) {
      messages.push(
        "The field is experiencing cooler conditions.",
      );
    } else {
      messages.push(
        "Temperature conditions look moderate.",
      );
    }
  }

  if (Number.isFinite(solar)) {
    if (solar >= 5) {
      messages.push(
        "There is strong solar energy available.",
      );
    } else {
      messages.push(
        "Solar energy is relatively limited.",
      );
    }
  }

  if (Number.isFinite(wind)) {
    if (wind >= 5) {
      messages.push(
        "Wind conditions are relatively strong.",
      );
    } else {
      messages.push(
        "Wind conditions are relatively calm.",
      );
    }
  }

  if (messages.length === 0) {
    messages.push(
      "Environmental information is available for this field.",
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-green-50 text-xl">
          🌍
        </div>

        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-green-700">
            Field conditions
          </p>

          <h3 className="mt-1 text-lg font-black text-slate-900">
            What the environment is telling us
          </h3>

          <div className="mt-3 space-y-2">
            {messages.map(
              (message) => (
                <div
                  key={message}
                  className="flex items-start gap-2 text-sm leading-6 text-slate-600"
                >
                  <span className="mt-1 text-green-600">
                    ✓
                  </span>

                  <span>
                    {message}
                  </span>
                </div>
              ),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}