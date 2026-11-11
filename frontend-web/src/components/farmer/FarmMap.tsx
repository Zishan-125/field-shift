import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, LayersControl, useMapEvents, useMap } from "react-leaflet";
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

// Automatically re-center map smoothly when coordinates change
function MapRecenter({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lon], map.getZoom(), { animate: true });
  }, [lat, lon, map]);
  return null;
}

// Component to handle drawing controls natively via Leaflet
function DrawControlComponent() {
  const map = useMap();
  
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

    map.on(L.Draw.Event.CREATED, (e: any) => {
      const layer = e.layer;
      drawnItems.addLayer(layer);
    });

    return () => {
      map.removeControl(drawControl);
    };
  }, [map]);

  return null;
}

// Internal component to capture clicks anywhere on the map
function LocationClickHandler({ onSelect }: { onSelect: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) {
      onSelect(e.latlng.lat, e.latlng.lng);
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
  const [mapLayer, setMapLayer] = useState<"standard" | "nasa">("standard");
  const [loadingWeather, setLoadingWeather] = useState<boolean>(false);
  const [climateData, setClimateData] = useState<{ temp?: number; rainfall?: number } | null>(null);

  // Fully dynamic bilingual field name & health score evaluation
  const activeFieldName = selectedFieldName && selectedFieldName.trim() !== "" 
    ? selectedFieldName 
    : (isBangla ? "নির্বাচিত জমির প্লট" : "Custom Field Plot");
    
  const activeHealthScore = cropHealthScore !== undefined && !isNaN(cropHealthScore) 
    ? cropHealthScore 
    : 82;

  const handleMapClick = async (clickedLat: number, clickedLon: number) => {
    const roundedLat = Number(clickedLat.toFixed(4));
    const roundedLon = Number(clickedLon.toFixed(4));
    setLat(roundedLat);
    setLon(roundedLon);

    if (onLocationSelect) {
      onLocationSelect(roundedLat, roundedLon);
    }

    setLoadingWeather(true);
    try {
      const endDateObj = new Date();
      endDateObj.setDate(endDateObj.getDate() - 10);
      const startDateObj = new Date();
      startDateObj.setDate(startDateObj.getDate() - 17);

      const formatDate = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
      const startStr = formatDate(startDateObj);
      const endStr = formatDate(endDateObj);

      const url = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M,PRECTOTCORR&community=AG&longitude=${roundedLon}&latitude=${roundedLat}&start=${startStr}&end=${endStr}&format=JSON`;
      
      const res = await fetch(url);
      const data = await res.json();
      
      const temps = data?.properties?.parameter?.T2M;
      const rains = data?.properties?.parameter?.PRECTOTCORR;
      
      if (temps && rains) {
        const tempKeys = Object.keys(temps);
        const latestTemp = temps[tempKeys[tempKeys.length - 1]];
        const latestRain = rains[tempKeys[tempKeys.length - 1]];

        setClimateData({
          temp: latestTemp,
          rainfall: latestRain,
        });
      }
    } catch (err) {
      console.error("Failed to fetch NASA telemetry:", err);
    } finally {
      setLoadingWeather(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
            {isBangla ? "গ্লোবাল জিওস্পেসিয়াল ইন্টেলিজেন্স" : "Global Geospatial Intelligence"}
          </span>
          <h3 className="text-lg font-black text-slate-900">
            {isBangla ? "খামারের সীমানা আঁকুন এবং আবহাওয়া বিশ্লেষণ করুন" : "Draw Farmland Boundary & Live Telemetry"}
          </h3>
          <p className="text-xs text-slate-500">
            {isBangla 
              ? "কৃষক হিসেবে আপনার জমির সীমানা ড্র করুন অথবা যেকোনো স্থানে ক্লিক করে নাসার লাইভ আবহাওয়া উপাত্ত দেখুন।"
              : "Farmers must draw their farmland boundary using the draw tool or click anywhere globally to stream live NASA telemetry."}
          </p>
        </div>

        {/* Layer Controls */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setMapLayer("standard")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              mapLayer === "standard" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600"
            }`}
          >
            {isBangla ? "ম্যাপ" : "Terrain"}
          </button>
          <button
            type="button"
            onClick={() => setMapLayer("nasa")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              mapLayer === "nasa" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-600"
            }`}
          >
            🛰️ {isBangla ? "নাসা স্যাটেলাইট" : "NASA Satellite"}
          </button>
        </div>
      </div>

      {/* Map Container */}
      <div className="relative h-[440px] w-full overflow-hidden rounded-2xl border border-slate-200/60 z-0">
        <MapContainer
          center={[lat, lon]}
          zoom={14}
          scrollWheelZoom={true}
          style={{ height: "100%", width: "100%" }}
        >
          <MapRecenter lat={lat} lon={lon} />
          <LocationClickHandler onSelect={handleMapClick} />
          <DrawControlComponent />

          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name={isBangla ? "স্ট্যান্ডার্ড ওপেনস্ট্রিটম্যাপ" : "OpenStreetMap Standard"}>
              <TileLayer
                attribution='&copy; OpenStreetMap contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
            </LayersControl.BaseLayer>

            <LayersControl.BaseLayer name={isBangla ? "নাসা মোডিস ট্রু কালার" : "NASA MODIS True Color"}>
              <TileLayer
                attribution='&copy; NASA GIBS'
                url="https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/2026-03-01/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg"
                maxZoom={9}
              />
            </LayersControl.BaseLayer>
          </LayersControl>

          <Marker position={[lat, lon]} icon={customMarker}>
            <Popup>
              <div className="p-2 space-y-1.5 min-w-[170px]">
                <p className="font-extrabold text-slate-900 text-sm">{activeFieldName}</p>
                <p className="text-[11px] text-slate-500">
                  {isBangla ? "অক্ষাংশ" : "Lat"}: {lat} | {isBangla ? "দ্রাঘিমাংশ" : "Lon"}: {lon}
                </p>
                
                <div className="mt-1 inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-md text-[11px]">
                  <span>{isBangla ? "ফসলের স্বাস্থ্য স্কোর" : "Health Score"}: {activeHealthScore}/100</span>
                </div>

                {loadingWeather ? (
                  <p className="text-[11px] text-emerald-600 font-bold animate-pulse mt-1">
                    {isBangla ? "নাসার উপাত্ত লোড হচ্ছে..." : "Streaming NASA Telemetry..."}
                  </p>
                ) : climateData ? (
                  <div className="mt-1 pt-1 border-t border-slate-100 text-[11px] space-y-0.5">
                    <p className="text-slate-700">🌡️ {isBangla ? "তাপমাত্রা" : "Temp"}: <b>{climateData.temp ?? "--"}°C</b></p>
                    <p className="text-slate-700">🌧️ {isBangla ? "বৃষ্টিপাত" : "Rainfall"}: <b>{climateData.rainfall ?? "--"} mm/day</b></p>
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-400 italic mt-1">
                    {isBangla ? "আবহাওয়া জানতে ম্যাপে ক্লিক করুন" : "Click map for live climate data"}
                  </p>
                )}
              </div>
            </Popup>
          </Marker>
        </MapContainer>
      </div>

      <div className="mt-3 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-2">
        <span>
          {isBangla ? "সক্রিয় স্থানাঙ্ক:" : "Active Coordinates:"} <strong className="text-slate-900">{lat}, {lon}</strong>
        </span>
        <span className="text-emerald-600 font-bold bg-emerald-50 px-2.5 py-1 rounded-lg">
          {isBangla ? "✏️ কৃষকের সীমানা অঙ্কন ও গ্লোবাল ইঞ্জিন সক্রিয়" : "✏️ Boundary Drawing & Global Engine Active"}
        </span>
      </div>
    </div>
  );
}