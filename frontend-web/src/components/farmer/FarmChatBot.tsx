import { useState, useRef, useEffect } from "react";

interface Message {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: string;
  isOffline?: boolean;
}

interface FarmChatBotProps {
  isBangla?: boolean;
  selectedFieldName?: string;
  cropHealthScore?: number;
}

export default function FarmChatBot({
  isBangla = false,
  selectedFieldName = "Feni Test Plot",
  cropHealthScore = 82,
}: FarmChatBotProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      sender: "ai",
      text: isBangla
        ? `নমস্কার! আমি আপনার এগ্রিকালচারাল এআই অ্যাসিস্ট্যান্ট। ${selectedFieldName} সম্পর্কে যেকোনো প্রশ্ন করতে পারেন (অনলাইন ও অফলাইন উভয় মোডে সচল)।`
        : `Hello! I am your FieldShift Agricultural Assistant. Ask me anything about ${selectedFieldName} (active online & offline).`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState("");
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [loading, setLoading] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Monitor network connectivity status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Offline intelligent rule-based fallback response engine
  const getOfflineResponse = (query: string): string => {
    const q = query.toLowerCase();
    if (isBangla) {
      if (q.includes("সার") || q.includes("fertilizer") || q.includes("ইউরিয়া")) {
        return `[অফলাইন মোড] ${selectedFieldName}-এর জন্য ইউরিয়া এবং টিএসপি সার পরিমিত পরিমাণে ব্যবহার করুন। বর্তমান স্বাস্থ্য স্কোর ${cropHealthScore}/100-এর জন্য মাটির আর্দ্রতা পরীক্ষা করে সেচ দিন।`;
      }
      if (q.includes("পোকা") || q.includes("pest") || q.includes("disease") || q.includes("রোগ")) {
        return `[অফলাইন মোড] পোকামাকড়ের আক্রমণ রোধে জৈব বালাইনাশক বা অনুমোদিত কীটনাশক ব্যবহার করুন। পাতা হলুদ হলে নাইট্রোজেনের ঘাটতি হতে পারে।`;
      }
      if (q.includes("মাটি") || q.includes("soil") || q.includes("quality")) {
        return `[অফলাইন মোড] ${selectedFieldName}-এর মাটির মান উন্নয়নে জৈব সার প্রয়োগ করুন এবং ড্রেনেজ ব্যবস্থা উন্নত রাখুন।`;
      }
      return `[অফলাইন মোড] আপনার প্রশ্নটি নথিভুক্ত করা হয়েছে। ${selectedFieldName}-এর স্বাস্থ্য স্কোর বর্তমানে ${cropHealthScore}/100। ইন্টারনেট সংযোগ আসলে বা সঠিক ব্যাকএন্ড রাউটে যুক্ত হলে রিয়েল-টাইম এআই পরামর্শ পাবেন।`;
    } else {
      if (q.includes("fertilizer") || q.includes("urea") || q.includes("soil")) {
        return `[Offline Mode] For ${selectedFieldName} (Health: ${cropHealthScore}/100), apply balanced NPK fertilizers based on soil testing. Avoid over-irrigation.`;
      }
      if (q.includes("pest") || q.includes("disease") || q.includes("bug")) {
        return `[Offline Mode] Inspect leaf undersides for aphid activity. Apply organic neem oil or recommended safe pesticides if needed.`;
      }
      return `[Offline Mode] Local advisory cache active for ${selectedFieldName}. Health score is ${cropHealthScore}/100. Connect your live API endpoint for full generative insights.`;
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userText = input.trim();
    const userMsg: Message = {
      id: Date.now().toString(),
      sender: "user",
      text: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    if (!isOnline) {
      setTimeout(() => {
        const offlineReply: Message = {
          id: (Date.now() + 1).toString(),
          sender: "ai",
          text: getOfflineResponse(userText),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isOffline: true,
        };
        setMessages((prev) => [...prev, offlineReply]);
        setLoading(false);
      }, 600);
      return;
    }

    try {
      // Replace with your real backend endpoint when live, or fallback cleanly
      const response = await fetch("https://your-backend-api.com/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: userText,
          fieldName: selectedFieldName,
          healthScore: cropHealthScore,
          language: isBangla ? "bn" : "en",
        }),
      });

      if (!response.ok) throw new Error("API failed");

      const data = await response.json();
      const aiReply: Message = {
        id: (Date.now() + 1).toString(),
        sender: "ai",
        text: data.reply || data.answer || (isBangla ? "দুঃখিত, উত্তর পাওয়া যায়নি।" : "Sorry, no response generated."),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isOffline: false,
      };
      setMessages((prev) => [...prev, aiReply]);
    } catch (error) {
      // Graceful fallback to local advisory rule engine if backend URL is unconfigured
      setTimeout(() => {
        const fallbackReply: Message = {
          id: (Date.now() + 1).toString(),
          sender: "ai",
          text: getOfflineResponse(userText),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isOffline: true,
        };
        setMessages((prev) => [...prev, fallbackReply]);
      }, 500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm flex flex-col h-[500px]">
      {/* Chat Header */}
      <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🤖</span>
          <div>
            <h4 className="text-sm font-black">
              {isBangla ? "ফিল্ডশিফট এআই বিশেষজ্ঞ" : "FieldShift AI Agronomist"}
            </h4>
            <p className="text-[10px] text-slate-400">
              {selectedFieldName} • {isBangla ? "স্কোর" : "Health"}: {cropHealthScore}/100
            </p>
          </div>
        </div>

        {/* Online / Offline Indicator Badge */}
        <div className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 ${
          isOnline ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
        }`}>
          <span className={`h-2 w-2 rounded-full ${isOnline ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
          {isOnline ? (isBangla ? "অনলাইন" : "Online") : (isBangla ? "অফলাইন মোড" : "Offline Mode")}
        </div>
      </div>

      {/* Message List Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs shadow-xs ${
                msg.sender === "user"
                  ? "bg-emerald-600 text-white rounded-br-xs"
                  : "bg-white text-slate-800 border border-slate-200/80 rounded-bl-xs"
              }`}
            >
              {msg.isOffline && (
                <span className="block text-[9px] text-amber-600 font-bold mb-0.5">
                  ⚡ {isBangla ? "লোকাল খামার অ্যাডভাইজরি ইঞ্জিন" : "Local Farm Advisory Engine"}
                </span>
              )}
              <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
            </div>
            <span className="text-[9px] text-slate-400 mt-1 px-1">{msg.timestamp}</span>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-2 rounded-2xl text-xs text-slate-500 w-max animate-pulse">
            <span>{isBangla ? "এআই চিন্তা করছে..." : "AI is analyzing..."}</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSend} className="p-3 bg-white border-t border-slate-200/80 flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            isBangla
              ? "আপনার খামার বা ফসল নিয়ে কিছু জিগ্যেস করুন..."
              : "Ask about crop rotation, fertilizers, weather..."
          }
          className="flex-1 bg-slate-100 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
        />
        <button
          type="submit"
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-xs"
        >
          {isBangla ? "পাঠান" : "Send"}
        </button>
      </form>
    </div>
  );
}