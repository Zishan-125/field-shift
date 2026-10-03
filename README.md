Field Shift

NASA Space Apps Challenge 2026 — Field Shift: Adapting Farms with NASA Data

Turning NASA Earth observations into one plain-language answer for farmers facing shifting rainfall, water stress, climate variability, and soil-health challenges:

Should I keep this crop, adjust my priorities, or shift my rotation?

The idea

Farmers experience changing weather and field conditions long before those changes become easy to interpret from scientific datasets.

NASA already provides valuable Earth observations for soil moisture, vegetation condition, rainfall, land-surface temperature, and land-water storage. The challenge is translation.

Field Shift is designed as a decision-support system that combines Earth observation data, local field information, crop characteristics, and farmer priorities to produce an understandable field assessment and crop-rotation recommendation.

The project is being developed with an offline-first runtime architecture, so the farmer-facing decision layer can operate from a local data store without requiring live NASA/GEE access.

How Field Shift works

Phase 1 — Online data preparation

NASA Earth Data / Google Earth Engine
              │
              ├── SMAP
              ├── MODIS
              ├── GPM IMERG
              ├── ECOSTRESS
              └── GRACE
              │
              ▼
       Data ingestion
              │
              ▼
    Canonical observations
              │
              ▼
       Monthly features
              │
              ▼
   Agricultural research data
              │
              ▼
       ML-ready dataset

Phase 2 — Offline decision support

Prepared local dataset
          │
          ▼
     Local SQLite DB
          │
          ▼
       FastAPI
          │
          ├───────────────┐
          ▼               ▼
     Field data      Recommendations
          │               │
          └───────┬───────┘
                  ▼
          Field Shift Dashboard
                  │
                  ▼
       Farmer priorities
                  │
                  ▼
       Crop rotation ranking

Current implementation status

Field Shift has already moved beyond the initial concept stage.

NASA Earth-observation ingestion

The current ingestion pipeline has successfully processed:

Dataset

Signal

Status

SMAP

Root-zone soil moisture

✅ Ingested

MODIS

NDVI / vegetation condition

✅ Ingested

GPM IMERG

Precipitation

✅ Ingested

ECOSTRESS

Land-surface temperature / thermal stress

✅ Ingested

GRACE

Land-water storage signal

✅ Ingested

Google Earth Engine is used during the online data-preparation phase.

Offline runtime

The current offline runtime is operational with:

backend/offline/server.py
backend/offline/field_shift.db

The FastAPI service currently exposes:

GET  /api/offline/health
GET  /api/offline/fields/{field_id}
GET  /api/offline/fields/{field_id}/environment
GET  /api/offline/fields/{field_id}/soil
GET  /api/offline/crops
GET  /api/offline/fields/{field_id}/rotations
GET  /api/offline/fields/{field_id}/rotations/evaluated
POST /api/offline/fields/{field_id}/recommendations

Run it with:

.ackendenv\Scripts\python.exe -m uvicorn offline.server:app --app-dir backend --host 127.0.0.1 --port 8001

Farmer-priority recommendation engine

Field Shift lets farmers change the importance of:

💧 Water conservation

🌱 Soil health

☀️ Climate resilience

🌾 Crop diversity

For every crop rotation:

Priority contribution
=
factor score × farmer weight

The final score is:

Priority Fit
=
Water contribution
+ Soil contribution
+ Climate contribution
+ Diversity contribution

This means the same crop rotation can receive a different Priority Fit when farmer priorities change.

The frontend now displays the calculation for each recommendation:

Water
rotation score × current weight = contribution

Soil
rotation score × current weight = contribution

Climate
rotation score × current weight = contribution

Variety
rotation score × current weight = contribution

The recommendation cards therefore use both the specific rotation's factor scores and the farmer's current priority profile rather than showing a static calculation.

Current frontend

The React dashboard is implemented in:

frontend-web/

Current functionality includes:

field overview

environment information

soil information

farmer priority selection

crop-rotation recommendations

recommendation ranking

rotation-specific factor scores

live priority-weight calculation

Priority Fit calculation

recommendation explanation

API/offline status handling

loading and error states

local/offline storage architecture

The current visual direction is being redesigned around a farmer-friendly Field Shift dashboard featuring field visualization, field health, environmental indicators, rotation planning, scenario comparison, explanations, and transparent data sources.

Frontend architecture

frontend-web/
├── public/
├── src/
│   ├── assets/
│   ├── components/
│   │   ├── common/
│   │   ├── farmer/
│   │   └── technical/
│   ├── engine/
│   ├── pages/
│   ├── services/
│   ├── storage/
│   └── types/
└── ...

Important modules include:

src/pages/Dashboard.tsx
src/services/api.ts

src/engine/
├── explainabilityEngine.ts
├── priority.ts
├── priorityEngine.ts
├── recommendationEngine.ts
└── riskEngine.ts

src/components/farmer/
├── FarmerGoalSelector.tsx
├── FieldHealthCard.tsx
├── RecommendationCard.tsx
├── RecommendationList.tsx
├── RecommendationReason.tsx
├── SoilSummary.tsx
├── WeatherSummary.tsx
└── ...

Offline-first architecture

A core design goal is to separate live Earth-data preparation from the farmer-facing decision runtime.

NASA / GEE
   │
   │ online preparation
   ▼
Prepared historical data
   │
   ▼
Local database
   │
   ▼
FastAPI
   │
   ▼
Field Shift

The frontend also contains:

src/storage/cache.ts
src/storage/indexedDb.ts
src/storage/sync.ts

Browser-level PWA/service-worker support remains part of the roadmap.

Data pipeline

The current pipeline is progressing toward:

NASA/GEE ingestion
        ↓
Canonical observations
        ↓
Monthly features
        ↓
NASA POWER integration
        ↓
Agricultural targets
        ↓
Final ML-ready dataset

The current NASA ingestion layer is operational. The canonical/monthly feature/ML dataset stages remain part of the next implementation phase.

ML layer

Planned/ongoing model modules include:

ml-models/stress_risk_model.py
ml-models/shift_score_model.py
ml-models/yield_forecast_lstm.py

These models are intended to support the broader field-risk, shift-score, and yield-forecasting workflow.

The complete ML integration is not yet the finished runtime path.

Feni District use case

The current project is being developed around a Feni District, Bangladesh use case.

The broader research/data pipeline is designed to combine:

NASA Earth observations

climate variables

soil information

crop information

agricultural targets

local field context

The objective is to translate these signals into understandable crop-rotation decision support.

What is completed

✅ NASA/GEE ingestion workflow

✅ SMAP ingestion

✅ MODIS ingestion

✅ GPM IMERG ingestion

✅ ECOSTRESS ingestion

✅ GRACE ingestion

✅ Current dataset validation

✅ Local SQLite offline database

✅ FastAPI offline service

✅ Field endpoint

✅ Environment endpoint

✅ Soil endpoint

✅ Crop endpoint

✅ Rotation endpoint

✅ Evaluated-rotation endpoint

✅ Farmer-priority recommendation endpoint

✅ React dashboard foundation

✅ Farmer priority selector

✅ Recommendation ranking

✅ Rotation-specific scoring display

✅ Live priority-weight calculation

✅ Priority Fit calculation

✅ Recommendation explanation

✅ Frontend API integration

✅ Local frontend storage architecture

Development

Frontend

cd frontend-web
npm install
npm run dev

The frontend currently expects the offline FastAPI service at:

http://127.0.0.1:8001

It can be changed using:

VITE_API_BASE_URL

Backend

From the project root:

.ackendenv\Scripts\python.exe -m uvicorn offline.server:app --app-dir backend --host 127.0.0.1 --port 8001

Health check:

http://127.0.0.1:8001/api/offline/health

NASA data & credits

Field Shift uses public NASA Earth-observation products and Google Earth Engine during the online data-preparation stage.

Primary Earth-observation sources include:

SMAP — Soil Moisture Active Passive

MODIS — Moderate Resolution Imaging Spectroradiometer

GPM IMERG — Global Precipitation Measurement / Integrated Multi-satellitE Retrievals

ECOSTRESS — ECOsystem Spaceborne Thermal Radiometer Experiment on Space Station

GRACE — Gravity Recovery and Climate Experiment

NASA POWER — climate/weather data used in the broader feature pipeline

Additional local soil and agricultural data are incorporated where required by the research and feature-engineering pipeline.

Dataset identifiers, processing details, and citations should be documented in:

docs/data-sources.md

Demo

The final repository should include a short end-to-end demonstration once the dashboard and complete decision workflow are ready.

Planned location:

docs/demo.gif

Intended demo flow:

Open Field Shift
      ↓
Select field
      ↓
Review field conditions
      ↓
Choose farmer priorities
      ↓
Generate crop-rotation recommendations
      ↓
Compare Priority Fit
      ↓
Understand why the recommendation changed

Project principle

Field Shift is a decision-support system, not a replacement for agronomists and not a guarantee of crop yield.

Recommendations should remain:

explainable

transparent

data-driven

priority-aware

locally contextualized

clear about uncertainty

The goal is simple:

Real Earth data. Real farm decisions. A more resilient future.

NASA Space Apps Challenge 2026

Built for the:

NASA Space Apps Challenge 2026

Project:

Field Shift: Adapting Farms with NASA Data

License

Built for NASA Space Apps Challenge 2026.

See LICENSE for the applicable terms.
