import { lazy, Suspense, useEffect, useState } from "react";

import { getDemoFields } from "../../services/api";

import type { DemoFieldsResponse } from "../../types/demoFields";
import type { PatternRecommendationResponse } from "../../types/pattern";

import type { FieldPick } from "./FieldMapPicker";
import VerdictCard from "./VerdictCard";

import bn from "../../i18n/bn";
import en from "../../i18n/en";

// Leaflet loads in its own chunk.
const FieldMapPicker = lazy(() => import("./FieldMapPicker"));

type Language = "bn" | "en";

export const DEFAULT_FIELD = "feni_feni_sadar_01";

function fill(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((text, [key, value]) => text.split(`{${key}}`).join(String(value)), template);
}

export default function FarmerVerdictSection({
  language,
  pick,
  onPick,
  recommendations,
}: {
  language: Language;
  pick: FieldPick;
  onPick: (pick: FieldPick) => void;
  recommendations?: PatternRecommendationResponse | null;
}) {
  const t = language === "bn" ? bn.mapPicker : en.mapPicker;
  const [data, setData] = useState<DemoFieldsResponse | null>(null);

  useEffect(() => {
    getDemoFields().then(setData).catch(() => setData(null));
  }, []);

  const field = data?.fields.find((f) => f.field_id === pick.fieldId);
  const upazila = field?.upazila ?? "Feni Sadar";
  const km = pick.distanceKm === null ? "" : pick.distanceKm.toLocaleString(language === "bn" ? "bn-BD" : "en-GB", { maximumFractionDigits: 1 });

  const note =
    pick.distanceKm === null
      ? fill(t.selected, { field: upazila })
      : fill(pick.insideFeni ? t.nearest : t.outside, { field: upazila, km });

  return (
    <div className="space-y-3">
      <div className="rounded-[2rem] border border-slate-200 bg-white p-3 shadow-sm sm:p-6">
        <p className="text-sm font-black text-slate-900">{t.title}</p>
        <p
          className={`mt-1.5 rounded-xl px-3 py-1.5 text-[11px] leading-4 ${
            pick.distanceKm === null ? "bg-blue-50 text-blue-950" : "bg-amber-50 text-amber-950"
          }`}
        >
          📍 {note}
        </p>
        <div className="mt-2">
          {data ? (
            <Suspense fallback={<div className="h-[210px] animate-pulse rounded-2xl bg-slate-100" />}>
              <FieldMapPicker
                fields={data.fields}
                upazilas={data.upazilas}
                selectedId={pick.fieldId}
                onPick={onPick}
                language={language}
              />
            </Suspense>
          ) : (
            <div className="h-[210px] animate-pulse rounded-2xl bg-slate-100" />
          )}
        </div>
      </div>

      <VerdictCard
        fieldId={pick.fieldId}
        fieldName={upazila}
        language={language}
        sameTopEverywhere={data?.same_top_everywhere ?? false}
        recommendations={recommendations}
      />
    </div>
  );
}
