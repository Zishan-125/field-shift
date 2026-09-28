import type { RiskBand } from "@/types";

interface RiskBandStyle {
  label: string;
  textClass: string;
  bgClass: string;
  ringClass: string;
  glowClass: string;
  hex: string;
}

export const RISK_BAND_STYLES: Record<RiskBand, RiskBandStyle> = {
  optimal: {
    label: "Optimal",
    textClass: "text-signal-emerald",
    bgClass: "bg-signal-emerald",
    ringClass: "ring-signal-emerald/40",
    glowClass: "shadow-glow-emerald",
    hex: "#10B981",
  },
  moderate: {
    label: "Adjust Timing",
    textClass: "text-signal-amber",
    bgClass: "bg-signal-amber",
    ringClass: "ring-signal-amber/40",
    glowClass: "shadow-glow-amber",
    hex: "#F59E0B",
  },
  high: {
    label: "Shift Crop",
    textClass: "text-signal-crimson",
    bgClass: "bg-signal-crimson",
    ringClass: "ring-signal-crimson/40",
    glowClass: "shadow-glow-crimson",
    hex: "#EF4444",
  },
};

export const SIGNAL_SOURCE_STYLES: Record<string, { hex: string; textClass: string }> = {
  SMAP: { hex: "#00F2FE", textClass: "text-signal-cyan" },
  MODIS: { hex: "#10B981", textClass: "text-signal-emerald" },
  ECOSTRESS: { hex: "#F59E0B", textClass: "text-signal-amber" },
  GPM_IMERG: { hex: "#8B5CF6", textClass: "text-signal-violet" },
  GRACE_FO: { hex: "#EF4444", textClass: "text-signal-crimson" },
};
