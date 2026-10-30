import { useEffect, useMemo, useState } from "react";

import {
  getHealth,
  getField,
  getEnvironment,
  getSoil,
  getRecommendations,
  getCrops,
} from "../services/api";

import type { Field } from "../types/field";

import type { Environment } from "../types/environment";

import type { SoilProfile } from "../types/soil";

import { DEFAULT_PRIORITIES } from "../types/farmer";

import type { FarmerPriorities } from "../types/farmer";

import type {
  RecommendationResponse,
  RotationRecommendation,
} from "../types/recommendation";

import type { Crop, NormalizedCrop } from "../types/crop";

import FarmerHeader from "../components/farmer/FarmerHeader";
import FarmerHero from "../components/farmer/FarmerHero";
import FarmerFieldStatus from "../components/farmer/FarmerFieldStatus";
import FarmerSoilView from "../components/farmer/FarmerSoilView";
import EarthObservationContext from "../components/farmer/EarthObservationContext";
import WeatherSummary from "../components/farmer/WeatherSummary";
import FarmerGoalSelector from "../components/farmer/FarmerGoalSelector";
import RecommendationList from "../components/farmer/RecommendationList";
import CropSelector from "../components/farmer/CropSelector";

import type { FieldStatus } from "../components/farmer/FarmerFieldStatus";

import type { Language } from "../components/farmer/LanguageSwitcher";

import bn from "../i18n/bn";
import en from "../i18n/en";

const FIELD_ID =
  import.meta.env.VITE_FIELD_ID || "426e9d97-78cf-45d2-82ae-8131040b5ee7";

function getObject(data: unknown, ...keys: string[]): Record<string, unknown> {
  for (const key of keys) {
    if (data && typeof data === "object" && key in data) {
      const value = (data as Record<string, unknown>)[key];

      if (value && typeof value === "object") {
        return value as Record<string, unknown>;
      }
    }
  }

  if (data && typeof data === "object") {
    return data as Record<string, unknown>;
  }

  return {};
}

function getApiErrorMessage(error: unknown, fallback: string): string {
  const errorObject = error as {
    response?: {
      data?: {
        detail?: string;
        message?: string;
      };
    };
    message?: string;
  };

  return (
    errorObject?.response?.data?.detail ||
    errorObject?.response?.data?.message ||
    errorObject?.message ||
    fallback
  );
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function firstNumber(
  source: Record<string, unknown>,
  keys: string[],
): number | null {
  for (const key of keys) {
    const value = toNumber(source[key]);

    if (value !== null) {
      return value;
    }
  }

  return null;
}

function calculateSoilStatus(soil: SoilProfile): FieldStatus {
  const ph = firstNumber(soil, [
    "soil_topsoil_ph",
    "soil_ph_0-5cm",
    "ph",
  ]);

  if (ph === null) {
    return "unknown";
  }

  if (ph >= 5.5 && ph <= 7.5) {
    return "good";
  }

  if (ph >= 5 && ph <= 8) {
    return "moderate";
  }

  return "attention";
}

/*
 * The environment endpoint returns every observed month:
 * { count, period, data: [{ ...one row per month }] }.
 * The newest row feeds the verdict and weather blocks, while
 * the whole series feeds the readings table so it can show change.
 */
function extractEnvironmentRows(data: unknown): Environment[] {
  if (Array.isArray(data)) {
    return data as Environment[];
  }

  if (data && typeof data === "object") {
    const object = data as Record<string, unknown>;

    for (const key of ["data", "rows", "environment"]) {
      if (Array.isArray(object[key])) {
        return object[key] as Environment[];
      }
    }

    return [object as Environment];
  }

  return [];
}

function calculateWaterStatus(environment: Environment): FieldStatus {
  const precipitation = firstNumber(environment, [
    "ag_rainfall_mm",
    "gpm_value",
    "precipitation",
    "rainfall",
    "gpm_precipitation",
  ]);

  if (precipitation === null) {
    return "unknown";
  }

  return precipitation > 0 ? "moderate" : "attention";
}

function calculateClimateStatus(environment: Environment): FieldStatus {
  const temperature = firstNumber(environment, [
    "power_temperature_mean",
    "ag_temperature_c",
    "temperature_c",
  ]);

  if (temperature === null) {
    return "unknown";
  }

  return temperature >= 10 && temperature <= 35 ? "good" : "moderate";
}

function normalizeCrop(crop: Crop, index: number): NormalizedCrop {
  const englishName = String(
    crop.english_name ?? crop.name_en ?? crop.crop_name ?? crop.name ?? "",
  ).trim();

  const banglaName = String(
    crop.bangla_name ?? crop.bengali_name ?? crop.name_bn ?? "",
  ).trim();

  const id = String(
    (crop.id ?? crop.crop_id ?? englishName) || `crop-${index}`,
  );

  return {
    id,
    englishName: englishName || `Crop ${index + 1}`,
    banglaName: banglaName || englishName || `ফসল ${index + 1}`,
    icon: String(crop.icon ?? crop.emoji ?? "🌱"),
  };
}

function extractCrops(data: unknown): NormalizedCrop[] {
  const raw = getObject(data, "crops", "data", "results");

  const candidates: unknown[] = Array.isArray(data)
    ? data
    : Array.isArray(raw)
      ? raw
      : [];

  return candidates
    .filter((item): item is Crop => Boolean(item && typeof item === "object"))
    .map(normalizeCrop);
}

function cropTokens(recommendation: RotationRecommendation): string[] {
  return [
    recommendation.crop_1_name,
    recommendation.crop_2_name,
    recommendation.crop_3_name,
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.trim().toLowerCase());
}

function matchesSelectedCrops(
  recommendation: RotationRecommendation,
  selectedCrops: NormalizedCrop[],
): boolean {
  if (selectedCrops.length === 0) {
    return true;
  }

  const rotationCrops = cropTokens(recommendation);

  if (rotationCrops.length === 0) {
    return false;
  }

  const selectedNames = selectedCrops.flatMap((crop) => [
    crop.englishName.trim().toLowerCase(),
    crop.banglaName.trim().toLowerCase(),
  ]);

  /*
   * A rotation matches when at least one
   * crop in that rotation is among the
   * farmer's selected crops.
   *
   * This keeps the farmer from having
   * to inspect all scenarios.
   */
  return rotationCrops.some((crop) => selectedNames.includes(crop));
}

export default function Dashboard() {
  const [language, setLanguage] = useState<Language>(() => {
    const stored = window.localStorage.getItem("field-shift-language");

    return stored === "en" ? "en" : "bn";
  });

  const t = language === "bn" ? bn : en;

  const [field, setField] = useState<Field | null>(null);

  const [environment, setEnvironment] = useState<Environment[]>([]);

  const [soil, setSoil] = useState<SoilProfile | null>(null);

  const [recommendations, setRecommendations] =
    useState<RecommendationResponse | null>(null);

  const [priorities, setPriorities] = useState<FarmerPriorities>({
    ...DEFAULT_PRIORITIES,
  });

  const [crops, setCrops] = useState<NormalizedCrop[]>([]);

  const [selectedCropIds, setSelectedCropIds] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);

  const [recommendationLoading, setRecommendationLoading] = useState(false);

  const [error, setError] = useState("");

  const [recommendationUpdated, setRecommendationUpdated] = useState(false);

  useEffect(() => {
    window.localStorage.setItem("field-shift-language", language);
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
          getEnvironment(FIELD_ID),
          getSoil(FIELD_ID),
          getRecommendations(FIELD_ID, DEFAULT_PRIORITIES),
          getCrops(),
        ]);

        if (!active) {
          return;
        }

        setField(getObject(fieldData, "field") as Field);

        setEnvironment(extractEnvironmentRows(environmentData));

        setSoil(
          getObject(
            soilData,
            "soil_profile",
            "soil",
            "profile",
            "data",
          ) as SoilProfile,
        );

        setRecommendations(recommendationData);

        setCrops(extractCrops(cropData));
      } catch (err: unknown) {
        console.error("FIELD SHIFT dashboard load failed:", err);

        if (!active) {
          return;
        }

        setError(
          getApiErrorMessage(
            err,
            language === "bn"
              ? "FIELD SHIFT-এর স্থানীয় backend-এর সাথে সংযোগ করা যাচ্ছে না।"
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

    if (selectedCropIds.length === 0) {
      setError(
        language === "bn"
          ? "অন্তত একটি ফসল নির্বাচন করুন।"
          : "Please select at least one crop.",
      );

      return false;
    }

    try {
      setRecommendationLoading(true);

      setError("");

      setRecommendationUpdated(false);

      const data = await getRecommendations(FIELD_ID, priorities);

      setRecommendations(data);

      setRecommendationUpdated(true);

      window.setTimeout(() => {
        const target = document.getElementById("recommendations");

        if (!target) {
          return;
        }

        const reduceMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;

        target.scrollIntoView({
          behavior: reduceMotion ? "auto" : "smooth",
          block: "start",
        });
      }, 120);

      return true;
    } catch (err: unknown) {
      console.error("FIELD SHIFT recommendation update failed:", err);

      setError(
        getApiErrorMessage(
          err,
          language === "bn"
            ? "পরিকল্পনা আপডেট করা যায়নি।"
            : "Unable to update recommendations.",
        ),
      );

      return false;
    } finally {
      setRecommendationLoading(false);
    }
  }

  const selectedCrops = useMemo(
    () => crops.filter((crop) => selectedCropIds.includes(crop.id)),
    [crops, selectedCropIds],
  );

  const recommendationResults = useMemo<RotationRecommendation[]>(() => {
    if (!Array.isArray(recommendations?.results)) {
      return [];
    }

    return recommendations.results.filter((recommendation) =>
      matchesSelectedCrops(recommendation, selectedCrops),
    );
  }, [recommendations, selectedCrops]);

  const currentSoil = soil || {};

  const currentEnvironment =
    environment.length > 0
      ? environment[environment.length - 1]
      : {};

  const soilStatus = calculateSoilStatus(currentSoil);

  const waterStatus = calculateWaterStatus(currentEnvironment);

  const climateStatus = calculateClimateStatus(currentEnvironment);

  const selectedCropNames = selectedCrops.map((crop) =>
    language === "bn" ? crop.banglaName : crop.englishName,
  );

  const fieldName = field?.name || "Feni Test Plot";

  const updatedDescription =
    "updatedDescription" in t.status
      ? t.status.updatedDescription
      : language === "bn"
        ? "আপনার নির্বাচিত ফসল এবং অগ্রাধিকার অনুযায়ী ফলাফল তৈরি হয়েছে।"
        : "The results now reflect your selected crops and priorities.";

  if (loading) {
    return (
      <div className="fs-boot">
        <div className="fs-boot-inner">
          <span className="fs-spinner" aria-hidden="true" />

          <h1 className="fs-boot-title">
            {t.common.loading} FIELD SHIFT
          </h1>

          <p className="fs-boot-text">
            {language === "bn"
              ? "আপনার মাঠের স্থানীয় তথ্য পড়া হচ্ছে"
              : "Reading your local farm data"}
          </p>
        </div>
      </div>
    );
  }

  if (error && !field) {
    return (
      <div className="fs-boot">
        <div className="fs-boot-inner">
          <h1 className="fs-boot-title">
            {language === "bn"
              ? "FIELD SHIFT চালু করা যায়নি"
              : "FIELD SHIFT could not load"}
          </h1>

          <p className="fs-boot-text">{error}</p>

          <button
            type="button"
            className="fs-button"
            onClick={() => window.location.reload()}
          >
            {language === "bn" ? "আবার চেষ্টা করুন" : "Try again"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fs-page">
      <FarmerHeader
        fieldName={fieldName}
        language={language}
        onLanguageChange={setLanguage}
      />

      <main className="fs-main">
        <div className="fs-container">
          <FarmerHero />

          <FarmerFieldStatus
            soilStatus={soilStatus}
            waterStatus={waterStatus}
            climateStatus={climateStatus}
            fieldName={field?.name}
            language={language}
          />

          <div className="fs-workbench">
            <div className="fs-column">
              {recommendationLoading ? (
                <p
                  className="fs-statusline"
                  data-tone="attention"
                  aria-live="polite"
                >
                  <strong>{t.status.updating}</strong> {t.status.comparing}
                </p>
              ) : null}

              {recommendationUpdated && !recommendationLoading ? (
                <p
                  className="fs-statusline"
                  data-tone="success"
                  role="status"
                  aria-live="polite"
                >
                  <strong>{t.status.updated}</strong> {updatedDescription}
                </p>
              ) : null}

              {error && field ? (
                <p className="fs-statusline" data-tone="error" role="alert">
                  <strong>{t.status.error}</strong> {error}
                </p>
              ) : null}

              <section
                id="recommendations"
                className="fs-anchor"
                aria-labelledby="rotations-title"
              >
                <RecommendationList
                  recommendations={recommendationResults}
                  priorities={priorities}
                  maxItems={3}
                  language={language}
                  crops={crops}
                  selectedCropNames={selectedCropNames}
                />
              </section>

              <div id="earth-observations" className="fs-anchor">
                <EarthObservationContext
                  data={environment}
                  language={language}
                />

                <WeatherSummary
                  environment={currentEnvironment}
                  language={language}
                />
              </div>

              <FarmerSoilView soil={currentSoil} language={language} />
            </div>

            <aside
              className="fs-aside"
              aria-label={
                language === "bn" ? "আপনার পছন্দ" : "Your choices"
              }
            >
              <div className="fs-panel">
                <CropSelector
                  crops={crops}
                  selectedCrops={selectedCropIds}
                  onChange={setSelectedCropIds}
                  language={language}
                />

                <FarmerGoalSelector
                  priorities={priorities}
                  onChange={setPriorities}
                  onApply={updateRecommendations}
                  loading={recommendationLoading}
                  language={language}
                />
              </div>
            </aside>
          </div>
        </div>
      </main>

      <footer className="fs-footer">
        <div className="fs-container">
          <div className="fs-footer-grid">
            <div className="fs-footer-col">
              <h2>
                {language === "bn"
                  ? "FIELD SHIFT কীভাবে কাজ করে"
                  : "How FIELD SHIFT works"}
              </h2>

              <p>
                {language === "bn"
                  ? "Earth observation থেকে কৃষি সিদ্ধান্ত"
                  : "From Earth observations to farm decisions"}
              </p>

              <p>
                {language === "bn"
                  ? "FIELD SHIFT পরিবেশ, মাটি, ফসল এবং কৃষকের অগ্রাধিকার একসাথে ব্যবহার করে crop rotation-এর সিদ্ধান্তে সহায়তা করে।"
                  : "FIELD SHIFT combines environmental, soil, crop and farmer-priority information to support local crop-rotation decisions."}
              </p>
            </div>

            <div className="fs-footer-col">
              <h2>{language === "bn" ? "যা ব্যবহার হয়" : "What goes in"}</h2>

              <dl className="fs-footer-list">
                <div>
                  <dt>{language === "bn" ? "NASA তথ্য" : "NASA observations"}</dt>
                  <dd>
                    {language === "bn"
                      ? "NASA Earth data থেকে পরিবেশগত তথ্য।"
                      : "Environmental conditions derived from NASA Earth data."}
                  </dd>
                </div>

                <div>
                  <dt>{language === "bn" ? "স্থানীয় মাটি" : "Local soil"}</dt>
                  <dd>
                    {language === "bn"
                      ? "নির্বাচিত মাঠের মাটির তথ্য।"
                      : "Soil information associated with the selected field."}
                  </dd>
                </div>

                <div>
                  <dt>
                    {language === "bn" ? "ফসলের বৈশিষ্ট্য" : "Crop characteristics"}
                  </dt>
                  <dd>
                    {language === "bn"
                      ? "ফসল ও rotation-এর তথ্য।"
                      : "Stored crop and rotation information."}
                  </dd>
                </div>

                <div>
                  <dt>
                    {language === "bn" ? "আপনার অগ্রাধিকার" : "Your priorities"}
                  </dt>
                  <dd>
                    {language === "bn"
                      ? "আপনার farming goals decision score-কে প্রভাবিত করে।"
                      : "Your farming goals influence the decision-support score."}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="fs-footer-col">
              <h2>
                {language === "bn"
                  ? "Decision-support তথ্য"
                  : "Decision-support information"}
              </h2>

              <p>
                {language === "bn"
                  ? "FIELD SHIFT crop-rotation scenario তুলনা করতে সাহায্য করে। এর score yield, profit বা farm performance-এর নিশ্চয়তা নয়।"
                  : "FIELD SHIFT helps compare available crop-rotation scenarios. Its scores are not guarantees of yield, profit or farm performance."}
              </p>
            </div>
          </div>

          <details className="fs-subdetails">
            <summary>
              {language === "bn" ? "কারিগরি তথ্য" : "Technical details"}
            </summary>

            <div className="fs-subdetails-body">
              <p className="fs-prose">
                {language === "bn"
                  ? "FIELD SHIFT একটি স্থানীয় offline database ব্যবহার করে, যেখানে NASA-derived environmental features, মাটির তথ্য এবং মূল্যায়িত crop-rotation scenario রয়েছে। Recommendation score একটি decision-support score; এটি yield, profit বা irrigation cost-এর সরাসরি পূর্বাভাস নয়।"
                  : "FIELD SHIFT uses a local offline database containing NASA-derived environmental features, soil information and evaluated crop-rotation scenarios. The recommendation score is a decision-support score and is not a direct prediction of yield, profit or irrigation cost."}
              </p>

              <dl className="fs-source-list">
                <div className="fs-source">
                  <dt>{language === "bn" ? "চালানোর ধরন" : "Runtime"}</dt>
                  <dd>Offline</dd>
                </div>

                <div className="fs-source">
                  <dt>{language === "bn" ? "Scenario" : "Scenarios"}</dt>
                  <dd>{recommendations?.scenario_count ?? 0}</dd>
                </div>

                <div className="fs-source">
                  <dt>{language === "bn" ? "ইন্টারনেট" : "Internet"}</dt>
                  <dd>{language === "bn" ? "প্রয়োজন নেই" : "Not required"}</dd>
                </div>
              </dl>
            </div>
          </details>

          <div className="fs-footer-credits">
            <span>NASA Space Apps Challenge 2026</span>
            <span>Real Earth data + Local knowledge + Farmer priorities</span>
            <span>Adapting Farms with NASA Data</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
