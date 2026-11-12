
import { useState, useEffect, useRef, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  LayersControl,
  useMapEvents,
  useMap,
} from "react-leaflet";

import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import L from "leaflet";
import "leaflet-draw";

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
  onLocationSelect?: (lat: number, lon: number) => void;
  initialLat?: number;
  initialLon?: number;
  selectedFieldName?: string;
  cropHealthScore?: number;
  isBangla?: boolean;
}

interface ClimateData {
  temp: number | null;
  rainfall: number | null;
  windSpeed: number | null;
  solarRadiation: number | null;
  observationDate: string;
}

interface NASAResponse {
  properties?: {
    parameter?: {
      T2M?: Record<string, number>;
      PRECTOTCORR?: Record<string, number>;
      WS2M?: Record<string, number>;
      ALLSKY_SFC_SW_DWN?: Record<string, number>;
    };
  };
  messages?: string[];
}

// Convert NASA POWER values safely.
// NASA POWER uses -999 for unavailable observations.
function toValidNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed === -999) {
    return null;
  }

  return parsed;
}

// Format a date as YYYYMMDD using UTC.
function formatNASADate(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

// Automatically re-center map smoothly when coordinates change.
function MapRecenter({
  lat,
  lon,
}: {
  lat: number;
  lon: number;
}) {
  const map = useMap();

  useEffect(() => {
    map.setView([lat, lon], map.getZoom(), {
      animate: true,
    });
  }, [lat, lon, map]);

  return null;
}

// Handle polygon drawing controls natively via Leaflet.
function DrawControlComponent({
  onLocationSelect,
}: {
  onLocationSelect?: (lat: number, lon: number) => void;
}) {
  const map = useMap();

  const onLocationSelectRef = useRef(onLocationSelect);

  // Keep the latest callback without rebuilding Leaflet controls.
  useEffect(() => {
    onLocationSelectRef.current = onLocationSelect;
  }, [onLocationSelect]);

  useEffect(() => {
    if (!map) return;

    const drawnItems = new L.FeatureGroup();

    map.addLayer(drawnItems);

    const drawControl = new L.Control.Draw({
      position: "topleft",
      draw: {
        polygon: {
          allowIntersection: false,
          showArea: true,
          shapeOptions: {
            color: "#059669",
            fillColor: "#10b981",
            fillOpacity: 0.3,
          },
        },
        rectangle: false,
        circle: false,
        circlemarker: false,
        marker: false,
        polyline: false,
      },
      edit: {
        featureGroup: drawnItems,
      },
    });

    map.addControl(drawControl);

    const handleCreated = (event: L.LeafletEvent) => {
      const layer = (event as L.DrawEvents.Created).layer as L.Polygon;

      drawnItems.addLayer(layer);

      // Use the polygon bounding-box center as the representative point.
      const center = layer.getBounds().getCenter();

      const selectedLat = Number(center.lat.toFixed(4));
      const selectedLon = Number(center.lng.toFixed(4));

      onLocationSelectRef.current?.(
        selectedLat,
        selectedLon
      );
    };

    map.on(L.Draw.Event.CREATED, handleCreated);

    return () => {
      map.off(L.Draw.Event.CREATED, handleCreated);
      map.removeControl(drawControl);
      map.removeLayer(drawnItems);
    };
  }, [map]);

  return null;
}

// Capture clicks anywhere on the map.
function LocationClickHandler({
  onSelect,
}: {
  onSelect: (lat: number, lon: number) => void;
}) {
  useMapEvents({
    click(event) {
      onSelect(
        event.latlng.lat,
        event.latlng.lng
      );
    },
  });

  return null;
}

export default function FarmMap({
  onLocationSelect,
  initialLat = 23.0185,
  initialLon = 91.3976,
  selectedFieldName,
  cropHealthScore,
  isBangla = false,
}: FarmMapProps) {
  const [lat, setLat] = useState<number>(initialLat);
  const [lon, setLon] = useState<number>(initialLon);

  const [mapLayer, setMapLayer] = useState<
    "standard" | "nasa"
  >("standard");

  const [loadingWeather, setLoadingWeather] =
    useState<boolean>(false);

  const [climateData, setClimateData] =
    useState<ClimateData | null>(null);

  const [weatherError, setWeatherError] =
    useState<string>("");

  const abortControllerRef =
    useRef<AbortController | null>(null);

  // Synchronize the map when Dashboard coordinates change.
  useEffect(() => {
    setLat(initialLat);
    setLon(initialLon);
  }, [initialLat, initialLon]);

  // Dynamic bilingual field name.
  const activeFieldName =
    selectedFieldName && selectedFieldName.trim() !== ""
      ? selectedFieldName
      : isBangla
        ? "নির্বাচিত জমির প্লট"
        : "Custom Field Plot";

  // Dynamic crop health score.
  const activeHealthScore =
    cropHealthScore !== undefined &&
    !isNaN(cropHealthScore)
      ? cropHealthScore
      : 82;

  // Fetch NASA POWER daily telemetry for selected coordinates.
  const fetchNASAData = useCallback(
    async (selectedLat: number, selectedLon: number) => {
      // Cancel any previous request.
      abortControllerRef.current?.abort();

      const controller = new AbortController();

      abortControllerRef.current = controller;

      setLoadingWeather(true);
      setWeatherError("");
      setClimateData(null);

      try {
        // NASA POWER daily data can have a reporting delay.
        // Request a recent completed observation window.
        const endDate = new Date();
        endDate.setUTCDate(endDate.getUTCDate() - 10);

        const startDate = new Date();
        startDate.setUTCDate(startDate.getUTCDate() - 17);

        const start = formatNASADate(startDate);
        const end = formatNASADate(endDate);

        const parameters = [
          "T2M",
          "PRECTOTCORR",
          "WS2M",
          "ALLSKY_SFC_SW_DWN",
        ].join(",");

        const url = new URL(
          "https://power.larc.nasa.gov/api/temporal/daily/point"
        );

        url.searchParams.set("parameters", parameters);
        url.searchParams.set("community", "AG");
        url.searchParams.set("longitude", String(selectedLon));
        url.searchParams.set("latitude", String(selectedLat));
        url.searchParams.set("start", start);
        url.searchParams.set("end", end);
        url.searchParams.set("format", "JSON");

        const response = await fetch(url.toString(), {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(
            `NASA POWER request failed: ${response.status}`
          );
        }

        const data: NASAResponse = await response.json();

        const parametersData = data?.properties?.parameter;

        if (!parametersData) {
          throw new Error("NASA POWER returned no parameter data.");
        }

        const temperatures = parametersData.T2M ?? {};
        const rainfall = parametersData.PRECTOTCORR ?? {};
        const windSpeeds = parametersData.WS2M ?? {};
        const solarRadiation =
          parametersData.ALLSKY_SFC_SW_DWN ?? {};

        // Use dates that exist in the temperature dataset.
        const observationDates = Object.keys(temperatures).sort();

        if (observationDates.length === 0) {
          throw new Error("No NASA POWER observations found.");
        }

        // Find the most recent date with at least one valid observation.
        const latestDate = [...observationDates]
          .reverse()
          .find((date) => {
            return [
              temperatures[date],
              rainfall[date],
              windSpeeds[date],
              solarRadiation[date],
            ].some((value) => toValidNumber(value) !== null);
          });

        if (!latestDate) {
          throw new Error("No valid NASA POWER observations found.");
        }

        if (controller.signal.aborted) return;

        setClimateData({
          temp: toValidNumber(temperatures[latestDate]),
          rainfall: toValidNumber(rainfall[latestDate]),
          windSpeed: toValidNumber(windSpeeds[latestDate]),
          solarRadiation: toValidNumber(
            solarRadiation[latestDate]
          ),
          observationDate: latestDate,
        });
      } catch (error) {
        if (
          error instanceof Error &&
          error.name === "AbortError"
        ) {
          return;
        }

        console.error(
          "Failed to fetch NASA POWER telemetry:",
          error
        );

        if (!controller.signal.aborted) {
          setWeatherError(
            isBangla
              ? "নাসার আবহাওয়ার উপাত্ত সংগ্রহ করা যায়নি। আবার চেষ্টা করুন।"
              : "Unable to retrieve NASA POWER telemetry. Please try again."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingWeather(false);
        }
      }
    },
    [isBangla]
  );

  // Abort any pending request when this component unmounts.
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Handle map clicks and polygon selection.
  const handleMapClick = useCallback(
    (clickedLat: number, clickedLon: number) => {
      const roundedLat = Number(clickedLat.toFixed(4));
      const roundedLon = Number(clickedLon.toFixed(4));

      setLat(roundedLat);
      setLon(roundedLon);

      // Send selected coordinates to Dashboard.
      onLocationSelect?.(roundedLat, roundedLon);

      // Fetch telemetry for the selected location.
      void fetchNASAData(roundedLat, roundedLon);
    },
    [onLocationSelect, fetchNASAData]
  );

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
      {/* Header */}
      <div className="mb-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
            {isBangla
              ? "গ্লোবাল জিওস্পেসিয়াল ইন্টেলিজেন্স"
              : "Global Geospatial Intelligence"}
          </span>

          <h3 className="text-lg font-black text-slate-900">
            {isBangla
              ? "খামারের সীমানা আঁকুন এবং আবহাওয়া বিশ্লেষণ করুন"
              : "Draw Farmland Boundary & Live Telemetry"}
          </h3>

          <p className="text-xs text-slate-500">
            {isBangla
              ? "আপনার জমির সীমানা ড্র করুন অথবা যেকোনো স্থানে ক্লিক করে নাসার আবহাওয়ার উপাত্ত দেখুন।"
              : "Draw your farmland boundary or click anywhere on the map to retrieve NASA POWER climate observations."}
          </p>
        </div>

        {/* Layer Controls */}
        <div className="flex items-center gap-1 self-start rounded-xl bg-slate-100 p-1 sm:self-auto">
          <button
            type="button"
            onClick={() => setMapLayer("standard")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              mapLayer === "standard"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600"
            }`}
          >
            {isBangla ? "ম্যাপ" : "Terrain"}
          </button>

          <button
            type="button"
            onClick={() => setMapLayer("nasa")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              mapLayer === "nasa"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-600"
            }`}
          >
            🛰️ {isBangla ? "নাসা স্যাটেলাইট" : "NASA Satellite"}
          </button>
        </div>
      </div>

      {/* Map Container */}
      <div className="relative z-0 h-[440px] w-full overflow-hidden rounded-2xl border border-slate-200/60">
        <MapContainer
          center={[lat, lon]}
          zoom={14}
          scrollWheelZoom={true}
          style={{
            height: "100%",
            width: "100%",
          }}
        >
          <MapRecenter lat={lat} lon={lon} />

          <LocationClickHandler onSelect={handleMapClick} />

          <DrawControlComponent
            onLocationSelect={handleMapClick}
          />

          <LayersControl position="topright">
            <LayersControl.BaseLayer
              checked={mapLayer === "standard"}
              name={
                isBangla
                  ? "স্ট্যান্ডার্ড ওপেনস্ট্রিটম্যাপ"
                  : "OpenStreetMap Standard"
              }
            >
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
            </LayersControl.BaseLayer>

            <LayersControl.BaseLayer
              checked={mapLayer === "nasa"}
              name={
                isBangla
                  ? "নাসা MODIS ট্রু কালার"
                  : "NASA MODIS True Color"
              }
            >
              <TileLayer
                attribution="&copy; NASA GIBS"
                url="https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/2026-03-01/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg"
                maxZoom={9}
              />
            </LayersControl.BaseLayer>
          </LayersControl>

          {/* Selected Location Marker */}
          <Marker
            position={[lat, lon]}
            icon={customMarker}
          >
            <Popup>
              <div className="min-w-[190px] space-y-1.5 p-2">
                <p className="text-sm font-extrabold text-slate-900">
                  {activeFieldName}
                </p>

                <p className="text-[11px] text-slate-500">
                  {isBangla ? "অক্ষাংশ" : "Lat"}: {lat} |
                  {" "}
                  {isBangla ? "দ্রাঘিমাংশ" : "Lon"}: {lon}
                </p>

                <div className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                  <span>
                    {isBangla
                      ? "ফসলের স্বাস্থ্য স্কোর"
                      : "Health Score"}
                    : {activeHealthScore}/100
                  </span>
                </div>

                {/* Loading State */}
                {loadingWeather ? (
                  <p className="mt-1 animate-pulse text-[11px] font-bold text-emerald-600">
                    {isBangla
                      ? "নাসার উপাত্ত লোড হচ্ছে..."
                      : "Fetching NASA POWER telemetry..."}
                  </p>
                ) : climateData ? (
                  <div className="mt-1 space-y-1 border-t border-slate-100 pt-2 text-[11px]">
                    <p className="font-bold text-slate-500">
                      {isBangla
                        ? "সর্বশেষ পর্যবেক্ষণ"
                        : "Latest Observation"}
                    </p>

                    <p className="text-slate-700">
                      🌡️ {isBangla ? "তাপমাত্রা" : "Temperature"}:
                      {" "}
                      <b>
                        {climateData.temp ?? "--"}°C
                      </b>
                    </p>

                    <p className="text-slate-700">
                      🌧️ {isBangla ? "বৃষ্টিপাত" : "Rainfall"}:
                      {" "}
                      <b>
                        {climateData.rainfall ?? "--"} mm/day
                      </b>
                    </p>

                    <p className="text-slate-700">
                      💨 {isBangla ? "বাতাসের গতি" : "Wind Speed"}:
                      {" "}
                      <b>
                        {climateData.windSpeed ?? "--"} m/s
                      </b>
                    </p>

                    <p className="text-slate-700">
                      ☀️ {isBangla ? "সৌর বিকিরণ" : "Solar Radiation"}:
                      {" "}
                      <b>
                        {climateData.solarRadiation ?? "--"} kWh/m²/day
                      </b>
                    </p>

                    <p className="pt-1 text-[10px] text-slate-400">
                      {isBangla ? "পর্যবেক্ষণের তারিখ" : "Observation Date"}:
                      {" "}
                      {climateData.observationDate}
                    </p>
                  </div>
                ) : weatherError ? (
                  <p className="mt-1 text-[10px] text-red-500">
                    {weatherError}
                  </p>
                ) : (
                  <p className="mt-1 text-[10px] italic text-slate-400">
                    {isBangla
                      ? "আবহাওয়ার উপাত্ত পেতে ম্যাপে ক্লিক করুন"
                      : "Click the map to retrieve climate data"}
                  </p>
                )}
              </div>
            </Popup>
          </Marker>
        </MapContainer>
      </div>

      {/* Coordinate and Status Footer */}
      <div className="mt-3 flex flex-col items-center justify-between gap-2 text-[11px] text-slate-500 sm:flex-row">
        <span>
          {isBangla ? "সক্রিয় স্থানাঙ্ক:" : "Active Coordinates:"}
          {" "}
          <strong className="text-slate-900">
            {lat}, {lon}
          </strong>
        </span>

        <span className="rounded-lg bg-emerald-50 px-2.5 py-1 font-bold text-emerald-600">
          {isBangla
            ? "✏️ কৃষকের সীমানা অঙ্কন ও গ্লোবাল ইঞ্জিন সক্রিয়"
            : "✏️ Boundary Drawing & Global Engine Active"}
        </span>
      </div>

      {/* Telemetry Status */}
      {loadingWeather && (
        <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs text-emerald-700">
          <span className="animate-pulse font-bold">
            {isBangla
              ? "NASA POWER থেকে উপাত্ত সংগ্রহ করা হচ্ছে..."
              : "Retrieving NASA POWER observations..."}
          </span>
        </div>
      )}

      {!loadingWeather && weatherError && (
        <div className="mt-3 rounded-xl border border-red-100 bg-red-50 p-3 text-xs text-red-700">
          {weatherError}
        </div>
      )}

      {!loadingWeather && climateData && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold text-slate-800">
              {isBangla
                ? "NASA POWER পরিবেশগত টেলিমেট্রি"
                : "NASA POWER Environmental Telemetry"}
            </p>

            <span className="text-[10px] text-slate-500">
              {climateData.observationDate}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <p className="text-[10px] text-slate-500">
                {isBangla ? "তাপমাত্রা" : "Temperature"}
              </p>
              <p className="text-sm font-black text-slate-900">
                {climateData.temp ?? "--"}°C
              </p>
            </div>

            <div>
              <p className="text-[10px] text-slate-500">
                {isBangla ? "বৃষ্টিপাত" : "Rainfall"}
              </p>
              <p className="text-sm font-black text-slate-900">
                {climateData.rainfall ?? "--"} mm/day
              </p>
            </div>

            <div>
              <p className="text-[10px] text-slate-500">
                {isBangla ? "বাতাসের গতি" : "Wind Speed"}
              </p>
              <p className="text-sm font-black text-slate-900">
                {climateData.windSpeed ?? "--"} m/s
              </p>
            </div>

            <div>
              <p className="text-[10px] text-slate-500">
                {isBangla ? "সৌর বিকিরণ" : "Solar Radiation"}
              </p>
              <p className="text-sm font-black text-slate-900">
                {climateData.solarRadiation ?? "--"} kWh/m²/day
              </p>
            </div>
          </div>
        </div>
      )}

      <p className="mt-3 text-[10px] leading-relaxed text-slate-400">
        {isBangla
          ? "তথ্যসূত্র: NASA POWER Daily API। দৈনিক উপাত্ত প্রকাশে বিলম্ব থাকতে পারে; এটি তাৎক্ষণিক আবহাওয়া পর্যবেক্ষণ নয়।"
          : "Data source: NASA POWER Daily API. Daily observations may be delayed; these are not real-time weather measurements."}
      </p>
    </div>
  );
}
