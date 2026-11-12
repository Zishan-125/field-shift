# Archive — kept for history, not used by the app

Nothing in this folder is imported, built, deployed or tested by the current app
(`backend/offline/` + `frontend-web/` + `data-pipeline/`). It was moved here on
12 Nov 2026 so the repository root shows only what runs. Nothing was deleted; git
history follows the moves.

| Path | What it was | Why it is archived |
|---|---|---|
| `backend-legacy/app/` | FastAPI app for an earlier "TerraShift" design: Postgres/PostGIS, an Ollama RAG copilot, Twilio SMS, an ML scorer, a Turso/LibSQL database option | The frontend never called it; the app uses `backend/offline/server.py` on a local SQLite file |
| `backend-legacy/tests/` | Tests for that app | Tested the unused app |
| `backend-legacy/Dockerfile`, `docker-compose.yml`, `.env.example` | Container and settings for that app (Postgres, Turso, Twilio variables) | Described the unused design |
| `backend-legacy/requirements.txt` | Its dependencies (torch, xgboost, faiss, sentence-transformers, twilio, libsql …) | The app needs only `backend/requirements-offline.txt` |
| `ml-models/` | Yield-LSTM, stress-risk and shift-score models with saved weights | **Trained only on synthetic data** from `generate_realistic_data.py`; the stress labels came from a rule, so the models re-learned the rule. Not validated and not to be presented as such |
| `ml-models/generate_realistic_data.py` | Generator of fake field histories | Source of the synthetic training data above |
| `ml-models/requirements.txt` | Former root requirements (torch, xgboost …) | Only the archived models needed them |
| `economics/economic_environmental_model.py`, `Feni_Economic_Environmental_Dataset.*` | Solar vs diesel irrigation economics on NASA POWER weather | Never wired into the app or the ranking; cost and income are listed as a limitation instead |
| `economics/Feni_Daily_Weather_NASA_POWER_ML.xlsx` | Excel copy of the NASA POWER daily file | The pipeline reads the CSV, which stays at the repository root (`climate/climate_shift.py`, `water/build_monthly_climate.py`) |
| `BASELINE.md` | Snapshot of the app before the Feni v2 changes (28 Oct 2026) | Historical reference; no longer describes the app |

The crop classifier that *is* used (for the season timeline only) lives in
`data-pipeline/classifier/`; its model card is `docs/ml/crop_classifier.md`.
