import { useEffect, useRef, useState } from "react";
import { Send, Languages, Satellite } from "lucide-react";
import { cn } from "@/lib/utils";
import { SIGNAL_SOURCE_STYLES } from "@/lib/riskBand";
import {
  COPILOT_LANGUAGES,
  SUGGESTED_PROMPTS,
  buildCopilotReply,
  type CopilotLanguage,
} from "@/mocks/copilotReply";
import type { CitationBadge, CopilotMessage, FieldPolygon } from "@/types";

interface CopilotChatProps {
  field: FieldPolygon | null;
  /** Fired when a citation badge is activated — the parent highlights the polygon and overlay. */
  onCitationSelect: (citation: CitationBadge) => void;
  className?: string;
}

export function CopilotChat({ field, onCitationSelect, className }: CopilotChatProps) {
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [lang, setLang] = useState<CopilotLanguage>("en");
  const [activeCitation, setActiveCitation] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number>();

  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, sending]);

  if (!field) {
    return (
      <div aria-disabled="true" className={cn("flex h-full items-center justify-center p-6 text-center text-xs text-ink-muted", className)}>
        Select a field to ask the Copilot about it.
      </div>
    );
  }

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    const now = new Date().toISOString();
    setMessages((m) => [...m, { id: `u-${now}`, role: "user", content: trimmed, timestamp: now }]);
    setDraft("");
    setSending(true);
    // Simulated RAG round-trip; replace with POST /copilot/chat.
    timer.current = window.setTimeout(() => {
      setMessages((m) => [...m, buildCopilotReply(field.id, lang)]);
      setSending(false);
    }, 900);
  };

  return (
    <div className={cn("flex h-full min-h-[420px] flex-col", className)}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] text-ink-muted">{field.name}</p>
          <h2 className="font-display text-sm font-semibold text-ink-primary">Field Copilot</h2>
        </div>
        <label className="flex items-center gap-1.5 text-[11px] text-ink-muted">
          <Languages size={13} aria-hidden="true" />
          <span className="sr-only">Response language</span>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as CopilotLanguage)}
            disabled={sending}
            className={cn(
              "rounded-md border border-space-border bg-space-panel px-1.5 py-1 text-[11px] text-ink-primary",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal-cyan disabled:opacity-40"
            )}
          >
            {COPILOT_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div role="log" aria-live="polite" aria-label="Copilot conversation" className="mt-3 flex-1 space-y-3 overflow-y-auto pr-1">
        {messages.length === 0 && (
          <div className="glass-panel rounded-xl p-4 text-[11px] leading-relaxed text-ink-muted">
            <p className="flex items-center gap-1.5 font-medium text-signal-cyan">
              <Satellite size={12} aria-hidden="true" /> Grounded in NASA data
            </p>
            <p className="mt-1.5">
              Ask about {field.name}. Every answer cites the satellite readings behind it — select a badge to see it on the map.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {SUGGESTED_PROMPTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => send(p)}
                  className={cn(
                    "rounded-full border border-space-border px-2.5 py-1 text-[11px] text-ink-primary",
                    "transition-colors duration-200 hover:border-signal-cyan/50 hover:bg-signal-cyan/[0.06]",
                    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal-cyan active:bg-signal-cyan/10"
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={cn("flex flex-col", m.role === "user" ? "items-end" : "items-start")}>
            <div
              className={cn(
                "max-w-[92%] rounded-xl px-3 py-2 text-xs leading-relaxed",
                m.role === "user"
                  ? "bg-signal-cyan/15 text-ink-primary ring-1 ring-signal-cyan/30"
                  : "glass-panel text-ink-primary"
              )}
            >
              {m.content}
            </div>
            {m.citations && (
              <ul aria-label="Data sources" className="mt-1.5 flex max-w-[92%] flex-wrap gap-1.5">
                {m.citations.map((c) => (
                  <li key={c.id}>
                    <CitationChip
                      citation={c}
                      active={activeCitation === c.id}
                      onSelect={() => {
                        setActiveCitation(c.id);
                        onCitationSelect(c);
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}

        {sending && (
          <div role="status" aria-busy="true" className="glass-panel inline-flex items-center gap-1 rounded-xl px-3 py-2.5">
            <span className="sr-only">Copilot is reading the latest signals…</span>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 animate-skeleton-pulse rounded-full bg-signal-cyan"
                style={{ animationDelay: `${i * 160}ms` }}
              />
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="mt-3 flex items-center gap-2">
        <label htmlFor="copilot-input" className="sr-only">
          Ask the Copilot
        </label>
        <input
          id="copilot-input"
          value={draft}
          disabled={sending}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send(draft)}
          placeholder="Ask about this field…"
          className={cn(
            "min-w-0 flex-1 rounded-lg border border-space-border bg-space-panel px-3 py-2 text-xs text-ink-primary placeholder:text-ink-muted",
            "transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal-cyan disabled:opacity-40"
          )}
        />
        <button
          type="button"
          aria-label="Send message"
          disabled={sending || !draft.trim()}
          onClick={() => send(draft)}
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-signal-cyan text-space",
            "transition-[box-shadow,opacity] duration-200 hover:shadow-glow-cyan active:opacity-90",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal-cyan",
            "disabled:cursor-not-allowed disabled:bg-space-border disabled:text-ink-muted disabled:shadow-none"
          )}
        >
          <Send size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function CitationChip({ citation, active, onSelect }: { citation: CitationBadge; active: boolean; onSelect: () => void }) {
  const style = SIGNAL_SOURCE_STYLES[citation.signal];
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      aria-label={`${citation.label}, observed ${citation.observedAt}: ${citation.value} ${citation.unit}. Show on map.`}
      title={`${citation.value} ${citation.unit}`}
      className={cn(
        "group inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-medium",
        "border-space-border bg-space-panel text-ink-muted transition-[border-color,background-color,color] duration-200",
        "hover:text-ink-primary hover:bg-white/[0.05] active:bg-white/[0.08]",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal-cyan",
        active && "border-signal-cyan/50 bg-signal-cyan/[0.08] text-ink-primary"
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: style?.hex }} aria-hidden="true" />
      <span>{citation.label}</span>
      <span className="tabular text-ink-muted">{citation.observedAt}</span>
      <span className="tabular hidden text-ink-primary group-hover:inline group-focus-visible:inline">
        {citation.value} {citation.unit}
      </span>
    </button>
  );
}
