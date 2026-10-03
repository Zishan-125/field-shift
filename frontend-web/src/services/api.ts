import axios from "axios";

import type {
  FieldResponse,
} from "../types/field";

import type {
  EnvironmentResponse,
} from "../types/environment";

import type {
  SoilResponse,
} from "../types/soil";

import type {
  FarmerPriorities,
} from "../types/farmer";

import type {
  RecommendationResponse,
} from "../types/recommendation";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8001";

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

export async function getHealth() {
  const response = await api.get(
    "/api/offline/health",
  );

  return response.data;
}

export async function getField(
  fieldId: string,
): Promise<FieldResponse> {
  const response =
    await api.get<FieldResponse>(
      `/api/offline/fields/${fieldId}`,
    );

  return response.data;
}

export async function getEnvironment(
  fieldId: string,
): Promise<EnvironmentResponse> {
  const response =
    await api.get<EnvironmentResponse>(
      `/api/offline/fields/${fieldId}/environment`,
    );

  return response.data;
}

export async function getSoil(
  fieldId: string,
): Promise<SoilResponse> {
  const response =
    await api.get<SoilResponse>(
      `/api/offline/fields/${fieldId}/soil`,
    );

  return response.data;
}

export async function getCrops() {
  const response = await api.get(
    "/api/offline/crops",
  );

  return response.data;
}

export async function getRotations(
  fieldId: string,
) {
  const response = await api.get(
    `/api/offline/fields/${fieldId}/rotations`,
  );

  return response.data;
}

export async function getEvaluatedRotations(
  fieldId: string,
) {
  const response = await api.get(
    `/api/offline/fields/${fieldId}/rotations/evaluated`,
  );

  return response.data;
}

/**
 * Recalculate crop-rotation recommendations
 * using the farmer's selected priority profile.
 *
 * IMPORTANT:
 * The backend currently expects the priority
 * object directly in the POST body.
 */
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