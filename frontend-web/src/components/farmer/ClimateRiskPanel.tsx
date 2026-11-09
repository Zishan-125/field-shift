import { useState } from "react";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { ClimateShiftResponse, CropExposure, ExposureHazard } from "../../types/climate";

import bn from "../../i18n/bn";
import en from "../../i18n/en";

type Language = "bn" | "en";

// Same validated pair as the trend charts (dataviz reference palette, slots 1-2).
const NASA_COLOR = "#2a78d6";
const HIGHLIGHT_COLOR = "#eb6834";
const FIT_COLOR = "#78716c";
const GREEN_COLOR = "#1baf7a";
const GRID_COLOR = "#e7e5e4";
const AXIS_TEXT = "#52514e";

const axis = {
  tick: { fill: AXIS_TEXT, fontSize: 11 },
  axisLine: { stroke: GRID_COLOR },
  tickLine: false,
};

function strings(language: Language) {
  return language === "bn" ? bn.climateRisk : en.climateRisk;
}

function fill(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((text, [key, value]) => text.split(`{${key}}`).join(String(value)), template);
}

function number(value: number, language: Language, digits = 0): string {
  return value.toLocaleString(language === "bn" ? "bn-BD" : "en-GB", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function day(iso: string, language: Language): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(language === "bn" ? "bn-BD" : "en-GB", {
    day: "numeric",
    month: "short",
  });
}

/* ------------------------------------------------------------------ */
/* Crop exposure: "hit in N of the last 28 years"                      */
/* ------------------------------------------------------------------ */

function ExposureCard({
  crop,
  items,
  floodMm,
  language,
}: {
  crop: string;
  items: CropExposure[];
  floodMm: number;
  language: Language;
}) {
  const t = strings(language);
  const patternNames = (item: CropExposure) => item.better_patterns;
  const hit = items.filter((item) => item.n_hit > 0).sort((a, b) => b.n_hit - a.n_hit);
  const clear = items.filter((item) => item.n_hit === 0);

  const hazardText = (hazard: ExposureHazard) =>
    fill(t.hazard[hazard], { mm: number(floodMm, language) });

  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <p className="text-sm font-black text-slate-900">{crop}</p>

      <ul className="mt-2 space-y-3">
        {hit.map((item) => (
          <li key={item.hazard} className="text-sm leading-6 text-slate-700">
            <div className="flex items-start gap-3">
              <span className="shrink-0 whitespace-nowrap pr-1 text-2xl font-black leading-8 text-slate-900">
                {number(item.n_hit, language)}/{number(item.n_years, language)}
              </span>
              <span>
                {item.validation.status === "linked_to_loss" ? (
                  <span className="mr-1 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-black text-orange-900">
                    {t.linkedBadge}
                  </span>
                ) : item.validation.status === "exposure_only" ? (
                  <span className="mr-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-700">
                    {t.exposureBadge}
                  </span>
                ) : null}
                {fill(item.validation.status === "exposure_only" ? t.exposedSentence : t.hitSentence, {
                  crop,
                  hazard: hazardText(item.hazard),
                  n: number(item.n_hit, language),
                  total: number(item.n_years, language),
                })}{" "}
                {fill(t.lastHit, {
                  years: item.years_hit
                    .slice(-3)
                    .map((year) => number(year, language).replace(/[,.\s]/g, ""))
                    .join(", "),
                })}
              </span>
            </div>

            {item.validation.status === "linked_to_loss" && (
              <p className="mt-1 text-xs text-slate-700">
                {fill(t.linkedNote, {
                  years: item.validation.years ?? "",
                  pct: number(Math.abs(item.validation.production_difference_pct ?? 0), language),
                  crop,
                })}
              </p>
            )}
            {item.validation.status === "exposure_only" && (
              <p className="mt-1 text-xs text-slate-700">
                {fill(t.exposureNote, { years: item.validation.years ?? "", crop })}
              </p>
            )}

            {patternNames(item).length > 0 ? (
              <p className="mt-1 text-xs text-slate-600">
                <span className="font-black">{t.betterPatterns}</span>{" "}
                {item.better_patterns
                  .map(
                    (pattern) =>
                      `${(["rabi", "kharif1", "kharif2"] as const)
                        .map((season) =>
                          language === "bn" ? pattern.seasons[season].name_bn : pattern.seasons[season].name_en,
                        )
                        .join(" – ")} (${fill(t.betterYears, { n: number(pattern.years_hit, language) })})`,
                  )
                  .join(" · ")}
              </p>
            ) : (
              <p className="mt-1 text-xs text-slate-500">{t.noBetter}</p>
            )}

            {item.hazard === "heat_flowering" ? (
              <p className="mt-1 text-[11px] leading-5 text-amber-800">{t.heatCaveat}</p>
            ) : (
              <p className="mt-1 text-[11px] leading-5 text-amber-800">
                {fill(t.eraCaveat, {
                  before: number(item.n_hit_before_2014, language),
                  after: number(item.n_hit_from_2014, language),
                })}
              </p>
            )}
          </li>
        ))}
      </ul>

      {clear.length > 0 && (
        <p className="mt-3 text-xs text-slate-500">
          ✓{" "}
          {fill(t.notHit, {
            total: number(clear[0].n_years, language),
            items: clear.map((item) => t.hazardShort[item.hazard]).join(", "),
          })}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Monsoon variability                                                 */
/* ------------------------------------------------------------------ */

function MonsoonChart({ data, language }: { data: ClimateShiftResponse; language: Language }) {
  const t = strings(language);
  const extremes = data.extremes!;
  const s = extremes.summary;

  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <p className="text-sm font-black text-slate-900">{t.monsoonTitle}</p>
      <p className="mt-2 text-sm leading-6 text-slate-700">
        {fill(t.monsoonSentence, {
          driest: number(s.monsoon_driest_mm, language),
          driestYear: String(s.monsoon_driest_year),
          wettest: number(s.monsoon_wettest_mm, language),
          wettestYear: String(s.monsoon_wettest_year),
          cv: number(s.monsoon_cv * 100, language),
          mean: number(s.monsoon_mean_mm, language),
        })}
      </p>

      <div className="mt-3">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={extremes.years} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid stroke={GRID_COLOR} vertical={false} />
            <XAxis dataKey="year" {...axis} />
            <YAxis {...axis} width={48} />
            <Tooltip
              formatter={(value) => [`${Math.round(Number(value))} mm`, t.monsoonSeries]}
              cursor={{ fill: "#f5f5f4" }}
            />
            <Bar dataKey="monsoon_rain_mm" name={t.monsoonSeries} radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {extremes.years.map((row) => (
                <Cell key={row.year} fill={row.year === 2024 ? HIGHLIGHT_COLOR : NASA_COLOR} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="mt-1 text-[11px] text-slate-500">
          <span className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ background: HIGHLIGHT_COLOR }} />
          {t.series2024}
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Return periods of the wettest 7 / 15 days                           */
/* ------------------------------------------------------------------ */

function ReturnPeriodChart({ data, language }: { data: ClimateShiftResponse; language: Language }) {
  const t = strings(language);
  const [days, setDays] = useState<"7" | "15">("7");
  const [table, setTable] = useState(false);
  const extremes = data.extremes!;
  const s = extremes.summary;
  const points = extremes.return_curve[days];
  const loc = s[`rx${days}_gumbel_loc`];
  const scale = s[`rx${days}_gumbel_scale`];

  const fit = [1.05, 1.2, 1.5, 2, 3, 5, 7, 10, 15, 20, 30, 40, 60].map((T) => ({
    T,
    fit: loc - scale * Math.log(-Math.log(1 - 1 / T)),
  }));
  const others = points.filter((p) => p.year !== 2024).map((p) => ({ T: p.return_period_y, value: p.value_mm, year: p.year }));
  const year2024 = points.filter((p) => p.year === 2024).map((p) => ({ T: p.return_period_y, value: p.value_mm, year: p.year }));
  const rank = s[`rx${days}_2024_rank`];
  const values = [...points.map((p) => p.value_mm), ...fit.map((f) => f.fit)];
  const yMin = Math.floor((Math.min(...values) - 20) / 50) * 50;
  const yMax = Math.ceil((Math.max(...values) + 20) / 50) * 50;

  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-black text-slate-900">{t.extremeTitle}</p>
        <div className="flex gap-1">
          {(["7", "15"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setDays(option)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-black ${
                days === option ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
              }`}
              aria-pressed={days === option}
            >
              {option === "7" ? t.window7 : t.window15}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-2 text-sm leading-6 text-slate-700">
        {fill(t.extremeSentence, {
          days: days === "7" ? t.window7 : t.window15,
          value: number(s[`rx${days}_2024_mm`], language),
          rankText: rank === 1 ? t.rankFirst : fill(t.rankOther, { rank: number(rank, language) }),
          T: number(s[`rx${days}_2024_return_period_gumbel_y`], language),
        })}
      </p>

      <div className="mt-3">
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart margin={{ top: 4, right: 12, bottom: 22, left: -8 }}>
            <CartesianGrid stroke={GRID_COLOR} />
            <XAxis
              dataKey="T"
              type="number"
              scale="log"
              domain={[1, 60]}
              ticks={[1, 2, 5, 10, 20, 50]}
              allowDataOverflow
              {...axis}
              label={{ value: t.axisReturn, position: "insideBottom", offset: -10, fill: AXIS_TEXT, fontSize: 11 }}
            />
            <YAxis
              {...axis}
              type="number"
              width={52}
              domain={[yMin, yMax]}
              allowDataOverflow
              tickFormatter={(value: number) => String(Math.round(value))}
            />
            <Tooltip
              formatter={(value, name) => [`${Math.round(Number(value))} mm`, name]}
              labelFormatter={(T) => `${t.returnPeriod}: ${Number(T).toFixed(1)}`}
            />
            <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11, color: AXIS_TEXT, paddingBottom: 8 }} />
            <Line
              data={fit}
              dataKey="fit"
              name={t.seriesFit}
              stroke={FIT_COLOR}
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              isAnimationActive={false}
            />
            <Scatter data={others} dataKey="value" name={t.seriesYears} fill={NASA_COLOR} isAnimationActive={false} />
            <Scatter
              data={year2024}
              dataKey="value"
              name={t.series2024}
              fill={HIGHLIGHT_COLOR}
              shape={(props: unknown) => {
                const { cx, cy } = props as { cx: number; cy: number };
                return <circle cx={cx} cy={cy} r={7} fill={HIGHLIGHT_COLOR} stroke="#ffffff" strokeWidth={2} />;
              }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <button type="button" onClick={() => setTable((v) => !v)} className="mt-1 text-[11px] font-black text-blue-700">
        {table ? t.tableHide : t.tableShow}
      </button>
      {table && (
        <table className="mt-2 text-left text-xs text-slate-600">
          <thead className="text-slate-500">
            <tr>
              <th className="pr-3">{t.year}</th>
              <th className="pr-3">{t.axisTotal}</th>
              <th>{t.returnPeriod}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.year} className={p.year === 2024 ? "font-black text-slate-900" : ""}>
                <td className="pr-3">{p.year}</td>
                <td className="pr-3">{Math.round(p.value_mm)}</td>
                <td>{p.return_period_y.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Fulgazi 2024 flood recovery                                         */
/* ------------------------------------------------------------------ */

function RecoveryTimeline({ data, language }: { data: ClimateShiftResponse; language: Language }) {
  const t = strings(language);
  const r = data.recovery!;
  const start = new Date("2024-07-15").getTime();
  const end = new Date("2024-11-15").getTime();
  const pos = (iso: string) => ((new Date(iso).getTime() - start) / (end - start)) * 100;

  const segments = [
    { from: r.ndvi_before_date ?? "2024-07-15", to: r.flood_start, color: GREEN_COLOR, label: t.recoveryGreen },
    { from: r.flood_start, to: r.flood_end, color: NASA_COLOR, label: t.recoveryWater },
    { from: r.green_again, to: "2024-11-15", color: GREEN_COLOR, label: t.recoveryRegrow },
  ];

  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <p className="text-sm font-black text-slate-900">{t.recoveryTitle}</p>
      <p className="mt-2 text-sm leading-6 text-slate-700">
        {fill(t.recoverySentence, {
          before: r.ndvi_before_date ? day(r.ndvi_before_date, language) : "—",
          start: day(r.flood_start, language),
          end: day(r.flood_end, language),
          days: number(r.days_under_water, language),
          green: day(r.green_again, language),
          total: number(r.days_flood_start_to_green, language),
        })}
      </p>

      <div className="relative mt-4 h-6 rounded-full bg-slate-100" role="img" aria-label={t.recoveryTitle}>
        {segments.map((segment) => (
          <div
            key={segment.label}
            className="absolute top-0 h-6 rounded-full"
            style={{
              left: `${Math.max(0, pos(segment.from))}%`,
              width: `${Math.max(1, pos(segment.to) - Math.max(0, pos(segment.from)))}%`,
              background: segment.color,
            }}
            title={segment.label}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-slate-500">
        <span>{day("2024-07-15", language)}</span>
        <span>{day("2024-11-15", language)}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-600">
        <span>
          <span className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ background: GREEN_COLOR }} />
          {t.recoveryGreen}
        </span>
        <span>
          <span className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ background: NASA_COLOR }} />
          {t.recoveryWater}
        </span>
      </div>
      <p className="mt-2 text-[11px] leading-5 text-slate-500">{t.recoveryRule}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* CMIP6 projections                                                   */
/* ------------------------------------------------------------------ */

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function Projections({ data, language }: { data: ClimateShiftResponse; language: Language }) {
  const t = strings(language);
  const models = new Set(data.projections.map((p) => p.model));
  const rows = [
    { id: "hot_days_mar_may" as const, label: t.projHot, digits: 0 },
    { id: "rx5day_mm" as const, label: t.projRx5, digits: 0 },
  ];

  const cell = (indicator: string, scenario: string, digits: number) => {
    const values = data.projections
      .filter((p) => p.indicator === indicator && p.scenario === scenario)
      .map((p) => p.projected);
    if (!values.length) return "—";
    const baseline = data.projections.find((p) => p.indicator === indicator)?.baseline_observed ?? 0;
    const change = median(values) - baseline;
    const changeText =
      indicator === "rx5day_mm"
        ? `${change >= 0 ? "+" : "−"}${number(Math.abs((100 * change) / baseline), language)}%`
        : `${change >= 0 ? "+" : "−"}${number(Math.abs(change), language, digits)}`;
    return fill(t.projRange, {
      change: changeText,
      median: number(median(values), language, digits),
      min: number(Math.min(...values), language, digits),
      max: number(Math.max(...values), language, digits),
    });
  };

  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <p className="text-sm font-black text-slate-900">{t.projectionsTitle}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{fill(t.projectionsIntro, { n: number(models.size, language) })}</p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-xs text-slate-700">
          <thead className="text-slate-500">
            <tr>
              <th className="py-1 pr-2" />
              <th className="py-1 pr-2">{t.projNow}</th>
              <th className="py-1 pr-2">{t.projMid}</th>
              <th className="py-1">{t.projHigh}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const baseline = data.projections.find((p) => p.indicator === row.id)?.baseline_observed;
              return (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="py-1 pr-2 font-bold">{row.label}</td>
                  <td className="py-1 pr-2">{baseline === undefined ? "—" : number(baseline, language, row.digits)}</td>
                  <td className="py-1 pr-2">{cell(row.id, "ssp245", row.digits)}</td>
                  <td className="py-1">{cell(row.id, "ssp585", row.digits)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {data.projection_context?.hot_days_recent_mean != null && (
        <p className="mt-2 text-[11px] leading-5 text-slate-500">
          {fill(t.projBaselineNote, { recent: number(data.projection_context.hot_days_recent_mean, language) })}
        </p>
      )}
      <p className="mt-1 text-[11px] leading-5 text-slate-500">
        {fill(t.projModels, { n: number(models.size, language) })}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export default function ClimateRiskPanel({ data, language }: { data: ClimateShiftResponse; language: Language }) {
  const t = strings(language);
  const floodMm = data.extremes?.summary.flood_threshold_7day_mm ?? 0;

  const byCrop = new Map<string, CropExposure[]>();
  for (const item of data.crop_exposure) {
    const key = language === "bn" ? item.name_bn : item.name_en;
    byCrop.set(key, [...(byCrop.get(key) ?? []), item]);
  }

  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-700">{t.eyebrow}</p>
      <h2 className="mt-2 text-xl font-black text-slate-900 sm:text-2xl">{t.title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">{fill(t.subtitle, { upazila: data.upazila })}</p>
      <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950">ℹ️ {t.shortRecord}</p>

      {byCrop.size > 0 && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {[...byCrop.entries()].map(([crop, items]) => (
            <ExposureCard key={crop} crop={crop} items={items} floodMm={floodMm} language={language} />
          ))}
        </div>
      )}

      {data.extremes && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <MonsoonChart data={data} language={language} />
          <ReturnPeriodChart data={data} language={language} />
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {data.recovery && <RecoveryTimeline data={data} language={language} />}
        {data.projections.length > 0 && <Projections data={data} language={language} />}
      </div>
    </div>
  );
}
