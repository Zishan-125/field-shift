export interface Environment {
  power_temperature_mean?: number;
  power_temperature_max?: number;
  power_temperature_min?: number;
  power_solar_radiation?: number;
  power_wind_speed?: number;

  power_days_observed?: number;
  expected_days?: number;
  power_available?: number;
  power_complete?: number;

  [key: string]: unknown;
}

export interface EnvironmentResponse {
  environment?: Environment;
  data?: Environment;
  [key: string]: unknown;
}