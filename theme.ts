// Same design tokens as the web dashboard (frontend-web/src/styles/tokens.css).
export const colors = {
  bg: "#0B0F17",
  panel: "#141C2E",
  border: "#1E293B",
  text: "#F8FAFC",
  muted: "#94A3B8",
  cyan: "#00F2FE",
  emerald: "#10B981",
  amber: "#F59E0B",
  crimson: "#EF4444",
  violet: "#8B5CF6",
};

export type Band = "optimal" | "moderate" | "high";
export const bandFor = (s: number): Band => (s >= 75 ? "optimal" : s >= 50 ? "moderate" : "high");
export const bandStyle: Record<Band, { label: string; color: string }> = {
  optimal: { label: "Optimal", color: colors.emerald },
  moderate: { label: "Adjust Timing", color: colors.amber },
  high: { label: "Shift Crop", color: colors.crimson },
};
