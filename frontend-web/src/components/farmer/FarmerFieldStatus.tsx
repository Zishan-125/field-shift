export type FieldStatus = "good" | "moderate" | "attention" | "unknown";

interface Props {
  soilStatus: FieldStatus;
  waterStatus: FieldStatus;
  climateStatus: FieldStatus;
  fieldName?: string;
  language?: "bn" | "en";
}

const statusText = {
  bn: {
    good: "ভালো আছে",
    moderate: "নজরে রাখুন",
    attention: "বিশেষ নজর দিন",
    unknown: "তথ্য নেই",
  },
  en: {
    good: "Looking good",
    moderate: "Keep an eye on it",
    attention: "Needs attention",
    unknown: "No reading",
  },
} as const;

const verdictText = {
  bn: {
    good: {
      title: "মাঠের সংকেত স্থিতিশীল",
      line: "পানি, মাটি ও আবহাওয়ার পাওয়া সংকেতগুলো এখন পর্যন্ত ভালো অবস্থায় আছে।",
    },
    moderate: {
      title: "কিছু সংকেত নজরে রাখা দরকার",
      line: "মাঠের কিছু অবস্থা পরিবর্তনের সাথে নজরে রাখা ভালো।",
    },
    attention: {
      title: "কিছু সংকেতে বেশি নজর দরকার",
      line: "পাওয়া সংকেতগুলো এখনই ঘনিষ্ঠ নজরদারির কথা বলছে।",
    },
    unknown: {
      title: "মাঠের তথ্য এখনো আসেনি",
      line: "মাটি, পানি বা আবহাওয়ার তথ্য পাওয়া গেলে এখানে অবস্থা দেখানো হবে।",
    },
    missing: (count: number) =>
      `এর মধ্যে ${count}টি সংকেতের তথ্য এখনো পাওয়া যায়নি।`,
    labels: {
      soil: "মাটি",
      water: "পানি",
      climate: "আবহাওয়া",
    },
  },
  en: {
    good: {
      title: "Field signals look stable",
      line: "The available soil, water and weather signals currently look stable.",
    },
    moderate: {
      title: "Some signals need watching",
      line: "Some field conditions are worth monitoring as they change.",
    },
    attention: {
      title: "Some signals need attention",
      line: "The available signals suggest that closer monitoring is useful.",
    },
    unknown: {
      title: "No field readings yet",
      line: "Soil, water and weather status will appear here once readings are available.",
    },
    missing: (count: number) =>
      `${count} ${count === 1 ? "signal has" : "signals have"} no readings yet.`,
    labels: {
      soil: "Soil",
      water: "Water",
      climate: "Weather",
    },
  },
} as const;

export default function FarmerFieldStatus({
  soilStatus,
  waterStatus,
  climateStatus,
  fieldName,
  language = "bn",
}: Props) {
  const copy = verdictText[language];

  const statuses: FieldStatus[] = [soilStatus, waterStatus, climateStatus];

  const attentionCount = statuses.filter(
    (status) => status === "attention",
  ).length;

  const moderateCount = statuses.filter(
    (status) => status === "moderate",
  ).length;

  const unknownCount = statuses.filter(
    (status) => status === "unknown",
  ).length;

  const overall: FieldStatus =
    unknownCount === statuses.length
      ? "unknown"
      : attentionCount > 0
        ? "attention"
        : moderateCount > 0
          ? "moderate"
          : "good";

  const line =
    overall !== "unknown" && unknownCount > 0
      ? `${copy[overall].line} ${copy.missing(unknownCount)}`
      : copy[overall].line;

  const signals: Array<{
    key: "soil" | "water" | "climate";
    status: FieldStatus;
  }> = [
    { key: "soil", status: soilStatus },
    { key: "water", status: waterStatus },
    { key: "climate", status: climateStatus },
  ];

  return (
    <section className="fs-verdict" aria-labelledby="field-verdict">
      <div>
        <h2 id="field-verdict" className="fs-verdict-title">
          {fieldName ? <span className="fs-sr-only">{fieldName}: </span> : null}
          {copy[overall].title}
        </h2>

        <p className="fs-verdict-line">{line}</p>
      </div>

      <dl className="fs-signals">
        {signals.map((signal) => (
          <div
            key={signal.key}
            className="fs-signal"
            data-state={signal.status}
          >
            <dt>{copy.labels[signal.key]}</dt>
            <dd>{statusText[language][signal.status]}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
