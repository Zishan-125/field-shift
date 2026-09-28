import { ChevronRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { RISK_BAND_STYLES } from "@/lib/riskBand";
import type { FieldPolygon, ShiftScore } from "@/types";

interface FieldListPanelProps {
  fields: FieldPolygon[];
  scores: Record<string, ShiftScore>;
  selectedFieldId: string | null;
  onSelectField: (fieldId: string) => void;
  isLoading?: boolean;
}

export function FieldListPanel({ fields, scores, selectedFieldId, onSelectField, isLoading }: FieldListPanelProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-space-border p-3">
        <label className="sr-only" htmlFor="field-search">
          Search fields
        </label>
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
          <input
            id="field-search"
            type="search"
            placeholder="Search fields or regions"
            disabled={isLoading}
            className={cn(
              "w-full rounded-lg border border-space-border bg-space-panel py-2 pl-8 pr-3 text-xs text-ink-primary placeholder:text-ink-muted",
              "transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-signal-cyan",
              "disabled:opacity-40"
            )}
          />
        </div>
      </div>

      <ul aria-label="Fields" className="flex-1 overflow-y-auto p-2">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <li key={i} aria-hidden="true" className="mb-1.5 h-[62px] animate-skeleton-pulse rounded-lg bg-space-panel" />
            ))
          : fields.map((field) => {
              const score = scores[field.id];
              const style = score ? RISK_BAND_STYLES[score.riskBand] : null;
              const isSelected = field.id === selectedFieldId;

              return (
                <li key={field.id}>
                  <button
                    type="button"
                    aria-current={isSelected ? "true" : undefined}
                    onClick={() => onSelectField(field.id)}
                    className={cn(
                      "group mb-1.5 flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left",
                      "transition-[background-color,border-color,box-shadow] duration-200 ease-out",
                      "border-transparent hover:border-space-border hover:bg-white/[0.03]",
                      "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-signal-cyan",
                      "active:bg-white/[0.06]",
                      isSelected && "border-signal-cyan/40 bg-signal-cyan/[0.06]"
                    )}
                  >
                    <span
                      className={cn("h-2 w-2 shrink-0 rounded-full", style?.bgClass ?? "bg-ink-muted")}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-ink-primary">{field.name}</span>
                      <span className="block truncate text-[11px] text-ink-muted">{field.region}</span>
                    </span>
                    <span className={cn("tabular text-xs font-semibold", style?.textClass ?? "text-ink-muted")}>
                      {score?.score ?? "—"}
                    </span>
                    <ChevronRight
                      size={14}
                      className={cn(
                        "shrink-0 text-ink-muted transition-transform duration-200",
                        isSelected ? "translate-x-0.5 text-signal-cyan" : "group-hover:translate-x-0.5"
                      )}
                      aria-hidden="true"
                    />
                  </button>
                </li>
              );
            })}
      </ul>
    </div>
  );
}
