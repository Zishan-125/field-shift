export interface SoilProfile {
  ph_0_5?: number;
  ph_5_15?: number;
  ph_15_30?: number;
  ph_30_60?: number;
  ph_60_100?: number;
  ph_100_200?: number;

  organic_carbon_0_5?: number;
  organic_carbon_5_15?: number;
  organic_carbon_15_30?: number;
  organic_carbon_30_60?: number;
  organic_carbon_60_100?: number;
  organic_carbon_100_200?: number;

  [key: string]: unknown;
}

export interface SoilResponse {
  soil?: SoilProfile;
  data?: SoilProfile;
  [key: string]: unknown;
}