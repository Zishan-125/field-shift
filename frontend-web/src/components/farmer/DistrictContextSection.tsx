import { useEffect, useState } from "react";

import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { getDistrictContext, type DistrictContext } from "../../services/api";

type Language = "bn" | "en";

// Validated pair (dataviz reference palette slots 1-2) + a neutral for "other".
const FENI_COLOR = "#eb6834";
const FLOOD_COLOR = "#2a78d6";
const OTHER_COLOR = "#c8c6c0";
const AXIS_TEXT = "#52514e";

const T = {
  bn: {
    sentence:
      "২০২৪-২৫ সালে বাংলাদেশের ৬৪টি জেলার মধ্যে ফেনীতেই আমনের জমি সবচেয়ে বেশি কমেছে: আগের বছরের মাত্র {feni}% টিকে ছিল (সারা দেশে {national}%)।",
    scope: "৬৪ জেলার তথ্য শুধু জাতীয় তুলনা ও যাচাইয়ের জন্য। সুপারিশ শুধু ফেনীর জন্য।",
    feni: "ফেনী",
    flood: "বিবিএস-এর ২০২৪ বন্যা-ক্ষতির তালিকায় থাকা জেলা",
    other: "অন্য জেলা",
    axis: "২০২৪-২৫ আমনের জমি, ২০২৩-২৪-এর তুলনায়",
    source: "উৎস: বিবিএস কৃষি পরিসংখ্যান বর্ষগ্রন্থ ২০২৫, সারণি ৩.৫ (পৃ. ৮৭–৮৮); বন্যা-তালিকা সারণি ৪.২.৯ (পৃ. ৪৪৭–৪৪৮)।",
  },
  en: {
    sentence:
      "In 2024-25 Feni lost the largest share of its Aman area of all 64 districts in Bangladesh: only {feni}% of the previous year's area remained (nationally {national}%).",
    scope: "The 64 districts are national context and validation only. Recommendations cover Feni only.",
    feni: "Feni",
    flood: "District on BBS's 2024 flood-damage list",
    other: "Other district",
    axis: "Aman area 2024-25 relative to 2023-24",
    source: "Source: BBS Yearbook of Agricultural Statistics 2025, Table 3.5 (pp. 87–88); flood list Table 4.2.9 (pp. 447–448).",
  },
};

export default function DistrictContextSection({ language = "bn" }: { language?: Language }) {
  const t = T[language];
  const [data, setData] = useState<DistrictContext | null>(null);

  useEffect(() => {
    getDistrictContext().then(setData).catch(() => setData(null));
  }, []);

  if (!data) return null;

  const pct = (value: number) =>
    Math.round(value * 100).toLocaleString(language === "bn" ? "bn-BD" : "en-GB");
  // From the hectares, not the rounded ratio (26,753 / 66,130 = 40.5 % -> 40 %).
  const feniArea = data.districts.find((d) => d.district === "Feni") ?? data.districts[0];
  const color = (d: DistrictContext["districts"][number]) =>
    d.district === "Feni" ? FENI_COLOR : d.flood_listed_2024 ? FLOOD_COLOR : OTHER_COLOR;

  return (
    <div>
      <p className="text-sm font-black leading-6 text-slate-900">
        {t.sentence
          .replace("{feni}", pct(feniArea.aman_ha_2024_25 / feniArea.aman_ha_2023_24))
          .replace("{national}", pct(data.national_ratio))}
      </p>
      <p className="mt-2 rounded-xl bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-950">ℹ️ {t.scope}</p>

      <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-slate-600">
        {[
          [FENI_COLOR, t.feni],
          [FLOOD_COLOR, t.flood],
          [OTHER_COLOR, t.other],
        ].map(([c, label]) => (
          <span key={label} className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: c }} />
            {label}
          </span>
        ))}
      </div>

      <div className="mt-2" role="img" aria-label={t.axis}>
        <ResponsiveContainer width="100%" height={data.districts.length * 13 + 40}>
          <BarChart data={data.districts} layout="vertical" margin={{ top: 4, right: 12, bottom: 20, left: 0 }}>
            <XAxis
              type="number"
              domain={[0, 1.25]}
              ticks={[0, 0.25, 0.5, 0.75, 1, 1.25]}
              tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
              tick={{ fill: AXIS_TEXT, fontSize: 10 }}
              label={{ value: t.axis, position: "insideBottom", offset: -12, fill: AXIS_TEXT, fontSize: 10 }}
            />
            <YAxis
              type="category"
              dataKey="district"
              width={92}
              interval={0}
              tick={{ fill: AXIS_TEXT, fontSize: 9 }}
            />
            <ReferenceLine x={1} stroke="#78716c" strokeDasharray="3 3" />
            <Tooltip formatter={(value) => [`${Math.round(Number(value) * 100)}%`, t.axis]} />
            <Bar dataKey="ratio_2024_over_2023" barSize={8} radius={[0, 3, 3, 0]} isAnimationActive={false}>
              {data.districts.map((d) => (
                <Cell key={d.district} fill={color(d)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-[11px] leading-5 text-slate-500">{t.source}</p>
    </div>
  );
}
