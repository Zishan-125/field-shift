import { useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, LayersControl } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix for default Leaflet marker icon paths broken in some bundlers
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

const customMarker = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

interface FarmMapProps {
  fieldName?: string;
  latitude?: number;
  longitude?: number;
  cropHealthScore?: number;
}

export default function FarmMap({
  fieldName = "Feni Test Plot",
  latitude = 23.0185,
  longitude = 91.3976,
  cropHealthScore = 78,
}: FarmMapProps) {
  const [mapLayer, setMapLayer] = useState<"standard" | "nasa">("standard");

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
            Geospatial Intelligence
          </span>
          <h3 className="text-lg font-black text-slate-900">
            Interactive Field Map & NASA Overlays
          </h3>
          <p className="text-xs text-slate-500">
            Plot coordinates, boundary tracking, and remote-sensing visualizer.
          </p>
        </div>

        {/* Map View Toggle Switch */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setMapLayer("standard")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              mapLayer === "standard"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Terrain / Map
          </button>
          <button
            type="button"
            onClick={() => setMapLayer("nasa")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              mapLayer === "nasa"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            🛰️ NASA Satellite
          </button>
        </div>
      </div>

      {/* Map Container */}
      <div className="relative h-[380px] w-full overflow-hidden rounded-2xl border border-slate-200/60 z-0">
        <MapContainer
          center={[latitude, longitude]}
          zoom={13}
          scrollWheelZoom={false}
          style={{ height: "100%", width: "100%" }}
        >
          <LayersControl position="topright">
            {/* Standard OpenStreetMap Base Layer */}
            <LayersControl.BaseLayer checked name="OpenStreetMap Standard">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
            </LayersControl.BaseLayer>

            {/* NASA GIBS MODIS True Color Satellite Layer */}
            <LayersControl.BaseLayer name="NASA MODIS True Color (Satellite)">
              <TileLayer
                attribution='&copy; <a href="https://earthdata.nasa.gov/">NASA GIBS</a>'
                url="https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/2026-03-01/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg"
                maxZoom={9}
              />
            </LayersControl.BaseLayer>
          </LayersControl>

          {/* Farm Marker */}
          <Marker position={[latitude, longitude]} icon={customMarker}>
            <Popup>
              <div className="p-1 space-y-1">
                <p className="font-extrabold text-slate-900 text-sm">{fieldName}</p>
                <p className="text-xs text-slate-600">Lat: {latitude}, Lon: {longitude}</p>
                <div className="mt-2 inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-md text-xs">
                  <span>Health Score: {cropHealthScore}/100</span>
                </div>
              </div>
            </Popup>
          </Marker>
        </MapContainer>
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
        <span>Coordinate System: WGS 84 (EPSG:4326)</span>
        <span className="font-semibold text-emerald-600">● Live Field Telemetry Active</span>
      </div>
    </div>
  );
}