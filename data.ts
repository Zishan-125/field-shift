// Condensed mirror of frontend-web/src/mocks — swap for API calls behind the same shapes.
export type Signal = "SMAP" | "MODIS" | "ECOSTRESS" | "GPM_IMERG" | "GRACE_FO";
export interface Contribution { signal: Signal; points: number; raw: string; observedAt: string }
export interface Field {
  id: string; name: string; region: string; crop: string; score: number; summary: string;
  breakdown: Contribution[];
}
export interface Rotation { id: string; crop: string; score: number; water: "low" | "medium" | "high"; window: string; rationale: string }
export interface Rank { fieldId: string; name: string; handle: string; score: number; change: number; streak: number }

export const SIGNAL_LABEL: Record<Signal, string> = {
  SMAP: "Soil Moisture", MODIS: "Vegetation (NDVI)", ECOSTRESS: "Evapotranspiration",
  GPM_IMERG: "Rainfall Outlook", GRACE_FO: "Aquifer Anomaly",
};

const c = (signal: Signal, points: number, raw: string, observedAt: string): Contribution => ({ signal, points, raw, observedAt });

export const FIELDS: Field[] = [
  { id: "field-ia-004", name: "North Quarter Section", region: "Story County, Iowa", crop: "Corn", score: 82,
    summary: "Soil moisture and canopy vigor are tracking above the 10-year norm. Current rotation holds.",
    breakdown: [c("SMAP", 18, "0.31 m³/m³", "2026-09-25"), c("MODIS", 14, "0.79 NDVI", "2026-09-24"), c("ECOSTRESS", 6, "4.1 mm/day", "2026-09-23"), c("GPM_IMERG", 8, "22.4 mm/7d", "2026-09-26"), c("GRACE_FO", -2, "-0.6 cm", "2026-09-20")] },
  { id: "field-pb-011", name: "Ludhiana Block 3", region: "Punjab, India", crop: "Wheat", score: 58,
    summary: "Groundwater drawdown and drying topsoil suggest delaying the next irrigation stage by 5–7 days.",
    breakdown: [c("SMAP", -22, "0.14 m³/m³", "2026-09-25"), c("MODIS", 9, "0.61 NDVI", "2026-09-24"), c("ECOSTRESS", -8, "6.8 mm/day", "2026-09-23"), c("GPM_IMERG", 14, "31.2 mm/7d", "2026-09-26"), c("GRACE_FO", -17, "-3.4 cm", "2026-09-19")] },
  { id: "field-ke-002", name: "Nakuru Highlands Plot", region: "Nakuru County, Kenya", crop: "Maize", score: 39,
    summary: "Sustained low soil moisture and declining vigor cross the threshold for a drought-tolerant swap.",
    breakdown: [c("SMAP", -26, "0.09 m³/m³", "2026-09-25"), c("MODIS", -11, "0.38 NDVI", "2026-09-24"), c("ECOSTRESS", -9, "7.9 mm/day", "2026-09-23"), c("GPM_IMERG", -4, "6.1 mm/7d", "2026-09-26"), c("GRACE_FO", -5, "-1.8 cm", "2026-09-18")] },
  { id: "field-br-007", name: "Mato Grosso Sector 7", region: "Mato Grosso, Brazil", crop: "Soybean", score: 67,
    summary: "Moisture and canopy remain solid, but a widening evapotranspiration gap needs monitoring.",
    breakdown: [c("SMAP", 11, "0.24 m³/m³", "2026-09-25"), c("MODIS", 13, "0.74 NDVI", "2026-09-24"), c("ECOSTRESS", -12, "7.2 mm/day", "2026-09-23"), c("GPM_IMERG", 4, "18.6 mm/7d", "2026-09-26"), c("GRACE_FO", 1, "0.2 cm", "2026-09-17")] },
];

export const ROTATIONS: Record<string, Rotation[]> = {
  "field-ke-002": [
    { id: "a", crop: "Sorghum", score: 88, water: "low", window: "10-05 – 11-15", rationale: "Deep roots handle the moisture deficit far better than maize." },
    { id: "b", crop: "Cowpea", score: 74, water: "low", window: "10-10 – 11-20", rationale: "Fixes nitrogen and tolerates the projected dry spell." },
    { id: "c", crop: "Maize (repeat)", score: 31, water: "high", window: "10-01 – 10-20", rationale: "High failure risk this cycle." },
  ],
  "field-pb-011": [
    { id: "a", crop: "Mung Bean", score: 81, water: "low", window: "03-15 – 04-10", rationale: "Short-cycle legume break rebuilds nitrogen with little irrigation." },
    { id: "b", crop: "Pearl Millet", score: 79, water: "low", window: "06-20 – 07-10", rationale: "Strong fallback if the aquifer anomaly deepens." },
    { id: "c", crop: "Wheat (repeat)", score: 62, water: "medium", window: "11-01 – 11-25", rationale: "Viable if irrigation shifts 5–7 days later." },
  ],
  "field-ia-004": [
    { id: "a", crop: "Soybean", score: 90, water: "medium", window: "05-01 – 05-25", rationale: "Standard corn–soy rotation remains optimal." },
    { id: "b", crop: "Crimson Clover (cover)", score: 85, water: "medium", window: "09-15 – 10-05", rationale: "Winter cover protects the strong moisture position." },
  ],
  "field-br-007": [
    { id: "a", crop: "Brachiaria (cover)", score: 83, water: "low", window: "09-25 – 10-20", rationale: "Grass cover rebuilds soil structure ahead of the next soy cycle." },
    { id: "b", crop: "Soybean (repeat)", score: 66, water: "medium", window: "09-20 – 10-15", rationale: "Fine short-term; watch water stress mid-cycle." },
  ],
};

export const RANKS: Rank[] = [
  { fieldId: "community-tx-021", name: "Brazos Bottom Farm", handle: "@m.reyes", score: 88, change: 2, streak: 9 },
  { fieldId: "field-ia-004", name: "North Quarter Section", handle: "@j.holloway", score: 82, change: 0, streak: 6 },
  { fieldId: "community-th-013", name: "Chao Phraya Paddy 5", handle: "@s.somchai", score: 74, change: 0, streak: 4 },
  { fieldId: "field-br-007", name: "Mato Grosso Sector 7", handle: "@r.almeida", score: 67, change: 1, streak: 2 },
  { fieldId: "community-ng-008", name: "Kano Sorghum Belt", handle: "@f.bello", score: 61, change: -1, streak: 1 },
  { fieldId: "field-pb-011", name: "Ludhiana Block 3", handle: "@k.singh", score: 58, change: -1, streak: 0 },
  { fieldId: "community-au-030", name: "Darling Downs East", handle: "@t.nguyen", score: 46, change: -3, streak: 0 },
  { fieldId: "field-ke-002", name: "Nakuru Highlands Plot", handle: "@a.wanjiru", score: 39, change: -2, streak: 0 },
];

export function copilotReply(field: Field): { text: string; citations: { label: string; date: string; value: string; signal: Signal }[] } {
  const top = [...field.breakdown].sort((a, b) => Math.abs(b.points) - Math.abs(a.points)).slice(0, 3);
  return {
    text: `Here's what the satellite signals show for ${field.name}: ${field.summary}`,
    citations: top.map((t) => ({ label: `${t.signal.replace("_", " ")} Data`, date: t.observedAt, value: t.raw, signal: t.signal })),
  };
}
