import type { CopilotMessage } from "@/types";

export const MOCK_COPILOT_THREAD: CopilotMessage[] = [
  {
    id: "msg-1",
    role: "user",
    content: "Why is Ludhiana Block 3 showing a moderate risk score this week?",
    timestamp: "2026-09-26T08:12:00Z",
  },
  {
    id: "msg-2",
    role: "assistant",
    content:
      "Two signals are driving the drop: topsoil moisture has fallen sharply over the last 10 days, and GRACE-FO shows a widening groundwater deficit in your block. Rainfall is trending up over the next 7 days, so delaying the next irrigation-dependent stage by 5–7 days should let the forecast rain close most of the gap.",
    timestamp: "2026-09-26T08:12:04Z",
    language: "en",
    citations: [
      {
        id: "cite-1",
        signal: "SMAP",
        label: "SMAP Data",
        observedAt: "2026-09-25",
        fieldId: "field-pb-011",
        value: 0.14,
        unit: "m³/m³",
      },
      {
        id: "cite-2",
        signal: "GRACE_FO",
        label: "GRACE-FO Data",
        observedAt: "2026-09-19",
        fieldId: "field-pb-011",
        value: -3.4,
        unit: "cm equiv.",
      },
      {
        id: "cite-3",
        signal: "GPM_IMERG",
        label: "GPM IMERG Forecast",
        observedAt: "2026-09-26",
        fieldId: "field-pb-011",
        value: 31.2,
        unit: "mm / 7d",
      },
    ],
  },
];
