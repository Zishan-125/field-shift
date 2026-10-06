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

function finite(value: unknown): number | null {
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

function trend(rows: Row[], keys: string[]): "up" | "down" | "flat" | "none" {
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

function trendText(value: ReturnType<typeof trend>, language: "bn" | "en"): string {
  if (value === "up") return language === "bn" ? "↑ বৃদ্ধি" : "↑ Rising";
  if (value === "down") return language === "bn" ? "↓ কমেছে" : "↓ Falling";
  if (value === "flat") return language === "bn" ? "→ স্থিতিশীল" : "→ Stable";
  return "—";
}

function numberText(value: number | null, digits = 2): string {
  return value === null ? "—" : value.toFixed(digits);
}

function ObservationCard({
  icon,
  source,
  label,
  value,
  unit,
  trendValue,
  description,
  language,
}: {
  icon: string;
  source: string;
  label: string;
  value: number | null;
  unit: string;
  trendValue: ReturnType<typeof trend>;
  description: string;
  language: "bn" | "en";
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-lg">
          {icon}
        </div>
        <span className="rounded-full bg-slate-50 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-slate-500">
          {source}
        </span>
      </div>

      <p className="mt-4 text-xs font-bold text-slate-500">{label}</p>
      <div className="mt-1 flex items-end justify-between gap-2">
        <p className="text-2xl font-black tracking-tight text-slate-950">
          {numberText(value)}
          {value !== null && <span className="ml-1 text-xs font-bold text-slate-400">{unit}</span>}
        </p>
        <span className="text-[10px] font-black text-slate-500">
          {trendText(trendValue, language)}
        </span>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-500">{description}</p>
    </div>
  );
}

export default function EarthObservationContext({ data, language = "bn" }: Props) {
  const rows = useMemo(() => getRows(data), [data]);
  const latest = rows.length > 0 ? rows[rows.length - 1] : {};

  const rainfall = firstFinite(latest, ["ag_rainfall_mm", "gpm_value", "rainfall_mm", "precipitation_mm"]);
  const soilMoisture = firstFinite(latest, ["ag_soil_moisture", "smap_value", "soil_moisture"]);
  const ndvi = firstFinite(latest, ["ag_ndvi", "modis_ndvi", "ndvi"]);
  const lst = firstFinite(latest, ["ag_lst_c", "ecostress_value", "ecostress_lst_c", "lst_c"]);
  const grace = firstFinite(latest, ["ag_grace_tws_anomaly_cm", "grace_value", "grace_tws_anomaly_cm"]);
  const temperature = firstFinite(latest, ["power_temperature_mean", "ag_temperature_c", "temperature_c"]);

  const observationMonth = latest.observation_month ??
    (latest.year && latest.month ? `${latest.year}-${String(latest.month).padStart(2, "0")}` : null);

  const descriptions = language === "bn"
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

  return (
    <section className="overflow-hidden rounded-[2rem] border border-blue-100 bg-blue-50/60 shadow-sm">
      <div className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">
              Earth Observation Context
            </p>
            <h2 className="mt-2 text-xl font-black text-blue-950 sm:text-2xl">
              {language === "bn" ? "মাঠের পরিবেশের বিস্তারিত" : "Detailed field environment"}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-950/65">
              {language === "bn"
                ? "NASA ও NASA POWER থেকে পাওয়া তথ্য মাঠের পরিবেশ বোঝার context হিসেবে দেখানো হচ্ছে।"
                : "NASA and NASA POWER observations are shown as environmental context for the field."}
            </p>
          </div>

          <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
              {language === "bn" ? "সর্বশেষ পর্যবেক্ষণ" : "Latest observation"}
            </p>
            <p className="mt-1 text-sm font-black text-slate-900">
              {monthLabel(observationMonth, language)}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ObservationCard icon="🌧️" source="GPM" label={language === "bn" ? "বৃষ্টিপাত" : "Rainfall"} value={rainfall} unit="mm" trendValue={trend(rows, ["ag_rainfall_mm", "gpm_value", "rainfall_mm", "precipitation_mm"])} description={descriptions.rainfall} language={language} />
          <ObservationCard icon="💧" source="SMAP" label={language === "bn" ? "মাটির পানি" : "Root-zone soil moisture"} value={soilMoisture} unit="" trendValue={trend(rows, ["ag_soil_moisture", "smap_value", "soil_moisture"])} description={descriptions.soil} language={language} />
          <ObservationCard icon="🌿" source="MODIS" label="NDVI" value={ndvi} unit="" trendValue={trend(rows, ["ag_ndvi", "modis_ndvi", "ndvi"])} description={descriptions.ndvi} language={language} />
          <ObservationCard icon="🌡️" source="ECOSTRESS" label={language === "bn" ? "ভূ-পৃষ্ঠের তাপমাত্রা" : "Land-surface temperature"} value={lst} unit="°C" trendValue={trend(rows, ["ag_lst_c", "ecostress_value", "ecostress_lst_c", "lst_c"])} description={descriptions.lst} language={language} />
          <ObservationCard icon="🌍" source="GRACE" label={language === "bn" ? "পানির মজুতের পরিবর্তন" : "Water-storage anomaly"} value={grace} unit="cm" trendValue={trend(rows, ["ag_grace_tws_anomaly_cm", "grace_value", "grace_tws_anomaly_cm"])} description={descriptions.grace} language={language} />
          <ObservationCard icon="☀️" source="POWER" label={language === "bn" ? "গড় তাপমাত্রা" : "Mean temperature"} value={temperature} unit="°C" trendValue={trend(rows, ["power_temperature_mean", "ag_temperature_c", "temperature_c"])} description={descriptions.temperature} language={language} />
        </div>

        <details className="mt-4 rounded-2xl border border-blue-100 bg-white">
          <summary className="cursor-pointer px-4 py-3 text-sm font-black text-blue-900">
            {language === "bn" ? "NASA data source ও বিস্তারিত দেখুন" : "View NASA data sources and details"}
          </summary>
          <div className="border-t border-blue-100 p-4">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["GPM", "Precipitation"],
                ["SMAP", "Root-zone soil moisture"],
                ["MODIS", "NDVI"],
                ["ECOSTRESS", "Land-surface temperature"],
                ["GRACE", "Water-storage signal"],
                ["NASA POWER", "Weather / climate variables"],
              ].map(([source, signal]) => (
                <div key={source} className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs font-black text-slate-800">{source}</p>
                  <p className="mt-1 text-xs text-slate-500">{signal}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-500">
              {language === "bn"
                ? `ঐতিহাসিক observation rows: ${rows.length}. Missing values থাকলে তা দেখানো হয়নি।`
                : `Historical observation rows: ${rows.length}. Missing observations are shown as unavailable.`}
            </p>
          </div>
        </details>

        <div className="mt-4 rounded-2xl border border-blue-100 bg-white p-4">
          <p className="text-sm font-black text-blue-950">
            {language === "bn" ? "এই তথ্য কীভাবে ব্যবহার করা হয়" : "How these observations are used"}
          </p>
          <p className="mt-1 text-xs leading-5 text-blue-950/65">
            {language === "bn"
              ? "এই observations environmental compatibility ও crop-rotation scenario comparison-এর context দেয়। এগুলো সরাসরি ফলন, লাভ বা crop-specific diagnosis-এর পূর্বাভাস নয়।"
              : "These observations provide context for environmental compatibility and crop-rotation scenario comparison. They are not direct yield, profit or crop-specific diagnostic predictions."}
          </p>
        </div>
      </div>
    </section>
  );
}
