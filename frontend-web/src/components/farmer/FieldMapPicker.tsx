import "leaflet/dist/leaflet.css";

import { useState } from "react";

import { CircleMarker, GeoJSON, MapContainer, TileLayer, Tooltip, useMapEvents } from "react-leaflet";

import type { DemoField } from "../../types/demoFields";

import bn from "../../i18n/bn";
import en from "../../i18n/en";

type Language = "bn" | "en";

const FIELD_COLOR = "#2a78d6";
const SELECTED_COLOR = "#eb6834";

export interface FieldPick {
  fieldId: string;
  distanceKm: number | null; // null = the field itself was tapped
  insideFeni: boolean;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

function insideRing(lat: number, lon: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function insideFeni(lat: number, lon: number, upazilas: any): boolean {
  if (!upazilas) return true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return upazilas.features.some((feature: any) => {
    const { type, coordinates } = feature.geometry;
    const polygons = type === "MultiPolygon" ? coordinates : [coordinates];
    return polygons.some((polygon: number[][][]) => insideRing(lat, lon, polygon[0]));
  });
}

export function nearestField(lat: number, lon: number, fields: DemoField[]): { field: DemoField; km: number } {
  return fields
    .map((field) => ({ field, km: haversineKm(lat, lon, field.center_lat, field.center_lon) }))
    .sort((a, b) => a.km - b.km)[0];
}

function TapHandler({
  fields,
  upazilas,
  onPick,
}: {
  fields: DemoField[];
  upazilas: unknown;
  onPick: (pick: FieldPick) => void;
}) {
  useMapEvents({
    click(event) {
      const { lat, lng } = event.latlng;
      const nearest = nearestField(lat, lng, fields);
      onPick({ fieldId: nearest.field.field_id, distanceKm: nearest.km, insideFeni: insideFeni(lat, lng, upazilas) });
    },
  });
  return null;
}

export default function FieldMapPicker({
  fields,
  upazilas,
  selectedId,
  onPick,
  language,
}: {
  fields: DemoField[];
  upazilas: unknown;
  selectedId: string;
  onPick: (pick: FieldPick) => void;
  language: Language;
}) {
  const t = language === "bn" ? bn.mapPicker : en.mapPicker;
  // Background tiles come from OpenStreetMap; offline only tiles already seen in Feni are cached.
  const [tilesFailed, setTilesFailed] = useState(false);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200">
      <MapContainer
        center={[22.99, 91.42]}
        zoom={10}
        scrollWheelZoom={false}
        style={{ height: 210, width: "100%" }}
        attributionControl
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          eventHandlers={{ tileerror: () => setTilesFailed(true), tileload: () => setTilesFailed(false) }}
        />
        {upazilas ? (
          <GeoJSON
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data={upazilas as any}
            style={{ color: "#52514e", weight: 1, fillOpacity: 0.04 }}
            interactive={false}
          />
        ) : null}
        {fields.map((field) => {
          const selected = field.field_id === selectedId;
          return (
            <CircleMarker
              key={field.field_id}
              center={[field.center_lat, field.center_lon]}
              radius={selected ? 11 : 8}
              pathOptions={{
                color: "#ffffff",
                weight: 2,
                fillColor: selected ? SELECTED_COLOR : FIELD_COLOR,
                fillOpacity: 1,
              }}
              bubblingMouseEvents={false}
              eventHandlers={{
                click: () => onPick({ fieldId: field.field_id, distanceKm: null, insideFeni: true }),
              }}
            >
              <Tooltip direction="top" offset={[0, -8]} permanent={selected}>
                {field.upazila}
              </Tooltip>
            </CircleMarker>
          );
        })}
        <TapHandler fields={fields} upazilas={upazilas} onPick={onPick} />
      </MapContainer>
      {tilesFailed && (
        <p className="bg-amber-50 px-2.5 py-1 text-[11px] leading-4 text-amber-950">🗺️ {t.offlineTiles}</p>
      )}
      <p className="bg-slate-50 px-2.5 py-1 text-[10px] leading-4 text-slate-500">{t.hint}</p>
    </div>
  );
}
