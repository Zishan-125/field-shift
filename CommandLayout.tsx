import type { ReactNode } from "react";
import { Satellite } from "lucide-react";

interface CommandLayoutProps {
  fieldPanel: ReactNode;
  mapPanel: ReactNode;
  scorePanel: ReactNode;
}

/**
 * Top-level ops-center shell: a fixed status bar over a 3-column grid.
 * Field list and score drawer collapse under the map on narrow viewports;
 * the map always keeps a fixed aspect ratio to avoid CLS while panels resize.
 */
export function CommandLayout({ fieldPanel, mapPanel, scorePanel }: CommandLayoutProps) {
  return (
    <div className="flex h-screen min-h-screen w-full flex-col bg-space">
      <header
        role="banner"
        className="glass-panel z-20 flex h-14 shrink-0 items-center justify-between border-b border-space-border px-4"
      >
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-signal-cyan/10 text-signal-cyan ring-1 ring-signal-cyan/30">
            <Satellite size={16} strokeWidth={2} aria-hidden="true" />
          </span>
          <div className="leading-tight">
            <p className="font-display text-sm font-semibold tracking-tight text-ink-primary">TerraShift</p>
            <p className="text-[11px] text-ink-muted">Field Shift Ops Console</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-ink-muted">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-signal-emerald" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-signal-emerald" />
          </span>
          <span className="tabular">Live — synced 06:00 UTC</span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside
          aria-label="Field list and filters"
          className="order-2 flex w-full shrink-0 flex-col border-t border-space-border lg:order-1 lg:h-full lg:w-[300px] lg:border-r lg:border-t-0"
        >
          {fieldPanel}
        </aside>

        <main aria-label="Field map" className="order-1 min-h-[360px] flex-1 lg:order-2 lg:h-full">
          {mapPanel}
        </main>

        <aside
          aria-label="Shift Score detail"
          className="order-3 flex w-full shrink-0 flex-col border-t border-space-border lg:h-full lg:w-[380px] lg:border-l lg:border-t-0"
        >
          {scorePanel}
        </aside>
      </div>
    </div>
  );
}
