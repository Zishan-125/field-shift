
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

// =======================================================
// CONFIGURATION
// =======================================================

const FIELD_ID =
  import.meta.env.VITE_FIELD_ID ||
  "426e9d97-78cf-45d2-82ae-8131040b5ee7";

// Feni regional map starting position.
// This is the initial map position, not a claim that
// arbitrary map coordinates belong to the prepared dataset.

const FENI_CENTER = {
  latitude: 23.0185,
  longitude: 91.3976,
};

const CROP_HEALTH_SCORE = 78;

const DASHBOARD_CACHE_KEY =
  "field-shift-feni-dashboard-v2";

// =======================================================
// TYPES
// =======================================================

type EnvironmentRow = {
  [key: string]: unknown;

  date?: string;
  observation_date?: string;
  observation_month?: string;

  year?: number;
  month?: number;

  power_temperature_mean?: number;
  temperature_c?: number;

  ag_rainfall_mm?: number;
  power_precipitation?: number;
  precipitation?: number;
  rainfall?: number;

  power_wind_speed?: number;
  wind_speed?: number;

  power_solar_radiation?: number;
  solar_radiation?: number;
};

type DashboardCache = {
  field: Field;
  environmentRows: EnvironmentRow[];
  soil: SoilProfile;
  recommendations: PatternRecommendationResponse;
  crops: NormalizedCrop[];
  savedAt: string;
};

type NASAObservation = {
  latitude: number;
  longitude: number;
  rows: EnvironmentRow[];
  fetchedAt: string;
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

    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      return value as Record<string, unknown>;
    }
  }

  return object;
}

function validNASAValue(
  value: unknown,
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number = Number(value);

  if (
    !Number.isFinite(number) ||
    number === -999
  ) {
    return null;
  }

  return number;
}

function nasaValueOrUndefined(
  value: number | null,
): number | undefined {
  return value === null ? undefined : value;
}

// =======================================================
// ENVIRONMENT DATA NORMALIZATION
// =======================================================

function extractEnvironmentRows(
  input: unknown,
): EnvironmentRow[] {
  let current: unknown = input;

  for (let depth = 0; depth < 6; depth++) {
    if (Array.isArray(current)) {
      return current.filter(
        (item): item is EnvironmentRow =>
          Boolean(
            item &&
            typeof item === "object" &&
            !Array.isArray(item),
          ),
      );
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

    let next: unknown;

    for (const key of candidateKeys) {
      const candidate = object[key];

      if (Array.isArray(candidate)) {
        return candidate.filter(
          (item): item is EnvironmentRow =>
            Boolean(
              item &&
              typeof item === "object" &&
              !Array.isArray(item),
            ),
        );
      }

      if (
        candidate &&
        typeof candidate === "object"
      ) {
        next = candidate;
        break;
      }
    }

    if (next !== undefined && next !== current) {
      current = next;
      continue;
    }

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
  return rows.length
    ? rows[rows.length - 1]
    : {};
}

// =======================================================
// LOCAL DASHBOARD CACHE
// =======================================================

function readDashboardCache(): DashboardCache | null {
  try {
    const stored = localStorage.getItem(
      DASHBOARD_CACHE_KEY,
    );

    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(stored);

    if (
      !parsed ||
      !parsed.field ||
      !Array.isArray(parsed.environmentRows) ||
      !parsed.soil ||
      !parsed.recommendations ||
      !Array.isArray(parsed.crops)
    ) {
      return null;
    }

    return parsed as DashboardCache;
  } catch (error) {
    console.warn(
      "FIELD SHIFT cache could not be read:",
      error,
    );

    return null;
  }
}

function saveDashboardCache(
  data: DashboardCache,
): boolean {
  try {
    localStorage.setItem(
      DASHBOARD_CACHE_KEY,
      JSON.stringify(data),
    );

    return true;
  } catch (error) {
    console.warn(
      "FIELD SHIFT cache could not be saved:",
      error,
    );

    return false;
  }
}

// =======================================================
// SOIL AND FIELD STATUS
// =======================================================

function calculateSoilStatus(
  soil: SoilProfile,
): "good" | "moderate" | "attention" {
  const rawValue = soil["soil_ph_0-5cm"];

  if (
    rawValue === null ||
    rawValue === undefined ||
    rawValue === ""
  ) {
    return "moderate";
  }

  const ph = Number(rawValue);

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

  return precipitation > 0
    ? "moderate"
    : "attention";
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
    banglaName:
      banglaName ||
      englishName ||
      `ফসল ${index + 1}`,
    icon: String(crop.icon ?? crop.emoji ?? "🌱"),
  };
}

function extractCrops(
  data: unknown,
): NormalizedCrop[] {
  if (Array.isArray(data)) {
    return data
      .filter(
        (item): item is Crop =>
          Boolean(item && typeof item === "object"),
      )
      .map(normalizeCrop);
  }

  const object = getObject(
    data,
    "crops",
    "data",
    "results",
  );

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
  if (!selectedCropIds.length) {
    return true;
  }

  return Object.values(pattern.seasons).some(
    (crop) =>
      selectedCropIds.includes(crop.crop_id),
  );
}

// =======================================================
// NASA POWER ONLINE MAP EXPLORATION
// =======================================================

async function fetchNASAPOWER(
  lat: number,
  lon: number,
  signal: AbortSignal,
): Promise<EnvironmentRow[]> {
  const endDate = new Date();

  endDate.setUTCDate(
    endDate.getUTCDate() - 10,
  );

  const startDate = new Date();

  startDate.setUTCDate(
    startDate.getUTCDate() - 17,
  );

  const formatDate = (date: Date) =>
    date
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "");

  const params = new URLSearchParams({
    parameters:
      "T2M,PRECTOTCORR,WS2M,ALLSKY_SFC_SW_DWN",
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

  const parameters =
    payload?.properties?.parameter;

  if (!parameters) {
    throw new Error(
      "NASA POWER returned no parameter data.",
    );
  }

  const temperature = parameters.T2M ?? {};
  const rainfall = parameters.PRECTOTCORR ?? {};
  const wind = parameters.WS2M ?? {};
  const solar = parameters.ALLSKY_SFC_SW_DWN ?? {};

  const dates = Array.from(
    new Set([
      ...Object.keys(temperature),
      ...Object.keys(rainfall),
      ...Object.keys(wind),
      ...Object.keys(solar),
    ]),
  ).sort();

  const rows: EnvironmentRow[] = dates
    .map((date): EnvironmentRow => {
      const temp = nasaValueOrUndefined(
        validNASAValue(temperature[date]),
      );

      const rain = nasaValueOrUndefined(
        validNASAValue(rainfall[date]),
      );

      const windSpeed = nasaValueOrUndefined(
        validNASAValue(wind[date]),
      );

      const solarRadiation = nasaValueOrUndefined(
        validNASAValue(solar[date]),
      );

      const year = Number(date.slice(0, 4));
      const month = Number(date.slice(4, 6));

      const formattedDate =
        `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;

      return {
        date: formattedDate,
        observation_date: formattedDate,

        observation_month:
          `${year}-${String(month).padStart(2, "0")}`,

        year,
        month,

        power_temperature_mean: temp,
        temperature_c: temp,

        ag_rainfall_mm: rain,
        power_precipitation: rain,
        precipitation: rain,
        rainfall: rain,

        power_wind_speed: windSpeed,
        wind_speed: windSpeed,

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
      ].some(
        (value) =>
          value !== undefined &&
          value !== null,
      ),
    );

  if (!rows.length) {
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

const [language, setLanguage] =
  useState<Language>(() => {
    const stored = localStorage.getItem(
      "field-shift-language",
    );

    return stored === "bn" ? "bn" : "en";
  });

const t = language === "bn" ? bn : en;
const isBangla = language === "bn";
  const recommendationLabels = {
    selectedCropFilter:
      "selectedCropFilter" in t.recommendations
        ? String(
            (
              t.recommendations as Record<
                string,
                unknown
              >
            ).selectedCropFilter ??
            (isBangla ? "নির্বাচিত ফসল" : "Selected crops"),
          )
        : isBangla
          ? "নির্বাচিত ফসল"
          : "Selected crops",

    title: t.recommendations.title,

    subtitle:
      "subtitle" in t.recommendations
        ? String(
            (
              t.recommendations as Record<
                string,
                unknown
              >
            ).subtitle ??
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
            (
              t.recommendations as Record<
                string,
                unknown
              >
            ).scenarios ??
            (isBangla ? "সম্ভাব্য পরিকল্পনা" : "Possible plans"),
          )
        : isBangla
          ? "সম্ভাব্য পরিকল্পনা"
          : "Possible plans",

    noMatch: t.recommendations.noMatch,
    changeCrops: t.recommendations.changeCrops,
  };

  // -----------------------------------------------------
  // CONNECTIVITY
  // -----------------------------------------------------

  const [isOnline, setIsOnline] = useState(
    () => navigator.onLine,
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener(
        "online",
        handleOnline,
      );

      window.removeEventListener(
        "offline",
        handleOffline,
      );
    };
  }, []);

  // -----------------------------------------------------
  // DASHBOARD MODE
  // -----------------------------------------------------

  
    useState("regional");

  // -----------------------------------------------------
  // FIELD
  // -----------------------------------------------------

  const [field, setField] =
    useState<Field | null>(null);

  // -----------------------------------------------------
  // FENI PREPARED ENVIRONMENT DATA
  //
  // IMPORTANT:
  // This state is exclusively for prepared backend
  // regional observations.
  //
  // Map exploration never modifies this state.
  // -----------------------------------------------------

  const [preparedEnvironmentRows, setPreparedEnvironmentRows] =
    useState<EnvironmentRow[]>([]);

  const [preparedDataAvailable, setPreparedDataAvailable] =
    useState(false);

  const [cacheSavedAt, setCacheSavedAt] =
    useState<string | null>(null);

  // -----------------------------------------------------
  // ONLINE MAP EXPLORATION COORDINATES
  // -----------------------------------------------------

  const [mapLat, setMapLat] = useState(
    FENI_CENTER.latitude,
  );

  const [mapLon, setMapLon] = useState(
    FENI_CENTER.longitude,
  );

  const [hasExploredLocation, setHasExploredLocation] =
    useState(false);

  // -----------------------------------------------------
  // ONLINE NASA TELEMETRY
  //
  // This is completely separate from the Feni dataset.
  // -----------------------------------------------------

  const [explorationData, setExplorationData] =
    useState<NASAObservation | null>(null);

  const [explorationLoading, setExplorationLoading] =
    useState(false);

  const [explorationError, setExplorationError] =
    useState("");

  // -----------------------------------------------------
  // SOIL
  // -----------------------------------------------------

  const [soil, setSoil] =
    useState<SoilProfile | null>(null);

  // -----------------------------------------------------
  // RECOMMENDATIONS
  // -----------------------------------------------------

  const [recommendations, setRecommendations] =
    useState<PatternRecommendationResponse | null>(
      null,
    );

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

  const [crops, setCrops] =
    useState<NormalizedCrop[]>([]);

  const [selectedCropIds, setSelectedCropIds] =
    useState<string[]>([]);

  // -----------------------------------------------------
  // DASHBOARD STATUS
  // -----------------------------------------------------

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [syncNotice, setSyncNotice] =
    useState("");

  // -----------------------------------------------------
  // LANGUAGE PERSISTENCE
  // -----------------------------------------------------

  useEffect(() => {
    localStorage.setItem(
      "field-shift-language",
      language,
    );
  }, [language]);

  // =====================================================
  // APPLY CACHED OR BACKEND DATA
  // =====================================================

  function applyDashboardData(
    data: DashboardCache,
    fromCache: boolean,
  ) {
    setField(data.field);

    setPreparedEnvironmentRows(
      sortEnvironmentRows(data.environmentRows),
    );

    setPreparedDataAvailable(
      data.environmentRows.length > 0,
    );

    setSoil(data.soil);

    setRecommendations(data.recommendations);

    setCrops(data.crops);

    setCacheSavedAt(data.savedAt);

    if (fromCache) {
      console.info(
        "FIELD SHIFT: Restored Feni regional dataset from local cache.",
      );
    }
  }

  // =====================================================
  // INITIAL DASHBOARD LOAD
  // =====================================================

  useEffect(() => {
    let active = true;

    async function loadDashboard() {

      // 1. Restore previously saved data first.

      const cachedData = readDashboardCache();

      if (cachedData) {
        applyDashboardData(cachedData, true);

        setSyncNotice(
          language === "bn"
            ? "সংরক্ষিত স্থানীয় তথ্য ব্যবহার করা হচ্ছে।"
            : "Using previously saved regional data.",
        );

        setLoading(false);
      }

      // 2. If offline, continue with cached data.

      if (!navigator.onLine) {
        if (!cachedData && active) {
          setError(
            language === "bn"
              ? "কোনো সংরক্ষিত তথ্য পাওয়া যায়নি। প্রথমবার ডেটা লোড করতে ইন্টারনেট প্রয়োজন।"
              : "No saved dashboard data is available. Internet is required for the first data download.",
          );

          setLoading(false);
        }

        return;
      }

      // 3. Refresh prepared regional data from backend.

      try {
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

        const fieldObject = getObject(
          fieldData,
          "field",
        ) as unknown as Field;

        const environmentRows =
          sortEnvironmentRows(
            extractEnvironmentRows(environmentData),
          );

        const soilObject = getObject(
          soilData,
          "soil_profile",
          "soil",
          "profile",
          "data",
        ) as unknown as SoilProfile;

        const normalizedCrops =
          extractCrops(cropData);

        const newCache: DashboardCache = {
          field: fieldObject,

          environmentRows,

          soil: soilObject,

          recommendations: recommendationData,

          crops: normalizedCrops,

          savedAt: new Date().toISOString(),
        };

        // 4. Update regional dataset ONLY.

        applyDashboardData(newCache, false);

        // 5. Save prepared data for future offline access.

        const saved = saveDashboardCache(newCache);

        setSyncNotice(
          saved
            ? language === "bn"
              ? "Feni regional dataset আপডেট ও স্থানীয়ভাবে সংরক্ষণ করা হয়েছে।"
              : "Feni regional dataset refreshed and saved locally."
            : language === "bn"
              ? "তথ্য লোড হয়েছে, তবে browser storage-এ সংরক্ষণ করা যায়নি।"
              : "Data loaded, but browser storage could not save the cache.",
        );

        setError("");

      } catch (err: unknown) {

        console.error(
          "FIELD SHIFT dashboard refresh failed:",
          err,
        );

        if (!active) return;

        if (cachedData) {
          setSyncNotice(
            language === "bn"
              ? "ইন্টারনেট সংযোগ পাওয়া যায়নি। সংরক্ষিত Feni dataset ব্যবহার করা হচ্ছে।"
              : "Backend unavailable. Continuing with cached Feni regional data.",
          );
        } else {
          setError(
            getApiErrorMessage(
              err,
              language === "bn"
                ? "FIELD SHIFT-এর backend-এর সাথে সংযোগ করা যাচ্ছে না।"
                : "Unable to connect to the FIELD SHIFT backend.",
            ),
          );
        }

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

  // =====================================================
  // ONLINE NASA MAP EXPLORATION
  //
  // Only triggered after the user selects a location.
  //
  // It NEVER modifies preparedEnvironmentRows.
  // =====================================================

  useEffect(() => {

    if (!hasExploredLocation) return;

    if (!isOnline) {
      setExplorationError(
        language === "bn"
          ? "অনলাইন NASA POWER তথ্য পেতে ইন্টারনেট প্রয়োজন।"
          : "Internet is required for online NASA POWER exploration.",
      );

      return;
    }

    const controller = new AbortController();

    async function loadExplorationData() {
      try {
        setExplorationLoading(true);

        setExplorationError("");

        const rows = await fetchNASAPOWER(
          mapLat,
          mapLon,
          controller.signal,
        );

        if (controller.signal.aborted) return;

        setExplorationData({
          latitude: mapLat,
          longitude: mapLon,
          rows: sortEnvironmentRows(rows),
          fetchedAt: new Date().toISOString(),
        });

       

        console.info(
          "NASA POWER map exploration updated.",
          {
            latitude: mapLat,
            longitude: mapLon,
            observationCount: rows.length,
          },
        );

      } catch (err: unknown) {

        if (
          err instanceof Error &&
          err.name === "AbortError"
        ) {
          return;
        }

        console.error(
          "NASA POWER exploration failed:",
          err,
        );

        if (!controller.signal.aborted) {
          setExplorationError(
            getApiErrorMessage(
              err,
              language === "bn"
                ? "নির্বাচিত স্থানের NASA POWER তথ্য পাওয়া যায়নি।"
                : "Could not retrieve NASA POWER data for this location.",
            ),
          );
        }

      } finally {
        if (!controller.signal.aborted) {
          setExplorationLoading(false);
        }
      }
    }

    void loadExplorationData();

    return () => {
      controller.abort();
    };

  }, [
    mapLat,
    mapLon,
    hasExploredLocation,
    isOnline,
    language,
  ]);

  // =====================================================
  // UPDATE RECOMMENDATIONS
  // =====================================================

  async function updateRecommendations(): Promise<boolean> {

    if (recommendationLoading) return false;

    if (!isOnline) {
      setError(
        language === "bn"
          ? "নতুন recommendation তৈরি করতে backend সংযোগ প্রয়োজন। সংরক্ষিত recommendation এখনো ব্যবহার করা যাবে।"
          : "A backend connection is required to generate new recommendations. Previously saved recommendations remain available.",
      );

      return false;
    }

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

      // Update cached recommendations without replacing
      // the prepared regional environmental observations.

      const existingCache = readDashboardCache();

      if (existingCache) {
        const updatedCache: DashboardCache = {
          ...existingCache,
          recommendations: data,
          savedAt: new Date().toISOString(),
        };

        saveDashboardCache(updatedCache);

        setCacheSavedAt(updatedCache.savedAt);
      }

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

  // =====================================================
  // SELECTED CROPS
  // =====================================================

  const selectedCrops = useMemo(
    () =>
      crops.filter((crop) =>
        selectedCropIds.includes(crop.id),
      ),
    [crops, selectedCropIds],
  );

  const selectedCropNames = selectedCrops.map(
    (crop) =>
      language === "bn"
        ? crop.banglaName
        : crop.englishName,
  );

  // =====================================================
  // FILTER RECOMMENDATIONS
  // =====================================================

  const recommendationResults =
    useMemo<RecommendedPattern[]>(() => {
      if (!Array.isArray(recommendations?.results)) {
        return [];
      }

      return recommendations.results.filter(
        (pattern) =>
          matchesSelectedCrops(
            pattern,
            selectedCropIds,
          ),
      );
    }, [recommendations, selectedCropIds]);

  // =====================================================
  // PREPARED REGIONAL ENVIRONMENT
  // =====================================================

  const currentSoil = soil || {};

  const currentEnvironment =
    latestEnvironmentRow(preparedEnvironmentRows);

  const earthObservationData = useMemo(
    () => ({
      data: preparedEnvironmentRows,
    }),
    [preparedEnvironmentRows],
  );

  // =====================================================
  // FIELD STATUS
  //
  // Status cards use prepared regional data only.
  // Arbitrary map clicks cannot change these values.
  // =====================================================

  const soilStatus =
    calculateSoilStatus(currentSoil);

  const waterStatus =
    calculateWaterStatus(currentEnvironment);

  const climateStatus =
    calculateClimateStatus(currentEnvironment);

  // =====================================================
  // EXPLORATION SUMMARY
  // =====================================================

  const explorationRows =
    explorationData?.rows ?? [];

  const latestExploration =
    latestEnvironmentRow(explorationRows);

  // =====================================================
  // LOADING SCREEN
  // =====================================================

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
            {isBangla
              ? "Feni regional dataset লোড হচ্ছে"
              : "Loading Feni regional dataset"}
          </p>
        </div>
      </div>
    );
  }

  // =====================================================
  // CONNECTION ERROR
  // =====================================================

  if (error && !field) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-lg rounded-[2rem] border border-red-200 bg-white p-7 shadow-sm sm:p-8">

          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-xl">
            ⚠️
          </div>

          <p className="mt-5 text-[10px] font-black uppercase tracking-[0.18em] text-red-600">
            {isBangla ? "সংযোগ সমস্যা" : "Connection problem"}
          </p>

          <h1 className="mt-2 text-2xl font-black text-slate-900">
            {isBangla
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
            {isBangla ? "↻ আবার চেষ্টা করুন" : "↻ Try again"}
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

      {/* ================================================
          TOP BAR
      ================================================ */}

      <div className="fs-container pt-4">

        <div className="flex flex-wrap items-center justify-between gap-3">

          <div className="flex flex-wrap items-center gap-2">

            <span className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-green-800">
              <span className="h-2 w-2 rounded-full bg-green-500" />

              Feni Regional Dataset
            </span>

            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-[10px] font-bold text-slate-600">

              {isOnline ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                  {isBangla ? "অনলাইন" : "Online"}
                </>
              ) : (
                <>
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  {isBangla ? "অফলাইন" : "Offline"}
                </>
              )}

            </span>

            {preparedDataAvailable && (
              <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-2 text-[10px] font-bold text-blue-800">
                {isBangla
                  ? "স্থানীয় তথ্য সংরক্ষিত"
                  : "Offline data available"}
              </span>
            )}

          </div>

          <LanguageSwitcher
            language={language}
            onChange={setLanguage}
          />

        </div>

        {syncNotice && (
          <p
            className="mt-3 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs text-slate-600"
            role="status"
            aria-live="polite"
          >
            {syncNotice}
          </p>
        )}

      </div>

      {/* ================================================
          HEADER
      ================================================ */}

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

        {/* ==============================================
            1. REGIONAL DATASET NOTICE
        ============================================== */}

        <section className="fs-section">

          <div className="overflow-hidden rounded-[2rem] border border-green-200 bg-white shadow-sm">

            <div className="bg-green-50 p-5 sm:p-6">

              <div className="flex flex-wrap items-center justify-between gap-3">

                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-green-700">
                    {isBangla
                      ? "স্থানীয় কৃষি সিদ্ধান্ত সহায়তা"
                      : "Regional agricultural decision support"}
                  </p>

                  <h2 className="mt-2 text-xl font-black text-green-950 sm:text-2xl">
                    {isBangla
                      ? "ফেনী অঞ্চলের কৃষকদের জন্য তৈরি"
                      : "Built for Feni Farmers"}
                  </h2>

                  <p className="mt-2 max-w-2xl text-sm leading-6 text-green-900/75">
                    {isBangla
                      ? "NASA Earth observation থেকে প্রস্তুত করা পরিবেশগত তথ্য, মাটির বৈশিষ্ট্য এবং ফসলের তথ্য ব্যবহার করে FIELD SHIFT স্থানীয় crop rotation সিদ্ধান্তে সহায়তা করে।"
                      : "FIELD SHIFT uses preprocessed NASA Earth observations, soil information and crop characteristics to support location-specific crop rotation decisions for farmers in Feni, Bangladesh."}
                  </p>
                </div>

                <span className="rounded-xl border border-green-200 bg-white px-4 py-3 text-xs font-black text-green-800">
                  {isBangla
                    ? "ফেনী, বাংলাদেশ"
                    : "Feni, Bangladesh"}
                </span>

              </div>

            </div>

            <div className="grid gap-3 p-5 sm:grid-cols-3">

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold text-slate-500">
                  {isBangla ? "তথ্যের উৎস" : "Data source"}
                </p>

                <p className="mt-1 text-sm font-black text-slate-800">
                  NASA + Regional Data
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold text-slate-500">
                  {isBangla ? "ডেটা ব্যবহার" : "Data access"}
                </p>

                <p className="mt-1 text-sm font-black text-green-700">
                  {isBangla
                    ? "অফলাইনেও পাওয়া যায়"
                    : "Available offline"}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold text-slate-500">
                  {isBangla ? "ভৌগোলিক পরিধি" : "Geographic scope"}
                </p>

                <p className="mt-1 text-sm font-black text-slate-800">
                  Feni District
                </p>
              </div>

            </div>

          </div>

        </section>

        {/* ==============================================
            2. FIELD STATUS
        ============================================== */}

        <section className="fs-section">

          <FarmerFieldStatus
            soilStatus={soilStatus}
            waterStatus={waterStatus}
            climateStatus={climateStatus}
            language={language}
          />

        </section>

        {/* ==============================================
            3. FARM MAP
        ============================================== */}

        <section
          id="farm-map"
          className="fs-section scroll-mt-6 space-y-4"
        >

          <SectionTitle
            eyebrow={
              isBangla
                ? "স্থানীয় জমি ও মানচিত্র"
                : "Farm location and map"
            }
            title={
              isBangla
                ? "আপনার জমি নির্বাচন করুন"
                : "Explore a farm location"
            }
            description={
              isBangla
                ? "ম্যাপে স্থান নির্বাচন করে NASA POWER-এর অনলাইন পরিবেশগত পর্যবেক্ষণ দেখতে পারবেন। এটি প্রস্তুত Feni regional dataset থেকে আলাদা।"
                : "Select a location to explore NASA POWER observations online. Map exploration is separate from the prepared Feni regional dataset."
            }
          />

          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">

            <p className="text-xs font-black text-blue-900">
              {isBangla
                ? "অনলাইন মানচিত্র অনুসন্ধান"
                : "Online map exploration"}
            </p>

            <p className="mt-1 text-xs leading-5 text-blue-800/80">
              {isBangla
                ? "অন্য অঞ্চলের স্থানাঙ্ক নির্বাচন করলে সেই স্থানের NASA POWER তথ্য আলাদাভাবে লোড হবে। এটি Feni farmer recommendation পরিবর্তন করবে না।"
                : "Selecting coordinates outside Feni retrieves separate NASA POWER observations. It does not change the Feni farmer decision-support dataset."}
            </p>

          </div>

          <FarmMap
            initialLat={mapLat}
            initialLon={mapLon}
            onLocationSelect={(lat, lon) => {

              setMapLat(lat);
              setMapLon(lon);

              setHasExploredLocation(true);

              setExplorationData(null);

              setExplorationError("");

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

        {/* ==============================================
            4. ONLINE MAP EXPLORATION RESULT
        ============================================== */}

        {hasExploredLocation && (

          <section className="fs-section mt-6">

            <div className="overflow-hidden rounded-[2rem] border border-blue-200 bg-white shadow-sm">

              <div className="border-b border-blue-100 bg-blue-50 p-5 sm:p-6">

                <div className="flex flex-wrap items-center justify-between gap-3">

                  <div>

                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-700">
                      NASA POWER API
                    </p>

                    <h2 className="mt-2 text-xl font-black text-blue-950">
                      {isBangla
                        ? "অনলাইন স্থানভিত্তিক পর্যবেক্ষণ"
                        : "Online location exploration"}
                    </h2>

                  </div>

                  <span className="rounded-full bg-blue-100 px-3 py-2 text-[10px] font-black text-blue-800">
                    {isBangla
                      ? "ইন্টারনেট প্রয়োজন"
                      : "Internet required"}
                  </span>

                </div>

                <p className="mt-3 text-xs text-blue-900/80">
                  {isBangla
                    ? `নির্বাচিত স্থানাঙ্ক: ${mapLat.toFixed(4)}, ${mapLon.toFixed(4)}`
                    : `Selected coordinates: ${mapLat.toFixed(4)}, ${mapLon.toFixed(4)}`}
                </p>

              </div>

              <div className="p-5 sm:p-6">

                {explorationLoading && (

                  <div
                    className="flex items-center gap-3 rounded-xl bg-blue-50 p-4"
                    role="status"
                  >

                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-100 border-t-blue-600" />

                    <p className="text-xs font-bold text-blue-800">
                      {isBangla
                        ? "NASA POWER তথ্য লোড হচ্ছে..."
                        : "Fetching NASA POWER observations..."}
                    </p>

                  </div>

                )}

                {explorationError && (

                  <div
                    className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800"
                    role="alert"
                  >
                    {explorationError}
                  </div>

                )}

                {explorationData && (

                  <>

                    <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50/50 p-4">

                      <p className="text-xs font-bold text-blue-800">
                        {isBangla
                          ? "সর্বশেষ উপলব্ধ পর্যবেক্ষণ"
                          : "Latest available observation"}
                      </p>

                      <p className="mt-1 text-[10px] text-slate-500">
                        {latestExploration.date ||
                          latestExploration.observation_date ||
                          "Date unavailable"}
                      </p>

                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

                      {[
                        {
                          label: "Temperature",
                          value:
                            validNASAValue(
                              latestExploration.power_temperature_mean,
                            ),
                          unit: "°C",
                        },
                        {
                          label: "Precipitation",
                          value:
                            validNASAValue(
                              latestExploration.ag_rainfall_mm,
                            ),
                          unit: "mm/day",
                        },
                        {
                          label: "Wind speed",
                          value:
                            validNASAValue(
                              latestExploration.power_wind_speed,
                            ),
                          unit: "m/s",
                        },
                        {
                          label: "Solar radiation",
                          value:
                            validNASAValue(
                              latestExploration.power_solar_radiation,
                            ),
                          unit: "kWh/m²/day",
                        },
                      ].map((item) => (

                        <div
                          key={item.label}
                          className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                        >

                          <p className="text-xs font-bold text-slate-500">
                            {item.label}
                          </p>

                          <p className="mt-2 text-xl font-black text-slate-900">
                            {item.value !== null
                              ? `${item.value.toFixed(2)} ${item.unit}`
                              : "Unavailable"}
                          </p>

                        </div>

                      ))}

                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2">

                      <p className="text-[10px] text-slate-500">
                        {isBangla
                          ? `${explorationRows.length}টি পর্যবেক্ষণ পাওয়া গেছে`
                          : `${explorationRows.length} observations retrieved`}
                      </p>

                      <p className="text-[10px] text-slate-500">
                        {isBangla
                          ? "NASA POWER Daily API"
                          : "NASA POWER Daily API"}
                      </p>

                    </div>

                  </>

                )}

              </div>

            </div>

          </section>

        )}

        {/* ==============================================
            5. FARM CHATBOT
        ============================================== */}

        <section className="fs-section scroll-mt-6 mt-6">
          <FarmChatBot
            isBangla={isBangla}
            selectedFieldName={
              field?.name ||
              (language === "bn"
                ? "নির্বাচিত জমির প্লট"
                : "Selected Field Plot")
            }
            cropHealthScore={CROP_HEALTH_SCORE}
            lat={mapLat}
            lon={mapLon}
            liveTelemetry={{
              temp: Number.isFinite(Number(currentEnvironment.power_temperature_mean))
                ? Number(currentEnvironment.power_temperature_mean)
                : null,
              rainfall: Number.isFinite(
                Number(
                  currentEnvironment.ag_rainfall_mm ??
                    currentEnvironment.power_precipitation
                )
              )
                ? Number(
                    currentEnvironment.ag_rainfall_mm ??
                      currentEnvironment.power_precipitation
                  )
                : null,
              windSpeed: Number.isFinite(Number(currentEnvironment.power_wind_speed))
                ? Number(currentEnvironment.power_wind_speed)
                : null,
              solarRadiation: Number.isFinite(
                Number(currentEnvironment.power_solar_radiation)
              )
                ? Number(currentEnvironment.power_solar_radiation)
                : null,
              observationDate: String(
                currentEnvironment.observation_date ?? ""
              ),
            }}
          />
        </section>

        {/* ==============================================
            6. PREPARED FENI ENVIRONMENT
        ============================================== */}

        <section className="fs-section mt-6">

          <SectionTitle
            eyebrow={
              isBangla
                ? "প্রস্তুত স্থানীয় পরিবেশগত তথ্য"
                : "Prepared regional environmental data"
            }
            title={
              isBangla
                ? "Feni Regional Environment"
                : "Feni Regional Environmental Context"
            }
            description={
              isBangla
                ? "Feni অঞ্চলের জন্য আগে থেকে প্রস্তুত করা পরিবেশগত পর্যবেক্ষণ। এটি তাৎক্ষণিক আবহাওয়া পরিমাপ নয়।"
                : "Preprocessed environmental observations prepared for the Feni region. These are not instantaneous weather measurements."
            }
          />

          <div className="mt-5 overflow-hidden rounded-[2rem] border border-green-200 bg-white shadow-sm">

            <div className="border-b border-green-100 bg-green-50 p-5">

              <div className="flex flex-wrap items-center justify-between gap-3">

                <div>
                  <p className="text-sm font-black text-green-950">
                    Feni Regional Dataset
                  </p>

                  <p className="mt-1 text-xs text-green-800/75">
                    {isBangla
                      ? "Prepared data • Offline available"
                      : "Prepared data • Offline available"}
                  </p>
                </div>

                <span className="rounded-full bg-white px-3 py-2 text-[10px] font-black text-green-800">
                  {preparedEnvironmentRows.length}{" "}
                  {isBangla ? "টি রেকর্ড" : "records"}
                </span>

              </div>

            </div>

            <div className="p-5 sm:p-6">

              {!preparedDataAvailable ? (

                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">

                  <p className="text-sm font-bold text-slate-700">
                    {isBangla
                      ? "প্রস্তুত পরিবেশগত তথ্য পাওয়া যায়নি।"
                      : "No prepared environmental observations are available."}
                  </p>

                  <p className="mt-2 text-xs text-slate-500">
                    {isBangla
                      ? "Backend-এর regional dataset পরীক্ষা করুন।"
                      : "Check the backend regional dataset."}
                  </p>

                </div>

              ) : (

                <>

                  <WeatherSummary
                    environment={
                      currentEnvironment as unknown as import("../types/environment").Environment
                    }
                  />

                  <div className="mt-4">

                    <EnvironmentSummary
                      environment={
                        currentEnvironment as unknown as import("../types/environment").Environment
                      }
                    />

                  </div>

                </>

              )}

            </div>

          </div>

          <p className="mt-3 text-[11px] leading-5 text-slate-500">
            {isBangla
              ? "তথ্যসূত্র: প্রস্তুত Feni regional dataset এবং NASA-derived environmental features। পর্যবেক্ষণের সময়কাল ও আপডেটের তারিখ মূল dataset অনুযায়ী নির্ধারিত।"
              : "Source: Prepared Feni regional dataset and NASA-derived environmental features. Observation periods and update dates depend on the underlying dataset."}
          </p>

          {/* PREPARED EARTH OBSERVATIONS */}

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

        {/* ==============================================
            7. SOIL
        ============================================== */}

        <section className="fs-section">

          <FarmerSoilView
            soil={currentSoil}
            language={language}
          />

        </section>

        {/* ==============================================
            8. CLIMATE SHIFT
        ============================================== */}

        <section className="fs-section">

          <Suspense
            fallback={
              <div className="h-40 animate-pulse rounded-[2rem] bg-slate-100" />
            }
          >

            <ClimateShiftSection
              language={language}
            />

          </Suspense>

        </section>

        {/* ==============================================
            9. DEMO FIELDS
        ============================================== */}

        <section className="fs-section">

          <DemoFieldsSection
            language={language}
          />

        </section>

        {/* ==============================================
            10. CROP SELECTION
        ============================================== */}

        <section className="fs-section">

          <CropSelector
            crops={crops}
            selectedCrops={selectedCropIds}
            onChange={setSelectedCropIds}
            language={language}
          />

        </section>

        {/* ==============================================
            11. FARMER PRIORITIES
        ============================================== */}

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

        {/* ==============================================
            12. RECOMMENDATIONS
        ============================================== */}

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

              <div className="text-4xl">
                🌱
              </div>

              <h3 className="mt-3 text-lg font-black text-amber-950">
                {recommendationLabels.noMatch}
              </h3>

              <p className="mt-2 text-sm text-amber-900/70">
                {recommendationLabels.changeCrops}
              </p>

            </div>

          )}

        </section>

        {/* ==============================================
            13. HOW FIELD SHIFT WORKS
        ============================================== */}

        <section className="fs-section overflow-hidden rounded-[2rem] border border-blue-100 bg-blue-50 p-6 sm:p-7">

          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">
            {isBangla
              ? "FIELD SHIFT কীভাবে কাজ করে"
              : "How FIELD SHIFT works"}
          </p>

          <h2 className="mt-2 text-xl font-black text-blue-950 sm:text-2xl">
            {isBangla
              ? "Earth observation থেকে কৃষি সিদ্ধান্ত"
              : "From Earth Observations to Farm Decisions"}
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-900/70">
            {isBangla
              ? "FIELD SHIFT পরিবেশ, মাটি, ফসল এবং কৃষকের অগ্রাধিকার একসাথে ব্যবহার করে crop rotation-এর সিদ্ধান্তে সহায়তা করে।"
              : "FIELD SHIFT combines prepared environmental observations, soil information, crop characteristics and farmer priorities to support regional crop rotation decisions."}
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

            {[
              [
                "🛰️",
                isBangla ? "NASA তথ্য" : "NASA observations",
                isBangla
                  ? "প্রস্তুত Earth observation dataset থেকে পরিবেশগত বৈশিষ্ট্য।"
                  : "Environmental features derived from prepared Earth observation datasets.",
              ],
              [
                "🌱",
                isBangla ? "স্থানীয় মাটি" : "Regional soil",
                isBangla
                  ? "নির্বাচিত মাঠের মাটির তথ্য।"
                  : "Soil information associated with the regional field dataset.",
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
                isBangla ? "আপনার অগ্রাধিকার" : "Farmer priorities",
                isBangla
                  ? "আপনার farming goals decision score-কে প্রভাবিত করে।"
                  : "Farmer priorities influence the decision-support score.",
              ],
            ].map(([icon, title, description]) => (

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

            ))}

          </div>

          {/* DATA PIPELINE */}

          <div className="mt-6 rounded-2xl border border-blue-100 bg-white p-5">

            <p className="text-xs font-black uppercase tracking-wide text-blue-800">
              {isBangla
                ? "ডেটা প্রস্তুতি ও ব্যবহার"
                : "Data preparation and usage"}
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

              {[
                "NASA / Earth Observation",
                "Regional Data Processing",
                "Prepared Feni Dataset",
                "Offline Farmer Decision Support",
              ].map((step, index) => (

                <div
                  key={step}
                  className="relative rounded-xl bg-blue-50 p-4"
                >

                  <p className="text-[10px] font-black text-blue-500">
                    STEP {index + 1}
                  </p>

                  <p className="mt-2 text-sm font-black leading-5 text-blue-950">
                    {step}
                  </p>

                </div>

              ))}

            </div>

          </div>

        </section>

        {/* ==============================================
            14. DECISION SUPPORT NOTICE
        ============================================== */}

        <section className="fs-section">

          <div className="fs-notice flex items-start gap-3 p-4 sm:p-5">

            <span className="text-base">
              ℹ️
            </span>

            <div>

              <p className="font-black text-slate-700">
                {isBangla
                  ? "Decision-support তথ্য"
                  : "Decision-support information"}
              </p>

              <p className="mt-1">
                {isBangla
                  ? "FIELD SHIFT crop-rotation scenario তুলনা করতে সাহায্য করে। এর score yield, profit বা farm performance-এর নিশ্চয়তা নয়। তথ্য ও recommendation Feni regional dataset-এর পরিধিতে ব্যবহার করা উচিত।"
                  : "FIELD SHIFT helps compare crop-rotation scenarios. Its scores are not guarantees of yield, profit or farm performance. Recommendations should be interpreted within the scope of the prepared Feni regional dataset."}
              </p>

            </div>

          </div>

        </section>

        {/* ==============================================
            15. TECHNICAL DETAILS
        ============================================== */}

        <details className="mb-10 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

          <summary className="cursor-pointer px-6 py-5 text-sm font-black text-slate-800">

            {isBangla
              ? "কারিগরি তথ্য"
              : "Technical details"}

          </summary>

          <div className="border-t border-slate-200 p-6">

            <p className="text-sm leading-6 text-slate-500">

              {isBangla
                ? "FIELD SHIFT প্রস্তুত Feni regional dataset এবং browser-এর local cache ব্যবহার করে। এতে NASA-derived environmental features, মাটির তথ্য এবং মূল্যায়িত crop-rotation scenario রয়েছে। অনলাইন মানচিত্র অনুসন্ধান আলাদা NASA POWER request ব্যবহার করে। Recommendation score সরাসরি yield, profit বা irrigation cost-এর পূর্বাভাস নয়।"
                : "FIELD SHIFT uses a prepared Feni regional dataset and browser-based local caching. It includes NASA-derived environmental features, soil information and evaluated crop-rotation scenarios. Online map exploration uses separate NASA POWER requests. Recommendation scores are not direct predictions of yield, profit or irrigation cost."}

            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">

              <div className="rounded-xl bg-slate-50 p-4">

                <p className="text-xs font-bold text-slate-400">
                  {isBangla
                    ? "ভৌগোলিক পরিধি"
                    : "Geographic scope"}
                </p>

                <p className="mt-1 text-sm font-bold text-slate-800">
                  Feni District, Bangladesh
                </p>

              </div>

              <div className="rounded-xl bg-slate-50 p-4">

                <p className="text-xs font-bold text-slate-400">
                  {isBangla
                    ? "প্রস্তুত ডেটাসেট"
                    : "Prepared dataset"}
                </p>

                <p className="mt-1 text-sm font-bold text-slate-800">
                  {preparedDataAvailable
                    ? isBangla
                      ? "পাওয়া গেছে"
                      : "Available"
                    : isBangla
                      ? "পাওয়া যায়নি"
                      : "Unavailable"}
                </p>

              </div>

              <div className="rounded-xl bg-slate-50 p-4">

                <p className="text-xs font-bold text-slate-400">
                  {isBangla
                    ? "সংরক্ষিত তথ্য"
                    : "Local cache"}
                </p>

                <p className="mt-1 text-sm font-bold text-green-700">
                  {preparedDataAvailable
                    ? isBangla
                      ? "সংরক্ষিত"
                      : "Available"
                    : isBangla
                      ? "নেই"
                      : "Unavailable"}
                </p>

              </div>

              <div className="rounded-xl bg-slate-50 p-4">

                <p className="text-xs font-bold text-slate-400">
                  {isBangla
                    ? "Recommendation scenarios"
                    : "Recommendation scenarios"}
                </p>

                <p className="mt-1 text-sm font-bold text-slate-800">
                  {recommendations?.counts.patterns ?? 0}
                </p>

              </div>

              <div className="rounded-xl bg-slate-50 p-4">

                <p className="text-xs font-bold text-slate-400">
                  {isBangla
                    ? "অনলাইন সংযোগ"
                    : "Internet connection"}
                </p>

                <p className="mt-1 text-sm font-bold text-slate-800">
                  {isOnline
                    ? isBangla
                      ? "সংযুক্ত"
                      : "Connected"
                    : isBangla
                      ? "বিচ্ছিন্ন"
                      : "Disconnected"}
                </p>

              </div>

              <div className="rounded-xl bg-slate-50 p-4">

                <p className="text-xs font-bold text-slate-400">
                  {isBangla
                    ? "শেষ cache update"
                    : "Last cache update"}
                </p>

                <p className="mt-1 text-sm font-bold text-slate-800">
                  {cacheSavedAt
                    ? new Date(cacheSavedAt).toLocaleString(
                        language === "bn" ? "bn-BD" : "en-GB",
                      )
                    : isBangla
                      ? "তথ্য নেই"
                      : "Not available"}
                </p>

              </div>

            </div>

            <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-4">

              <p className="text-xs font-black text-blue-900">
                {isBangla
                  ? "Online বনাম Offline"
                  : "Online versus Offline"}
              </p>

              <p className="mt-2 text-xs leading-6 text-blue-900/80">
                {isBangla
                  ? "আগে থেকে সংরক্ষিত regional dataset এবং recommendation ইন্টারনেট ছাড়া ব্যবহার করা যায়। নতুন backend data refresh, নতুন recommendation generation এবং NASA POWER map exploration-এর জন্য ইন্টারনেট প্রয়োজন।"
                  : "Previously saved regional data and recommendations remain accessible without internet. Backend refreshes, generating new recommendations and NASA POWER map exploration require internet access."}
              </p>

            </div>

          </div>

        </details>

      </section>

    </main>
  );
}
