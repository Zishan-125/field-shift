import { useId, useState } from "react";
import { ChevronDown, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { RISK_BAND_STYLES, SIGNAL_SOURCE_STYLES } from "@/lib/riskBand";
import type { FieldPolygon, ShiftScore } from "@/types";

const RADIUS = 54;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const TREND_ICON = { rising: TrendingUp, falling: TrendingDown, stable: Minus } as const;

interface ShiftScoreCardProps {
  field: FieldPolygon | null;
  score: ShiftScore | null;
  isLoading?: boolean;
  className?: string;
}

export function ShiftScoreCard({ field, score, isLoading = false, className }: ShiftScoreCardProps) {
  const [expanded, setExpanded] = useState(true);
  const breakdownId = useId();

  if (isLoading) return <ShiftScoreCardSkeleton className={className} />;

  // Disabled state: no field selected, or no score computed yet for the selection.
  if (!field || !score) {
    return (
      <div
        aria-disabled="true"
        className={cn(
          "glass-panel flex flex-col items-center justify-center gap-2 rounded-xl p-8 text-center opacity-60",
          className
        )}
      >
        <div className="h-[120px] w-[120px] rounded-full border-2 border-dashed border-space-border" />
        <p className="mt-2 text-xs text-ink-muted">Select a field to view its Shift Score</p>
      </div>
    );
  }

  const style = RISK_BAND_STYLES[score.riskBand];
  const progress = Math.max(0, Math.min(100, score.score)) / 100;
  const dashOffset = CIRCUMFERENCE * (1 - progress);

  return (
    <div className={cn("flex flex-col", className)}>
      <p className="text-[11px] text-ink-muted">{field.region}</p>
      <h2 className="font-display text-sm font-semibold text-ink-primary">{field.name}</h2>

      <div className={cn("glass-panel mt-3 rounded-xl p-5", style.glowClass)}>
        <div className="relative mx-auto h-[136px] w-[136px]">
          <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" role="img" aria-labelledby={`${breakdownId}-title`}>
            <title id={`${breakdownId}-title`}>
              Shift Score {score.score} out of 100 — {style.label}
            </title>
            <circle cx="60" cy="60" r={RADIUS} fill="none" stroke="var(--divider)" strokeWidth="8" />
            <circle
              cx="60"
              cy="60"
              r={RADIUS}
              fill="none"
              stroke={style.hex}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              className="transition-[stroke-dashoffset] duration-700 ease-out"
              style={{ filter: `drop-shadow(0 0 6px ${style.hex}99)` }}
            />
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn("font-display tabular text-4xl font-semibold leading-none", style.textClass)}>
              {score.score}
            </span>
            <span className="mt-1 text-[10px] text-ink-muted">/ 100</span>
          </div>
        </div>

        <p className={cn("mt-3 text-center text-xs font-medium", style.textClass)}>{style.label}</p>
        <p className="mt-2 text-center text-[11px] leading-relaxed text-ink-muted">{score.summary}</p>
        <p className="mt-2 text-center text-[10px] text-ink-muted">
          Confidence <span className="tabular">{Math.round(score.confidence * 100)}%</span>
        </p>
      </div>

      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={breakdownId}
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          "mt-3 flex w-full items-center justify-between rounded-lg border border-space-border bg-space-panel px-3 py-2.5 text-xs font-medium text-ink-primary",
          "transition-colors duration-200 hover:bg-white/[0.04]",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-signal-cyan",
          "active:bg-white/[0.06]"
        )}
      >
        Signal breakdown
        <ChevronDown
          size={15}
          className={cn("text-ink-muted transition-transform duration-200", expanded && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      <ul id={breakdownId} hidden={!expanded} className="mt-2 space-y-1.5">
        {score.signalBreakdown.map((s) => {
          const TrendIcon = TREND_ICON[s.trend];
          const sourceStyle = SIGNAL_SOURCE_STYLES[s.signal];
          return (
            <li
              key={s.signal}
              className="flex items-center gap-2.5 rounded-lg border border-space-border bg-space-panel px-3 py-2.5"
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: sourceStyle?.hex }}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className={cn("truncate text-xs font-medium", sourceStyle?.textClass)}>{s.label}</p>
                <p className="tabular text-[10px] text-ink-muted">
                  {s.rawValue} {s.unit} · {s.observedAt}
                </p>
              </div>
              <TrendIcon size={13} className="shrink-0 text-ink-muted" aria-label={`Trend: ${s.trend}`} />
              <span
                className={cn(
                  "tabular w-14 shrink-0 text-right text-xs font-semibold",
                  s.contribution >= 0 ? "text-signal-emerald" : "text-signal-crimson"
                )}
              >
                {s.contribution >= 0 ? "+" : ""}
                {s.contribution} pts
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ShiftScoreCardSkeleton({ className }: { className?: string }) {
  return (
    <div role="status" aria-busy="true" aria-label="Loading Shift Score" className={cn("flex flex-col", className)}>
      <span className="sr-only">Loading Shift Score…</span>
      <div className="h-3 w-24 animate-skeleton-pulse rounded bg-space-panel" />
      <div className="mt-2 h-4 w-40 animate-skeleton-pulse rounded bg-space-panel" />
      <div className="glass-panel mt-3 flex flex-col items-center rounded-xl p-5">
        <div className="h-[136px] w-[136px] animate-skeleton-pulse rounded-full bg-space-panel" />
        <div className="mt-3 h-3 w-20 animate-skeleton-pulse rounded bg-space-panel" />
      </div>
      <div className="mt-3 space-y-1.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-11 animate-skeleton-pulse rounded-lg bg-space-panel" />
        ))}
      </div>
    </div>
  );
}
