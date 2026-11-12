import LanguageSwitcher from "./LanguageSwitcher";

type Language = "bn" | "en";

/** Compact farmer header: name, one line of purpose (Bangla first), language switch. */
export default function AppHeader({
  language,
  onLanguageChange,
}: {
  language: Language;
  onLanguageChange: (language: Language) => void;
}) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="fs-container flex items-center justify-between gap-3 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-lg">🌾</span>
          <div className="min-w-0">
            <p className="text-base font-black leading-5 text-slate-900">
              {language === "bn" ? "ফিল্ড শিফট" : "Field Shift"}
            </p>
            <p className="truncate text-[11px] leading-4 text-slate-500">
              {language === "bn"
                ? "ফেনী · নাসার উপগ্রহ-তথ্যে ফসল-চক্রের সিদ্ধান্ত"
                : "Feni · crop-rotation decisions from NASA satellite data"}
            </p>
          </div>
        </div>
        <div className="shrink-0">
          <LanguageSwitcher language={language} onChange={onLanguageChange} />
        </div>
      </div>
    </header>
  );
}
