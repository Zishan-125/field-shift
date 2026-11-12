# Baseline — state of the app before the Feni v2 changes

Recorded 2026-10-28 on branch `improve/feni-v2` (based on `Zishan-backend-ml-models-data-pipeline` @ `590bac3`).
No logic was changed to produce this report. It is the reference point for every later change.

## How it was run

```bash
# backend (Python 3.13)
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements-offline.txt
cd offline
uvicorn server:app --host 127.0.0.1 --port 8001

# frontend (Node 24, npm 11)
cd frontend-web
npm ci
npm run build
npx vite preview --host 127.0.0.1 --port 4173   # talks to http://127.0.0.1:8001 by default
```

`backend/requirements-offline.txt` contains only what `backend/offline/` and `data-pipeline/` import.
The old `backend/requirements.txt` (Postgres, Twilio, torch, FAISS …) belongs to the unused `backend/app/`.

## API — every `/api/offline` endpoint

Field ID: `426e9d97-78cf-45d2-82ae-8131040b5ee7`.

| Endpoint | Status | What it returns |
|---|---|---|
| `GET /` | 200 | Service info, `methodology_version: farmer_priority_v2`, offline flags |
| `GET /api/offline/health` | 200 | `healthy`; DB metadata: built 2026-09-30, period 2019-01-01 → 2024-09-30, `synthetic_yield_target: false` |
| `GET /api/offline/fields/{id}` | 200 | "Feni Test Plot", polygon 23.00–23.01 N, 91.39–91.40 E (centroid 23.005, 91.395) |
| `GET /api/offline/fields/{id}/environment` | 200 | 69 monthly rows 2019-01 → 2024-09, 115 columns (GPM, SMAP, MODIS NDVI/EVI, ECOSTRESS LST, GRACE, NASA POWER, SoilGrids copies) |
| `GET /api/offline/fields/{id}/soil` | 200 | SoilGrids 2.0 by depth (0–200 cm), 5 valid 250 m pixels; topsoil pH 5.48, clay 38 %, SOC 22 g/kg |
| `GET /api/offline/crops` | 200 | 8 crops (Aman/Aus/Boro rice, lentil, maize, mungbean, mustard, wheat), all `profile_status: scenario_prior`, source "BARC Crop Zoning …" with no page/table reference |
| `GET /api/offline/fields/{id}/rotations` | 200 | 272 scenarios (56 two-crop + 216 three-crop permutations) |
| `GET /api/offline/fields/{id}/rotations/evaluated` | 200 | 272 scenarios with water / soil / climate / diversity component scores |
| `POST /api/offline/fields/{id}/recommendations` `{}` | 200 | 272 scenarios re-ranked with default weights water 0.4, soil 0.3, climate 0.2, diversity 0.1 |
| `POST …/recommendations` all weights 0 | 400 | "At least one farmer priority must be greater than zero." (correct) |
| `GET /api/offline/fields/does-not-exist` | 404 | "Field not found" (correct) |

## Current top 10 recommendations (default priorities)

| # | Rotation | Score | Water | Soil | Climate | Diversity |
|---|---|---|---|---|---|---|
| 1 | Mungbean → Mustard | 0.634 | 0.63 | 0.59 | 0.52 | 1.00 |
| 2 | Mustard → Mungbean | 0.634 | 0.63 | 0.59 | 0.52 | 1.00 |
| 3 | Lentil → Mustard | 0.617 | 0.61 | 0.59 | 0.48 | 1.00 |
| 4 | Mustard → Lentil | 0.617 | 0.61 | 0.59 | 0.48 | 1.00 |
| 5 | Wheat → Mungbean | 0.604 | 0.57 | 0.59 | 0.50 | 1.00 |
| 6 | Mungbean → Wheat | 0.604 | 0.57 | 0.59 | 0.50 | 1.00 |
| 7 | Lentil → Mungbean → Mustard | 0.594 | 0.63 | 0.57 | 0.51 | 0.67 |
| 8 | Lentil → Mustard → Mungbean | 0.594 | 0.63 | 0.57 | 0.51 | 0.67 |
| 9 | Mungbean → Lentil → Mustard | 0.594 | 0.63 | 0.57 | 0.51 | 0.67 |
| 10 | Mungbean → Mustard → Lentil | 0.594 | 0.63 | 0.57 | 0.51 | 0.67 |

The dashboard shows the same order (#1 মুগ ডাল → সরিষা, 63 % "priority match").

## What works

- Backend starts on port 8001. The startup check finds all 7 tables and the configured field.
- All endpoints respond. Errors are handled cleanly (404 for unknown field, 400 for all-zero weights).
- Frontend: `npm run build` passes (`tsc -b` + Vite, 361 kB JS / 108 kB gzip). `npm run lint` gives 0 errors, 1 warning.
- The dashboard loads from the local API and shows the hero, field status, Earth-observation cards (GPM 364 mm, SMAP 0.41, ECOSTRESS 32.8 °C, GRACE 34.0 cm, POWER 28.3 °C for 2024-09), crop picker, priority sliders and ranked rotations.
- Bangla is the default UI language, and English is available.
- Responses already label scores as `scenario_indicator_not_yield_prediction`.

## What is broken or wrong

### Recommendations (CLAUDE.md problem #1)
1. **No rice in the top 40.** The first scenario with any rice is Aus rice → Mungbean at rank 41.
2. **The real Feni pattern ranks last.** Boro rice → Aman rice is #272 of 272 (score 0.255). Boro–Fallow–T.Aman is the dominant pattern in the Chittagong region, which includes Feni: 22.9 % of net cropped area (Shahidullah et al. 2017, Bangladesh Rice J. 21(2):109–122).
3. **Every top-10 item is Rabi crops only.** The field is left empty through the Kharif-2 monsoon, and the order of crops has no meaning: all 56 two-crop pairs score exactly the same as their reverse (A→B = B→A).
4. **Only 64 distinct scores among 272 scenarios**, so the ranking is mostly ties.

### Satellite data barely matters (problem #2)
5. The NASA data enters scoring as 3 constants, identical for all 272 scenarios: water context 0.393, climate context 0.332, **soil context 0.500**.
6. The soil context 0.500 is not a measurement. `soil_topsoil_fertility_proxy` is null in all 69 rows, so `safe_mean()` in `data-pipeline/build_farmer_priority_scenarios.py` falls back to its default of 0.5.
7. MODIS NDVI/EVI is missing in 17 of 69 months: every June–August/September, which is the monsoon, because of cloud. That is the whole T.Aman season. ECOSTRESS LST is missing in 14 months.

### Frontend display bugs
8. **The soil card shows "—" for pH, organic carbon, clay, sand and silt.** `Dashboard.tsx` looks for keys `soil` / `profile` / `data` in the API response, but the API returns `soil_profile`.
9. **The weather card shows "—°C", "—" and "— m/s".** `Dashboard.tsx` passes the whole 69-row `data` array as `environment` instead of the latest row.
10. **NDVI shows "0.00" for the latest month.** The real value is null (monsoon cloud), and the null is displayed as zero.
11. ~~The page header says "NASA Space Apps Challenge 2024".~~ Correction: the header already says 2026 (`FarmerHeader.tsx:67`); the small screenshot was misread.
12. Lint warning: `useEffect` in `Dashboard.tsx:594` is missing the `language` dependency.

### Other
13. `crop_profiles.source` cites "BARC Crop Zoning" with no document, table or page, so the values can't be checked.
14. `server.py` uses `@app.on_event("startup")`, which is deprecated in FastAPI 0.162. It still works.
15. `backend/offline/README.md` is empty.
16. `field_shift.db` can't be rebuilt from the repo, because `data-pipeline/output/` is git-ignored and absent (problem #5).
17. There is no service worker or PWA manifest (problem #6).

## Not checked

- The `data-pipeline/` scripts compile under the pinned versions (pandas 3.1, numpy 2.5), but they were **not run**: their inputs (`data-pipeline/output/`) and GEE credentials for the service-account path are not in the repo.
- `docs/challenge.md` is not written yet. It waits for the official challenge text.
