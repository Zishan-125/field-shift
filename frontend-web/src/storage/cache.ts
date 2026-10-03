import {
  getCachedData,
  setCachedData,
} from "./indexedDb";

export const CACHE_KEYS = {
  field: "field",
  environment: "environment",
  soil: "soil",
  recommendations: "recommendations",
  health: "health",
} as const;

export async function saveCache<T>(
  key: string,
  data: T,
): Promise<void> {
  await setCachedData(key, data);
}

export async function loadCache<T>(
  key: string,
): Promise<T | null> {
  return getCachedData<T>(key);
}