export type Season = "rabi" | "kharif1" | "kharif2";

export type FeasibilityStatus =
  | "feasible"
  | "tight"
  | "infeasible"
  | "unverified";

export interface PatternCrop {
  crop_id: string;
  name_en: string;
  name_bn: string;
  is_fallow: boolean;
}

export interface ScheduledCrop extends PatternCrop {
  position: Season;
  variant_id: string;
  /** "MM-DD" */
  start: string;
  /** "MM-DD" */
  end: string;
  start_doy: number;
  end_doy: number;
  field_days: number;
  slack_days: number;
}

export interface PatternIndicators {
  food_production_score: number;
  water_productivity_score: number;
  soil_health_score: number;
  climate_resilience_score: number;
  crop_diversity_score: number;
}

export interface PatternPriorities {
  food_production: number;
  water_productivity: number;
  soil_health: number;
  climate_resilience: number;
  crop_diversity: number;
}

/** UI default (not data); mirrors DEFAULT_PATTERN_PRIORITIES in server.py. */
export const DEFAULT_PATTERN_PRIORITIES: PatternPriorities = {
  food_production: 0.3,
  water_productivity: 0.25,
  soil_health: 0.2,
  climate_resilience: 0.15,
  crop_diversity: 0.1,
};

export type EndUseClass =
  | "food_grain"
  | "pulse"
  | "oilseed"
  | "feed"
  | "condiment"
  | "tuber"
  | "vegetable";

export interface EvidenceFlag {
  code: "small_area_yield" | "little_grown_in_feni" | "not_in_regional_survey";
  crop_id: string | null;
  feni_area_ha?: number;
}

export interface PerCropFoodWater {
  crop_id: string;
  name_en: string;
  name_bn: string;
  end_use_class: EndUseClass | null;
  human_food_share: number | null;
  feni_area_ha: number | null;
  yield_t_ha?: number;
  gross_gj_ha?: number;
  human_food_gj_ha?: number;
  water_need_mm?: number;
  irrigation_mm?: number;
  effective_rain_mm?: number;
}

export interface Delta {
  current: number;
  candidate: number;
  change: number;
  change_pct: number | null;
}

export type TradeOffCode =
  | "fewer_harvests"
  | "less_food"
  | "more_irrigation"
  | "fewer_rice_seasons"
  | "tight_timing";

export interface Comparison {
  human_food_energy_gj_ha: Delta | null;
  irrigation_mm: Delta | null;
  harvests_change: number;
  rice_seasons_change: number;
  trade_offs: { code: TradeOffCode; detail: string }[];
  change_kind: "improvement" | "trade_off";
}

export interface UpazilaShare {
  upazila: string;
  area_ha: number | null;
  pct_of_upazila_nca: number | null;
}

export interface CroppingPattern {
  pattern_id: string;
  name: string;
  seasons: Record<Season, PatternCrop>;
  schedule: ScheduledCrop[];
  facts: {
    crop_count: number;
    rice_crop_count: number;
    legume_crop_count: number;
  };
  feasibility: {
    status: FeasibilityStatus;
    reasons: string[];
    calendar_conflict: boolean;
    min_gap_days: number | null;
    total_field_days: number | null;
    turnaround_days_assumed: number;
    turnaround_is_assumption: boolean;
  };
  adoption: {
    region: string;
    region_area_ha: number | null;
    region_pct_nca: number | null;
    region_upazila_count: number | null;
    national_area_ha: number | null;
    national_pct_nca: number | null;
    national_upazila_count: number | null;
    observed_in_region: boolean;
    feni_upazilas: UpazilaShare[];
    source_id: string;
    source_detail: string;
    reference_year: string;
  };
  notes: string | null;
  production: {
    human_food_energy_gj_ha: number | null;
    rice_equivalent_t_ha: number | null;
    gross_energy_gj_ha: number | null;
    gross_rice_equivalent_t_ha: number | null;
    harvests_per_year: number;
    unknown_end_use_crops: string[];
    yield_source: string;
    end_use_source: string;
  };
  evidence_flags: {
    yield_evidence: EvidenceFlag[];
    market_reality: EvidenceFlag[];
  };
  water: {
    water_need_mm: number | null;
    irrigation_mm: number | null;
    irrigation_m3_ha: number | null;
    effective_rain_mm: number | null;
    water_productivity_mj_m3: number | null;
    method: string;
  };
  per_crop: PerCropFoodWater[];
  indicators: PatternIndicators | null;
  indicator_type: string | null;
  missing_profile_crops: string[];
}

export type SeasonChangeKind =
  | "same"
  | "added"
  | "removed"
  | "replaced";

export interface SeasonChange {
  season: Season;
  change: SeasonChangeKind;
  from: PatternCrop;
  to: PatternCrop;
}

export interface ScoredPattern extends CroppingPattern {
  score: number | null;
  priority_contributions: Record<string, number> | null;
}

export interface RecommendedPattern extends ScoredPattern {
  rank?: number;
  score_change?: number | null;
  indicator_changes?: PatternIndicators | null;
  season_changes: SeasonChange[];
  comparison: Comparison;
}

export interface PatternRecommendationResponse {
  field: {
    field_id: string;
    name: string;
  };
  priority_profile: Record<string, number>;
  current: ScoredPattern;
  results: RecommendedPattern[];
  not_scored: RecommendedPattern[];
  not_recommended: CroppingPattern[];
  counts: {
    patterns: number;
    recommended: number;
    not_scored: number;
    not_recommended: number;
  };
  methodology: {
    version: string;
    score_type: string;
    indicator_sources: Record<string, string>;
    default_priorities: PatternPriorities;
    synthetic_yield_target: boolean;
    notes: string[];
  };
}

export const DEFAULT_CURRENT_PATTERN_ID = "boro_fallow_taman";
