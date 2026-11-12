type Language = "bn" | "en";

/** "How it works", the decision-support notice and technical details (moved out of Dashboard.tsx). */
export default function AboutSections({ language, patternCount }: { language: Language; patternCount: number }) {
  return (
    <>
      {/* =====================================================
          7. HOW FIELD SHIFT WORKS
      ====================================================== */}

      <section className="fs-section overflow-hidden rounded-[2rem] border border-blue-100 bg-blue-50 p-6 sm:p-7">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">
          {language === "bn"
            ? "FIELD SHIFT কীভাবে কাজ করে"
            : "How FIELD SHIFT works"}
        </p>

        <h2 className="mt-2 text-xl font-black text-blue-950 sm:text-2xl">
          {language === "bn"
            ? "Earth observation থেকে কৃষি সিদ্ধান্ত"
            : "From Earth observations to farm decisions"}
        </h2>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-900/70">
          {language === "bn"
            ? "FIELD SHIFT পরিবেশ, মাটি, ফসল এবং কৃষকের অগ্রাধিকার একসাথে ব্যবহার করে crop rotation-এর সিদ্ধান্তে সহায়তা করে।"
            : "FIELD SHIFT combines environmental, soil, crop and farmer-priority information to support local crop-rotation decisions."}
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [
              "🛰️",
              language === "bn"
                ? "NASA তথ্য"
                : "NASA observations",
              language === "bn"
                ? "NASA Earth data থেকে পরিবেশগত তথ্য।"
                : "Environmental conditions derived from NASA Earth data.",
            ],

            [
              "🌱",
              language === "bn"
                ? "স্থানীয় মাটি"
                : "Local soil",
              language === "bn"
                ? "নির্বাচিত মাঠের মাটির তথ্য।"
                : "Soil information associated with the selected field.",
            ],

            [
              "🌾",
              language === "bn"
                ? "ফসলের বৈশিষ্ট্য"
                : "Crop characteristics",
              language === "bn"
                ? "ফসল ও rotation-এর তথ্য।"
                : "Stored crop and rotation information.",
            ],

            [
              "🎯",
              language === "bn"
                ? "আপনার অগ্রাধিকার"
                : "Your priorities",
              language === "bn"
                ? "আপনার farming goals decision score-কে প্রভাবিত করে।"
                : "Your farming goals influence the decision-support score.",
            ],
          ].map(
            ([
              icon,
              title,
              description,
            ]) => (
              <div
                key={title}
                className="rounded-2xl bg-white/70 p-4"
              >
                <div className="text-2xl">
                  {icon}
                </div>

                <p className="mt-3 text-sm font-black text-blue-950">
                  {title}
                </p>

                <p className="mt-1 text-xs leading-5 text-blue-900/70">
                  {description}
                </p>
              </div>
            ),
          )}
        </div>
      </section>

      {/* =====================================================
          8. NOTICE
      ====================================================== */}

      <section className="fs-section">
        <div className="fs-notice flex items-start gap-3 p-4 sm:p-5">
          <span className="text-base">
            ℹ️
          </span>

          <div>
            <p className="font-black text-slate-700">
              {language === "bn"
                ? "Decision-support তথ্য"
                : "Decision-support information"}
            </p>

            <p className="mt-1">
              {language === "bn"
                ? "FIELD SHIFT crop-rotation scenario তুলনা করতে সাহায্য করে। এর score yield, profit বা farm performance-এর নিশ্চয়তা নয়।"
                : "FIELD SHIFT helps compare available crop-rotation scenarios. Its scores are not guarantees of yield, profit or farm performance."}
            </p>
          </div>
        </div>
      </section>

      {/* =====================================================
          9. TECHNICAL DETAILS
      ====================================================== */}

      <details className="mb-10 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <summary className="cursor-pointer px-6 py-5 text-sm font-black text-slate-800">
          {language === "bn"
            ? "কারিগরি তথ্য"
            : "Technical details"}
        </summary>

        <div className="border-t border-slate-200 p-6">
          <p className="text-sm leading-6 text-slate-500">
            {language === "bn"
              ? "FIELD SHIFT একটি স্থানীয় offline database ব্যবহার করে, যেখানে NASA-derived environmental features, মাটির তথ্য এবং মূল্যায়িত crop-rotation scenario রয়েছে। Recommendation score একটি decision-support score; এটি yield, profit বা irrigation cost-এর সরাসরি পূর্বাভাস নয়।"
              : "FIELD SHIFT uses a local offline database containing NASA-derived environmental features, soil information and evaluated crop-rotation scenarios. The recommendation score is a decision-support score and is not a direct prediction of yield, profit or irrigation cost."}
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-bold text-slate-400">
                {language === "bn"
                  ? "চালানোর ধরন"
                  : "Runtime"}
              </p>

              <p className="mt-1 text-sm font-bold text-slate-800">
                {language === "bn"
                  ? "Offline"
                  : "Offline"}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-bold text-slate-400">
                {language === "bn"
                  ? "Scenario"
                  : "Scenarios"}
              </p>

              <p className="mt-1 text-sm font-bold text-slate-800">
                {
                  patternCount
                }
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-bold text-slate-400">
                {language === "bn"
                  ? "ইন্টারনেট"
                  : "Internet"}
              </p>

              <p className="mt-1 text-sm font-bold text-green-700">
                {language === "bn"
                  ? "প্রয়োজন নেই"
                  : "Not required"}
              </p>
            </div>
          </div>
        </div>
      </details>
    </>
  );
}
