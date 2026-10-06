import type { SoilProfile } from "../../types/soil";

interface Props {
  soil: SoilProfile;
  language?: "bn" | "en";
}

function numberValue(soil: SoilProfile, keys: string[]): number | null {
  for (const key of keys) {
    const value = Number(soil[key]);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function format(value: number | null, digits = 2): string {
  return value === null ? "—" : value.toFixed(digits);
}

export default function FarmerSoilView({ soil, language = "bn" }: Props) {
  const ph = numberValue(soil, ["soil_topsoil_ph", "soil_ph_0-5cm", "ph"]);
  const organicCarbon = numberValue(soil, [
    "soil_topsoil_organic_carbon",
    "organic_carbon",
    "soil_organic_carbon",
  ]);
  const clay = numberValue(soil, ["soil_topsoil_clay", "clay"]);
  const sand = numberValue(soil, ["soil_topsoil_sand", "sand"]);
  const silt = numberValue(soil, ["soil_topsoil_silt", "silt"]);
  const cec = numberValue(soil, ["soil_topsoil_cec", "cec"]);
  const nitrogen = numberValue(soil, ["soil_topsoil_nitrogen", "nitrogen"]);
  const depth = numberValue(soil, ["soil_depth_cm", "depth_cm"]);

  const rawSoil = soil as Record<string, unknown>;
  const source = String(
    rawSoil.soil_source ?? rawSoil.source ?? "SoilGrids",
  );
  const isModelled =
    String(rawSoil.soil_values_are_modelled_predictions ?? "true") === "true" ||
    source.toLowerCase().includes("soilgrids");

  const rows = [
    {
      label: language === "bn" ? "pH" : "Soil pH",
      value: format(ph),
      unit: "",
    },
    {
      label: language === "bn" ? "জৈব কার্বন" : "Organic carbon",
      value: format(organicCarbon),
      unit: organicCarbon === null ? "" : "%",
    },
    {
      label: language === "bn" ? "কাদা" : "Clay",
      value: format(clay, 1),
      unit: clay === null ? "" : "%",
    },
    {
      label: language === "bn" ? "বালি" : "Sand",
      value: format(sand, 1),
      unit: sand === null ? "" : "%",
    },
    {
      label: language === "bn" ? "পলি" : "Silt",
      value: format(silt, 1),
      unit: silt === null ? "" : "%",
    },
  ];

  return (
    <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
      <div className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-green-600">
              {language === "bn" ? "মাটির তথ্য" : "Soil information"}
            </p>
            <h2 className="mt-2 text-xl font-black text-slate-950 sm:text-2xl">
              {language === "bn" ? "আপনার মাটি কেমন?" : "What is your soil like?"}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              {language === "bn"
                ? "মাঠের জন্য পাওয়া surface-soil বৈশিষ্ট্যগুলো সহজভাবে দেখানো হচ্ছে।"
                : "A simple view of the surface-soil properties available for this field."}
            </p>
          </div>

          <span className="w-fit rounded-full bg-slate-100 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-slate-600">
            {source}
          </span>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {rows.map((row) => (
            <div key={row.label} className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-bold text-slate-500">{row.label}</p>
              <p className="mt-2 text-xl font-black text-slate-900">
                {row.value}
                {row.unit && <span className="ml-1 text-xs font-bold text-slate-400">{row.unit}</span>}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <span className="text-lg">ℹ️</span>
            <div>
              <p className="text-sm font-black text-amber-950">
                {isModelled
                  ? language === "bn"
                    ? "এগুলো modelled soil estimates"
                    : "These are modelled soil estimates"
                  : language === "bn"
                    ? "মাটির তথ্যের উৎস"
                    : "Soil data source"}
              </p>
              <p className="mt-1 text-xs leading-5 text-amber-900/70">
                {isModelled
                  ? language === "bn"
                    ? "SoilGrids-এর modelled estimates; মাঠে সরাসরি মাপা soil sample নয়।"
                    : "SoilGrids modelled estimates; they are not direct field-measured soil samples."
                  : language === "bn"
                    ? `তথ্যের উৎস: ${source}`
                    : `Source: ${source}`}
              </p>
            </div>
          </div>
        </div>

        <details className="mt-4 rounded-2xl border border-slate-200 bg-white">
          <summary className="cursor-pointer px-4 py-3 text-sm font-black text-slate-700">
            {language === "bn" ? "আরও মাটির তথ্য দেখুন" : "View more soil details"}
          </summary>
          <div className="grid gap-3 border-t border-slate-100 p-4 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-slate-400">CEC</p>
              <p className="mt-1 font-black text-slate-800">{format(cec)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-slate-400">Nitrogen</p>
              <p className="mt-1 font-black text-slate-800">{format(nitrogen)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-slate-400">Depth</p>
              <p className="mt-1 font-black text-slate-800">
                {depth === null ? "—" : `${depth} cm`}
              </p>
            </div>
          </div>
        </details>

        <p className="mt-4 text-xs leading-5 text-slate-400">
          {language === "bn"
            ? "মাটির তথ্য rotation comparison-এর একটি অংশ; এটি crop-specific soil diagnosis নয়।"
            : "Soil information is one part of rotation comparison; it is not a crop-specific soil diagnosis."}
        </p>
      </div>
    </section>
  );
}
