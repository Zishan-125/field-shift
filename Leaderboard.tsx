import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Flame, Minus, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { RISK_BAND_STYLES } from "@/lib/riskBand";
import { riskBandForScore } from "@/types";
import type { LeaderboardEntry } from "@/types";

type SortKey = "score" | "streakWeeks";

const PODIUM = ["text-signal-amber", "text-ink-primary", "text-signal-crimson"] as const;

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  /** Fields present in the user's workspace — only these can be opened on the map. */
  workspaceFieldIds: string[];
  selectedFieldId: string | null;
  onSelectField: (fieldId: string) => void;
  isLoading?: boolean;
  className?: string;
}

export function Leaderboard({ entries, workspaceFieldIds, selectedFieldId, onSelectField, isLoading = false, className }: LeaderboardProps) {
  const [sortKey, setSortKey] = useState<SortKey>("score");

  const ranked = useMemo(
    () =>
      [...entries]
        .sort((a, b) => b[sortKey] - a[sortKey] || b.score - a.score)
        .map((e, i) => ({ ...e, rank: i + 1 })),
    [entries, sortKey]
  );

  if (isLoading) {
    return (
      <div role="status" aria-busy="true" aria-label="Loading leaderboard" className={cn("space-y-1.5", className)}>
        <span className="sr-only">Loading leaderboard…</span>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-[52px] animate-skeleton-pulse rounded-lg bg-space-panel" />
        ))}
      </div>
    );
  }

  if (ranked.length === 0) {
    return (
      <p aria-disabled="true" className={cn("p-6 text-center text-xs text-ink-muted", className)}>
        No community rankings yet this cycle.
      </p>
    );
  }

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] text-ink-muted">Community field health</p>
          <h2 className="flex items-center gap-1.5 font-display text-sm font-semibold text-ink-primary">
            <Trophy size={14} className="text-signal-amber" aria-hidden="true" /> Leaderboard
          </h2>
        </div>
        <div role="group" aria-label="Sort rankings" className="flex rounded-lg border border-space-border p-0.5 text-[11px]">
          {(
            [
              { key: "score", label: "Score" },
              { key: "streakWeeks", label: "Streak" },
            ] as const
          ).map((o) => (
            <button
              key={o.key}
              type="button"
              aria-pressed={sortKey === o.key}
              onClick={() => setSortKey(o.key)}
              className={cn(
                "rounded-md px-2.5 py-1 font-medium text-ink-muted transition-colors duration-200 hover:text-ink-primary",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal-cyan active:bg-white/[0.06]",
                sortKey === o.key && "bg-signal-cyan/10 text-signal-cyan"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <ol className="mt-3 space-y-1.5">
        {ranked.map((e) => {
          const style = RISK_BAND_STYLES[riskBandForScore(e.score)];
          const inWorkspace = workspaceFieldIds.includes(e.fieldId);
          const isSelected = e.fieldId === selectedFieldId;
          const Change = e.rankChange > 0 ? ArrowUp : e.rankChange < 0 ? ArrowDown : Minus;

          return (
            <li key={e.fieldId}>
              <button
                type="button"
                disabled={!inWorkspace}
                aria-current={isSelected ? "true" : undefined}
                onClick={() => onSelectField(e.fieldId)}
                title={inWorkspace ? undefined : "Not in your workspace"}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left",
                  "transition-[background-color,border-color] duration-200 ease-out",
                  "border-space-border bg-space-panel enabled:hover:border-white/20 enabled:active:bg-white/[0.05]",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-signal-cyan",
                  "disabled:cursor-default disabled:opacity-60",
                  isSelected && "border-signal-cyan/50 bg-signal-cyan/[0.06]"
                )}
              >
                <span className={cn("tabular w-5 shrink-0 text-center text-sm font-semibold", PODIUM[e.rank - 1] ?? "text-ink-muted")}>
                  {e.rank}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-ink-primary">{e.fieldName}</span>
                  <span className="block truncate text-[10px] text-ink-muted">
                    {e.farmerHandle} · {e.region}
                  </span>
                </span>
                {e.streakWeeks > 0 && (
                  <span className="flex items-center gap-0.5 text-[10px] text-signal-amber" aria-label={`${e.streakWeeks} week streak`}>
                    <Flame size={11} aria-hidden="true" />
                    <span className="tabular">{e.streakWeeks}</span>
                  </span>
                )}
                <span
                  className={cn(
                    "flex w-6 shrink-0 items-center justify-center text-[10px]",
                    e.rankChange > 0 ? "text-signal-emerald" : e.rankChange < 0 ? "text-signal-crimson" : "text-ink-muted"
                  )}
                  aria-label={e.rankChange === 0 ? "No rank change" : `${e.rankChange > 0 ? "Up" : "Down"} ${Math.abs(e.rankChange)}`}
                >
                  <Change size={11} aria-hidden="true" />
                  {e.rankChange !== 0 && <span className="tabular">{Math.abs(e.rankChange)}</span>}
                </span>
                <span className={cn("tabular w-7 shrink-0 text-right text-xs font-semibold", style.textClass)}>{e.score}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
