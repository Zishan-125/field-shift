/**
 * TerraShift domain types.
 * These mirror the eventual API contract (GET /fields, GET /fields/:id/shift-score,
 * GET /fields/:id/signals, POST /copilot/chat) closely enough to swap mocks for
 * live fetches without touching component code — only the data-fetching hook changes.
 */

/** The five NASA Earth-observation products TerraShift ingests. */
export type SignalSource = "SMAP" | "MODIS" | "ECOSTRESS" | "GPM_IMERG" | "GRACE_FO";

export const SIGNAL_LABELS: Record<SignalSource, string> = {
  SMAP: "Soil Moisture (SMAP)",
  MODIS: "Vegetation Index (MODIS)",
  ECOSTRESS: "Evapotranspiration (ECOSTRESS)",
  GPM_IMERG: "Rainfall Outlook (GPM IMERG)",
  GRACE_FO: "Aquifer Anomaly (GRACE-FO)",
};

/** Composite 0–100 Shift Score risk bands, mapped to the design system's accent tokens. */
export type RiskBand = "optimal" | "moderate" | "high";

export function riskBandForScore(score: number): RiskBand {
  if (score >= 75) return "optimal";
  if (score >= 50) return "moderate";
  return "high";
}

export type ShiftRecommendation = "continue" | "adjust_timing" | "shift_crop" | "shift_rotation";

export interface GeoPoint {
  lng: number;
  lat: number;
}

/** A single field boundary, clipped to the farmer's registered parcel. */
export interface FieldPolygon {
  id: string;
  name: string;
  region: string;
  countryCode: string;
  centroid: GeoPoint;
  /** GeoJSON Polygon ring, [lng, lat][] */
  boundary: [number, number][];
  areaHectares: number;
  cropType: string;
  lastSurveyed: string; // ISO date
}

/** One signal's contribution to the composite Shift Score. */
export interface SignalContribution {
  signal: SignalSource;
  label: string;
  /** Signed points contributed to the 0–100 composite score, e.g. -22 or +14. */
  contribution: number;
  weight: number; // 0–1, share of the composite formula
  rawValue: number;
  unit: string;
  observedAt: string; // ISO date
  trend: "rising" | "falling" | "stable";
}

/** The composite Shift Score for one field, with full signal-level explainability. */
export interface ShiftScore {
  fieldId: string;
  score: number; // 0–100
  riskBand: RiskBand;
  recommendation: ShiftRecommendation;
  confidence: number; // 0–1
  computedAt: string; // ISO date
  signalBreakdown: SignalContribution[];
  summary: string;
}

/** Time-series reading for one NASA signal, used to drive map overlays and sparklines. */
export interface SignalReading {
  date: string; // ISO date
  value: number;
}

export interface NASASignalMetrics {
  fieldId: string;
  signal: SignalSource;
  unit: string;
  spatialResolutionM: number;
  latestValue: number;
  latestObservedAt: string;
  history: SignalReading[];
}

/** A candidate crop or rotation suggested by RotationPlanner. */
export interface CropRecommendation {
  id: string;
  cropName: string;
  suitabilityScore: number; // 0–100
  waterDemand: "low" | "medium" | "high";
  plantingWindow: { start: string; end: string }; // MM-DD
  climateResilienceTags: string[];
  rationale: string;
}

/** A NASA-data citation attached to a Copilot message, e.g. "[SMAP Data: 2026-09-20]". */
export interface CitationBadge {
  id: string;
  signal: SignalSource;
  label: string;
  observedAt: string; // ISO date
  fieldId: string;
  value: number;
  unit: string;
}

export interface CopilotMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string; // ISO date
  citations?: CitationBadge[];
  language?: string; // BCP-47, for multilingual responses
}

export interface LeaderboardEntry {
  fieldId: string;
  fieldName: string;
  farmerHandle: string;
  region: string;
  score: number;
  rank: number;
  rankChange: number; // +/- positions since last cycle
  streakWeeks: number;
}
