# Offline runtime

FastAPI + SQLite. This is the API the frontend calls; it needs no internet.

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate            # Windows  (source .venv/bin/activate on Linux/macOS)
pip install -r requirements-offline.txt

cd offline
uvicorn server:app --host 127.0.0.1 --port 8001
```

## Database

`field_shift.db` is committed. It is built in two steps:

1. `build_offline_database.py` — environment, soil, crop profiles and the old
   rotation scenarios. Needs `data-pipeline/output/`, which is **not** in the
   repository.
2. `build_pattern_tables.py` — crop calendar, cropping patterns and their
   feasibility check. Needs only files in the repository:

   ```bash
   python backend/offline/build_pattern_tables.py
   ```

## Main endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/offline/health` | Status and database metadata |
| `GET /api/offline/fields/{id}` · `/environment` · `/soil` | Field, monthly NASA/POWER features, SoilGrids profile |
| `GET /api/offline/crop-calendar` | Sourced sowing/harvest windows |
| `GET /api/offline/patterns` | All cropping patterns with feasibility status and reasons |
| `POST /api/offline/fields/{id}/pattern-recommendations` | Ranked patterns as changes from `current_pattern_id` (default `boro_fallow_taman`) |
| `/rotations`, `/rotations/evaluated`, `POST /recommendations` | Deprecated crop permutations without a season check |

Method: `data-pipeline/scoring/methodology.md`. Sources: `docs/data-sources.md`.
