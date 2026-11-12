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

// Reverse geocode lat/lon to get a readable location name
async function fetchLocationName(lat: number, lon: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`,
      { headers: { "Accept-Language": "en" } }
    );
    if (!res.ok) return "";
    const data = await res.json();
    const address = data?.address;
    if (!address) return data?.display_name?.split(",")[0] || "";

    const locality =
      address.village ||
      address.town ||
      address.city ||
      address.county ||
      address.state_district ||
      address.state ||
      "";
    const country = address.country || "";
    return locality && country ? `${locality}, ${country}` : locality || country;
  } catch {
    return "";
  }
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

function generateFarmerFriendlyAdvice(
  query: string,
  lat: number,
  lon: number,
  locationName: string,
  fieldName: string,
  telemetry: LiveTelemetry | null,
  healthScore: number,
  isBangla: boolean
): { text: string; sourceTag: string } {
  const q = query.toLowerCase();
  const temp = telemetry?.temp;
  const rain = telemetry?.rainfall;
  const locDisplay = locationName || `Lat: ${lat.toFixed(2)}°, Lon: ${lon.toFixed(2)}`;

  const sourceTag = isBangla
    ? `🛰️ নাসা স্যাটেলাইট উপাত্ত (${locDisplay})`
    : `🛰️ NASA Satellite Telemetry (${locDisplay})`;

  const tempTextBn = temp !== null && temp !== undefined ? `${temp.toFixed(1)}°C` : "স্বাভাবিক";
  const rainTextBn = rain !== null && rain !== undefined ? `${rain.toFixed(1)} মিমি/দিন` : "পরিমিত";
  const tempTextEn = temp !== null && temp !== undefined ? `${temp.toFixed(1)}°C` : "normal";
  const rainTextEn = rain !== null && rain !== undefined ? `${rain.toFixed(1)} mm/day` : "moderate";

  // 1. WATER / IRRIGATION QUERY
  if (
    q.includes("water") ||
    q.includes("rain") ||
    q.includes("irrigat") ||
    q.includes("পানি") ||
    q.includes("সেচ") ||
    q.includes("বৃষ্টি")
  ) {
    const isDry = rain !== null && rain !== undefined && rain < 2.0;
    if (isBangla) {
      return {
        sourceTag,
        text: `📍 **এলাকা (${fieldName}):** ${locDisplay}\n🌡️ **তাপমাত্রা:** ${tempTextBn} | 🌧️ **বৃষ্টিপাত:** ${rainTextBn}\n\n💧 **কৃষকের সহজ পরামর্শ:**\n${
          isDry
            ? "আপনার জমিতে বর্তমানে বৃষ্টির পরিমাণ কিছুটা কম মনে হচ্ছে। মাটির আর্দ্রতা ধরে রাখতে খড় বা কচুরিপানা দিয়ে মালচিং করতে পারেন এবং সকালে বা বিকেলে হালকা সেচ দেওয়া ভালো হবে।"
            : "জমির আবহাওয়া ও আর্দ্রতা সন্তোষজনক রয়েছে। অতিরিক্ত পানি জমতে না দিয়ে নিষ্কাশনের ব্যবস্থা রাখুন।"
        }`,
      };
    }
    return {
      sourceTag,
      text: `📍 **Location (${fieldName}):** ${locDisplay}\n🌡️ **Temperature:** ${tempTextEn} | 🌧️ **Rainfall:** ${rainTextEn}\n\n💧 **Farmer Advisory:**\n${
        isDry
          ? "Rainfall is currently on the lower side. Apply organic mulch (straw or crop residue) to retain soil moisture, and consider light irrigation during early morning or evening."
          : "Moisture levels look adequate. Ensure your field drainage channels are clear to prevent waterlogging."
      }`,
    };
  }

  // 2. CROP ROTATION QUERY
  if (
    q.includes("rotat") ||
    q.includes("crop") ||
    q.includes("plant") ||
    q.includes("ফসল") ||
    q.includes("চাষ") ||
    q.includes("পরিবর্তন")
  ) {
    const isHot = temp !== null && temp !== undefined && temp > 30;
    if (isBangla) {
      return {
        sourceTag,
        text: `📍 **এলাকা (${fieldName}):** ${locDisplay}\n🌡️ **তাপমাত্রা:** ${tempTextBn}\n\n🌾 **ফসল আবর্তনের সহজ পরামর্শ:**\n${
          isHot
            ? "বর্তমান গরম আবহাওয়ায় ধান বা প্রধান ফসলের পর ডালজাতীয় ফসল (যেমন মুগ বা মাষকলাই) কিংবা খরা-সহনশীল ফসল চাষ করলে মাটির উর্বরতা ও নাইট্রোজেন বৃদ্ধি পাবে।"
            : "মাটির পুষ্টি ও স্বাস্থ্য ঠিক রাখতে শিমজাতীয় ফসল বা সবুজ সার আবর্তনে যুক্ত করা অত্যন্ত লাভজনক।"
        }`,
      };
    }
    return {
      sourceTag,
      text: `📍 **Location (${fieldName}):** ${locDisplay}\n🌡️ **Temperature:** ${tempTextEn}\n\n🌾 **Crop Rotation Advisory:**\n${
        isHot
          ? "Given the warm temperatures, rotating into nitrogen-fixing legumes (mung beans or cover crops) after your main harvest will naturally restore soil fertility and save water."
          : "Adding deep-rooting legumes or rotation crops between seasons helps break pest cycles and improves soil structure."
      }`,
    };
  }

  // 3. SOIL HEALTH QUERY
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
        text: `📍 **এলাকা (${fieldName}):** ${locDisplay}\n\n🌱 **মাটি ও ফসলের স্বাস্থ্য (স্কোর: ${healthScore}/100):**\nমাটির উর্বরতা বাড়াতে রাসায়নিক সারের ওপর চাপ কমিয়ে জৈব সার বা কম্পোস্ট ব্যবহার করুন। ডালজাতীয় ফসল চাষ করলে প্রাকৃতিকভাবে মাটিতে নাইট্রোজেন জমা হয়।`,
      };
    }
    return {
      sourceTag,
      text: `📍 **Location (${fieldName}):** ${locDisplay}\n\n🌱 **Soil Health Status (Score: ${healthScore}/100):**\nBoost organic matter by mixing compost into the soil. Rotating with nitrogen-fixing cover crops will naturally enrich your fields without heavy chemical costs.`,
    };
  }

  // DEFAULT SUMMARY
  if (isBangla) {
    return {
      sourceTag,
      text: `📍 **নির্বাচিত এলাকা (${fieldName}):** ${locDisplay}\n🌡️ **তাপমাত্রা:** ${tempTextBn} | 🌧️ **বৃষ্টিপাত:** ${rainTextBn}\n\n🌟 **আপনার খামারের সারসংক্ষেপ:**\nফসলের স্বাস্থ্য স্কোর **${healthScore}/100**। আপনি সেচ, সার, আবহাওয়া বা কোন ফসল চাষ করবেন তা নিয়ে যেকোনো প্রশ্ন করতে পারেন।`,
    };
  }

  return {
    sourceTag,
    text: `📍 **Selected Location (${fieldName}):** ${locDisplay}\n🌡️ **Temperature:** ${tempTextEn} | 🌧️ **Rainfall:** ${rainTextEn}\n\n🌟 **Field Summary:**\nField health score is **${healthScore}/100**. Ask me anything about irrigation, fertilizer, weather, or best crop choices for this land.`,
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
        ? "🛰️ নাসা এআই কৃষি বন্ধু"
        : "🛰️ NASA AI Farm Companion",
      content: isBangla
        ? `নমস্কার! আমি আপনার নাসা এআই কৃষি বন্ধু (${selectedFieldName})। ম্যাপে যেকোনো জমির ওপর ক্লিক করুন এবং আপনার এলাকার আবহাওয়া, সেচ বা ফসল আবর্তন নিয়ে যেকোনো প্রশ্ন করুন।`
        : `Hello! I am your NASA AI Farm Companion for ${selectedFieldName}. Click anywhere on the global map and ask me about local weather, irrigation, or crop rotation for your farm.`,
    },
  ]);

  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [locationName, setLocationName] = useState<string>("");
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Fetch location name when lat/lon changes
  useEffect(() => {
    let active = true;
    fetchLocationName(lat, lon).then((name) => {
      if (active && name) setLocationName(name);
    });
    return () => {
      active = false;
    };
  }, [lat, lon]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Stop speech when component unmounts
  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  function handleSpeak(textToSpeak: string, msgId: string) {
    if (!("speechSynthesis" in window)) {
      alert("Voice reply is not supported in your browser.");
      return;
    }

    const synth = window.speechSynthesis;

    if (speakingMessageId === msgId) {
      synth.cancel();
      setSpeakingMessageId(null);
      return;
    }

    synth.cancel();
    const cleanText = textToSpeak.replace(/[*#_📍🌡️🌧️💧🌾🌱🌟🛰️]/g, "");
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = isBangla ? "bn-BD" : "en-US";
    utterance.rate = 0.95;

    utterance.onend = () => {
      setSpeakingMessageId(null);
    };

    utterance.onerror = () => {
      setSpeakingMessageId(null);
    };

    setSpeakingMessageId(msgId);
    synth.speak(utterance);
  }

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
      let activeTelemetry = liveTelemetry;
      if (
        !activeTelemetry ||
        (activeTelemetry.temp === undefined &&
          activeTelemetry.rainfall === undefined)
      ) {
        activeTelemetry = await fetchGlobalNASATelemetry(lat, lon);
      }

      const reply = generateFarmerFriendlyAdvice(
        query,
        lat,
        lon,
        locationName,
        selectedFieldName,
        activeTelemetry,
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
        "এখন কি জমিতে সেচ দেওয়া দরকার?",
        "মাটির উর্বরতা ও স্বাস্থ্য কীভাবে বাড়াবো?",
      ]
    : [
        "What is the best crop rotation here?",
        "Do I need irrigation right now?",
        "How can I improve soil health?",
      ];

  const locDisplayString = locationName
    ? `${locationName} (${lat.toFixed(2)}°, ${lon.toFixed(2)}°)`
    : `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`;

  return (
    <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-emerald-50/60 px-5 py-4 sm:px-6">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
            {isBangla ? "নাসা এআই কৃষি বন্ধু" : "NASA AI Farm Companion"}
          </p>
          <h3 className="mt-0.5 text-base font-black text-slate-900 sm:text-lg">
            {isBangla ? "আপনার জমির যেকোনো প্রশ্ন করুন" : "Ask About Your Farm & Crops"}
          </h3>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-1.5 text-xs font-bold text-emerald-900 shadow-sm">
          <span>📍</span>
          <span className="max-w-[220px] truncate">{locDisplayString}</span>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="max-h-[360px] space-y-4 overflow-y-auto p-5 sm:p-6">
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
              className={`relative max-w-[90%] whitespace-pre-line rounded-2xl px-4 py-3.5 text-sm leading-6 shadow-sm ${
                msg.role === "user"
                  ? "bg-emerald-600 font-medium text-white"
                  : "border border-slate-200/80 bg-slate-50 text-slate-900"
              }`}
            >
              {msg.content}

              {/* Voice Read Aloud Button for Assistant Messages */}
              {msg.role === "assistant" && (
                <div className="mt-3 flex items-center justify-end border-t border-slate-200/60 pt-2">
                  <button
                    type="button"
                    onClick={() => handleSpeak(msg.content, msg.id)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold transition ${
                      speakingMessageId === msg.id
                        ? "bg-amber-500 text-white shadow-sm"
                        : "bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50"
                    }`}
                  >
                    <span>{speakingMessageId === msg.id ? "⏹️" : "🔊"}</span>
                    <span>
                      {speakingMessageId === msg.id
                        ? isBangla
                          ? "বন্ধ করুন"
                          : "Stop Audio"
                        : isBangla
                        ? "শুনে নিন (Listen)"
                        : "Listen Voice Reply"}
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-600">
            <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-600" />
            <span>
              {isBangla
                ? "নাসা স্যাটেলাইট উপাত্ত বিশ্লেষণ করা হচ্ছে..."
                : "Analyzing NASA satellite observations..."}
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
            className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 transition hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-900 shadow-sm"
          >
            🌱 {prompt}
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
              ? `${locationName || selectedFieldName} সম্পর্কে প্রশ্ন লিখুন...`
              : `Ask about ${locationName || selectedFieldName}...`
          }
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none"
        />
        <button
          type="submit"
          disabled={isTyping || !input.trim()}
          className="shrink-0 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-black text-white transition hover:bg-emerald-700 disabled:opacity-50 shadow-sm"
        >
          {isBangla ? "জিজ্ঞেস করুন" : "Ask"}
        </button>
      </form>
    </div>
  );
}