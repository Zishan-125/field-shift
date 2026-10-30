import { Leaf, MapPin } from "lucide-react";

import LanguageSwitcher from "./LanguageSwitcher";

import type { Language } from "./LanguageSwitcher";

interface FarmerHeaderProps {
  backendAvailable?: boolean;
  fieldName?: string;
  language?: Language;
  onLanguageChange?: (language: Language) => void;
}

export default function FarmerHeader({
  backendAvailable = true,
  fieldName = "Your field",
  language = "bn",
  onLanguageChange,
}: FarmerHeaderProps) {
  const statusText = backendAvailable
    ? language === "bn"
      ? "অফলাইন মোড প্রস্তুত"
      : "Offline mode ready"
    : language === "bn"
      ? "সংরক্ষিত মাঠের তথ্য ব্যবহৃত হচ্ছে"
      : "Using saved farm data";

  return (
    <header className="fs-topbar">
      <div className="fs-container fs-topbar-inner">
        <span className="fs-brand">
          <span className="fs-brand-mark" aria-hidden="true">
            <Leaf size={17} strokeWidth={2.2} />
          </span>

          <span className="fs-brand-name">Field Shift</span>
        </span>

        <span className="fs-topbar-field">
          <MapPin size={14} strokeWidth={2} aria-hidden="true" />

          {fieldName}
        </span>

        <div className="fs-topbar-actions">
          <span className="fs-status">{statusText}</span>

          {onLanguageChange ? (
            <LanguageSwitcher
              language={language}
              onChange={onLanguageChange}
            />
          ) : null}
        </div>
      </div>
    </header>
  );
}
