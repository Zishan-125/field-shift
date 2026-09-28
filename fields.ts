import type { FieldPolygon } from "@/types";

function rectangle(centerLng: number, centerLat: number, halfW = 0.006, halfH = 0.004): [number, number][] {
  return [
    [centerLng - halfW, centerLat - halfH],
    [centerLng + halfW, centerLat - halfH],
    [centerLng + halfW, centerLat + halfH],
    [centerLng - halfW, centerLat + halfH],
    [centerLng - halfW, centerLat - halfH],
  ];
}

export const MOCK_FIELDS: FieldPolygon[] = [
  {
    id: "field-ia-004",
    name: "North Quarter Section",
    region: "Story County, Iowa",
    countryCode: "US",
    centroid: { lng: -93.6319, lat: 42.0308 },
    boundary: rectangle(-93.6319, 42.0308),
    areaHectares: 64.7,
    cropType: "Corn",
    lastSurveyed: "2026-09-18",
  },
  {
    id: "field-pb-011",
    name: "Ludhiana Block 3",
    region: "Punjab, India",
    countryCode: "IN",
    centroid: { lng: 75.8573, lat: 30.901 },
    boundary: rectangle(75.8573, 30.901, 0.004, 0.003),
    areaHectares: 12.3,
    cropType: "Wheat",
    lastSurveyed: "2026-09-21",
  },
  {
    id: "field-ke-002",
    name: "Nakuru Highlands Plot",
    region: "Nakuru County, Kenya",
    countryCode: "KE",
    centroid: { lng: 36.0667, lat: -0.3031 },
    boundary: rectangle(36.0667, -0.3031, 0.005, 0.005),
    areaHectares: 8.9,
    cropType: "Maize",
    lastSurveyed: "2026-09-15",
  },
  {
    id: "field-br-007",
    name: "Mato Grosso Sector 7",
    region: "Mato Grosso, Brazil",
    countryCode: "BR",
    centroid: { lng: -55.9159, lat: -12.6819 },
    boundary: rectangle(-55.9159, -12.6819, 0.008, 0.006),
    areaHectares: 142.5,
    cropType: "Soybean",
    lastSurveyed: "2026-09-22",
  },
];
