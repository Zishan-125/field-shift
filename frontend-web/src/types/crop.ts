export interface Crop {
  id?: string | number;
  crop_id?: string | number;

  name?: string;
  crop_name?: string;
  english_name?: string;
  name_en?: string;

  bangla_name?: string;
  bengali_name?: string;
  name_bn?: string;

  icon?: string;
  emoji?: string;

  [key: string]: unknown;
}

export interface NormalizedCrop {
  id: string;
  englishName: string;
  banglaName: string;
  icon: string;
}

export interface CropResponse {
  crops?: Crop[];
  data?: Crop[];
  results?: Crop[];
  [key: string]: unknown;
}

/**
 * Local farmer-facing crop dictionary.
 *
 * This keeps the UI Bangla-first even when
 * the offline API currently stores English
 * crop names only.
 */
export const CROP_TRANSLATIONS: Record<
  string,
  {
    bn: string;
    icon: string;
  }
> = {
  "aman rice": {
    bn: "আমন ধান",
    icon: "🌾",
  },

  "aus rice": {
    bn: "আউশ ধান",
    icon: "🌾",
  },

  "boro rice": {
    bn: "বোরো ধান",
    icon: "🌾",
  },

  lentil: {
    bn: "মসুর ডাল",
    icon: "🌱",
  },

  maize: {
    bn: "ভুট্টা",
    icon: "🌽",
  },

  mungbean: {
    bn: "মুগ ডাল",
    icon: "🌱",
  },

  mustard: {
    bn: "সরিষা",
    icon: "🌼",
  },

  wheat: {
    bn: "গম",
    icon: "🌾",
  },
};

export function getBanglaCropName(
  englishName: string,
): string {
  const key = englishName
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, " ");

  return (
    CROP_TRANSLATIONS[key]?.bn ||
    englishName
  );
}

export function getCropIcon(
  englishName: string,
): string {
  const key = englishName
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, " ");

  return (
    CROP_TRANSLATIONS[key]?.icon ||
    "🌱"
  );
}