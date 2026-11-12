import { useEffect, useState } from "react";

import { getDemoFields } from "../../services/api";

import type { DemoFieldSeason, DemoFieldsResponse, SeasonLabel } from "../../types/demoFields";

import bn from "../../i18n/bn";
import en from "../../i18n/en";

type Language = "bn" | "en";

// Reference categorical slots 1-4 in fixed order (validated together).
// Aqua and yellow are below 3:1 against white, so every cell carries a
// letter and the legend names each class.
const CLASS_COLOR: Record<SeasonLabel, string> = {
  Boro: "#2a78d6",
  Fallow: "#eb6834",
  T_Aman: "#1baf7a",
  Rabi_nonrice: "#eda100",
};

function strings(language: Language) {
  return language === "bn" ? bn.fieldsFromSpace : en.fieldsFromSpace;
}

function fill(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((text, [key, value]) => text.split(`{${key}}`).join(String(value)), template);
}

function seasonClass(season: DemoFieldSeason | undefined): { label: SeasonLabel | null; fromModel: boolean } {
  if (!season) return { label: null, fromModel: false };
  if (season.rule_label) return { label: season.rule_label, fromModel: false };
  if (season.predicted && !season.uncertain) return { label: season.predicted, fromModel: true };
  return { label: null, fromModel: false };
}

function Cell({ season, language }: { season: DemoFieldSeason | undefined; language: Language }) {
  const t = strings(language);
  const { label, fromModel } = seasonClass(season);
  const name = label ? t.label[label] : t.label.none;

  return (
    <div
      className={`flex h-7 w-7 items-center justify-center rounded-md text-[10px] font-black ${
        label ? "text-white" : "border border-dashed border-slate-300 text-slate-400"
      } ${fromModel ? "opacity-60" : ""}`}
      style={label ? { background: CLASS_COLOR[label] } : undefined}
      title={`${season?.year ?? ""} · ${name}${fromModel ? ` · ${t.fromModel}` : ""}`}
      aria-label={`${season?.year ?? ""} ${name}`}
    >
      {label ? t.short[label] : t.short.none}
    </div>
  );
}

export default function DemoFieldsSection({ language = "bn" }: { language?: Language }) {
  const t = strings(language);
  const [data, setData] = useState<DemoFieldsResponse | null>(null);

  useEffect(() => {
    let active = true;
    getDemoFields()
      .then((response) => active && setData(response))
      .catch(() => active && setData(null));
    return () => {
      active = false;
    };
  }, []);

  if (!data) return null;

  const num = (value: number) => value.toLocaleString(language === "bn" ? "bn-BD" : "en-GB");

  const years = [...new Set(data.fields.flatMap((f) => f.seasons.map((s) => s.year)))].sort();
  const coastal = data.coastal_fallow;
  const inlandLabelled = data.fields
    .filter((f) => f.field_id !== coastal.field_id)
    .reduce((sum, f) => sum + f.rabi_fallow.labelled, 0);
  const fields = [...data.fields].sort((a, b) =>
    a.field_id === coastal.field_id ? -1 : b.field_id === coastal.field_id ? 1 : a.upazila.localeCompare(b.upazila),
  );

  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-700">{t.eyebrow}</p>
      <h2 className="mt-2 text-xl font-black text-slate-900 sm:text-2xl">{t.title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">{t.subtitle}</p>

      {coastal.coastal && (
        <div className="mt-4 rounded-2xl border border-orange-200 bg-orange-50 p-4">
          <p className="text-sm font-black leading-6 text-slate-900">
            🌊{" "}
            {fill(t.coastalLine, {
              fallow: num(coastal.coastal.fallow),
              years: num(coastal.coastal.years),
              inland: num(coastal.inland_fallow),
              inlandLabelled: num(inlandLabelled),
            })}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-600">{t.coastalWhy}</p>
        </div>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="text-left text-xs text-slate-600">
          <thead>
            <tr>
              <th className="pr-3" />
              <th className="pr-3" />
              {years.map((year) => (
                <th key={year} className="px-0.5 pb-1 text-center font-bold text-slate-500">
                  {String(year).slice(2)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fields.flatMap((field) =>
              (["rabi", "kharif2"] as const).map((season, i) => (
                <tr key={`${field.field_id}-${season}`}>
                  <td className="whitespace-nowrap pr-3 font-black text-slate-800">{i === 0 ? field.upazila : ""}</td>
                  <td className="whitespace-nowrap pr-3 text-slate-500">{t[season]}</td>
                  {years.map((year) => (
                    <td key={year} className="px-0.5 py-0.5">
                      <Cell
                        season={field.seasons.find((s) => s.season === season && s.year === year)}
                        language={language}
                      />
                    </td>
                  ))}
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-slate-600">
        {(Object.keys(CLASS_COLOR) as SeasonLabel[]).map((label) => (
          <span key={label} className="flex items-center gap-1">
            <span
              className="flex h-4 w-4 items-center justify-center rounded text-[9px] font-black text-white"
              style={{ background: CLASS_COLOR[label] }}
            >
              {t.short[label]}
            </span>
            {t.label[label]}
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span className="flex h-4 w-4 items-center justify-center rounded border border-dashed border-slate-300 text-[9px] text-slate-400">
            ?
          </span>
          {t.label.none}
        </span>
      </div>
      <p className="mt-2 text-[11px] leading-5 text-slate-500">{t.source}</p>
      <details className="mt-2 text-[11px] leading-5 text-slate-600">
        <summary className="cursor-pointer font-black text-blue-700">{t.classifierTitle}</summary>
        <p className="mt-1">{t.classifierNote}</p>
      </details>
    </div>
  );
}
