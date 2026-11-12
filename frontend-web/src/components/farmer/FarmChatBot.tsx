import { useState, useRef, useEffect } from "react";

interface LiveTelemetry {
  temp?: number | null;
  rainfall?: number | null;
  windSpeed?: number | null;
  solarRadiation?: number | null;
  humidity?: number | null;
  observationDate?: string;
}

interface FarmChatBotProps {
  isBangla?: boolean;
  selectedFieldName?: string;
  cropHealthScore?: number;
  lat?: number;
  lon?: number;
  liveTelemetry?: LiveTelemetry | null;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sourceTag?: string;
}

function toValidNum(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  const num = Number(val);
  return !Number.isFinite(num) || num === -999 ? null : num;
}

function formatNASADate(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

async function fetchGlobalNASATelemetry(
  lat: number,
  lon: number
): Promise<LiveTelemetry | null> {
  try {
    const endDate = new Date();
    endDate.setUTCDate(endDate.getUTCDate() - 10);

    const startDate = new Date();
    startDate.setUTCDate(startDate.getUTCDate() - 17);

    const url = new URL(
      "https://power.larc.nasa.gov/api/temporal/daily/point"
    );
    url.searchParams.set(
      "parameters",
      "T2M,PRECTOTCORR,WS2M,ALLSKY_SFC_SW_DWN,RH2M"
    );
    url.searchParams.set("community", "AG");
    url.searchParams.set("longitude", String(lon));
    url.searchParams.set("latitude", String(lat));
    url.searchParams.set("start", formatNASADate(startDate));
    url.searchParams.set("end", formatNASADate(endDate));
    url.searchParams.set("format", "JSON");

    const res = await fetch(url.toString());
    if (!res.ok) return null;

    const json = await res.json();
    const params = json?.properties?.parameter;
    if (!params) return null;

    const dates = Object.keys(params.T2M ?? {}).sort();
    const latest = [...dates]
      .reverse()
      .find((d) => toValidNum(params.T2M?.[d]) !== null);

    if (!latest) return null;

    return {
      temp: toValidNum(params.T2M?.[latest]),
      rainfall: toValidNum(params.PRECTOTCORR?.[latest]),
      windSpeed: toValidNum(params.WS2M?.[latest]),
      solarRadiation: toValidNum(params.ALLSKY_SFC_SW_DWN?.[latest]),
      humidity: toValidNum(params.RH2M?.[latest]),
      observationDate: latest,
    };
  } catch {
    return null;
  }
}

function generateGlobalFieldAdvice(
  query: string,
  lat: number,
  lon: number,
  telemetry: LiveTelemetry | null,
  fieldName: string,
  healthScore: number,
  isBangla: boolean
): { text: string; sourceTag: string } {
  const q = query.toLowerCase();
  const isFeniRegion =
    lat >= 22.8 && lat <= 23.25 && lon >= 91.2 && lon <= 91.6;

  const temp = telemetry?.temp;
  const rain = telemetry?.rainfall;
  const wind = telemetry?.windSpeed;
  const solar = telemetry?.solarRadiation;
  const obsDate = telemetry?.observationDate ?? "Recent";

  const hasLiveNASA =
    temp !== null && temp !== undefined ||
    rain !== null && rain !== undefined;

  const sourceTag = hasLiveNASA
    ? isBangla
      ? `🛰️ NASA POWER লাইভ (${lat.toFixed(2)}°, ${lon.toFixed(2)}°)`
      : `🛰️ NASA POWER Live (${lat.toFixed(2)}°, ${lon.toFixed(2)}°)`
    : isFeniRegion
      ? isBangla
        ? "📂 ফেনী অফলাইন নাসা ডেটাসেট"
        : "📂 Feni Offline NASA Dataset"
      : isBangla
        ? "🌍 গ্লোবাল অফলাইন অ্যাগ্রো-ইঞ্জিন"
        : "🌍 Global Offline Agro-Engine";

  // Build telemetry summary string
  const telemetrySummaryEn = hasLiveNASA
    ? `At coordinates (${lat.toFixed(4)}°, ${lon.toFixed(4)}°) [Obs: ${obsDate}], NASA POWER records: Temp ${temp ?? "--"}°C, Rainfall ${rain ?? "--"} mm/day, Solar ${solar ?? "--"} kWh/m²/day, Wind ${wind ?? "--"} m/s.`
    : `Using baseline regional profile for ${fieldName} (${lat.toFixed(4)}°, ${lon.toFixed(4)}°).`;

  const telemetrySummaryBn = hasLiveNASA
    ? `আপনার নির্বাচিত স্থানাঙ্ক (${lat.toFixed(4)}°, ${lon.toFixed(4)}°) [তারিখ: ${obsDate}]-এ NASA POWER উপাত্ত অনুযায়ী: তাপমাত্রা ${temp ?? "--"}°C, বৃষ্টিপাত ${rain ?? "--"} মিমি/দিন, সৌর বিকিরণ ${solar ?? "--"} kWh/m²/day, বাতাস ${wind ?? "--"} m/s।`
    : `${fieldName} (${lat.toFixed(4)}°, ${lon.toFixed(4)}°)-এর জন্য সংরক্ষিত আঞ্চলিক উপাত্ত ব্যবহার করা হচ্ছে।`;

  // 1. WATER / IRRIGATION / RAINFALL QUERY
  if (
    q.includes("water") ||
    q.includes("rain") ||
    q.includes("irrigat") ||
    q.includes("পানি") ||
    q.includes("সেচ") ||
    q.includes("বৃষ্টি")
  ) {
    const lowRain = rain !== null && rain !== undefined && rain < 2.0;
    const highSolar = solar !== null && solar !== undefined && solar > 5.0;

    if (isBangla) {
      return {
        sourceTag,
        text: `${telemetrySummaryBn}\n\n💧 **সেচ ও পানি ব্যবস্থাপনা পরামর্শ:** ${
          lowRain
            ? `বৃষ্টিপাত কম (${rain} মিমি/দিন)${highSolar ? " এবং উচ্চ সৌর বিকিরণের কারণে বাষ্পীভবন বেশি" : ""}। মাটির আর্দ্রতা ধরে রাখতে মালচিং (খড় বা কচুরিপানা) ব্যবহার করুন এবং সকাল বা বিকেলে হালকা সেচ দিন।`
            : `পর্যাপ্ত আর্দ্রতা বা বৃষ্টিপাত লক্ষ্য করা যাচ্ছে। জমিতে জলাবদ্ধতা এড়াতে নালা পরিষ্কার রাখুন।`
        }`,
      };
    }
    return {
      sourceTag,
      text: `${telemetrySummaryEn}\n\n💧 **Water & Irrigation Advisory:** ${
        lowRain
          ? `Precipitation is low (${rain} mm/day)${highSolar ? " with high solar radiation driving evapotranspiration" : ""}. Apply organic mulching to reduce soil moisture loss and schedule drip or early-morning irrigation.`
          : `Moisture levels appear moderate. Ensure field drainage channels are clear to prevent root waterlogging.`
      }`,
    };
  }

  // 2. CROP ROTATION / NEXT CROP QUERY
  if (
    q.includes("rotat") ||
    q.includes("crop") ||
    q.includes("plant") ||
    q.includes("ফসল") ||
    q.includes("চাষ") ||
    q.includes("পরিবর্তন")
  ) {
    const isHot = temp !== null && temp !== undefined && temp > 30;
    const isCool = temp !== null && temp !== undefined && temp < 20;

    if (isBangla) {
      const suggestion = isHot
        ? "উচ্চ তাপমাত্রার কারণে খরা-সহনশীল ডাল জাতীয় ফসল (মুগ বা মাষকলাই), তিল অথবা ভুট্টা চাষ করলে মাটির নাইট্রোজেন বাড়বে এবং পানির খরচ কমবে।"
        : isCool
          ? "শীতল আবহাওয়ায় সরিষা, গম, মসুর ডাল বা আলু আবর্তন ফসল হিসেবে অত্যন্ত উপযোগী।"
          : "ধান বা প্রধান ফসলের পর শিম জাতীয় ফসল (ডাল/বাদাম) চাষ করলে মাটির জৈব পদার্থ ও নাইট্রোজেন স্থিতিশীল থাকে।";

      return {
        sourceTag,
        text: `${telemetrySummaryBn}\n\n🌾 **ফসল আবর্তন (Crop Rotation) পরামর্শ:** ${suggestion}`,
      };
    }

    const suggestionEn = isHot
      ? "Under warm conditions (>30°C), rotating into nitrogen-fixing legumes (mung bean, cowpea), sorghum, or sesame reduces water demand and restores soil nitrogen."
      : isCool
        ? "Under cooler temperatures (<20°C), rotating with mustard, lentils, wheat, or winter vegetables maximizes yield while breaking pest cycles."
        : "Rotating main cereal crops with deep-rooting legumes or cover crops improves soil organic matter, water infiltration, and nutrient cycling.";

    return {
      sourceTag,
      text: `${telemetrySummaryEn}\n\n🌾 **Crop Rotation Strategy:** ${suggestionEn}`,
    };
  }

  // 3. SOIL / FERTILIZER / HEALTH QUERY
  if (
    q.includes("soil") ||
    q.includes("health") ||
    q.includes("fertilizer") ||
    q.includes("মাটি") ||
    q.includes("সার") ||
    q.includes("স্বাস্থ্য")
  ) {
    if (isBangla) {
      return {
        sourceTag,
        text: `${telemetrySummaryBn}\n\n🌱 **মাটি ও ফসলের স্বাস্থ্য (${healthScore}/100):** মাটির দীর্ঘমেয়াদী উর্বরতা ধরে রাখতে রাসায়নিক সারের পাশাপাশি জৈব কম্পোস্ট ও নাইট্রোজেন-সংবন্ধনকারী ফসল (ডাল/ধইঞ্চা) আবর্তনে যুক্ত করুন।`,
      };
    }
    return {
      sourceTag,
      text: `${telemetrySummaryEn}\n\n🌱 **Soil & Field Health (${healthScore}/100):** Combine organic compost with nitrogen-fixing cover crops between primary harvests to prevent nutrient depletion and surface erosion.`,
    };
  }

  // 4. DEFAULT GENERAL FIELD STATUS
  if (isBangla) {
    return {
      sourceTag,
      text: `${telemetrySummaryBn}\n\n📊 **মাঠের সারসংক্ষেপ (${fieldName}):** বর্তমান স্বাস্থ্য স্কোর **${healthScore}/100**। আপনি ম্যাপের যেকোনো স্থানে ক্লিক করে বা সীমানা এঁকে বিশ্বের যেকোনো জমির জন্য সেচ, মাটি বা ফসল আবর্তন সম্পর্কে প্রশ্ন করতে পারেন।`,
    };
  }

  return {
    sourceTag,
    text: `${telemetrySummaryEn}\n\n📊 **Field Overview (${fieldName}):** Current field health score is **${healthScore}/100**. Click or draw any farm boundary on the global map above, then ask about crop rotation, irrigation, heat stress, or soil health for that exact location.`,
  };
}

export default function FarmChatBot({
  isBangla = false,
  selectedFieldName = "Field Plot",
  cropHealthScore = 78,
  lat = 23.0185,
  lon = 91.3976,
  liveTelemetry = null,
}: FarmChatBotProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: "welcome",
      role: "assistant",
      sourceTag: isBangla
        ? "🛰️ গ্লোবাল NASA অ্যাগ্রো-অ্যাডভাইজর"
        : "🛰️ Global NASA Agro-Advisor",
      content: isBangla
        ? "স্বাগতম! ম্যাপে বিশ্বের যেকোনো খামারের অবস্থান নির্বাচন করুন এবং আপনার জমির তাপমাত্রা, বৃষ্টিপাত, সেচ বা ফসল আবর্তন (Crop Rotation) সম্পর্কে প্রশ্ন করুন।"
        : "Welcome! Select any farm location on the global map above and ask about temperature, rainfall, irrigation, or optimal crop rotation strategies for your exact field.",
    },
  ]);

  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  async function handleSend(customPrompt?: string) {
    const query = (customPrompt ?? input).trim();
    if (!query || isTyping) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: query,
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customPrompt) setInput("");
    setIsTyping(true);

    try {
      // Use live telemetry passed from map/dashboard, or fetch directly from NASA POWER API for current lat/lon
      let activeTelemetry = liveTelemetry;
      if (
        !activeTelemetry ||
        (activeTelemetry.temp === undefined &&
          activeTelemetry.rainfall === undefined)
      ) {
        activeTelemetry = await fetchGlobalNASATelemetry(lat, lon);
      }

      const reply = generateGlobalFieldAdvice(
        query,
        lat,
        lon,
        activeTelemetry,
        selectedFieldName,
        cropHealthScore,
        isBangla
      );

      setMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          role: "assistant",
          content: reply.text,
          sourceTag: reply.sourceTag,
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  }

  const quickPrompts = isBangla
    ? [
        "এই জমির জন্য সেরা ফসল আবর্তন কী?",
        "বর্তমান আবহাওয়ায় সেচ প্রয়োজন কি?",
        "মাটির স্বাস্থ্য কীভাবে বাড়াবো?",
      ]
    : [
        "Best crop rotation for this field?",
        "Do I need irrigation based on NASA data?",
        "How can I improve soil health here?",
      ];

  return (
    <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-4 sm:px-6">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600">
            {isBangla
              ? "গ্লোবাল নাসা এআই কৃষি সহায়ক"
              : "Global NASA Field Assistant"}
          </p>
          <h3 className="mt-0.5 text-base font-black text-slate-900 sm:text-lg">
            {isBangla
              ? "আপনার জমির তথ্য নিয়ে প্রশ্ন করুন"
              : "Ask About Your Specific Field"}
          </h3>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-800">
          📍 {lat.toFixed(4)}°, {lon.toFixed(4)}°
        </div>
      </div>

      {/* Chat Messages */}
      <div className="max-h-[340px] space-y-3 overflow-y-auto p-5 sm:p-6">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.role === "user" ? "items-end" : "items-start"
            }`}
          >
            {msg.sourceTag && msg.role === "assistant" && (
              <span className="mb-1 text-[10px] font-bold text-emerald-700">
                {msg.sourceTag}
              </span>
            )}
            <div
              className={`max-w-[88%] whitespace-pre-line rounded-2xl px-4 py-3 text-sm leading-6 ${
                msg.role === "user"
                  ? "bg-emerald-600 font-medium text-white"
                  : "border border-slate-200/80 bg-slate-50 text-slate-800"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-600">
            <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-600" />
            <span>
              {isBangla
                ? "NASA POWER উপাত্ত বিশ্লেষণ করা হচ্ছে..."
                : "Analyzing NASA POWER field observations..."}
            </span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts */}
      <div className="flex flex-wrap gap-2 border-t border-slate-100 bg-slate-50/50 px-5 py-3 sm:px-6">
        {quickPrompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => void handleSend(prompt)}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSend();
        }}
        className="flex items-center gap-2 border-t border-slate-200 bg-white p-3 sm:px-6 sm:py-4"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            isBangla
              ? `স্থানাঙ্ক (${lat.toFixed(2)}°, ${lon.toFixed(2)}°) নিয়ে প্রশ্ন লিখুন...`
              : `Ask about field (${lat.toFixed(2)}°, ${lon.toFixed(2)}°)...`
          }
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none"
        />
        <button
          type="submit"
          disabled={isTyping || !input.trim()}
          className="shrink-0 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white transition hover:bg-emerald-700 disabled:opacity-50"
        >
          {isBangla ? "পাঠান" : "Ask"}
        </button>
      </form>
    </div>
  );
}