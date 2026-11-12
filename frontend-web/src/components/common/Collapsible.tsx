import type { ReactNode } from "react";

/** A section closed by default: the farmer sees the answer, a judge opens what they want. */
export default function Collapsible({
  title,
  subtitle,
  open,
  onToggle,
  id,
  children,
}: {
  title: string;
  subtitle?: string;
  open?: boolean;
  onToggle?: (open: boolean) => void;
  id?: string;
  children: ReactNode;
}) {
  return (
    <details
      id={id}
      className="fs-section scroll-mt-4 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
      open={open}
      onToggle={(event) => onToggle?.((event.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3.5">
        <span className="min-w-0">
          <span className="block text-sm font-black text-slate-900">{title}</span>
          {subtitle && <span className="mt-0.5 block text-xs leading-5 text-slate-500">{subtitle}</span>}
        </span>
        <span className="shrink-0 text-lg text-slate-400" aria-hidden>
          ⌄
        </span>
      </summary>
      <div className="border-t border-slate-100 p-3 sm:p-5">{children}</div>
    </details>
  );
}
