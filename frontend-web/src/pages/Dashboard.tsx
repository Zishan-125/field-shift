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
} from "../services/api";

import type { Field } from "../types/field";

import type {
  Environment,
} from "../types/environment";

import type {
  SoilProfile,
} from "../types/soil";

import type {
  FarmerPriorities,
} from "../types/farmer";

import {
  DEFAULT_PRIORITIES,
} from "../types/farmer";

import type {
  RecommendationResponse,
  RotationRecommendation,
} from "../types/recommendation";

import FarmerHeader from "../components/farmer/FarmerHeader";
import FieldHealthCard from "../components/farmer/FieldHealthCard";
import WeatherSummary from "../components/farmer/WeatherSummary";
import EnvironmentSummary from "../components/farmer/EnvironmentSummary";
import RiskCard from "../components/farmer/RiskCard";
import SoilSummary from "../components/farmer/SoilSummary";
import FarmerGoalSelector from "../components/farmer/FarmerGoalSelector";
import RecommendationList from "../components/farmer/RecommendationList";

import SectionTitle from "../components/common/SectionTitle";

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
        data as Record<string, unknown>
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
    errorObject?.response?.data?.detail ||
    errorObject?.response?.data?.message ||
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

  /*
   * Conservative UI interpretation only.
   * This is not a crop-specific agronomic diagnosis.
   */
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

  /*
   * This is intentionally conservative.
   * Positive rainfall is not automatically
   * "good" or "bad"; it only indicates that
   * water-related conditions should currently
   * be monitored.
   */
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

function getPriorityLabel(
  priorities: FarmerPriorities,
): string {
  const entries: [
    keyof FarmerPriorities,
    string,
  ][] = [
    [
      "water_conservation",
      "Save water",
    ],
    [
      "soil_health",
      "Protect soil",
    ],
    [
      "climate_resilience",
      "Handle climate",
    ],
    [
      "crop_diversity",
      "More crop variety",
    ],
  ];

  let selectedLabel = "Balanced";
  let highestValue = -Infinity;

  for (const [
    key,
    label,
  ] of entries) {
    const value = Number(
      priorities[key],
    );

    if (
      Number.isFinite(value) &&
      value > highestValue
    ) {
      highestValue = value;
      selectedLabel = label;
    }
  }

  return selectedLabel;
}

export default function Dashboard() {
  const [field, setField] =
    useState<Field | null>(null);

  const [environment, setEnvironment] =
    useState<Environment | null>(null);

  const [soil, setSoil] =
    useState<SoilProfile | null>(null);

  const [
    recommendations,
    setRecommendations,
  ] = useState<RecommendationResponse | null>(
    null,
  );

  const [priorities, setPriorities] =
    useState<FarmerPriorities>({
      ...DEFAULT_PRIORITIES,
    });

  const [loading, setLoading] =
    useState(true);

  const [
    recommendationLoading,
    setRecommendationLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    recommendationUpdated,
    setRecommendationUpdated,
  ] = useState(false);

  /**
   * Initial dashboard loading.
   */
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
            "Unable to connect to the FIELD SHIFT local backend.",
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

  /**
   * Recalculate recommendations using
   * the currently selected farmer priorities.
   */
  async function updateRecommendations() {
    if (recommendationLoading) {
      return;
    }

    try {
      setRecommendationLoading(true);
      setError("");
      setRecommendationUpdated(false);

      const data =
        await getRecommendations(
          FIELD_ID,
          priorities,
        );

      setRecommendations(data);
      setRecommendationUpdated(true);

      /*
       * Give the farmer visual feedback first,
       * then move attention toward the new plan.
       */
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
    } catch (err: unknown) {
      console.error(
        "FIELD SHIFT recommendation update failed:",
        err,
      );

      setError(
        getApiErrorMessage(
          err,
          "Unable to update recommendations.",
        ),
      );
    } finally {
      setRecommendationLoading(false);
    }
  }

  const recommendationResults =
    useMemo<RotationRecommendation[]>(
      () => {
        if (
          Array.isArray(
            recommendations?.results,
          )
        ) {
          return recommendations.results;
        }

        return [];
      },
      [recommendations],
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

  const currentPriorityLabel =
    getPriorityLabel(
      priorities,
    );

  /*
   * Initial loading screen.
   */
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="px-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-green-50">
            <div className="h-7 w-7 animate-spin rounded-full border-4 border-green-100 border-t-green-600" />
          </div>

          <p className="mt-5 text-sm font-black text-slate-800">
            Loading FIELD SHIFT...
          </p>

          <p className="mt-1 text-xs text-slate-400">
            Reading your local farm data
          </p>
        </div>
      </div>
    );
  }

  /*
   * Complete failure:
   * field itself could not load.
   */
  if (error && !field) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-lg rounded-[2rem] border border-red-200 bg-white p-7 shadow-sm sm:p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-xl">
            ⚠️
          </div>

          <p className="mt-5 text-[10px] font-black uppercase tracking-[0.18em] text-red-600">
            Connection problem
          </p>

          <h1 className="mt-2 text-2xl font-black text-slate-900">
            FIELD SHIFT could not load
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-600">
            {error}
          </p>

          <div className="mt-5 rounded-2xl bg-slate-50 p-4">
            <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
              Local service
            </p>

            <p className="mt-1 break-all text-xs text-slate-600">
              {import.meta.env
                .VITE_API_BASE_URL ||
                "http://127.0.0.1:8001"}
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              window.location.reload()
            }
            className="fs-primary-button mt-5 w-full"
          >
            ↻ Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="fs-page">
      <FarmerHeader
        fieldName={
          field?.name ||
          "Feni Test Plot"
        }
      />

      <section className="fs-container py-6 sm:py-8 lg:py-10">

        {/* =====================================================
            1. FIELD HEALTH
        ====================================================== */}

        <section className="fs-section">
          <FieldHealthCard
            soilStatus={soilStatus}
            waterStatus={waterStatus}
            climateStatus={
              climateStatus
            }
          />
        </section>

        {/* =====================================================
            2. FIELD SITUATION
        ====================================================== */}

        <section className="fs-section">
          <SectionTitle
            eyebrow="Field situation"
            title="What is happening on your farm?"
            description="A simple view of the environmental conditions available for your field."
          />

          <div className="mt-5 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm sm:p-1">
            <div className="p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                    Current conditions
                  </p>

                  <h3 className="mt-1 text-lg font-black text-slate-900">
                    Your field environment
                  </h3>
                </div>

                <span className="w-fit rounded-full bg-green-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-green-700">
                  Local field data
                </span>
              </div>

              <div className="mt-5">
                <WeatherSummary
                  environment={
                    currentEnvironment
                  }
                />
              </div>

              <div className="mt-4">
                <EnvironmentSummary
                  environment={
                    currentEnvironment
                  }
                />
              </div>
            </div>
          </div>

          <div className="mt-4">
            <RiskCard
              soilStatus={soilStatus}
              waterStatus={waterStatus}
              climateStatus={
                climateStatus
              }
            />
          </div>
        </section>

        {/* =====================================================
            3. SOIL
        ====================================================== */}

        <section className="fs-section">
          <SoilSummary
            soil={currentSoil}
          />
        </section>

        {/* =====================================================
            4. FARMER PRIORITIES
        ====================================================== */}

        <section className="fs-section">
          <FarmerGoalSelector
            priorities={priorities}
            onChange={
              setPriorities
            }
            onApply={
              updateRecommendations
            }
            loading={
              recommendationLoading
            }
          />

          {/* Update status */}
          {recommendationLoading && (
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-100 border-t-blue-600" />
              </div>

              <div>
                <p className="text-sm font-black text-blue-900">
                  Recalculating your farm plan
                </p>

                <p className="mt-0.5 text-xs text-blue-800/70">
                  Comparing crop rotations
                  using:{" "}
                  {currentPriorityLabel}
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
                    Your crop plan has been
                    updated
                  </p>

                  <p className="mt-0.5 text-xs text-green-800/70">
                    Recommendations now reflect
                    your selected priority:{" "}
                    {currentPriorityLabel}.
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
                  Couldn&apos;t update the plan
                </p>

                <p className="mt-1 text-xs leading-5 text-red-700/80">
                  {error}
                </p>
              </div>
            </div>
          )}
        </section>

        {/* =====================================================
            5. RECOMMENDATIONS
        ====================================================== */}

        <section
          id="recommendations"
          className="fs-section scroll-mt-6"
        >
          <RecommendationList
            recommendations={
              recommendationResults
            }
            priorities={priorities}
            maxItems={3}
          />
        </section>

        {/* =====================================================
            6. HOW FIELD SHIFT WORKS
        ====================================================== */}

        <section className="fs-section overflow-hidden rounded-[2rem] border border-blue-100 bg-blue-50 p-6 sm:p-7">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">
            How FIELD SHIFT works
          </p>

          <h2 className="mt-2 text-xl font-black text-blue-950 sm:text-2xl">
            From Earth observations to farm decisions
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-900/70">
            FIELD SHIFT combines environmental,
            soil, crop and farmer-priority
            information to support local
            crop-rotation decisions.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [
                "🛰️",
                "NASA observations",
                "Environmental conditions derived from NASA Earth data.",
              ],
              [
                "🌱",
                "Local soil",
                "Soil information associated with the selected field.",
              ],
              [
                "🌾",
                "Crop characteristics",
                "Stored crop and rotation information used in scenario evaluation.",
              ],
              [
                "🎯",
                "Your priorities",
                "Your farming goals influence the decision-support score.",
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
            7. NOTICE
        ====================================================== */}

        <section className="fs-section">
          <div className="fs-notice flex items-start gap-3 p-4 sm:p-5">
            <span className="text-base">
              ℹ️
            </span>

            <div>
              <p className="font-black text-slate-700">
                Decision-support information
              </p>

              <p className="mt-1">
                FIELD SHIFT helps compare available
                crop-rotation scenarios. Its scores
                are not guarantees of yield, profit
                or farm performance.
              </p>
            </div>
          </div>
        </section>

        {/* =====================================================
            8. TECHNICAL DETAILS
        ====================================================== */}

        <details className="mb-10 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <summary className="cursor-pointer px-6 py-5 text-sm font-black text-slate-800">
            Technical details
          </summary>

          <div className="border-t border-slate-200 p-6">
            <p className="text-sm leading-6 text-slate-500">
              FIELD SHIFT uses a local offline
              database containing NASA-derived
              environmental features, soil information
              and evaluated crop-rotation scenarios.
              The recommendation score is a
              decision-support score and is not a
              direct prediction of yield, profit or
              irrigation cost.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold text-slate-400">
                  Runtime
                </p>

                <p className="mt-1 text-sm font-bold text-slate-800">
                  Offline
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold text-slate-400">
                  Scenarios
                </p>

                <p className="mt-1 text-sm font-bold text-slate-800">
                  {recommendations?.scenario_count ??
                    0}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold text-slate-400">
                  Internet
                </p>

                <p className="mt-1 text-sm font-bold text-green-700">
                  Not required
                </p>
              </div>
            </div>
          </div>
        </details>
      </section>
    </main>
  );
}