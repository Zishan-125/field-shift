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
  water_conservation_score: number;
  soil_health_score: number;
  climate_resilience_score: number;
  crop_diversity_score: number;
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
    indicator_type: string;
    synthetic_yield_target: boolean;
    notes: string[];
  };
}

export const DEFAULT_CURRENT_PATTERN_ID = "boro_fallow_taman";
