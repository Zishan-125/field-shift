type Status = "good" | "moderate" | "attention";

interface Props {
  soilStatus: Status;
  waterStatus: Status;
  climateStatus: Status;
  language?: "bn" | "en";
}

const statusText = {
  bn: {
    good: "ভালো আছে",
    moderate: "নজরে রাখুন",
    attention: "বিশেষ নজর দিন",
  },
  en: {
    good: "Looking good",
    moderate: "Keep an eye on it",
    attention: "Needs attention",
  },
} as const;

function StatusItem({
  icon,
  label,
  status,
  description,
  language,
}: {
  icon: string;
  label: string;
  status: Status;
  description: string;
  language: "bn" | "en";
}) {
  const tone =
    status === "good"
      ? "border-emerald-100 bg-emerald-50"
      : status === "attention"
        ? "border-amber-200 bg-amber-50"
        : "border-slate-200 bg-slate-50";

  const badge =
    status === "good"
      ? "bg-white text-emerald-700"
      : status === "attention"
        ? "bg-white text-amber-700"
        : "bg-white text-slate-700";

  return (
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-lg shadow-sm">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-black text-slate-900">{label}</p>
            <span className={`rounded-full px-2 py-1 text-[9px] font-black ${badge}`}>
              {status === "good" ? "✓" : "👀"}
            </span>
          </div>
          <p className="mt-1 text-xs font-bold text-slate-700">
            {statusText[language][status]}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
        </div>
      </div>
    </div>
  );
}

export default function FarmerFieldStatus({
  soilStatus,
  waterStatus,
  climateStatus,
  language = "bn",
}: Props) {
  const t = statusText[language];

  const statuses: Status[] = [
    soilStatus,
    waterStatus,
    climateStatus,
  ];

  const attentionCount = statuses.filter((s) => s === "attention").length;
  const moderateCount = statuses.filter((s) => s === "moderate").length;

  const overall: Status =
    attentionCount > 0
      ? "attention"
      : moderateCount > 0
        ? "moderate"
        : "good";

  const overallCopy: Record<"bn" | "en", Record<Status, string>> = {
    bn: {
      good: "পানি, মাটি ও আবহাওয়ার পাওয়া সংকেতগুলো এখন পর্যন্ত ভালো অবস্থায় আছে।",
      moderate: "কিছু মাঠের অবস্থা পরিবর্তনের সাথে নজরে রাখা ভালো।",
      attention: "কিছু সংকেত বাড়তি নজর দেওয়ার প্রয়োজন দেখাচ্ছে।",
    },
    en: {
      good: "The available soil, water and weather signals currently look stable.",
      moderate: "Some field conditions are worth monitoring as they change.",
      attention: "Some available signals suggest that closer monitoring is useful.",
    },
  };

  const badgeClass =
    overall === "good"
      ? "bg-emerald-50 text-emerald-700"
      : overall === "attention"
        ? "bg-amber-50 text-amber-700"
        : "bg-slate-100 text-slate-700";

  const items: Array<{
    icon: string;
    label: string;
    status: Status;
    description: string;
  }> = [
    {
      icon: "🌱",
      label: language === "bn" ? "মাটি" : "Soil",
      status: soilStatus,
      description:
        language === "bn"
          ? "মাটির পাওয়া তথ্য rotation তুলনায় ব্যবহার করা হয়।"
          : "Available soil information is used when comparing rotations.",
    },
    {
      icon: "💧",
      label: language === "bn" ? "পানি" : "Water",
      status: waterStatus,
      description:
        language === "bn"
          ? "বৃষ্টি ও পানির সংকেত পরিবর্তনের সাথে নজরে রাখা হয়।"
          : "Rainfall and water-related signals are monitored as they change.",
    },
    {
      icon: "☀️",
      label: language === "bn" ? "আবহাওয়া" : "Weather",
      status: climateStatus,
      description:
        language === "bn"
          ? "তাপমাত্রা ও জলবায়ুর সংকেত rotation তুলনায় context দেয়।"
          : "Temperature and climate signals provide context for rotation comparison.",
    },
  ];

  return (
    <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
      <div className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-green-600">
              {language === "bn" ? "আজকের মাঠের অবস্থা" : "Today's field status"}
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
              {language === "bn" ? "আপনার মাঠ কেমন?" : "How is your field?"}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              {language === "bn"
                ? "মাটি, পানি ও আবহাওয়ার পাওয়া প্রধান সংকেতগুলোর একটি সহজ চিত্র।"
                : "A simple view of the main soil, water and weather signals available for your field."}
            </p>
          </div>

          <span className={`w-fit rounded-full px-3 py-2 text-xs font-black ${badgeClass}`}>
            {t[overall]}
          </span>
        </div>

        <div className="mt-5 rounded-2xl bg-slate-50 p-4">
          <div className="flex items-start gap-3">
            <span className="text-xl">{overall === "good" ? "🌱" : "👀"}</span>
            <div>
              <p className="text-sm font-black text-slate-900">{t[overall]}</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                {overallCopy[language][overall]}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {items.map((item) => (
            <StatusItem key={item.label} {...item} language={language} />
          ))}
        </div>

        <p className="mt-4 text-xs leading-5 text-slate-400">
          {language === "bn"
            ? "এগুলো decision-support indicators; crop-specific agronomic diagnosis নয়।"
            : "These are decision-support indicators, not crop-specific agronomic diagnoses."}
        </p>
      </div>
    </section>
  );
}
