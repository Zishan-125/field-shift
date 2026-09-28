import { useState } from "react";
import { CalendarRange, Droplet, ArrowLeft, CheckCircle2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { riskBandForScore } from "@/types";
import { RISK_BAND_STYLES } from "@/lib/riskBand";
import type { CropRecommendation, FieldPolygon } from "@/types";

const WATER_DEMAND_STYLE: Record<CropRecommendation["waterDemand"], { label: string; textClass: string }> = {
  low: { label: "Low water demand", textClass: "text-signal-cyan" },
  medium: { label: "Medium water demand", textClass: "text-signal-amber" },
  high: { label: "High water demand", textClass: "text-signal-crimson" },
};

type Stage = "browse" | "review" | "confirmed";

interface RotationPlannerProps {
  field: FieldPolygon | null;
  recommendations: CropRecommendation[];
  isLoading?: boolean;
  className?: string;
}

export function RotationPlanner({ field, recommendations, isLoading = false, className }: RotationPlannerProps) {
  const [stage, setStage] = useState<Stage>("browse");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (isLoading) return <RotationPlannerSkeleton className={className} />;

  if (!field) {
    return (
      <div className={cn("flex h-full items-center justify-center p-6 text-center text-xs text-ink-muted", className)}>
        Select a field to plan its next rotation.
      </div>
    );
  }

  const selected = recommendations.find((r) => r.id === selectedId) ?? null;

  const reset = () => {
    setStage("browse");
    setSelectedId(null);
  };

  return (
    <div className={cn("flex flex-col", className)}>
      <p className="text-[11px] text-ink-muted">{field.region}</p>
      <h2 className="font-display text-sm font-semibold text-ink-primary">Rotation Planner</h2>
      <p className="mt-1 text-[11px] text-ink-muted">
        Current crop: <span className="font-medium text-ink-primary">{field.cropType}</span>
      </p>

      {/* Step indicator */}
      <ol className="mt-3 flex items-center gap-2 text-[10px] text-ink-muted" aria-label="Rotation planning steps">
        {(["browse", "review", "confirmed"] as Stage[]).map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded-full border tabular",
                stage === s || (stage === "confirmed" && s !== "confirmed")
                  ? "border-signal-cyan text-signal-cyan"
                  : "border-space-border text-ink-muted"
              )}
            >
              {i + 1}
            </span>
            <span className="capitalize">{s === "browse" ? "Select crop" : s}</span>
            {i < 2 && <span className="h-px w-3 bg-space-border" aria-hidden="true" />}
          </li>
        ))}
      </ol>

      {stage === "browse" && (
        <>
          <ul className="mt-3 space-y-2">
            {recommendations.map((rec) => {
              const band = riskBandForScore(rec.suitabilityScore);
              const style = RISK_BAND_STYLES[band];
              const isDisabled = rec.suitabilityScore < 40;
              const isSelected = rec.id === selectedId;

              return (
                <li key={rec.id}>
                  <button
                    type="button"
                    disabled={isDisabled}
                    aria-pressed={isSelected}
                    aria-disabled={isDisabled}
                    onClick={() => setSelectedId(rec.id)}
                    className={cn(
                      "w-full rounded-xl border bg-space-panel p-3 text-left",
                      "transition-[border-color,background-color,box-shadow] duration-200 ease-out",
                      "border-space-border hover:border-white/20",
                      "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-signal-cyan",
                      "active:bg-white/[0.04]",
                      "disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-space-border",
                      isSelected && cn("border-signal-cyan/50 bg-signal-cyan/[0.05]", style.glowClass)
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-ink-primary">{rec.cropName}</span>
                      <span className={cn("tabular text-xs font-semibold", style.textClass)}>
                        {rec.suitabilityScore}
                        <span className="text-ink-muted">/100</span>
                      </span>
                    </div>

                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-space-border">
                      <div
                        className={cn("h-full rounded-full transition-[width] duration-500", style.bgClass)}
                        style={{ width: `${rec.suitabilityScore}%` }}
                      />
                    </div>

                    {isDisabled ? (
                      <p className="mt-2 text-[11px] font-medium text-signal-crimson">Not recommended this cycle</p>
                    ) : (
                      <>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-ink-muted">
                          <span className="flex items-center gap-1">
                            <CalendarRange size={11} aria-hidden="true" />
                            {rec.plantingWindow.start} – {rec.plantingWindow.end}
                          </span>
                          <span className={cn("flex items-center gap-1", WATER_DEMAND_STYLE[rec.waterDemand].textClass)}>
                            <Droplet size={11} aria-hidden="true" />
                            {WATER_DEMAND_STYLE[rec.waterDemand].label}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {rec.climateResilienceTags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full border border-space-border px-2 py-0.5 text-[10px] text-ink-muted"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          <button
            type="button"
            disabled={!selected}
            onClick={() => setStage("review")}
            className={cn(
              "mt-3 w-full rounded-lg bg-signal-cyan px-4 py-2.5 text-xs font-semibold text-space",
              "transition-[opacity,box-shadow] duration-200",
              "hover:shadow-glow-cyan",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal-cyan",
              "active:opacity-90",
              "disabled:cursor-not-allowed disabled:bg-space-border disabled:text-ink-muted disabled:hover:shadow-none"
            )}
          >
            Continue with {selected ? selected.cropName : "a crop"}
          </button>
        </>
      )}

      {stage === "review" && selected && (
        <div className="mt-3">
          <div className="glass-panel rounded-xl p-4">
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-signal-cyan">
              <Sparkles size={12} aria-hidden="true" /> Recommended rotation
            </p>
            <p className="mt-1 font-display text-lg font-semibold text-ink-primary">{selected.cropName}</p>
            <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">{selected.rationale}</p>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <dt className="text-ink-muted">Planting window</dt>
                <dd className="tabular text-ink-primary">
                  {selected.plantingWindow.start} – {selected.plantingWindow.end}
                </dd>
              </div>
              <div>
                <dt className="text-ink-muted">Water demand</dt>
                <dd className={cn("font-medium", WATER_DEMAND_STYLE[selected.waterDemand].textClass)}>
                  {selected.waterDemand}
                </dd>
              </div>
            </dl>
          </div>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setStage("browse")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border border-space-border bg-space-panel px-3 py-2.5 text-xs font-medium text-ink-primary",
                "transition-colors duration-200 hover:bg-white/[0.04]",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-signal-cyan",
                "active:bg-white/[0.06]"
              )}
            >
              <ArrowLeft size={13} aria-hidden="true" />
              Back
            </button>
            <button
              type="button"
              onClick={() => setStage("confirmed")}
              className={cn(
                "flex-1 rounded-lg bg-signal-emerald px-4 py-2.5 text-xs font-semibold text-space",
                "transition-[opacity,box-shadow] duration-200 hover:shadow-glow-emerald",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal-emerald",
                "active:opacity-90"
              )}
            >
              Confirm rotation plan
            </button>
          </div>
        </div>
      )}

      {stage === "confirmed" && selected && (
        <div className="glass-panel mt-3 flex flex-col items-center rounded-xl p-6 text-center shadow-glow-emerald">
          <CheckCircle2 size={28} className="text-signal-emerald" aria-hidden="true" />
          <p className="mt-2 text-xs font-medium text-ink-primary">Rotation plan confirmed</p>
          <p className="mt-1 text-[11px] text-ink-muted">
            {field.name} is now scheduled for <span className="text-ink-primary">{selected.cropName}</span>, planting{" "}
            {selected.plantingWindow.start}.
          </p>
          <button
            type="button"
            onClick={reset}
            className={cn(
              "mt-4 rounded-lg border border-space-border px-3 py-2 text-[11px] font-medium text-ink-muted",
              "transition-colors duration-200 hover:bg-white/[0.04] hover:text-ink-primary",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-signal-cyan"
            )}
          >
            Plan a different crop
          </button>
        </div>
      )}
    </div>
  );
}

function RotationPlannerSkeleton({ className }: { className?: string }) {
  return (
    <div role="status" aria-busy="true" aria-label="Loading rotation options" className={cn("flex flex-col", className)}>
      <span className="sr-only">Loading rotation options…</span>
      <div className="h-3 w-20 animate-skeleton-pulse rounded bg-space-panel" />
      <div className="mt-2 h-4 w-32 animate-skeleton-pulse rounded bg-space-panel" />
      <div className="mt-4 space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 animate-skeleton-pulse rounded-xl bg-space-panel" />
        ))}
      </div>
    </div>
  );
}
