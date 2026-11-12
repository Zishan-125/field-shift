import axios from "axios";

import type { FieldResponse } from "../types/field";
import type { EnvironmentResponse } from "../types/environment";
import type { SoilResponse } from "../types/soil";
import type { FarmerPriorities } from "../types/farmer";
import type { RecommendationResponse } from "../types/recommendation";
import {
  DEFAULT_CURRENT_PATTERN_ID,
  type PatternPriorities,
  type PatternRecommendationResponse,
} from "../types/pattern";
import type { ClimateShiftResponse } from "../types/climate";
import type { DemoFieldsResponse } from "../types/demoFields";
import type {
  CropResponse,
} from "../types/crop";

import { rerank, type StaticRecommendations } from "./staticRanking";

/*
 * Two data sources:
 *   live    the FastAPI server (backend/offline/server.py), when VITE_API_BASE_URL is set
 *   static  JSON exported from the same server at build time
 *           (backend/offline/export_static.py -> public/data/), precached by the
 *           service worker, so the site runs with no backend and offline.
 * With an API URL the live server is tried first and the static data is the
 * fallback; without one the static data is used directly.
 */
const API_BASE_URL: string | undefined = import.meta.env.VITE_API_BASE_URL || undefined;

export const api = axios.create({
  baseURL: API_BASE_URL ?? "http://127.0.0.1:8001",
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 60000,
});

let lastSource: "live" | "static" = API_BASE_URL ? "live" : "static";

/** Where the last response came from (shown in the technical details). */
export function dataSource(): "live" | "static" {
  return lastSource;
}

async function staticJson<T>(path: string): Promise<T> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/${path}`);
  if (!response.ok) {
    throw new Error(`Static data not found: ${path} (${response.status})`);
  }
  return (await response.json()) as T;
}

async function liveOrStatic<T>(live: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
  if (API_BASE_URL) {
    try {
      const data = await live();
      lastSource = "live";
      return data;
    } catch (error) {
      console.warn("Field Shift: live API unavailable, using built-in data.", error);
    }
  }
  const data = await fallback();
  lastSource = "static";
  return data;
}

function slug(text: string): string {
  return text.toLowerCase().replace(/ /g, "_");
}

export async function getHealth() {
  return liveOrStatic(
    async () => (await api.get("/api/offline/health")).data,
    () => staticJson("health.json"),
  );
}

export async function getField(
  fieldId: string,
): Promise<FieldResponse> {
  return liveOrStatic(
    async () => (await api.get<FieldResponse>(`/api/offline/fields/${fieldId}`)).data,
    () => staticJson<FieldResponse>("field.json"),
  );
}

export async function getEnvironment(
  fieldId: string,
): Promise<EnvironmentResponse> {
  return liveOrStatic(
    async () => (await api.get<EnvironmentResponse>(`/api/offline/fields/${fieldId}/environment`)).data,
    () => staticJson<EnvironmentResponse>("environment.json"),
  );
}

export async function getSoil(
  fieldId: string,
): Promise<SoilResponse> {
  return liveOrStatic(
    async () => (await api.get<SoilResponse>(`/api/offline/fields/${fieldId}/soil`)).data,
    () => staticJson<SoilResponse>("soil.json"),
  );
}

export async function getCrops(): Promise<CropResponse> {
  return liveOrStatic(
    async () => (await api.get<CropResponse>("/api/offline/crops")).data,
    () => staticJson<CropResponse>("crops.json"),
  );
}

/** Live API only (legacy rotation endpoints are not exported). */
export async function getRotations(
  fieldId: string,
) {
  const response = await api.get(
    `/api/offline/fields/${fieldId}/rotations`,
  );

  return response.data;
}

/** Live API only (legacy rotation endpoints are not exported). */
export async function getEvaluatedRotations(
  fieldId: string,
) {
  const response = await api.get(
    `/api/offline/fields/${fieldId}/rotations/evaluated`,
  );

  return response.data;
}

export async function getClimateShift(
  upazila?: string,
): Promise<ClimateShiftResponse> {
  return liveOrStatic(
    async () =>
      (await api.get<ClimateShiftResponse>("/api/offline/climate-shift", { params: upazila ? { upazila } : {} })).data,
    () => staticJson<ClimateShiftResponse>(`climate-shift/${upazila ? slug(upazila) : "default"}.json`),
  );
}

export async function getDemoFields(): Promise<DemoFieldsResponse> {
  return liveOrStatic(
    async () => (await api.get<DemoFieldsResponse>("/api/offline/demo-fields")).data,
    () => staticJson<DemoFieldsResponse>("demo-fields.json"),
  );
}

export async function getPatternRecommendations(
  fieldId: string,
  priorities: PatternPriorities,
  currentPatternId: string,
): Promise<PatternRecommendationResponse> {
  return liveOrStatic(
    async () =>
      (
        await api.post<PatternRecommendationResponse>(`/api/offline/fields/${fieldId}/pattern-recommendations`, {
          ...priorities,
          current_pattern_id: currentPatternId,
        })
      ).data,
    async () => {
      if (currentPatternId !== DEFAULT_CURRENT_PATTERN_ID) {
        throw new Error("The built-in data covers the default current pattern only.");
      }
      // Same ranking as the API: weighted sum of exported component scores.
      return rerank(await staticJson<StaticRecommendations>(`recommendations/${fieldId}.json`), priorities);
    },
  );
}

export interface DistrictContext {
  districts: {
    district: string;
    aman_ha_2023_24: number;
    aman_ha_2024_25: number;
    ratio_2024_over_2023: number;
    flood_listed_2024: number;
  }[];
  n_districts: number;
  national_ratio: number;
  lowest: string;
  feni: { district: string; ratio_2024_over_2023: number };
  scope: string;
  source: string;
}

export async function getDistrictContext(): Promise<DistrictContext> {
  return liveOrStatic(
    async () => (await api.get<DistrictContext>("/api/offline/district-context")).data,
    () => staticJson<DistrictContext>("district-context.json"),
  );
}

/** @deprecated crop permutations without a season check; live API only */
export async function getRecommendations(
  fieldId: string,
  priorities: FarmerPriorities,
): Promise<RecommendationResponse> {
  const response =
    await api.post<RecommendationResponse>(
      `/api/offline/fields/${fieldId}/recommendations`,
      priorities,
    );

  return response.data;
}
