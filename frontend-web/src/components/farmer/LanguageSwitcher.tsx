import type { ReactNode } from "react";

export type Language = "bn" | "en";

interface LanguageSwitcherProps {
  language: Language;
  onChange: (language: Language) => void;
  className?: string;
}

export default function LanguageSwitcher({
  language,
  onChange,
  className = "",
}: LanguageSwitcherProps): ReactNode {
  return (
    <div
      className={`inline-flex items-center rounded-full border border-slate-200 bg-white p-1 shadow-sm ${className}`}
      role="group"
      aria-label="Language"
    >
      <button
        type="button"
        onClick={() => onChange("bn")}
        aria-pressed={language === "bn"}
        className={[
          "rounded-full px-3 py-1.5 text-xs font-black transition",
          language === "bn"
            ? "bg-green-600 text-white shadow-sm"
            : "text-slate-500 hover:bg-slate-50 hover:text-slate-800",
        ].join(" ")}
      >
        বাংলা
      </button>

      <button
        type="button"
        onClick={() => onChange("en")}
        aria-pressed={language === "en"}
        className={[
          "rounded-full px-3 py-1.5 text-xs font-black transition",
          language === "en"
            ? "bg-green-600 text-white shadow-sm"
            : "text-slate-500 hover:bg-slate-50 hover:text-slate-800",
        ].join(" ")}
      >
        English
      </button>
    </div>
  );
}