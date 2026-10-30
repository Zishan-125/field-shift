import { useMemo } from "react";

interface Props {
  data: unknown;
  language?: "bn" | "en";
}

interface Row {
  observation_month?: unknown;
  year?: unknown;
  month?: unknown;
  gpm_value?: unknown;
  rainfall_mm?: unknown;
  precipitation_mm?: unknown;
  ag_rainfall_mm?: unknown;
  smap_value?: unknown;
  soil_moisture?: unknown;
  ag_soil_moisture?: unknown;
  modis_ndvi?: unknown;
  ndvi?: unknown;
  ag_ndvi?: unknown;
  ecostress_value?: unknown;
  ecostress_lst_c?: unknown;
  lst_c?: unknown;
  ag_lst_c?: unknown;
  grace_value?: unknown;
  grace_tws_anomaly_cm?: unknown;
  ag_grace_tws_anomaly_cm?: unknown;
  power_temperature_mean?: unknown;
  temperature_c?: unknown;
  ag_temperature_c?: unknown;
  [key: string]: unknown;
}

type Trend = "up" | "down" | "flat" | "none";

function finite(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;

  const n = Number(value);

  return Number.isFinite(n) ? n : null;
}

function getRows(data: unknown): Row[] {
  if (Array.isArray(data)) return data as Row[];
  if (!data || typeof data !== "object") return [];

  const object = data as Record<string, unknown>;
  const candidates = [
    object.data,
    object.rows,
    object.environment,
    object.monthly,
    object.results,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate as Row[];
  }

  return [];
}

function firstFinite(row: Row, keys: string[]): number | null {
  for (const key of keys) {
    const value = finite(row[key]);
    if (value !== null) return value;
  }
  return null;
}

function monthLabel(value: unknown, language: "bn" | "en"): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "—";

  const date = new Date(raw.length === 7 ? `${raw}-01` : raw);
  if (Number.isNaN(date.getTime())) return raw;

  return new Intl.DateTimeFormat(language === "bn" ? "bn-BD" : "en-US", {
    month: "short",
    year: "numeric",
  }).format(date);
}

function trend(rows: Row[], keys: string[]): Trend {
  const values = rows
    .map((row) => firstFinite(row, keys))
    .filter((value): value is number => value !== null);

  if (values.length < 2) return "none";

  const previous = values[values.length - 2];
  const latest = values[values.length - 1];
  const delta = latest - previous;
  const tolerance = Math.max(Math.abs(previous) * 0.03, 0.01);

  if (delta > tolerance) return "up";
  if (delta < -tolerance) return "down";
  return "flat";
}

function trendText(value: Trend, language: "bn" | "en"): string {
  if (value === "up") return language === "bn" ? "↑ বৃদ্ধি" : "↑ Rising";
  if (value === "down") return language === "bn" ? "↓ কমেছে" : "↓ Falling";
  if (value === "flat") return language === "bn" ? "→ স্থিতিশীল" : "→ Stable";
  return "—";
}

function numberText(value: number | null, digits = 2): string {
  return value === null ? "—" : value.toFixed(digits);
}

export default function EarthObservationContext({
  data,
  language = "bn",
}: Props) {
  const rows = useMemo(() => getRows(data), [data]);

  const latest = rows.length > 0 ? rows[rows.length - 1] : {};

  const observationMonth =
    latest.observation_month ??
    (latest.year && latest.month
      ? `${latest.year}-${String(latest.month).padStart(2, "0")}`
      : null);

  const descriptions =
    language === "bn"
      ? {
          rainfall: "মাসিক বৃষ্টিপাতের environmental context।",
          soil: "মাটির পানির availability বোঝার একটি indicator।",
          ndvi: "উদ্ভিদের সবুজত্বের environmental indicator।",
          lst: "মাঠের surface thermal condition-এর context।",
          grace: "বিস্তৃত terrestrial water-storage context।",
          temperature: "মাঠের broader climate context।",
        }
      : {
          rainfall: "Monthly rainfall provides environmental context.",
          soil: "An indicator of root-zone water availability.",
          ndvi: "An indicator of vegetation greenness.",
          lst: "Context for surface thermal conditions.",
          grace: "Broader terrestrial water-storage context.",
          temperature: "Broader climate context for the field.",
        };

  const observations: Array<{
    source: string;
    label: string;
    value: number | null;
    unit: string;
    trend: Trend;
    description: string;
  }> = [
    {
      source: "GPM",
      label: language === "bn" ? "বৃষ্টিপাত" : "Rainfall",
      value: firstFinite(latest, [
        "ag_rainfall_mm",
        "gpm_value",
        "rainfall_mm",
        "precipitation_mm",
      ]),
      unit: "mm",
      trend: trend(rows, [
        "ag_rainfall_mm",
        "gpm_value",
        "rainfall_mm",
        "precipitation_mm",
      ]),
      description: descriptions.rainfall,
    },
    {
      source: "SMAP",
      label: language === "bn" ? "মাটির পানি" : "Root-zone soil moisture",
      value: firstFinite(latest, [
        "ag_soil_moisture",
        "smap_value",
        "soil_moisture",
      ]),
      unit: "",
      trend: trend(rows, ["ag_soil_moisture", "smap_value", "soil_moisture"]),
      description: descriptions.soil,
    },
    {
      source: "MODIS",
      label: "NDVI",
      value: firstFinite(latest, ["ag_ndvi", "modis_ndvi", "ndvi"]),
      unit: "",
      trend: trend(rows, ["ag_ndvi", "modis_ndvi", "ndvi"]),
      description: descriptions.ndvi,
    },
    {
      source: "ECOSTRESS",
      label:
        language === "bn" ? "ভূ-পৃষ্ঠের তাপমাত্রা" : "Land-surface temperature",
      value: firstFinite(latest, [
        "ag_lst_c",
        "ecostress_value",
        "ecostress_lst_c",
        "lst_c",
      ]),
      unit: "°C",
      trend: trend(rows, [
        "ag_lst_c",
        "ecostress_value",
        "ecostress_lst_c",
        "lst_c",
      ]),
      description: descriptions.lst,
    },
    {
      source: "GRACE",
      label:
        language === "bn" ? "পানির মজুতের পরিবর্তন" : "Water-storage anomaly",
      value: firstFinite(latest, [
        "ag_grace_tws_anomaly_cm",
        "grace_value",
        "grace_tws_anomaly_cm",
      ]),
      unit: "cm",
      trend: trend(rows, [
        "ag_grace_tws_anomaly_cm",
        "grace_value",
        "grace_tws_anomaly_cm",
      ]),
      description: descriptions.grace,
    },
    {
      source: "POWER",
      label: language === "bn" ? "গড় তাপমাত্রা" : "Mean temperature",
      value: firstFinite(latest, [
        "power_temperature_mean",
        "ag_temperature_c",
        "temperature_c",
      ]),
      unit: "°C",
      trend: trend(rows, [
        "power_temperature_mean",
        "ag_temperature_c",
        "temperature_c",
      ]),
      description: descriptions.temperature,
    },
  ];

  return (
    <section aria-labelledby="readings-title">
      <div className="fs-head">
        <div>
          <h2 id="readings-title">
            {language === "bn"
              ? "মাঠের পরিবেশের বিস্তারিত"
              : "Detailed field environment"}
          </h2>

          <p>
            {language === "bn"
              ? "NASA ও NASA POWER থেকে পাওয়া তথ্য মাঠের পরিবেশ বোঝার context হিসেবে দেখানো হচ্ছে।"
              : "NASA and NASA POWER observations are shown as environmental context for the field."}
          </p>
        </div>

        <span className="fs-head-meta">
          {language === "bn" ? "সর্বশেষ" : "Latest"}
          <span className="fs-figure">
            {monthLabel(observationMonth, language)}
          </span>
        </span>
      </div>

      <div className="fs-panel">
        <div className="fs-panel-block">
          <table className="fs-table fs-readings">
            <caption className="fs-sr-only">
              {language === "bn"
                ? "NASA পরিবেশগত পর্যবেক্ষণ"
                : "NASA environmental observations"}
            </caption>

            <thead>
              <tr>
                <th scope="col" className="fs-col-sensor">
                  {language === "bn" ? "উৎস" : "Source"}
                </th>

                <th scope="col">{language === "bn" ? "পাঠ" : "Reading"}</th>

                <th scope="col" className="fs-col-value">
                  {language === "bn" ? "সর্বশেষ" : "Latest"}
                </th>

                <th scope="col" className="fs-col-trend">
                  {language === "bn" ? "পরিবর্তন" : "Change"}
                </th>
              </tr>
            </thead>

            <tbody>
              {observations.map((observation) => (
                <tr key={observation.source} className="fs-reading">
                  <td className="fs-cell-sensor">
                    <span className="fs-sensor">{observation.source}</span>
                  </td>

                  <td className="fs-cell-reading">
                    <span className="fs-reading-name">
                      {observation.label}
                    </span>

                    <span className="fs-reading-desc">
                      {observation.description}
                    </span>
                  </td>

                  <td className="fs-cell-value">
                    <span
                      className="fs-value"
                      data-missing={observation.value === null}
                    >
                      {numberText(observation.value)}

                      {observation.value !== null && observation.unit ? (
                        <span className="fs-value-unit">
                          {observation.unit}
                        </span>
                      ) : null}
                    </span>
                  </td>

                  <td className="fs-cell-trend">
                    <span
                      className="fs-trend"
                      data-trend={observation.trend}
                    >
                      {trendText(observation.trend, language)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="fs-panel-block">
          <details className="fs-subdetails">
            <summary>
              {language === "bn"
                ? "NASA data source ও বিস্তারিত দেখুন"
                : "View NASA data sources and details"}
            </summary>

            <div className="fs-subdetails-body">
              <dl className="fs-source-list">
                {[
                  ["GPM", "Precipitation"],
                  ["SMAP", "Root-zone soil moisture"],
                  ["MODIS", "NDVI"],
                  ["ECOSTRESS", "Land-surface temperature"],
                  ["GRACE", "Water-storage signal"],
                  ["NASA POWER", "Weather / climate variables"],
                ].map(([source, signal]) => (
                  <div key={source} className="fs-source">
                    <dt>{source}</dt>
                    <dd>{signal}</dd>
                  </div>
                ))}
              </dl>

              <p className="fs-note">
                {language === "bn"
                  ? `ঐতিহাসিক observation rows: ${rows.length}. Missing readings অনুপলব্ধ হিসেবে দেখানো হয়েছে।`
                  : `Historical observation rows: ${rows.length}. Missing readings are shown as unavailable.`}
              </p>
            </div>
          </details>

          <p className="fs-note">
            {language === "bn"
              ? "এই observations environmental compatibility ও crop-rotation scenario comparison-এর context দেয়। এগুলো সরাসরি ফলন, লাভ বা crop-specific diagnosis-এর পূর্বাভাস নয়।"
              : "These observations provide context for environmental compatibility and crop-rotation scenario comparison. They are not direct yield, profit or crop-specific diagnostic predictions."}
          </p>
        </div>
      </div>
    </section>
  );
}
