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
      className={["fs-lang", className].filter(Boolean).join(" ")}
      role="group"
      aria-label={language === "bn" ? "ভাষা" : "Language"}
    >
      <button
        type="button"
        lang="bn"
        onClick={() => onChange("bn")}
        aria-pressed={language === "bn"}
      >
        বাংলা
      </button>

      <button
        type="button"
        lang="en"
        onClick={() => onChange("en")}
        aria-pressed={language === "en"}
      >
        English
      </button>
    </div>
  );
}
