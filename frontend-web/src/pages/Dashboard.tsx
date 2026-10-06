import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getHealth,
  getField,
  getEnvironment,
  getSoil,
  getRecommendations,
  getCrops,
} from "../services/api";

import type { Field } from "../types/field";

import type {
  Environment,
} from "../types/environment";

import type {
  SoilProfile,
} from "../types/soil";

import {
  DEFAULT_PRIORITIES,
} from "../types/farmer";

import type {
  FarmerPriorities,
} from "../types/farmer";

import type {
  RecommendationResponse,
  RotationRecommendation,
} from "../types/recommendation";

import type {
  Crop,
  NormalizedCrop,
} from "../types/crop";

import FarmerHeader from "../components/farmer/FarmerHeader";
import FarmerFieldStatus from "../components/farmer/FarmerFieldStatus";
import FarmerSoilView from "../components/farmer/FarmerSoilView";
import EarthObservationContext from "../components/farmer/EarthObservationContext";
import WeatherSummary from "../components/farmer/WeatherSummary";
import EnvironmentSummary from "../components/farmer/EnvironmentSummary";
import FarmerGoalSelector from "../components/farmer/FarmerGoalSelector";
import RecommendationList from "../components/farmer/RecommendationList";
import CropSelector from "../components/farmer/CropSelector";
import LanguageSwitcher from "../components/farmer/LanguageSwitcher";

import SectionTitle from "../components/common/SectionTitle";

import bn from "../i18n/bn";
import en from "../i18n/en";

import type {
  Language,
} from "../components/farmer/LanguageSwitcher";

const FIELD_ID =
  import.meta.env.VITE_FIELD_ID ||
  "426e9d97-78cf-45d2-82ae-8131040b5ee7";

function getObject(
  data: unknown,
  ...keys: string[]
): Record<string, unknown> {
  for (const key of keys) {
    if (
      data &&
      typeof data === "object" &&
      key in data
    ) {
      const value = (
        data as Record<
          string,
          unknown
        >
      )[key];

      if (
        value &&
        typeof value === "object"
      ) {
        return value as Record<
          string,
          unknown
        >;
      }
    }
  }

  if (
    data &&
    typeof data === "object"
  ) {
    return data as Record<
      string,
      unknown
    >;
  }

  return {};
}

function getApiErrorMessage(
  error: unknown,
  fallback: string,
): string {
  const errorObject =
    error as {
      response?: {
        data?: {
          detail?: string;
          message?: string;
        };
      };
      message?: string;
    };

  return (
    errorObject?.response?.data
      ?.detail ||
    errorObject?.response?.data
      ?.message ||
    errorObject?.message ||
    fallback
  );
}

function calculateSoilStatus(
  soil: SoilProfile,
): "good" | "moderate" | "attention" {
  const ph = Number(
    soil["soil_ph_0-5cm"],
  );

  if (!Number.isFinite(ph)) {
    return "moderate";
  }

  if (ph >= 5.5 && ph <= 7.5) {
    return "good";
  }

  if (ph >= 5 && ph <= 8) {
    return "moderate";
  }

  return "attention";
}

function calculateWaterStatus(
  environment: Environment,
): "good" | "moderate" | "attention" {
  const precipitation = Number(
    environment.precipitation ??
      environment.rainfall ??
      environment.gpm_precipitation,
  );

  if (!Number.isFinite(precipitation)) {
    return "moderate";
  }

  return precipitation > 0
    ? "moderate"
    : "attention";
}

function calculateClimateStatus(
  environment: Environment,
): "good" | "moderate" | "attention" {
  const temperature = Number(
    environment.power_temperature_mean,
  );

  if (!Number.isFinite(temperature)) {
    return "moderate";
  }

  return temperature >= 10 &&
    temperature <= 35
    ? "good"
    : "moderate";
}

function normalizeCrop(
  crop: Crop,
  index: number,
): NormalizedCrop {
  const englishName = String(
    crop.english_name ??
      crop.name_en ??
      crop.crop_name ??
      crop.name ??
      "",
  ).trim();

  const banglaName = String(
    crop.bangla_name ??
      crop.bengali_name ??
      crop.name_bn ??
      "",
  ).trim();

  const id = String(
    (crop.id ??
      crop.crop_id ??
      englishName) ||
      `crop-${index}`,
  );

  return {
    id,
    englishName:
      englishName ||
      `Crop ${index + 1}`,
    banglaName:
      banglaName ||
      englishName ||
      `ফসল ${index + 1}`,
    icon: String(
      crop.icon ??
        crop.emoji ??
        "🌱",
    ),
  };
}

function extractCrops(
  data: unknown,
): NormalizedCrop[] {
  const raw =
    getObject(
      data,
      "crops",
      "data",
      "results",
    );

  const candidates: unknown[] =
    Array.isArray(data)
      ? data
      : Array.isArray(raw)
        ? raw
        : [];

  return candidates
    .filter(
      (item): item is Crop =>
        Boolean(
          item &&
            typeof item ===
              "object",
        ),
    )
    .map(normalizeCrop);
}

function cropTokens(
  recommendation: RotationRecommendation,
): string[] {
  return [
    recommendation.crop_1_name,
    recommendation.crop_2_name,
    recommendation.crop_3_name,
  ]
    .filter(
      (
        value,
      ): value is string =>
        Boolean(value),
    )
    .map((value) =>
      value
        .trim()
        .toLowerCase(),
    );
}

function matchesSelectedCrops(
  recommendation: RotationRecommendation,
  selectedCrops: NormalizedCrop[],
): boolean {
  if (selectedCrops.length === 0) {
    return true;
  }

  const rotationCrops =
    cropTokens(
      recommendation,
    );

  if (rotationCrops.length === 0) {
    return false;
  }

  const selectedNames =
    selectedCrops.flatMap(
      (crop) => [
        crop.englishName
          .trim()
          .toLowerCase(),

        crop.banglaName
          .trim()
          .toLowerCase(),
      ],
    );

  /*
   * A rotation matches when at least one
   * crop in that rotation is among the
   * farmer's selected crops.
   *
   * This keeps the farmer from having
   * to inspect all scenarios.
   */
  return rotationCrops.some(
    (crop) =>
      selectedNames.includes(
        crop,
      ),
  );
}

export default function Dashboard() {
  const [language, setLanguage] =
    useState<Language>(() => {
      const stored =
        window.localStorage.getItem(
          "field-shift-language",
        );

      return stored === "en"
        ? "en"
        : "bn";
    });

  const t =
    language === "bn"
      ? bn
      : en;

  /*
   * Normalize recommendation labels here.
   *
   * This avoids TypeScript errors when the
   * translation files do not yet expose the
   * optional recommendation labels.
   */
  const recommendationLabels = {
    selectedCropFilter:
      "selectedCropFilter" in
      t.recommendations
        ? String(
            (
              t.recommendations as Record<
                string,
                unknown
              >
            )
              .selectedCropFilter ??
              (
                language === "bn"
                  ? "নির্বাচিত ফসল"
                  : "Selected crops"
              ),
          )
        : language === "bn"
          ? "নির্বাচিত ফসল"
          : "Selected crops",

    title:
      t.recommendations.title,

    subtitle:
      "subtitle" in
      t.recommendations
        ? String(
            (
              t.recommendations as Record<
                string,
                unknown
              >
            ).subtitle ??
              (
                language === "bn"
                  ? "আপনার অগ্রাধিকার অনুযায়ী সম্ভাব্য ফসল পরিকল্পনা"
                  : "Recommended crop plans based on your priorities"
              ),
          )
        : language === "bn"
          ? "আপনার অগ্রাধিকার অনুযায়ী সম্ভাব্য ফসল পরিকল্পনা"
          : "Recommended crop plans based on your priorities",

    scenarios:
      "scenarios" in
      t.recommendations
        ? String(
            (
              t.recommendations as Record<
                string,
                unknown
              >
            ).scenarios ??
              (
                language === "bn"
                  ? "সম্ভাব্য পরিকল্পনা"
                  : "Possible plans"
              ),
          )
        : language === "bn"
          ? "সম্ভাব্য পরিকল্পনা"
          : "Possible plans",

    noMatch:
      t.recommendations.noMatch,

    changeCrops:
      t.recommendations.changeCrops,
  };

  const [field, setField] =
    useState<Field | null>(
      null,
    );

  const [
    environment,
    setEnvironment,
  ] = useState<Environment | null>(
    null,
  );

  const [soil, setSoil] =
    useState<SoilProfile | null>(
      null,
    );

  const [
    recommendations,
    setRecommendations,
  ] =
    useState<RecommendationResponse | null>(
      null,
    );

  const [priorities, setPriorities] =
    useState<FarmerPriorities>({
      ...DEFAULT_PRIORITIES,
    });

  const [crops, setCrops] =
    useState<NormalizedCrop[]>(
      [],
    );

  const [
    selectedCropIds,
    setSelectedCropIds,
  ] = useState<string[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [
    recommendationLoading,
    setRecommendationLoading,
  ] = useState(false);

  const [error, setError] =
    useState("");

  const [
    recommendationUpdated,
    setRecommendationUpdated,
  ] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(
      "field-shift-language",
      language,
    );
  }, [language]);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      try {
        setLoading(true);
        setError("");

        await getHealth();

        const [
          fieldData,
          environmentData,
          soilData,
          recommendationData,
          cropData,
        ] = await Promise.all([
          getField(FIELD_ID),

          getEnvironment(
            FIELD_ID,
          ),

          getSoil(
            FIELD_ID,
          ),

          getRecommendations(
            FIELD_ID,
            DEFAULT_PRIORITIES,
          ),

          getCrops(),
        ]);

        if (!active) {
          return;
        }

        setField(
          getObject(
            fieldData,
            "field",
          ) as Field,
        );

        setEnvironment(
          getObject(
            environmentData,
            "environment",
            "data",
          ) as Environment,
        );

        setSoil(
          getObject(
            soilData,
            "soil",
            "profile",
            "data",
          ) as SoilProfile,
        );

        setRecommendations(
          recommendationData,
        );

        setCrops(
          extractCrops(
            cropData,
          ),
        );
      } catch (err: unknown) {
        console.error(
          "FIELD SHIFT dashboard load failed:",
          err,
        );

        if (!active) {
          return;
        }

        setError(
          getApiErrorMessage(
            err,
            language === "bn"
              ? "FIELD SHIFT-এর স্থানীয় backend-এর সাথে সংযোগ করা যাচ্ছে না।"
              : "Unable to connect to the FIELD SHIFT local backend.",
          ),
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      active = false;
    };
  }, []);

  async function updateRecommendations(): Promise<boolean> {
    if (recommendationLoading) {
      return false;
    }

    if (
      selectedCropIds.length ===
      0
    ) {
      setError(
        language === "bn"
          ? "অন্তত একটি ফসল নির্বাচন করুন।"
          : "Please select at least one crop.",
      );

      return false;
    }

    try {
      setRecommendationLoading(
        true,
      );

      setError("");

      setRecommendationUpdated(
        false,
      );

      const data =
        await getRecommendations(
          FIELD_ID,
          priorities,
        );

      setRecommendations(
        data,
      );

      setRecommendationUpdated(
        true,
      );

      window.setTimeout(() => {
        document
          .getElementById(
            "recommendations",
          )
          ?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
      }, 120);

      return true;
    } catch (err: unknown) {
      console.error(
        "FIELD SHIFT recommendation update failed:",
        err,
      );

      setError(
        getApiErrorMessage(
          err,
          language === "bn"
            ? "পরিকল্পনা আপডেট করা যায়নি।"
            : "Unable to update recommendations.",
        ),
      );

      return false;
    } finally {
      setRecommendationLoading(
        false,
      );
    }
  }

  const selectedCrops =
    useMemo(
      () =>
        crops.filter((crop) =>
          selectedCropIds.includes(
            crop.id,
          ),
        ),
      [
        crops,
        selectedCropIds,
      ],
    );

  const recommendationResults =
    useMemo<
      RotationRecommendation[]
    >(
      () => {
        if (
          !Array.isArray(
            recommendations?.results,
          )
        ) {
          return [];
        }

        return recommendations.results.filter(
          (recommendation) =>
            matchesSelectedCrops(
              recommendation,
              selectedCrops,
            ),
        );
      },
      [
        recommendations,
        selectedCrops,
      ],
    );

  const currentSoil =
    soil || {};

  const currentEnvironment =
    environment || {};

  const soilStatus =
    calculateSoilStatus(
      currentSoil,
    );

  const waterStatus =
    calculateWaterStatus(
      currentEnvironment,
    );

  const climateStatus =
    calculateClimateStatus(
      currentEnvironment,
    );

  const selectedCropNames =
    selectedCrops.map(
      (crop) =>
        language === "bn"
          ? crop.banglaName
          : crop.englishName,
    );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="px-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-green-50">
            <div className="h-7 w-7 animate-spin rounded-full border-4 border-green-100 border-t-green-600" />
          </div>

          <p className="mt-5 text-sm font-black text-slate-800">
            {t.common.loading} FIELD SHIFT...
          </p>

          <p className="mt-1 text-xs text-slate-400">
            {language === "bn"
              ? "আপনার মাঠের স্থানীয় তথ্য পড়া হচ্ছে"
              : "Reading your local farm data"}
          </p>
        </div>
      </div>
    );
  }

  if (error && !field) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-lg rounded-[2rem] border border-red-200 bg-white p-7 shadow-sm sm:p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-xl">
            ⚠️
          </div>

          <p className="mt-5 text-[10px] font-black uppercase tracking-[0.18em] text-red-600">
            {language === "bn"
              ? "সংযোগ সমস্যা"
              : "Connection problem"}
          </p>

          <h1 className="mt-2 text-2xl font-black text-slate-900">
            {language === "bn"
              ? "FIELD SHIFT চালু করা যায়নি"
              : "FIELD SHIFT could not load"}
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-600">
            {error}
          </p>

          <button
            type="button"
            onClick={() =>
              window.location.reload()
            }
            className="fs-primary-button mt-5 w-full"
          >
            {language === "bn"
              ? "↻ আবার চেষ্টা করুন"
              : "↻ Try again"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="fs-page">
      <div className="fs-container pt-4">
        <div className="flex justify-end">
          <LanguageSwitcher
            language={language}
            onChange={setLanguage}
          />
        </div>
      </div>

      <FarmerHeader
        fieldName={
          field?.name ||
          "Feni Test Plot"
        }
      />

      <section className="fs-container py-6 sm:py-8 lg:py-10">

        {/* =====================================================
            1. FARMER-FIRST FIELD STATUS
        ====================================================== */}

        <section className="fs-section">
          <FarmerFieldStatus
            soilStatus={
              soilStatus
            }
            waterStatus={
              waterStatus
            }
            climateStatus={
              climateStatus
            }
            language={
              language
            }
          />
        </section>

        {/* =====================================================
            2. SIMPLE FIELD ENVIRONMENT
        ====================================================== */}

        <section className="fs-section">
          <SectionTitle
            eyebrow={
              language === "bn"
                ? "মাঠের অবস্থা"
                : "Field environment"
            }
            title={
              language === "bn"
                ? "আজকের মাঠের পরিবেশ"
                : "Today's field environment"
            }
            description={
              language === "bn"
                ? "মাঠের জন্য পাওয়া প্রধান পরিবেশগত তথ্য এক নজরে দেখুন।"
                : "See the main environmental signals available for your field at a glance."
            }
          />

          <div className="mt-5 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
            <div className="p-5 sm:p-6">
              <WeatherSummary
                environment={
                  currentEnvironment
                }
              />

              <div className="mt-4">
                <EnvironmentSummary
                  environment={
                    currentEnvironment
                  }
                />
              </div>
            </div>
          </div>

          {/* NASA / Earth observation anchor */}
          <div
            id="earth-observations"
            className="mt-4 scroll-mt-6"
          >
            <EarthObservationContext
              data={
                currentEnvironment
              }
              language={
                language
              }
            />
          </div>
        </section>

        {/* =====================================================
            3. SOIL
        ====================================================== */}

        <section className="fs-section">
          <FarmerSoilView
            soil={currentSoil}
            language={
              language
            }
          />
        </section>

        {/* =====================================================
            4. CROP SELECTION
        ====================================================== */}

        <section className="fs-section">
          <CropSelector
            crops={crops}
            selectedCrops={
              selectedCropIds
            }
            onChange={
              setSelectedCropIds
            }
            language={
              language
            }
          />
        </section>

        {/* =====================================================
            5. FARMER PRIORITIES
        ====================================================== */}

        <section className="fs-section">
          <FarmerGoalSelector
            priorities={
              priorities
            }
            onChange={
              setPriorities
            }
            onApply={
              updateRecommendations
            }
            loading={
              recommendationLoading
            }
            language={
              language
            }
          />

          {recommendationLoading && (
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-100 border-t-blue-600" />
              </div>

              <div>
                <p className="text-sm font-black text-blue-900">
                  {
                    t.status
                      .updating
                  }
                </p>

                <p className="mt-0.5 text-xs text-blue-800/70">
                  {
                    t.status
                      .comparing
                  }
                </p>
              </div>
            </div>
          )}

          {recommendationUpdated &&
            !recommendationLoading && (
              <div
                className="mt-4 flex items-center gap-3 rounded-2xl border border-green-100 bg-green-50 p-4"
                role="status"
                aria-live="polite"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-green-600 shadow-sm">
                  ✓
                </div>

                <div>
                  <p className="text-sm font-black text-green-900">
                    {
                      t.status
                        .updated
                    }
                  </p>

                  <p className="mt-0.5 text-xs text-green-800/70">
                    {language ===
                    "bn"
                      ? "আপনার ফসল এবং অগ্রাধিকার অনুযায়ী ফলাফল তৈরি হয়েছে।"
                      : "The results now reflect your selected crops and priorities."}
                  </p>
                </div>
              </div>
            )}

          {error && field && (
            <div
              className="mt-4 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4"
              role="alert"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-red-600">
                ⚠️
              </div>

              <div>
                <p className="text-sm font-black text-red-800">
                  {
                    t.status
                      .error
                  }
                </p>

                <p className="mt-1 text-xs leading-5 text-red-700/80">
                  {error}
                </p>
              </div>
            </div>
          )}
        </section>

        {/* =====================================================
            6. RECOMMENDATIONS
        ====================================================== */}

        <section
          id="recommendations"
          className="fs-section scroll-mt-6"
        >
          <div className="mb-5 rounded-[2rem] border border-green-100 bg-green-50 p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-green-600">
                  {
                    recommendationLabels.selectedCropFilter
                  }
                </p>

                <h2 className="mt-2 text-xl font-black text-green-950 sm:text-2xl">
                  {
                    recommendationLabels.title
                  }
                </h2>

                <p className="mt-2 text-sm leading-6 text-green-900/70">
                  {
                    recommendationLabels.subtitle
                  }
                </p>
              </div>

              <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                <p className="text-2xl font-black text-green-700">
                  {
                    recommendationResults.length
                  }
                </p>

                <p className="text-[10px] font-black uppercase tracking-wide text-green-600">
                  {
                    recommendationLabels.scenarios
                  }
                </p>
              </div>
            </div>

            {selectedCropNames.length >
              0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {selectedCropNames.map(
                  (name) => (
                    <span
                      key={name}
                      className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-green-800 shadow-sm"
                    >
                      🌱 {name}
                    </span>
                  ),
                )}
              </div>
            )}
          </div>

          {recommendationResults.length >
          0 ? (
            <RecommendationList
              recommendations={
                recommendationResults
              }
              priorities={
                priorities
              }
              maxItems={3}
              language={
                language
              }
              crops={crops}
            />
          ) : (
            <div className="rounded-[2rem] border border-amber-200 bg-amber-50 p-6 text-center">
              <div className="text-4xl">
                🌱
              </div>

              <h3 className="mt-3 text-lg font-black text-amber-950">
                {
                  recommendationLabels.noMatch
                }
              </h3>

              <p className="mt-2 text-sm text-amber-900/70">
                {
                  recommendationLabels.changeCrops
                }
              </p>
            </div>
          )}
        </section>

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
                    recommendations?.scenario_count ??
                    0
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
      </section>
    </main>
  );
}