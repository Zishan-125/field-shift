import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getHealth,
  getField,
  getEnvironment,
  getSoil,
  getPatternRecommendations,
  getCrops,
} from "../services/api";

import type { Field } from "../types/field";
import type { Environment } from "../types/environment";
import type { SoilProfile } from "../types/soil";

import {
  DEFAULT_CURRENT_PATTERN_ID,
  DEFAULT_PATTERN_PRIORITIES,
} from "../types/pattern";

import type {
  PatternPriorities,
  PatternRecommendationResponse,
  RecommendedPattern,
} from "../types/pattern";

import type {
  Crop,
  NormalizedCrop,
} from "../types/crop";

import FarmChatBot from "../components/farmer/FarmChatBot";
import FarmerHeader from "../components/farmer/FarmerHeader";
import FarmerFieldStatus from "../components/farmer/FarmerFieldStatus";
import FarmerSoilView from "../components/farmer/FarmerSoilView";
import EarthObservationContext from "../components/farmer/EarthObservationContext";
import WeatherSummary from "../components/farmer/WeatherSummary";
import EnvironmentSummary from "../components/farmer/EnvironmentSummary";
import FarmerGoalSelector from "../components/farmer/FarmerGoalSelector";
import PatternRecommendationList from "../components/farmer/PatternRecommendationList";
import DemoFieldsSection from "../components/farmer/DemoFieldsSection";
import FarmMap from "../components/farmer/FarmMap";
import CropSelector from "../components/farmer/CropSelector";
import LanguageSwitcher from "../components/farmer/LanguageSwitcher";
import SectionTitle from "../components/common/SectionTitle";

import bn from "../i18n/bn";
import en from "../i18n/en";

import type { Language } from "../components/farmer/LanguageSwitcher";

const ClimateShiftSection = lazy(
  () => import("../components/farmer/ClimateShiftSection"),
);

const FIELD_ID =
  import.meta.env.VITE_FIELD_ID ||
  "426e9d97-78cf-45d2-82ae-8131040b5ee7";

const CROP_HEALTH_SCORE = 78;

type EnvironmentRow = Environment & {
  date?: string;
  observation_date?: string;
  observation_month?: string;
  year?: number;
  month?: number;
  power_temperature_mean?: number | null;
  ag_rainfall_mm?: number | null;
  power_precipitation?: number | null;
  precipitation?: number | null;
  rainfall?: number | null;
  power_wind_speed?: number | null;
  wind_speed?: number | null;
  power_solar_radiation?: number | null;
  solar_radiation?: number | null;
  [key: string]: unknown;
};

// =======================================================
// GENERAL HELPERS
// =======================================================

function getApiErrorMessage(
  error: unknown,
  fallback: string,
): string {
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

function getObject(
  data: unknown,
  ...keys: string[]
): Record<string, unknown> {
  if (!data || typeof data !== "object") {
    return {};
  }

  const object = data as Record<string, unknown>;

  for (const key of keys) {
    const value = object[key];

    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  }

  return object;
}

// =======================================================
// ENVIRONMENT DATA NORMALIZATION
// =======================================================

/**
 * Accepts any of these response shapes:
 *
 * [row, row]
 * { data: [row, row] }
 * { environment: [row, row] }
 * { environment: { data: [row, row] } }
 * { results: [row, row] }
 *
 * Also supports a single flat observation object.
 */
function extractEnvironmentRows(
  input: unknown,
): EnvironmentRow[] {
  let current: unknown = input;

  for (let depth = 0; depth < 6; depth++) {
    if (Array.isArray(current)) {
      return current.filter(
        (item): item is EnvironmentRow =>
          Boolean(item && typeof item === "object"),
      ) as EnvironmentRow[];
    }

    if (!current || typeof current !== "object") {
      return [];
    }

    const object = current as Record<string, unknown>;

    const candidateKeys = [
      "data",
      "rows",
      "environment",
      "monthly",
      "results",
      "observations",
    ];

    let next: unknown = undefined;

    for (const key of candidateKeys) {
      const candidate = object[key];

      if (Array.isArray(candidate)) {
        return candidate.filter(
          (item): item is EnvironmentRow =>
            Boolean(item && typeof item === "object"),
        ) as EnvironmentRow[];
      }

      if (candidate && typeof candidate === "object") {
        next = candidate;
        break;
      }
    }

    if (next !== undefined && next !== current) {
      current = next;
      continue;
    }

    // A flat observation object is also valid.
    const looksLikeObservation = [
      "power_temperature_mean",
      "temperature_c",
      "ag_rainfall_mm",
      "precipitation",
      "rainfall",
      "date",
      "observation_date",
    ].some((key) => key in object);

    return looksLikeObservation
      ? [object as EnvironmentRow]
      : [];
  }

  return [];
}

function sortEnvironmentRows(
  rows: EnvironmentRow[],
): EnvironmentRow[] {
  return [...rows].sort((a, b) => {
    const dateA = String(
      a.date ??
      a.observation_date ??
      a.observation_month ??
      "",
    );

    const dateB = String(
      b.date ??
      b.observation_date ??
      b.observation_month ??
      "",
    );

    return dateA.localeCompare(dateB);
  });
}

function latestEnvironmentRow(
  rows: EnvironmentRow[],
): EnvironmentRow {
  return rows.length > 0
    ? rows[rows.length - 1]
    : {};
}

function validNASAValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);

  if (!Number.isFinite(number) || number === -999) {
    return null;
  }

  return number;
}

// =======================================================
// SOIL AND FIELD STATUS
// =======================================================

function calculateSoilStatus(
  soil: SoilProfile,
): "good" | "moderate" | "attention" {
  const rawValue = soil["soil_ph_0-5cm"];

  if (rawValue === null || rawValue === undefined || rawValue === "") {
    return "moderate";
  }

  const ph = Number(rawValue);

  if (!Number.isFinite(ph)) {
    return "moderate";
  }

  if (ph >= 5.5 && ph <= 7.5) return "good";
  if (ph >= 5 && ph <= 8) return "moderate";

  return "attention";
}

function calculateWaterStatus(
  environment: EnvironmentRow,
): "good" | "moderate" | "attention" {
  const precipitation = validNASAValue(
    environment.ag_rainfall_mm ??
    environment.power_precipitation ??
    environment.precipitation ??
    environment.rainfall,
  );

  if (precipitation === null) {
    return "moderate";
  }

  return precipitation > 0 ? "moderate" : "attention";
}

function calculateClimateStatus(
  environment: EnvironmentRow,
): "good" | "moderate" | "attention" {
  const temperature = validNASAValue(
    environment.power_temperature_mean ??
    environment.temperature_c,
  );

  if (temperature === null) {
    return "moderate";
  }

  return temperature >= 10 && temperature <= 35
    ? "good"
    : "moderate";
}

// =======================================================
// CROP NORMALIZATION
// =======================================================

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
    (crop.id ?? crop.crop_id ?? englishName) ||
    `crop-${index}`,
  );

  return {
    id,
    englishName: englishName || `Crop ${index + 1}`,
    banglaName: banglaName || englishName || `ফসল ${index + 1}`,
    icon: String(crop.icon ?? crop.emoji ?? "🌱"),
  };
}

function extractCrops(data: unknown): NormalizedCrop[] {
  if (Array.isArray(data)) {
    return data
      .filter(
        (item): item is Crop =>
          Boolean(item && typeof item === "object"),
      )
      .map(normalizeCrop);
  }

  const object = getObject(data, "crops", "data", "results");

  for (const key of ["crops", "data", "results"]) {
    const candidate = object[key];

    if (Array.isArray(candidate)) {
      return candidate
        .filter(
          (item): item is Crop =>
            Boolean(item && typeof item === "object"),
        )
        .map(normalizeCrop);
    }
  }

  return [];
}

// =======================================================
// RECOMMENDATION HELPERS
// =======================================================

function matchesSelectedCrops(
  pattern: RecommendedPattern,
  selectedCropIds: string[],
): boolean {
  if (selectedCropIds.length === 0) {
    return true;
  }

  return Object.values(pattern.seasons).some((crop) =>
    selectedCropIds.includes(crop.crop_id),
  );
}

// =======================================================
// NASA POWER FETCH
// =======================================================

async function fetchNASAPOWER(
  lat: number,
  lon: number,
  signal: AbortSignal,
): Promise<EnvironmentRow[]> {
  const endDate = new Date();
  endDate.setUTCDate(endDate.getUTCDate() - 10);

  const startDate = new Date();
  startDate.setUTCDate(startDate.getUTCDate() - 17);

  const formatDate = (date: Date) =>
    date.toISOString().slice(0, 10).replace(/-/g, "");

  const params = new URLSearchParams({
    parameters: "T2M,PRECTOTCORR,WS2M,ALLSKY_SFC_SW_DWN",
    community: "AG",
    longitude: String(lon),
    latitude: String(lat),
    start: formatDate(startDate),
    end: formatDate(endDate),
    format: "JSON",
  });

  const url =
    `https://power.larc.nasa.gov/api/temporal/daily/point?${params.toString()}`;

  const response = await fetch(url, { signal });

  if (!response.ok) {
    throw new Error(
      `NASA POWER request failed (${response.status})`,
    );
  }

  const payload = await response.json();

  const parameters = payload?.properties?.parameter;

  if (!parameters) {
    throw new Error("NASA POWER returned no parameter data.");
  }

  const temperature = parameters.T2M ?? {};
  const rainfall = parameters.PRECTOTCORR ?? {};
  const wind = parameters.WS2M ?? {};
  const solar = parameters.ALLSKY_SFC_SW_DWN ?? {};

  // Use the union of all available dates, not only T2M dates.
  const dates = Array.from(
    new Set([
      ...Object.keys(temperature),
      ...Object.keys(rainfall),
      ...Object.keys(wind),
      ...Object.keys(solar),
    ]),
  ).sort();

  const rows: EnvironmentRow[] = dates
    .map((date) => {
      const temp = validNASAValue(temperature[date]);
      const rain = validNASAValue(rainfall[date]);
      const windSpeed = validNASAValue(wind[date]);
      const solarRadiation = validNASAValue(solar[date]);

      const year = Number(date.slice(0, 4));
      const month = Number(date.slice(4, 6));
      const formattedDate =
        `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;

      return {
        date: formattedDate,
        observation_date: formattedDate,
        observation_month: `${year}-${String(month).padStart(2, "0")}`,
        year,
        month,

        // NASA POWER temperature (°C)
        power_temperature_mean: temp,
        temperature_c: temp,

        // NASA POWER precipitation (mm/day)
        ag_rainfall_mm: rain,
        power_precipitation: rain,
        precipitation: rain,
        rainfall: rain,

        // NASA POWER wind speed (m/s)
        power_wind_speed: windSpeed,
        wind_speed: windSpeed,

        // NASA POWER solar radiation (kWh/m²/day)
        power_solar_radiation: solarRadiation,
        solar_radiation: solarRadiation,
      };
    })
    .filter((row) =>
      [
        row.power_temperature_mean,
        row.ag_rainfall_mm,
        row.power_wind_speed,
        row.power_solar_radiation,
      ].some((value) => value !== null),
    );

  if (rows.length === 0) {
    throw new Error(
      "NASA POWER returned no usable observations for these coordinates.",
    );
  }

  return rows;
}

// =======================================================
// DASHBOARD
// =======================================================

export default function Dashboard() {
  // -----------------------------------------------------
  // LANGUAGE
  // -----------------------------------------------------

  const [language, setLanguage] = useState<Language>(() => {
    const stored = window.localStorage.getItem(
      "field-shift-language",
    );

    return stored === "en" ? "en" : "bn";
  });

  const t = language === "bn" ? bn : en;
  const isBangla = language === "bn";

  const recommendationLabels = {
    selectedCropFilter:
      "selectedCropFilter" in t.recommendations
        ? String(
            (t.recommendations as Record<string, unknown>)
              .selectedCropFilter ??
            (isBangla ? "নির্বাচিত ফসল" : "Selected crops"),
          )
        : isBangla
          ? "নির্বাচিত ফসল"
          : "Selected crops",

    title: t.recommendations.title,

    subtitle:
      "subtitle" in t.recommendations
        ? String(
            (t.recommendations as Record<string, unknown>)
              .subtitle ??
            (isBangla
              ? "আপনার অগ্রাধিকার অনুযায়ী সম্ভাব্য ফসল পরিকল্পনা"
              : "Recommended crop plans based on your priorities"),
          )
        : isBangla
          ? "আপনার অগ্রাধিকার অনুযায়ী সম্ভাব্য ফসল পরিকল্পনা"
          : "Recommended crop plans based on your priorities",

    scenarios:
      "scenarios" in t.recommendations
        ? String(
            (t.recommendations as Record<string, unknown>)
              .scenarios ??
            (isBangla ? "সম্ভাব্য পরিকল্পনা" : "Possible plans"),
          )
        : isBangla
          ? "সম্ভাব্য পরিকল্পনা"
          : "Possible plans",

    noMatch: t.recommendations.noMatch,
    changeCrops: t.recommendations.changeCrops,
  };

  // -----------------------------------------------------
  // FIELD AND MAP COORDINATES
  // -----------------------------------------------------

  const [field, setField] = useState<Field | null>(null);

  const [mapLat, setMapLat] = useState<number>(23.0185);
  const [mapLon, setMapLon] = useState<number>(91.3976);

  // -----------------------------------------------------
  // ENVIRONMENT
  // -----------------------------------------------------

  const [environmentRows, setEnvironmentRows] =
    useState<EnvironmentRow[]>([]);

  const [environmentLoading, setEnvironmentLoading] =
    useState(false);

  const [environmentError, setEnvironmentError] =
    useState("");

  // -----------------------------------------------------
  // SOIL
  // -----------------------------------------------------

  const [soil, setSoil] = useState<SoilProfile | null>(null);

  // -----------------------------------------------------
  // RECOMMENDATIONS
  // -----------------------------------------------------

  const [
    recommendations,
    setRecommendations,
  ] = useState<PatternRecommendationResponse | null>(null);

  const [priorities, setPriorities] =
    useState<PatternPriorities>({
      ...DEFAULT_PATTERN_PRIORITIES,
    });

  const [recommendationLoading, setRecommendationLoading] =
    useState(false);

  const [recommendationUpdated, setRecommendationUpdated] =
    useState(false);

  // -----------------------------------------------------
  // CROPS
  // -----------------------------------------------------

  const [crops, setCrops] = useState<NormalizedCrop[]>([]);
  const [selectedCropIds, setSelectedCropIds] =
    useState<string[]>([]);

  // -----------------------------------------------------
  // DASHBOARD LOADING
  // -----------------------------------------------------

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // -----------------------------------------------------
  // LANGUAGE PERSISTENCE
  // -----------------------------------------------------

  useEffect(() => {
    window.localStorage.setItem(
      "field-shift-language",
      language,
    );
  }, [language]);

  // -----------------------------------------------------
  // INITIAL BACKEND DATA
  // -----------------------------------------------------

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
          getPatternRecommendations(
            FIELD_ID,
            DEFAULT_PATTERN_PRIORITIES,
            DEFAULT_CURRENT_PATTERN_ID,
          ),
          getCrops(),
        ]);

        if (!active) return;

        setField(
          getObject(fieldData, "field") as unknown as Field,
        );

        // Normalize backend environment response.
        // This remains available as fallback if NASA fails.
        const backendRows = sortEnvironmentRows(
          extractEnvironmentRows(environmentData),
        );

        setEnvironmentRows(backendRows);

        setSoil(
          getObject(
            soilData,
            "soil_profile",
            "soil",
            "profile",
            "data",
          ) as unknown as SoilProfile,
        );

        setRecommendations(recommendationData);
        setCrops(extractCrops(cropData));

      } catch (err: unknown) {
        console.error(
          "FIELD SHIFT dashboard load failed:",
          err,
        );

        if (!active) return;

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

    void loadDashboard();

    return () => {
      active = false;
    };
    // Initial load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -----------------------------------------------------
  // LIVE NASA POWER TELEMETRY
  // -----------------------------------------------------

  useEffect(() => {
    if (loading) return;

    const controller = new AbortController();

    async function loadLiveEnvironment() {
      try {
        setEnvironmentLoading(true);
        setEnvironmentError("");

        const rows = await fetchNASAPOWER(
          mapLat,
          mapLon,
          controller.signal,
        );

        if (controller.signal.aborted) return;

        const sortedRows = sortEnvironmentRows(rows);

        // Replace backend fallback with live coordinate-specific
        // NASA POWER observations.
        setEnvironmentRows(sortedRows);

        console.info("NASA POWER observations updated", {
          latitude: mapLat,
          longitude: mapLon,
          count: sortedRows.length,
          latest: latestEnvironmentRow(sortedRows),
        });

      } catch (err: unknown) {
        if (
          err instanceof Error &&
          err.name === "AbortError"
        ) {
          return;
        }

        console.error("NASA POWER fetch failed:", err);

        if (!controller.signal.aborted) {
          setEnvironmentError(
            getApiErrorMessage(
              err,
              language === "bn"
                ? "নির্বাচিত স্থানের NASA POWER তথ্য লোড করা যায়নি।"
                : "Could not load NASA POWER observations for the selected location.",
            ),
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setEnvironmentLoading(false);
        }
      }
    }

    void loadLiveEnvironment();

    return () => {
      controller.abort();
    };
  }, [mapLat, mapLon, loading, language]);

  // -----------------------------------------------------
  // UPDATE RECOMMENDATIONS
  // -----------------------------------------------------

  async function updateRecommendations(): Promise<boolean> {
    if (recommendationLoading) return false;

    try {
      setRecommendationLoading(true);
      setError("");
      setRecommendationUpdated(false);

      const data = await getPatternRecommendations(
        FIELD_ID,
        priorities,
        DEFAULT_CURRENT_PATTERN_ID,
      );

      setRecommendations(data);
      setRecommendationUpdated(true);

      window.setTimeout(() => {
        document
          .getElementById("recommendations")
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
      setRecommendationLoading(false);
    }
  }

  // -----------------------------------------------------
  // SELECTED CROPS
  // -----------------------------------------------------

  const selectedCrops = useMemo(
    () =>
      crops.filter((crop) =>
        selectedCropIds.includes(crop.id),
      ),
    [crops, selectedCropIds],
  );

  const selectedCropNames = selectedCrops.map((crop) =>
    language === "bn"
      ? crop.banglaName
      : crop.englishName,
  );

  // -----------------------------------------------------
  // FILTER RECOMMENDATIONS
  // -----------------------------------------------------

  const recommendationResults = useMemo<RecommendedPattern[]>(
    () => {
      if (!Array.isArray(recommendations?.results)) {
        return [];
      }

      return recommendations.results.filter((pattern) =>
        matchesSelectedCrops(pattern, selectedCropIds),
      );
    },
    [recommendations, selectedCropIds],
  );

  // -----------------------------------------------------
  // CURRENT ENVIRONMENT
  // -----------------------------------------------------

  const currentSoil = soil || {};

  // Always use a flat latest observation for summary cards.
  const currentEnvironment =
    latestEnvironmentRow(environmentRows);

  // EarthObservationContext expects an array or an object
  // containing an array under "data".
  const earthObservationData = useMemo(
    () => ({ data: environmentRows }),
    [environmentRows],
  );

  // -----------------------------------------------------
  // FIELD STATUS
  // -----------------------------------------------------

  const soilStatus = calculateSoilStatus(currentSoil);
  const waterStatus = calculateWaterStatus(currentEnvironment);
  const climateStatus = calculateClimateStatus(currentEnvironment);

  // -----------------------------------------------------
  // LOADING SCREEN
  // -----------------------------------------------------

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

  // -----------------------------------------------------
  // CONNECTION ERROR
  // -----------------------------------------------------

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
            onClick={() => window.location.reload()}
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

  // =====================================================
  // MAIN DASHBOARD
  // =====================================================

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
        selectedFieldName={
          field?.name ||
          (isBangla
            ? "নির্বাচিত জমির প্লট"
            : "Selected Field Plot")
        }
        isBangla={isBangla}
      />

      <section className="fs-container py-6 sm:py-8 lg:py-10">
        {/* 1. FIELD STATUS */}
        <section className="fs-section">
          <FarmerFieldStatus
            soilStatus={soilStatus}
            waterStatus={waterStatus}
            climateStatus={climateStatus}
            language={language}
          />
        </section>

        {/* 2. FARM MAP */}
        <section
          id="farm-map"
          className="fs-section scroll-mt-6 space-y-4"
        >
          <FarmMap
            initialLat={mapLat}
            initialLon={mapLon}
            onLocationSelect={(lat, lon) => {
              setMapLat(lat);
              setMapLon(lon);
            }}
            selectedFieldName={
              field?.name ||
              (isBangla
                ? "নির্বাচিত জমির প্লট"
                : "Selected Field Plot")
            }
            cropHealthScore={CROP_HEALTH_SCORE}
            isBangla={isBangla}
          />
        </section>

        {/* 2.1 FARM CHATBOT */}
        <section className="fs-section scroll-mt-6 mt-6">
          <FarmChatBot
            isBangla={isBangla}
            selectedFieldName={
              field?.name ||
              (isBangla
                ? "নির্বাচিত জমির প্লট"
                : "Selected Field Plot")
            }
            cropHealthScore={CROP_HEALTH_SCORE}
          />
        </section>

        {/* 3. FIELD ENVIRONMENT */}
        <section className="fs-section mt-6">
          <SectionTitle
            eyebrow={
              isBangla ? "মাঠের অবস্থা" : "Field environment"
            }
            title={
              isBangla
                ? "আজকের মাঠের পরিবেশ"
                : "Today's field environment"
            }
            description={
              isBangla
                ? "মাঠের জন্য পাওয়া প্রধান পরিবেশগত তথ্য এক নজরে দেখুন।"
                : "See the main environmental signals available for your field at a glance."
            }
          />

          <div className="mt-5 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
            <div className="p-5 sm:p-6">
              {environmentLoading && (
                <p
                  className="mb-3 rounded-xl bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700"
                  role="status"
                  aria-live="polite"
                >
                  {isBangla
                    ? "নির্বাচিত স্থানাঙ্কের NASA POWER তথ্য লোড হচ্ছে..."
                    : "Loading NASA POWER observations for the selected coordinates..."}
                </p>
              )}

              {environmentError && (
                <p
                  className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800"
                  role="alert"
                >
                  {environmentError}
                </p>
              )}

              {environmentRows.length === 0 &&
              !environmentLoading ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                  <p className="text-sm font-bold text-slate-700">
                    {isBangla
                      ? "এই স্থানের পরিবেশগত তথ্য পাওয়া যায়নি।"
                      : "No environmental observations are currently available for this location."}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {isBangla
                      ? "ম্যাপে অন্য স্থান নির্বাচন করে আবার চেষ্টা করুন।"
                      : "Select another location on the map and try again."}
                  </p>
                </div>
              ) : (
                <>
                  <WeatherSummary
                    environment={currentEnvironment}
                  />

                  <div className="mt-4">
                    <EnvironmentSummary
                      environment={currentEnvironment}
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          <p className="mt-2 text-[11px] leading-5 text-slate-500">
            {isBangla
              ? "তথ্যসূত্র: NASA POWER Daily API। দৈনিক উপাত্ত প্রকাশে বিলম্ব থাকতে পারে; এটি তাৎক্ষণিক আবহাওয়া পর্যবেক্ষণ নয়।"
              : "Source: NASA POWER Daily API. Daily observations have a reporting delay and are not instantaneous weather measurements."}
          </p>

          {/* LIVE EARTH OBSERVATION CONTEXT */}
          <div
            id="earth-observations"
            className="mt-4 scroll-mt-6"
          >
            <EarthObservationContext
              data={earthObservationData}
              language={language}
            />
          </div>
        </section>

        {/* 4. SOIL */}
        <section className="fs-section">
          <FarmerSoilView
            soil={currentSoil}
            language={language}
          />
        </section>

        {/* 5. CLIMATE SHIFT */}
        <section className="fs-section">
          <Suspense
            fallback={
              <div className="h-40 animate-pulse rounded-[2rem] bg-slate-100" />
            }
          >
            <ClimateShiftSection language={language} />
          </Suspense>
        </section>

        {/* 6. DEMO FIELDS */}
        <section className="fs-section">
          <DemoFieldsSection language={language} />
        </section>

        {/* 7. CROP SELECTION */}
        <section className="fs-section">
          <CropSelector
            crops={crops}
            selectedCrops={selectedCropIds}
            onChange={setSelectedCropIds}
            language={language}
          />
        </section>

        {/* 8. FARMER PRIORITIES */}
        <section className="fs-section">
          <FarmerGoalSelector
            priorities={priorities}
            onChange={setPriorities}
            onApply={updateRecommendations}
            loading={recommendationLoading}
            language={language}
          />

          {recommendationLoading && (
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-100 border-t-blue-600" />
              </div>
              <div>
                <p className="text-sm font-black text-blue-900">
                  {t.status.updating}
                </p>
                <p className="mt-0.5 text-xs text-blue-800/70">
                  {t.status.comparing}
                </p>
              </div>
            </div>
          )}

          {recommendationUpdated && !recommendationLoading && (
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
                  {t.status.updated}
                </p>
                <p className="mt-0.5 text-xs text-green-800/70">
                  {isBangla
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
                  {t.status.error}
                </p>
                <p className="mt-1 text-xs leading-5 text-red-700/80">
                  {error}
                </p>
              </div>
            </div>
          )}
        </section>

        {/* 9. RECOMMENDATIONS */}
        <section
          id="recommendations"
          className="fs-section scroll-mt-6"
        >
          <div className="mb-5 rounded-[2rem] border border-green-100 bg-green-50 p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-green-600">
                  {recommendationLabels.selectedCropFilter}
                </p>
                <h2 className="mt-2 text-xl font-black text-green-950 sm:text-2xl">
                  {recommendationLabels.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-green-900/70">
                  {recommendationLabels.subtitle}
                </p>
              </div>

              <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                <p className="text-2xl font-black text-green-700">
                  {recommendationResults.length}
                </p>
                <p className="text-[10px] font-black uppercase tracking-wide text-green-600">
                  {recommendationLabels.scenarios}
                </p>
              </div>
            </div>

            {selectedCropNames.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {selectedCropNames.map((name) => (
                  <span
                    key={name}
                    className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-green-800 shadow-sm"
                  >
                    🌱 {name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {recommendations ? (
            <PatternRecommendationList
              data={recommendations}
              results={recommendationResults}
              initialItems={3}
              language={language}
            />
          ) : (
            <div className="rounded-[2rem] border border-amber-200 bg-amber-50 p-6 text-center">
              <div className="text-4xl">🌱</div>
              <h3 className="mt-3 text-lg font-black text-amber-950">
                {recommendationLabels.noMatch}
              </h3>
              <p className="mt-2 text-sm text-amber-900/70">
                {recommendationLabels.changeCrops}
              </p>
            </div>
          )}
        </section>

        {/* 10. HOW FIELD SHIFT WORKS */}
        <section className="fs-section overflow-hidden rounded-[2rem] border border-blue-100 bg-blue-50 p-6 sm:p-7">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">
            {isBangla
              ? "FIELD SHIFT কীভাবে কাজ করে"
              : "How FIELD SHIFT works"}
          </p>

          <h2 className="mt-2 text-xl font-black text-blue-950 sm:text-2xl">
            {isBangla
              ? "Earth observation থেকে কৃষি সিদ্ধান্ত"
              : "From Earth observations to farm decisions"}
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-900/70">
            {isBangla
              ? "FIELD SHIFT পরিবেশ, মাটি, ফসল এবং কৃষকের অগ্রাধিকার একসাথে ব্যবহার করে crop rotation-এর সিদ্ধান্তে সহায়তা করে।"
              : "FIELD SHIFT combines environmental, soil, crop and farmer-priority information to support local crop-rotation decisions."}
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [
                "🛰️",
                isBangla ? "NASA তথ্য" : "NASA observations",
                isBangla
                  ? "NASA Earth data থেকে পরিবেশগত তথ্য।"
                  : "Environmental conditions derived from NASA Earth data.",
              ],
              [
                "🌱",
                isBangla ? "স্থানীয় মাটি" : "Local soil",
                isBangla
                  ? "নির্বাচিত মাঠের মাটির তথ্য।"
                  : "Soil information associated with the selected field.",
              ],
              [
                "🌾",
                isBangla ? "ফসলের বৈশিষ্ট্য" : "Crop characteristics",
                isBangla
                  ? "ফসল ও rotation-এর তথ্য।"
                  : "Stored crop and rotation information.",
              ],
              [
                "🎯",
                isBangla ? "আপনার অগ্রাধিকার" : "Your priorities",
                isBangla
                  ? "আপনার farming goals decision score-কে প্রভাবিত করে।"
                  : "Your farming goals influence the decision-support score.",
              ],
            ].map(([icon, title, description]) => (
              <div
                key={title}
                className="rounded-2xl bg-white/70 p-4"
              >
                <div className="text-2xl">{icon}</div>
                <p className="mt-3 text-sm font-black text-blue-950">
                  {title}
                </p>
                <p className="mt-1 text-xs leading-5 text-blue-900/70">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* 11. NOTICE */}
        <section className="fs-section">
          <div className="fs-notice flex items-start gap-3 p-4 sm:p-5">
            <span className="text-base">ℹ️</span>
            <div>
              <p className="font-black text-slate-700">
                {isBangla
                  ? "Decision-support তথ্য"
                  : "Decision-support information"}
              </p>
              <p className="mt-1">
                {isBangla
                  ? "FIELD SHIFT crop-rotation scenario তুলনা করতে সাহায্য করে। এর score yield, profit বা farm performance-এর নিশ্চয়তা নয়।"
                  : "FIELD SHIFT helps compare available crop-rotation scenarios. Its scores are not guarantees of yield, profit or farm performance."}
              </p>
            </div>
          </div>
        </section>

        {/* 12. TECHNICAL DETAILS */}
        <details className="mb-10 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <summary className="cursor-pointer px-6 py-5 text-sm font-black text-slate-800">
            {isBangla ? "কারিগরি তথ্য" : "Technical details"}
          </summary>

          <div className="border-t border-slate-200 p-6">
            <p className="text-sm leading-6 text-slate-500">
              {isBangla
                ? "FIELD SHIFT একটি স্থানীয় offline database ব্যবহার করে, যেখানে NASA-derived environmental features, মাটির তথ্য এবং মূল্যায়িত crop-rotation scenario রয়েছে। Recommendation score একটি decision-support score; এটি yield, profit বা irrigation cost-এর সরাসরি পূর্বাভাস নয়।"
                : "FIELD SHIFT uses a local offline database containing NASA-derived environmental features, soil information and evaluated crop-rotation scenarios. The recommendation score is a decision-support score and is not a direct prediction of yield, profit or irrigation cost."}
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold text-slate-400">
                  {isBangla ? "চালানোর ধরন" : "Runtime"}
                </p>
                <p className="mt-1 text-sm font-bold text-slate-800">
                  Offline
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold text-slate-400">
                  {isBangla ? "Scenario" : "Scenarios"}
                </p>
                <p className="mt-1 text-sm font-bold text-slate-800">
                  {recommendations?.counts.patterns ?? 0}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold text-slate-400">
                  {isBangla ? "ইন্টারনেট" : "Internet"}
                </p>
                <p className="mt-1 text-sm font-bold text-green-700">
                  {isBangla ? "প্রয়োজন নেই" : "Not required"}
                </p>
              </div>
            </div>
          </div>
        </details>
      </section>
    </main>
  );
}