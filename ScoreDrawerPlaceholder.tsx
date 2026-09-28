import { RISK_BAND_STYLES, SIGNAL_SOURCE_STYLES } from "@/lib/riskBand";
import { cn } from "@/lib/utils";
import type { FieldPolygon, ShiftScore } from "@/types";

interface ScoreDrawerPlaceholderProps {
  field: FieldPolygon | null;
  score: ShiftScore | null;
}

/**
 * Lightweight stand-in for ShiftScoreCard.tsx (radial gauge + expandable signal
 * breakdown), so the 3-panel layout is fully wired end to end. Swap this import
 * in App.tsx for <ShiftScoreCard /> once that component is built.
 */
export function ScoreDrawerPlaceholder({ field, score }: ScoreDrawerPlaceholderProps) {
  if (!field || !score) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-xs text-ink-muted">
        Select a field to view its Shift Score.
      </div>
    );
  }

  const style = RISK_BAND_STYLES[score.riskBand];

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <p className="text-[11px] text-ink-muted">{field.region}</p>
      <h2 className="font-display text-sm font-semibold text-ink-primary">{field.name}</h2>

      <div className={cn("glass-panel mt-3 rounded-xl p-4 text-center", style.glowClass)}>
        <p className={cn("font-display tabular text-4xl font-semibold", style.textClass)}>{score.score}</p>
        <p className={cn("mt-1 text-xs font-medium", style.textClass)}>{style.label}</p>
        <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">{score.summary}</p>
      </div>

      <p className="mb-2 mt-4 text-[11px] font-medium uppercase tracking-wide text-ink-muted">Signal breakdown</p>
      <ul className="space-y-1.5">
        {score.signalBreakdown.map((s) => (
          <li
            key={s.signal}
            className="flex items-center justify-between rounded-lg border border-space-border bg-space-panel px-2.5 py-2 text-xs"
          >
            <span className={cn("font-medium", SIGNAL_SOURCE_STYLES[s.signal]?.textClass)}>{s.label}</span>
            <span className={cn("tabular font-semibold", s.contribution >= 0 ? "text-signal-emerald" : "text-signal-crimson")}>
              {s.contribution >= 0 ? "+" : ""}
              {s.contribution} pts
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
