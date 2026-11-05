import type { PatternCrop, TradeOffCode } from "./pattern";

export type ClimateIndicatorId =
  | "rainy_season_onset_doy"
  | "rainy_season_withdrawal_doy"
  | "rainy_season_length_days"
  | "hot_days_mar_may"
  | "hot_days_boro_flowering"
  | "extreme_rain_days"
  | "longest_dry_spell_kharif1"
  | "rabi_rain_mm"
  | "annual_rain_mm"
  | "annual_et0_mm";

export type TrendStatus =
  | "trend"
  | "step_change_not_trend"
  | "no_significant_trend";

export interface ClimateIndicator {
  upazila: string;
  indicator: ClimateIndicatorId;
  label: string;
  unit: string;
  n_years: number;
  first_year: number;
  last_year: number;
  mean_value: number;
  change_per_decade: number;
  p_value: number;
  significant: boolean;
  direction: string;
  pettitt_break_year: number;
  pettitt_p_value: number;
  mean_before_break: number;
  mean_after_break: number;
  post_break_years: number;
  post_break_change_per_decade: number | null;
  post_break_p_value: number | null;
  status: TrendStatus;
  source_basis: "rain" | "tmax" | "et0";
  gauge_agreement: string;
  gauge_agrees: boolean | null;
  series: { year: number; value: number }[];
}

export interface GaugeRow {
  variable: string;
  period: string;
  power: number;
  other: number;
}

export interface ClimateAdvicePattern {
  pattern_id: string;
  name: string;
  seasons: Record<"rabi" | "kharif1" | "kharif2", PatternCrop>;
  rank: number;
  change_kind: "improvement" | "trade_off";
  trade_offs: { code: TradeOffCode; detail: string }[];
}

export interface ClimateAdvice {
  indicator: ClimateIndicatorId;
  hazard: string;
  direction: string;
  adverse: boolean;
  change_per_decade: number;
  unit: string;
  gauge_agrees: boolean | null;
  threatened_crops: { crop_id: string; name_en: string; name_bn: string }[];
  better_patterns: ClimateAdvicePattern[];
}

export interface ClimateShiftResponse {
  upazila: string;
  available_upazilas: string[];
  indicators: ClimateIndicator[];
  gauge_check: {
    station: string;
    annual_rain: GaugeRow[];
    monthly_rain: GaugeRow[];
    monthly_tmax: GaugeRow[];
  };
  advice: ClimateAdvice[];
  notes: { source: string; grid: string; significance: string };
}
