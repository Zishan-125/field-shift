import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// Feni district with a small margin. Only OpenStreetMap tiles inside this box
// are cached for offline use (runtime cache, never bulk-downloaded).
const FENI_BBOX = { south: 22.6, north: 23.4, west: 91.15, east: 91.7 };

function tileInFeni(url: URL): boolean {
  if (!url.hostname.endsWith("tile.openstreetmap.org")) return false;
  const match = url.pathname.match(/\/(\d+)\/(\d+)\/(\d+)\.png$/);
  if (!match) return false;
  const [z, x, y] = match.slice(1).map(Number);
  const n = 2 ** z;
  const lon = (xx: number) => (xx / n) * 360 - 180;
  const lat = (yy: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * yy) / n))) * 180) / Math.PI;
  // tile overlaps the box
  return lon(x + 1) >= FENI_BBOX.west && lon(x) <= FENI_BBOX.east && lat(y + 1) <= FENI_BBOX.north && lat(y) >= FENI_BBOX.south;
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: ["favicon.svg", "icons/*.png"],
      manifest: {
        name: "ফিল্ড শিফট · Field Shift — Feni",
        short_name: "Field Shift",
        description: "Keep, adjust or shift your crop rotation — Feni, from NASA satellite data. Works offline.",
        lang: "bn",
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#047857",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // App shell + every exported data file (public/data/**) are precached.
        globPatterns: ["**/*.{js,css,html,svg,png,json,woff,woff2}"],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: "/index.html",
        runtimeCaching: [
          {
            urlPattern: ({ url }) => tileInFeni(url),
            handler: "CacheFirst",
            options: {
              cacheName: "osm-tiles-feni",
              expiration: { maxEntries: 3000, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});
