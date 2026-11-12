export type SeasonLabel = "Boro" | "Rabi_nonrice" | "Fallow" | "T_Aman";

export interface DemoFieldSeason {
  field_id: string;
  season: "rabi" | "kharif2";
  year: number;
  rule_label: SeasonLabel | null;
  rule_reason: string;
  predicted?: SeasonLabel | null;
  confidence?: number | null;
  uncertain?: number | null;
}

export interface DemoField {
  field_id: string;
  upazila: string;
  rule: string;
  center_lat: number;
  center_lon: number;
  size_m: number;
  seasons: DemoFieldSeason[];
  rabi_fallow: { fallow: number; labelled: number; years: number };
}

export interface DemoFieldsResponse {
  fields: DemoField[];
  coastal_fallow: {
    field_id: string | null;
    coastal: { fallow: number; labelled: number; years: number } | null;
    inland_fallow: number;
    inland_years: number;
    inland_fields: number;
    note: string;
  };
  label_source: string;
  upazilas: unknown;
  top_picks: Record<string, { top: string | null; second: string | null; risk: number | null }>;
  same_top_everywhere: boolean;
}
