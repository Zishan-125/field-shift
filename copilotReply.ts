import type { CitationBadge, CopilotMessage, ShiftRecommendation } from "@/types";
import { MOCK_FIELDS } from "./fields";
import { MOCK_SHIFT_SCORES } from "./shiftScores";

export const COPILOT_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "pt", label: "Português" },
  { code: "sw", label: "Kiswahili" },
] as const;
export type CopilotLanguage = (typeof COPILOT_LANGUAGES)[number]["code"];

const LEAD_IN: Record<CopilotLanguage, string> = {
  en: "Here's what the satellite signals show for {name}:",
  hi: "{name} के लिए उपग्रह संकेत यह दिखाते हैं:",
  pt: "Isto é o que os sinais de satélite mostram para {name}:",
  sw: "Hivi ndivyo ishara za setilaiti zinaonyesha kwa {name}:",
};

const RECOMMENDATION: Record<ShiftRecommendation, Record<CopilotLanguage, string>> = {
  continue: {
    en: "Recommendation: keep the current rotation.",
    hi: "सिफारिश: वर्तमान फसल चक्र जारी रखें।",
    pt: "Recomendação: manter a rotação atual.",
    sw: "Pendekezo: endelea na mzunguko wa sasa.",
  },
  adjust_timing: {
    en: "Recommendation: adjust timing.",
    hi: "सिफारिश: समय में बदलाव करें।",
    pt: "Recomendação: ajustar o calendário.",
    sw: "Pendekezo: rekebisha muda wa kazi.",
  },
  shift_crop: {
    en: "Recommendation: shift to a drought-tolerant crop.",
    hi: "सिफारिश: सूखा-सहनशील फसल अपनाएं।",
    pt: "Recomendação: mudar para uma cultura tolerante à seca.",
    sw: "Pendekezo: badilisha kwa zao linalostahimili ukame.",
  },
  shift_rotation: {
    en: "Recommendation: change the rotation.",
    hi: "सिफारिश: फसल चक्र बदलें।",
    pt: "Recomendação: alterar a rotação.",
    sw: "Pendekezo: badilisha mzunguko.",
  },
};

export const SUGGESTED_PROMPTS = ["Why is this score what it is?", "Should I change my crop?"];

/**
 * Stand-in for POST /copilot/chat. The real endpoint returns RAG-grounded text plus the
 * retrieved signal records; here we ground the reply in the field's mock Shift Score and
 * cite its three highest-impact signals. Only the framing sentences are localized here —
 * the backend is expected to return fully translated text.
 */
export function buildCopilotReply(fieldId: string, lang: CopilotLanguage): CopilotMessage {
  const score = MOCK_SHIFT_SCORES[fieldId];
  const field = MOCK_FIELDS.find((f) => f.id === fieldId);
  const now = new Date().toISOString();

  if (!score || !field) {
    return { id: `msg-${now}`, role: "assistant", timestamp: now, language: lang, content: "I don't have signal data for that field yet." };
  }

  const citations: CitationBadge[] = [...score.signalBreakdown]
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, 3)
    .map((s) => ({
      id: `cite-${fieldId}-${s.signal}`,
      signal: s.signal,
      label: `${s.signal.replace("_", " ")} Data`,
      observedAt: s.observedAt,
      fieldId,
      value: s.rawValue,
      unit: s.unit,
    }));

  return {
    id: `msg-${now}`,
    role: "assistant",
    timestamp: now,
    language: lang,
    content: `${LEAD_IN[lang].replace("{name}", field.name)} ${score.summary} ${RECOMMENDATION[score.recommendation][lang]}`,
    citations,
  };
}
