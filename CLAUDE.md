# Field Shift — project brief for Claude Code

NASA Space Apps Challenge 2026, challenge **"Field Shift: Adapting Farms with NASA Data"**.
Hackathon weekend: 14–15 November 2026. Use case: Feni District, Bangladesh.
Goal: help a farmer decide whether to keep, adjust, or shift their crop rotation, using NASA Earth observations, explained in plain Bangla/English.

## What actually runs in production

- `frontend-web/` — React 19 + TS + Vite + Tailwind. Main screen is `src/pages/Dashboard.tsx` (~1300 lines). Builds cleanly. Field ID is hard-coded (`426e9d97-...`).
- `backend/offline/server.py` — the REAL API (FastAPI + plain `sqlite3` on `backend/offline/field_shift.db`). This is what the frontend calls.
- `backend/offline/build_offline_database.py` — builds the SQLite DB from `data-pipeline/output/` (that folder is git-ignored and NOT in the repo).
- `data-pipeline/` — GEE / NASA ingestion (SMAP, MODIS, GPM IMERG, ECOSTRESS, GRACE), NASA POWER, SoilGrids, monthly features, crop profiles, rotation scenarios, scoring.

## Legacy / unused code (from an older "TerraShift" design)

- `backend/app/` (Postgres/PostGIS, Ollama RAG copilot, Twilio SMS, ML scorer) — not used by the frontend. `docker-compose.yml`, `backend/Dockerfile`, `backend/tests/` and `.env.example` all describe this old design.
- `ml-models/` — trained ONLY on synthetic data from `generate_realistic_data.py` (fake field histories). Stress labels come from a rule, so the model just re-learns the rule. Must not be presented as validated.
- Root files `economic_environmental_model.py`, `Feni_Economic_Environmental_Dataset.*` (solar/diesel irrigation economics) and `Feni_Daily_Weather_NASA_POWER_ML.*` (real NASA POWER daily 2015–2024) are not wired into the app.

## Current data (in field_shift.db)

- 1 field: "Feni Test Plot", a ~1 km box at 23.00–23.01 N, 91.39–91.40 E.
- 69 monthly rows, 2019-01 → 2024-09, NASA EO + POWER + SoilGrids.
- 8 crops (Aman/Aus/Boro rice, maize, wheat, lentil, mungbean, mustard), parameters hand-set.
- 272 rotation scenarios (56 two-crop + 216 three-crop permutations).

## Known problems (fix in this priority order)

1. **Agronomically invalid recommendations.** Scenarios are crop permutations with no season/calendar check. The top results (mustard→mungbean, mustard→lentil, lentil→wheat …) contain only Rabi crops and leave the field empty in the Kharif-2 monsoon, and A→B / B→A get identical scores. Real Feni patterns are annual sequences across Rabi / Kharif-1 / Kharif-2 (e.g. Boro–Fallow–T.Aman, Mustard–Boro–T.Aman, Lentil/Mungbean–Aus–T.Aman). Scoring also rewards dropping rice entirely, which no Feni farmer would do.
2. **Satellite data barely affects the result.** NASA data is collapsed into 3 constant "context" numbers; scores mostly come from fixed crop constants, so the ranking is the same for any field.
3. **Missing Feni-specific risks:** salinity (coastal Sonagazi), flash floods / waterlogging, cyclones, monsoon onset shifts, heat during Boro grain filling. No yield, cost or income dimension at all.
4. **Data too thin:** one tiny field, ~6 years. No climate trend analysis, no future projection.
5. **Pipeline not reproducible:** `data-pipeline/output/` and `historical/` are not committed; `scoring/methodology.md` is empty; README mentions `docs/` and `LICENSE` that don't exist.
6. **No real offline mode:** no service worker / PWA manifest despite "offline-first".
7. **README overclaims** (Turso in production path, ML "workflow", etc.). Keep claims honest.

## Rules for work in this repo

- Never invent numbers, metrics, yields or citations. Real sources only (NASA, BBS, BARI, BRRI, DAE, SRDI, FAO); cite them in `docs/data-sources.md`.
- Anything synthetic or assumed must be labelled as such in data, API responses and UI.
- Keep `backend/offline/server.py` + `field_shift.db` working at every commit; the frontend must keep building (`npm run build` in `frontend-web/`).
- Keep the farmer UI simple and bilingual (`src/i18n/en.ts`, `src/i18n/bn.ts`); put technical detail behind "details" toggles.
- Small, focused commits with clear messages. Run the server and the build before committing.
