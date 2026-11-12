# Deploying Field Shift (branch `improve/feni-v2`)

The app is a static site. It needs **no server**: the API's answers are exported to
`frontend-web/public/data/` and the farmer's priorities re-rank patterns in the browser
(`src/services/staticRanking.ts`, tested against the API with `npm test`). A backend is optional.

Verified 12 Nov 2026: a clean clone of this branch, with no API server running anywhere, builds,
passes `npm test` and serves the verdict, top 3 and map; the browser made no API request.

## A. Static only (recommended for judging)

Create a **separate Vercel project** for this branch, so the existing production project (which builds
`Zishan-backend-ml-models-data-pipeline`) is untouched.

| Vercel setting | Value |
|---|---|
| Git repository | `Zishan-125/field-shift` |
| Production branch | `improve/feni-v2` |
| Root directory | `frontend-web` |
| Framework preset | Vite |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Node.js version | 22.x or 24.x (Vite 8 needs Node 20.19+ / 22.12+) |
| Environment variables | **none** — leave `VITE_API_BASE_URL` unset |

`frontend-web/vercel.json` only sets `Cache-Control: max-age=0, must-revalidate` on `sw.js`, the
manifest and `data/*`, so a new deployment reaches users who already installed the app.

Branch previews of this repository are behind Vercel login (Deployment Protection). For a public judging
link, either use the new project's production URL or switch protection off for that project
(Settings → Deployment Protection).

After deploying, check on a phone: the verdict card appears on the first screen, the map shows six
dots, and after one visit the app still opens in airplane mode (see the offline test in the README).

## B. With a backend (live data, same UI)

1. Host `backend/offline/` on any Python host (Render, Railway, Fly.io, a VM):
   * Python 3.13
   * Install: `pip install -r backend/requirements-offline.txt`
   * Start (working directory `backend/offline`): `uvicorn server:app --host 0.0.0.0 --port $PORT`
   * The database `backend/offline/field_shift.db` is in the repository; no other service is needed.
   * Check `https://<host>/api/offline/health`.
2. In the Vercel project set `VITE_API_BASE_URL=https://<host>` and **redeploy**. It is read at build time.
3. The app then uses the live API and falls back to the built-in data if the API is unreachable.
   CORS in `server.py` allows any origin.

There is no Turso/LibSQL or Postgres in this path; the server reads the SQLite file with `sqlite3`.

## Keeping the static data in step with the database

Whenever `field_shift.db` changes (`backend/offline/build_*_tables.py`):

```bash
python backend/offline/export_static.py     # rewrites frontend-web/public/data/ and the test fixture
cd frontend-web && npm test                 # static ranking must still equal the API ranking
```

`frontend-web/public/data/manifest.json` records the export time and the source commit.
