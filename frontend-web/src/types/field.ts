export interface Field {
  field_id: string;
  name: string;
  geometry_type?: string;
  geometry_geojson?: string;

  centroid_lat?: number;
  centroid_lon?: number;

  min_lat?: number;
  max_lat?: number;
  min_lon?: number;
  max_lon?: number;

  [key: string]: unknown;
}

export interface FieldResponse {
  field: Field;
  runtime: "offline" | "online" | string;
  internet_required: boolean;
}