import type { RotationRecommendation } from "../../types/recommendation";

interface RecommendationReasonProps {
  recommendation: RotationRecommendation;
  language?: "bn" | "en";
}

export default function RecommendationReason({
  recommendation,
  language = "bn",
}: RecommendationReasonProps) {
  const reasons = buildReasons(
    recommendation,
    language,
  );

  return (
    <details className="group mt-5 border-t border-slate-100 pt-5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-slate-800">
            {language === "bn"
              ? "কেন এই আবর্তন?"
              : "Why this rotation?"}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            {language === "bn"
              ? "কোন বিষয়গুলো এই সুপারিশকে প্রভাবিত করেছে দেখুন"
              : "See what influenced the recommendation"}
          </p>
        </div>

        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition group-open:rotate-180">
          ↓
        </span>
      </summary>

      <div className="mt-4 space-y-2">
        {reasons.map((reason) => (
          <div
            key={reason.title}
            className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3"
          >
            <div
              className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${reason.iconBg}`}
            >
              <span className="text-sm">
                {reason.icon}
              </span>
            </div>

            <div>
              <p className="text-sm font-bold text-slate-800">
                {reason.title}
              </p>

              <p className="mt-0.5 text-xs leading-5 text-slate-500">
                {reason.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}

interface Reason {
  title: string;
  description: string;
  icon: string;
  iconBg: string;
}

function buildReasons(
  recommendation: RotationRecommendation,
  language: "bn" | "en",
): Reason[] {
  const reasons: Reason[] = [];

  const water =
    Number(
      recommendation.water_conservation_score,
    ) || 0;

  const soil =
    Number(
      recommendation.soil_health_score,
    ) || 0;

  const climate =
    Number(
      recommendation.climate_resilience_score,
    ) || 0;

  const diversity =
    Number(
      recommendation.crop_diversity_score,
    ) || 0;

  if (water >= 0.7) {
    reasons.push({
      title:
        language === "bn"
          ? "পানি দক্ষতার সঙ্গে ব্যবহার করে"
          : "Uses water efficiently",
      description:
        language === "bn"
          ? "এই আবর্তনের পানি সংরক্ষণ স্কোর আপনার জমির জন্য ভালো।"
          : "This rotation has a strong water-conservation score for your field.",
      icon: "💧",
      iconBg: "bg-blue-100",
    });
  } else {
    reasons.push({
      title:
        language === "bn"
          ? "পানির ব্যবহার বিবেচনা করা হয়েছে"
          : "Water use considered",
      description:
        language === "bn"
          ? "আপনার জমির জন্য সুপারিশে পানি সংরক্ষণ বিবেচনা করা হয়েছে।"
          : "Water conservation is included in the recommendation for your field.",
      icon: "💧",
      iconBg: "bg-blue-100",
    });
  }

  if (soil >= 0.7) {
    reasons.push({
      title:
        language === "bn"
          ? "মাটির স্বাস্থ্য সমর্থন করে"
          : "Supports soil health",
      description:
        language === "bn"
          ? "এই আবর্তনের মাটির স্বাস্থ্য স্কোর ভালো।"
          : "This rotation has a strong soil-health score.",
      icon: "🌱",
      iconBg: "bg-green-100",
    });
  } else {
    reasons.push({
      title:
        language === "bn"
          ? "মাটির স্বাস্থ্য বিবেচনা করা হয়েছে"
          : "Soil health considered",
      description:
        language === "bn"
          ? "আপনার জমির মাটির অবস্থা ব্যবহার করে এই আবর্তন মূল্যায়ন করা হয়েছে।"
          : "The rotation was evaluated using your field's soil conditions.",
      icon: "🌱",
      iconBg: "bg-green-100",
    });
  }

  if (climate >= 0.7) {
    reasons.push({
      title:
        language === "bn"
          ? "জলবায়ু সহনশীলতা ভালো"
          : "Better climate resilience",
      description:
        language === "bn"
          ? "পরিবর্তিত পরিবেশগত অবস্থার মধ্যে এই আবর্তন ভালোভাবে কাজ করে।"
          : "The rotation performs well against changing environmental conditions.",
      icon: "☀️",
      iconBg: "bg-amber-100",
    });
  }

  if (diversity >= 0.7) {
    reasons.push({
      title:
        language === "bn"
          ? "ফসলের বৈচিত্র্য বাড়ায়"
          : "Adds crop diversity",
      description:
        language === "bn"
          ? "এই ফসলের ক্রম ফসলের বৈচিত্র্যে উল্লেখযোগ্য অবদান রাখে।"
          : "The crop sequence contributes strongly to crop diversity.",
      icon: "🌾",
      iconBg: "bg-purple-100",
    });
  }

  if (reasons.length < 3) {
    reasons.push({
      title:
        language === "bn"
          ? "আপনার অগ্রাধিকারের সঙ্গে সামঞ্জস্যপূর্ণ"
          : "Matched to your priorities",
      description:
        language === "bn"
          ? "এই সুপারিশ আপনার নির্বাচিত কৃষি অগ্রাধিকার ও জমির অবস্থাকে একসঙ্গে বিবেচনা করে।"
          : "The recommendation combines your selected farming priorities with field conditions.",
      icon: "✓",
      iconBg: "bg-slate-200",
    });
  }

  return reasons.slice(0, 4);
}