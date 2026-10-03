import type { RotationRecommendation } from "../../types/recommendation";

interface RecommendationReasonProps {
  recommendation: RotationRecommendation;
}

export default function RecommendationReason({
  recommendation,
}: RecommendationReasonProps) {
  const reasons = buildReasons(recommendation);

  return (
    <details className="group mt-5 border-t border-slate-100 pt-5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-slate-800">
            Why this rotation?
          </p>

          <p className="mt-1 text-xs text-slate-400">
            See what influenced the recommendation
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
      title: "Uses water efficiently",
      description:
        "This rotation has a strong water-conservation score for your field.",
      icon: "💧",
      iconBg: "bg-blue-100",
    });
  } else {
    reasons.push({
      title: "Water use considered",
      description:
        "Water conservation is included in the recommendation for your field.",
      icon: "💧",
      iconBg: "bg-blue-100",
    });
  }

  if (soil >= 0.7) {
    reasons.push({
      title: "Supports soil health",
      description:
        "This rotation has a strong soil-health score.",
      icon: "🌱",
      iconBg: "bg-green-100",
    });
  } else {
    reasons.push({
      title: "Soil health considered",
      description:
        "The rotation was evaluated using your field's soil conditions.",
      icon: "🌱",
      iconBg: "bg-green-100",
    });
  }

  if (climate >= 0.7) {
    reasons.push({
      title: "Better climate resilience",
      description:
        "The rotation performs well against changing environmental conditions.",
      icon: "☀️",
      iconBg: "bg-amber-100",
    });
  }

  if (diversity >= 0.7) {
    reasons.push({
      title: "Adds crop diversity",
      description:
        "The crop sequence contributes strongly to crop diversity.",
      icon: "🌾",
      iconBg: "bg-purple-100",
    });
  }

  if (reasons.length < 3) {
    reasons.push({
      title: "Matched to your priorities",
      description:
        "The recommendation combines your selected farming priorities with field conditions.",
      icon: "✓",
      iconBg: "bg-slate-200",
    });
  }

  return reasons.slice(0, 4);
}