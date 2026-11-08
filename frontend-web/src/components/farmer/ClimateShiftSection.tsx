import { useEffect, useMemo, useState } from "react";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { getClimateShift } from "../../services/api";

import type {
  ClimateAdvice,
  ClimateIndicator,
  ClimateIndicatorId,
  ClimateShiftResponse,
} from "../../types/climate";

import bn from "../../i18n/bn";
import en from "../../i18n/en";

type Language = "bn" | "en";

interface ClimateShiftSectionProps {
  language?: Language;
}

// Reference palette (dataviz skill), categorical slots 1-3, validated together.
// Slot 3 is below 3:1 contrast, so that line is also dashed and the values are
// in the details table.
const NASA_COLOR = "#2a78d6";
const GAUGE_COLOR = "#eb6834";
const POWER_COMPARE_COLOR = "#1baf7a";
const GRID_COLOR = "#e7e5e4";
const AXIS_TEXT = "#52514e";

const CHART_INDICATORS: ClimateIndicatorId[] = [
  "tx90p_mar_may",
  "annual_rain_mm",
  "extreme_rain_days",
  "rainy_season_onset_doy",
];

function strings(language: Language) {
  return language === "bn" ? bn.climate : en.climate;
}

function fill(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, String(value)),
    template,
  );
}

function round(value: number, digits = 1): string {
  return Math.abs(value) >= 100 ? Math.round(value).toString() : value.toFixed(digits);
}

function dayOfYearLabel(doy: number, language: Language): string {
  const day = new Date(2001, 0, Math.round(doy));
  return day.toLocaleDateString(language === "bn" ? "bn-BD" : "en-GB", {
    day: "numeric",
    month: "short",
  });
}

function unitLabel(indicator: ClimateIndicator, language: Language): string {
  const t = strings(language);
  return t.unit[indicator.unit as keyof typeof t.unit] ?? indicator.unit;
}

/** One plain-language sentence per indicator, chosen by its status. */
function sentence(indicator: ClimateIndicator, language: Language): string {
  const t = strings(language);
  const label = t.indicator[indicator.indicator];
  const unit = unitLabel(indicator, language);

  if (indicator.status === "trend") {
    return fill(t.sentenceTrend, {
      label,
      verb: indicator.change_per_decade >= 0 ? t.rose : t.fell,
      value: round(Math.abs(indicator.change_per_decade)),
      unit,
      year: indicator.first_year,
    });
  }

  if (indicator.status === "step_change_not_trend") {
    return fill(t.sentenceStep, {
      label,
      year: indicator.pettitt_break_year,
      before: round(indicator.mean_before_break),
      after: round(indicator.mean_after_break),
      unit,
    });
  }

  return fill(t.sentenceNone, { label, year: indicator.first_year });
}

function StatusBadge({ indicator, language }: { indicator: ClimateIndicator; language: Language }) {
  const t = strings(language);

  const [text, className] =
    indicator.status === "trend"
      ? [t.trendBadge, "bg-blue-50 text-blue-900"]
      : indicator.status === "step_change_not_trend"
        ? [t.stepBadge, "bg-amber-50 text-amber-900"]
        : [t.notSignificantBadge, "bg-slate-100 text-slate-700"];

  return <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${className}`}>{text}</span>;
}

function IndicatorChart({
  indicator,
  gauge,
  comparison,
  language,
}: {
  indicator: ClimateIndicator;
  gauge: Map<number, number>;
  comparison?: Map<number, number>;
  language: Language;
}) {
  const t = strings(language);
  const unit = unitLabel(indicator, language);
  const mainName = indicator.source === "gpm" ? t.gpmSeries : t.nasaSeries;

  const data = indicator.series.map((point) => ({
    year: point.year,
    nasa: point.value,
    gauge: gauge.get(point.year),
    power: comparison?.get(point.year),
  }));

  const axis = {
    tick: { fill: AXIS_TEXT, fontSize: 11 },
    axisLine: { stroke: GRID_COLOR },
    tickLine: false,
  };

  if (indicator.indicator === "annual_rain_mm") {
    return (
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid stroke={GRID_COLOR} vertical={false} />
          <XAxis dataKey="year" {...axis} />
          <YAxis {...axis} width={48} />
          <Tooltip formatter={(value) => `${Math.round(Number(value))} ${unit}`} />
          <Legend wrapperStyle={{ fontSize: 11, color: AXIS_TEXT }} />
          <Line
            type="monotone"
            dataKey="nasa"
            name={mainName}
            stroke={NASA_COLOR}
            strokeWidth={2}
            isAnimationActive={false}
            dot={false}
          />
          {comparison && comparison.size > 0 && (
            <Line
              type="monotone"
              dataKey="power"
              name={t.nasaSeries}
              stroke={POWER_COMPARE_COLOR}
              strokeWidth={2}
              strokeDasharray="5 4"
              isAnimationActive={false}
              dot={false}
            />
          )}
          <Scatter dataKey="gauge" name={t.gaugeSeries} fill={GAUGE_COLOR} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    );
  }

  if (indicator.indicator === "rainy_season_onset_doy") {
    return (
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid stroke={GRID_COLOR} vertical={false} />
          <XAxis dataKey="year" {...axis} />
          <YAxis
            {...axis}
            width={56}
            domain={["dataMin - 10", "dataMax + 10"]}
            tickFormatter={(doy: number) => dayOfYearLabel(doy, language)}
          />
          <Tooltip formatter={(doy) => dayOfYearLabel(Number(doy), language)} />
          <Line
            type="monotone"
            dataKey="nasa"
            name={t.nasaSeries}
            stroke={NASA_COLOR}
            strokeWidth={2}
            isAnimationActive={false}
            dot={{ r: 3, fill: NASA_COLOR }}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
        <XAxis dataKey="year" {...axis} />
        <YAxis {...axis} width={40} allowDecimals={false} />
        <Tooltip formatter={(value) => `${Number(value)} ${unit}`} cursor={{ fill: "#f5f5f4" }} />
        <Bar dataKey="nasa" name={t.nasaSeries} fill={NASA_COLOR} radius={[4, 4, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function AdviceItem({ item, language }: { item: ClimateAdvice; language: Language }) {
  const t = strings(language);
  const patternStrings = language === "bn" ? bn.patterns : en.patterns;
  const hazardText = item.adverse
    ? t.hazard[item.hazard as keyof typeof t.hazard]
    : t.hazardReverse[item.hazard as keyof typeof t.hazardReverse];
  const crops = item.threatened_crops
    .map((crop) => (language === "bn" ? crop.name_bn : crop.name_en))
    .join(", ");
  const isWater = item.hazard === "drier_rabi" || item.hazard === "higher_water_demand";

  let consequence: string;
  if (isWater) {
    consequence = item.adverse ? t.adviceWater : t.adviceBenefitWater;
  } else {
    consequence = fill(item.adverse ? t.adviceThreat : t.adviceBenefit, { crops: crops || "—" });
  }

  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6">
      <p className="font-black text-slate-900">
        {item.adverse ? "⚠️" : "ℹ️"} {hazardText}
      </p>
      <p className="text-slate-700">{consequence}</p>

      {item.gauge_agrees === false && <p className="text-xs text-amber-800">{t.caveatGauge}</p>}

      {item.adverse && (
        <div className="mt-2">
          {item.better_patterns.length === 0 ? (
            <p className="text-xs text-slate-500">{t.noBetter}</p>
          ) : (
            <>
              <p className="text-xs font-black text-slate-600">{t.betterPatterns}</p>
              <ul className="mt-1 space-y-1">
                {item.better_patterns.map((pattern) => (
                  <li key={pattern.pattern_id} className="text-xs text-slate-700">
                    ·{" "}
                    {(["rabi", "kharif1", "kharif2"] as const)
                      .map((season) =>
                        language === "bn" ? pattern.seasons[season].name_bn : pattern.seasons[season].name_en,
                      )
                      .join(" – ")}
                    {pattern.change_kind === "trade_off" && (
                      <span className="ml-1 text-amber-800">
                        ({pattern.trade_offs.map((trade) => patternStrings.tradeOffs[trade.code]).join(", ")})
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </li>
  );
}

export default function ClimateShiftSection({ language = "bn" }: ClimateShiftSectionProps) {
  const t = strings(language);
  const [upazila, setUpazila] = useState<string | undefined>(undefined);
  const [data, setData] = useState<ClimateShiftResponse | null>(null);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;

    getClimateShift(upazila)
      .then((response) => {
        if (active) {
          setData(response);
          setError(false);
        }
      })
      .catch(() => active && setError(true));

    return () => {
      active = false;
    };
  }, [upazila]);

  const gauge = useMemo(
    () =>
      new Map(
        (data?.gauge_check.annual_rain ?? []).map((row) => [Number(row.period), Number(row.other)]),
      ),
    [data],
  );

  if (error) {
    return null;
  }

  if (!data) {
    return <div className="h-40 animate-pulse rounded-[2rem] bg-slate-100" />;
  }

  const byId = new Map(data.indicators.map((item) => [item.indicator, item]));
  const empty = new Map<number, number>();
  const powerRain = new Map(
    (byId.get("annual_rain_mm_power")?.series ?? []).map((point) => [point.year, point.value]),
  );
  const biasOffsets = data.gauge_check.tmax_bias_correction.filter((row) => row.kind === "offset");
  const biasChecks = data.gauge_check.tmax_bias_correction.filter((row) => row.kind !== "offset");

  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-700">{t.eyebrow}</p>
          <h2 className="mt-2 text-xl font-black text-slate-900 sm:text-2xl">{t.title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {fill(t.subtitle, { upazila: data.upazila })}
          </p>
          <p className="mt-2 rounded-xl bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-950">
            🛰️ {data.rain_source === "gpm" ? t.gridGpm : t.gridPower}
          </p>
        </div>

        <label className="text-xs font-bold text-slate-500">
          {t.upazila}
          <select
            value={data.upazila}
            onChange={(event) => setUpazila(event.target.value)}
            className="ml-2 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-slate-800"
          >
            {data.available_upazilas.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {CHART_INDICATORS.map((id) => {
          const indicator = byId.get(id);
          if (!indicator) return null;

          return (
            <div key={id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-black text-slate-900">{t.indicator[id]}</p>
                <StatusBadge indicator={indicator} language={language} />
              </div>

              <p className="mt-2 text-sm leading-6 text-slate-700">{sentence(indicator, language)}</p>

              {indicator.status !== "no_significant_trend" && indicator.gauge_agrees === false && (
                <p className="mt-1 text-xs leading-5 text-amber-800">{t.caveatGauge}</p>
              )}

              <div className="mt-3">
                <IndicatorChart
                  indicator={indicator}
                  gauge={id === "annual_rain_mm" ? gauge : empty}
                  comparison={id === "annual_rain_mm" ? powerRain : undefined}
                  language={language}
                />
              </div>

              {id.startsWith("tx90p") && (
                <p className="mt-1 text-[11px] leading-5 text-slate-500">{t.hotDayHint}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Advice: trends turned into crop risks */}
      <div className="mt-6 rounded-2xl bg-slate-50 p-4">
        <p className="text-sm font-black text-slate-900">{t.adviceTitle}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">{t.adviceIntro}</p>

        {data.advice.length === 0 ? (
          <p className="mt-3 text-sm text-slate-700">{t.noAdvice}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {data.advice.map((item) => (
              <AdviceItem key={item.indicator} item={item} language={language} />
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="mt-4 text-xs font-black text-blue-700"
        aria-expanded={open}
      >
        {open ? t.hideDetails : t.details} {open ? "↑" : "↓"}
      </button>

      {open && (
        <div className="mt-3 space-y-4 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-600">
          <p>{data.notes.source}</p>
          <p>{data.notes.grid}</p>
          <p>{data.notes.significance}</p>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left">
              <thead className="text-slate-500">
                <tr>
                  <th className="py-1 pr-2">{t.table.indicator}</th>
                  <th className="py-1 pr-2">{t.table.years}</th>
                  <th className="py-1 pr-2">{t.table.slope}</th>
                  <th className="py-1 pr-2">{t.table.p}</th>
                  <th className="py-1 pr-2">{t.table.breakYear}</th>
                  <th className="py-1 pr-2">{t.table.afterBreak}</th>
                  <th className="py-1 pr-2">{t.table.status}</th>
                  <th className="py-1">{t.table.gauge}</th>
                </tr>
              </thead>
              <tbody>
                {data.indicators.map((item) => (
                  <tr key={item.indicator} className="border-t border-slate-100 align-top">
                    <td className="py-1 pr-2 font-bold text-slate-700">{t.indicator[item.indicator]}</td>
                    <td className="py-1 pr-2">
                      {item.first_year}–{item.last_year} ({item.n_years})
                    </td>
                    <td className="py-1 pr-2">
                      {item.change_per_decade > 0 ? "+" : ""}
                      {round(item.change_per_decade)} {unitLabel(item, language)}
                    </td>
                    <td className="py-1 pr-2">{item.p_value.toFixed(4)}</td>
                    <td className="py-1 pr-2">
                      {item.pettitt_break_year} ({item.pettitt_p_value.toFixed(4)})
                    </td>
                    <td className="py-1 pr-2">
                      {item.post_break_change_per_decade === null
                        ? "—"
                        : `${round(item.post_break_change_per_decade)} (${item.post_break_p_value?.toFixed(3)})`}
                    </td>
                    <td className="py-1 pr-2">
                      <StatusBadge indicator={item} language={language} />
                    </td>
                    <td className="py-1">{item.gauge_agreement}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <p className="font-black text-slate-700">{t.gaugeTitle}</p>
            <table className="mt-1 text-left">
              <thead className="text-slate-500">
                <tr>
                  <th className="pr-3" />
                  <th className="pr-3">{t.gaugeSeries}</th>
                  <th className="pr-3">{t.nasaSeries}</th>
                  {data.gauge_check.annual_rain_by_source.gpm.length > 0 && <th>{t.gpmSeries}</th>}
                </tr>
              </thead>
              <tbody>
                {data.gauge_check.annual_rain_by_source.power.map((row) => {
                  const gpm = data.gauge_check.annual_rain_by_source.gpm.find((item) => item.period === row.period);
                  return (
                    <tr key={row.period}>
                      <td className="pr-3">{row.period}</td>
                      <td className="pr-3">{Math.round(row.other)}</td>
                      <td className="pr-3">{Math.round(row.power)}</td>
                      {gpm && <td>{Math.round(gpm.power)}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-1">{data.gauge_check.station}</p>
          </div>

          {biasOffsets.length > 0 && (
            <div>
              <p className="font-black text-slate-700">{t.biasTitle}</p>
              <p>{t.biasIntro}</p>

              <table className="mt-1 text-left">
                <thead className="text-slate-500">
                  <tr>
                    <th className="pr-3">{t.biasHeld}</th>
                    <th className="pr-3">{t.biasBefore}</th>
                    <th>{t.biasAfter}</th>
                  </tr>
                </thead>
                <tbody>
                  {biasChecks.map((row) => (
                    <tr key={row.kind}>
                      <td className="pr-3">{row.kind.slice(-4)}</td>
                      <td className="pr-3">{row.bias_before_c?.toFixed(2)}</td>
                      <td>{row.bias_after_c?.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <table className="mt-2 text-left">
                <thead className="text-slate-500">
                  <tr>
                    <th className="pr-3">{t.biasMonth}</th>
                    <th>{t.biasOffset}</th>
                  </tr>
                </thead>
                <tbody>
                  {biasOffsets.map((row) => (
                    <tr key={row.month}>
                      <td className="pr-3">{row.month}</td>
                      <td>+{row.offset_c?.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
