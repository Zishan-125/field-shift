import type { Environment } from "../../types/environment";

interface WeatherSummaryProps {
  environment: Environment;
  language?: "bn" | "en";
}

function decimal(value: unknown, decimals = 1): string | null {
  const n = Number(value);

  return Number.isFinite(n) ? n.toFixed(decimals) : null;
}

function whole(value: unknown): string | null {
  const n = Number(value);

  return Number.isFinite(n) ? String(Math.round(n)) : null;
}

export default function WeatherSummary({
  environment,
  language = "bn",
}: WeatherSummaryProps) {
  const temperature = decimal(environment.power_temperature_mean);

  const minTemperature = decimal(environment.power_temperature_min);

  const maxTemperature = decimal(environment.power_temperature_max);

  const wind = decimal(environment.power_wind_speed);

  const observedDays = whole(environment.power_days_observed);

  const items: Array<{
    label: string;
    value: string;
    unit: string;
    detail?: string;
  }> = [];

  if (temperature !== null) {
    items.push({
      label: language === "bn" ? "গড় তাপমাত্রা" : "Mean temperature",
      value: temperature,
      unit: "°C",
      detail:
        minTemperature !== null && maxTemperature !== null
          ? `${minTemperature}° – ${maxTemperature}°`
          : undefined,
    });
  }

  if (wind !== null) {
    items.push({
      label: language === "bn" ? "বাতাসের গতি" : "Wind speed",
      value: wind,
      unit: "m/s",
    });
  }

  if (observedDays !== null) {
    items.push({
      label: language === "bn" ? "তথ্যের দিন" : "Days observed",
      value: observedDays,
      unit: language === "bn" ? "দিন" : "days",
    });
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <section className="fs-weather" aria-labelledby="weather-title">
      <div className="fs-head">
        <div>
          <h2 id="weather-title">
            {language === "bn" ? "POWER দৈনিক আবহাওয়া" : "POWER daily weather"}
          </h2>

          <p>
            {language === "bn"
              ? "সাম্প্রতিক আবহাওয়ার পাওয়া তথ্য।"
              : "Available readings from the recent weather window."}
          </p>
        </div>
      </div>

      <div className="fs-panel">
        <div className="fs-panel-block">
          <dl className="fs-weather-grid">
            {items.map((item) => (
              <div key={item.label} className="fs-weather-item">
                <dt>{item.label}</dt>

                <dd>
                  {item.value}

                  {item.unit ? <span>{item.unit}</span> : null}
                </dd>

                {item.detail ? (
                  <dd className="fs-weather-detail">{item.detail}</dd>
                ) : null}
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
