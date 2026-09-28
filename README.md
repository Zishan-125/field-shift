# TerraShift
### NASA Space Apps Challenge 2026 — *Field Shift: Adapting Farms with NASA Data*

> Turning NASA Earth observations into one plain-language answer for
> farmers facing shifting rainfall, water shortages, and declining
> soil health: **should I keep this crop, adjust my timing, or shift
> my rotation?**

![demo](docs/demo.gif)
<!-- Record this last, once the dashboard + a live SMS reply both
     work end-to-end. A 20-30 second screen capture beats a written
     description for judges skimming dozens of repos. -->

---

## The problem

Farmers feel a shifting climate — shorter rains, hotter soil, falling
water tables — long before they can quantify it. NASA already
measures all of this (soil moisture, vegetation stress, rainfall,
groundwater), but that data lives in raster files and scientific
APIs, not in a decision a farmer can act on this week. TerraShift is
the translation layer: local soil information, crop history, and a
farmer's own priorities go in; a **Field Shift Score** and one
concrete rotation recommendation come out — reachable on a web
dashboard, an offline-first mobile app, or a plain SMS to any phone.

## How it works

```
NASA Earthdata / Google Earth Engine
        │  (SMAP, MODIS, GPM IMERG, ECOSTRESS, GRACE-FO)
        ▼
data-pipeline/  ──►  PostgreSQL + PostGIS
        │                     │
        ▼                     ▼
ml-models/            backend/app/services/scoring_engine.py
(stress + rotation           │
 models, optional)           ▼
                      FastAPI (backend/app)
                     ┌────────┼─────────┐
                     ▼        ▼         ▼
              Web dashboard  Mobile   SMS / USSD
              (frontend-web) (mobile-app) (Twilio)
```

Every recommendation names the specific NASA signal that drove it
(e.g. *"SMAP: root-zone soil moisture 40% below normal for 3
weeks"*) — see `backend/app/services/scoring_engine.py` for the
full, deliberately-explainable scoring logic.

## Repository layout

See the top-level tree in this repo for the full structure; the
short version:

| Folder | What's in it |
|---|---|
| `backend/` | FastAPI service — API, scoring engine, RAG copilot, SMS webhook |
| `data-pipeline/` | Scheduled ingestion of NASA/EO data into Postgres/PostGIS |
| `ml-models/` | Stress-risk classifier, composite shift-score model, yield forecasting |
| `frontend-web/` | React dashboard (field map, score card, rotation planner) |
| `mobile-app/` | React Native (Expo), offline-first field-agent app |
| `docs/` | Architecture diagram, pitch deck, data-source notes |

## Quickstart (for judges)

Everything runs with one command once Docker is installed:

```bash
git clone <this-repo-url>
cd terrashift
cp .env.example .env          # then fill in the values below
docker compose up --build
```

Once containers are healthy:
- API + interactive docs: http://localhost:8000/docs
- Health check: http://localhost:8000/health
- Adminer (peek at the database): http://localhost:8080

Run the backend test suite:
```bash
docker compose exec backend pytest
```

### Required values in `.env`

| Variable | Where to get it |
|---|---|
| `GEE_SERVICE_ACCOUNT_JSON` | [Google Earth Engine service account](https://developers.google.com/earth-engine/guides/service_account) — needed for every NASA dataset pull |
| `NASA_EARTHDATA_TOKEN` | [NASA Earthdata Login](https://urs.earthdata.nasa.gov/) — used for any direct (non-GEE) NASA API calls |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | [Twilio console](https://console.twilio.com/) — only required to test the SMS channel; the web dashboard works without it |

No key for the copilot: it runs against a local Ollama model
(pulled automatically by `docker compose up`), so it works fully
offline — no internet dependency during a live demo.

## NASA data & credits

TerraShift is built entirely on public NASA Earth observation
products, accessed via Google Earth Engine:

- **SMAP** (Soil Moisture Active Passive) — NASA/JPL
- **MODIS** (MOD13Q1 NDVI) — NASA/USGS
- **GPM IMERG** (Global Precipitation Measurement) — NASA/JAXA
- **ECOSTRESS** (ESI, evapotranspiration stress) — NASA/JPL
- **GRACE-FO** (Gravity Recovery and Climate Experiment Follow-On) — NASA/DLR/GFZ

Soil texture/nutrient baselines from **SoilGrids** (ISRIC) supplement
the NASA layers where noted in `data-pipeline/`. Full dataset IDs and
citations are listed in `docs/data-sources.md`.

## License

Built for NASA Space Apps Challenge 2026. See `LICENSE` for terms.