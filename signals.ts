import type { NASASignalMetrics, SignalSource } from "@/types";
import { MOCK_FIELDS } from "./fields";

const SIGNAL_CONFIG: Record<
  SignalSource,
  { unit: string; resolutionM: number; base: number; amplitude: number }
> = {
  SMAP: { unit: "m³/m³", resolutionM: 9000, base: 0.22, amplitude: 0.08 },
  MODIS: { unit: "NDVI", resolutionM: 250, base: 0.65, amplitude: 0.12 },
  ECOSTRESS: { unit: "mm/day", resolutionM: 70, base: 5.5, amplitude: 1.8 },
  GPM_IMERG: { unit: "mm / 7d", resolutionM: 10000, base: 18, amplitude: 12 },
  GRACE_FO: { unit: "cm equiv.", resolutionM: 111000, base: -0.5, amplitude: 2.2 },
};

function seededHistory(seed: number, base: number, amplitude: number, days = 30) {
  const history = [];
  const today = new Date("2026-09-26T00:00:00Z");
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const wave = Math.sin((i + seed) / 4) * amplitude * 0.5;
    const drift = ((seed % 5) - 2) * (amplitude / days) * (days - i);
    const value = Math.round((base + wave + drift) * 1000) / 1000;
    history.push({ date: d.toISOString().slice(0, 10), value });
  }
  return history;
}

export const MOCK_SIGNALS: NASASignalMetrics[] = MOCK_FIELDS.flatMap((field, fieldIdx) =>
  (Object.keys(SIGNAL_CONFIG) as SignalSource[]).map((signal, signalIdx) => {
    const cfg = SIGNAL_CONFIG[signal];
    const history = seededHistory(fieldIdx * 7 + signalIdx, cfg.base, cfg.amplitude);
    const latest = history[history.length - 1];
    return {
      fieldId: field.id,
      signal,
      unit: cfg.unit,
      spatialResolutionM: cfg.resolutionM,
      latestValue: latest.value,
      latestObservedAt: latest.date,
      history,
    };
  })
);

export function signalsForField(fieldId: string): NASASignalMetrics[] {
  return MOCK_SIGNALS.filter((s) => s.fieldId === fieldId);
}
