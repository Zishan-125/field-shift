# TerraShift — Field Shift Advisory (NASA Space Apps: "Field Shift")

Turns NASA SMAP, MODIS, ECOSTRESS, GPM IMERG and GRACE-FO signals into a 0–100 **Shift Score** and
actionable field decisions. Dark "orbital ops center" design system shared by web and mobile.

## Contents
| Folder | What it is |
|---|---|
| `frontend-web/` | React + Vite + Tailwind dashboard (deck.gl + MapLibre, no map token needed) |
| `mobile-app/`   | Expo (React Native) app, offline-first caching |
| `demo/terrashift-demo.html` | Single-file preview of the UI — open it in any browser |

## Run the web dashboard
```bash
cd frontend-web && npm install && npm run dev      # http://localhost:5173
```
## Run the mobile app
```bash
cd mobile-app && npm install && npx expo start     # scan QR with Expo Go, or press w for web
```

## Components (all in `frontend-web/src/components`)
- `map/FieldMap.tsx` — deck.gl field polygons over CARTO Dark Matter, HUD signal toggles
- `dashboard/ShiftScoreCard.tsx` — radial gauge + expandable per-signal breakdown
- `dashboard/RotationPlanner.tsx` — select → review → confirm crop rotation workflow
- `dashboard/CopilotChat.tsx` — signal-cited assistant; badges highlight the field and overlay on the map
- `dashboard/Leaderboard.tsx` — community rankings, sortable by score or streak

Every interactive element implements default, hover, focus-visible, active, loading (`aria-busy`) and disabled states.

## Known limitations (read before demoing)
- **All data is mock.** Fixtures live in `frontend-web/src/mocks/` and `mobile-app/src/data.ts`; shapes match
  `src/types/index.ts` so real API calls can replace them without touching components.
- **Copilot replies are templated**, built from the field's Shift Score; only the framing sentences are localized
  (EN/HI/PT/SW). Real RAG + translation must come from the backend (`POST /copilot/chat`).
- **Signal overlays are a heatmap stand-in** seeded from field readings. SMAP/ECOSTRESS/GRACE-FO have no public
  field-resolution tile service; swap `buildSignalHeatmapLayer` in `map/layers.ts` for a tile layer once served.
- **Mobile** has no map screen yet and its "offline" support caches selection + chat locally (AsyncStorage);
  there is no background sync. It is type-checked but has not been run on a device or simulator.
- The web bundle is ~2 MB (deck.gl + MapLibre); code-split before production.
