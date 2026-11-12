# Merge notes: `improve/feni-v2` → `Zishan-backend-ml-models-data-pipeline`

**Not merged. Nothing was pushed to the base branch.** This is a map of the conflicts for Zishan and
Montakim to reconcile together. Produced 12 Nov 2026 by a trial merge in a throw-away worktree
(`git merge --no-commit --no-ff origin/Zishan-backend-ml-models-data-pipeline` on `improve/feni-v2` @ `2f31289`,
base @ `612972b`), then aborted.

## Summary

| File | Conflict regions | Nature |
|---|---|---|
| `frontend-web/src/pages/Dashboard.tsx` | **9** | Both branches restructured the page (see below) |
| `README.md` | 4 | Rewritten here (validation-first, 250 lines); base kept the old 1,600-line README and added PWA/Leaflet badges |
| `frontend-web/package.json` | 2 | Dependency lists (both added Leaflet; base adds `leaflet-draw`) |
| `frontend-web/package-lock.json` | 5 | Follows `package.json`; regenerate with `npm install`, do not hand-merge |

The brief said three files and three Dashboard regions. Since then the base branch gained 8 commits
(chatbot voice and geocoding, a hand-written service worker, README edits), so there are now four files
and nine Dashboard regions.

**Merged cleanly by Git but still in conflict at run time**, so they need a decision too:

1. **Two service workers.** Base: `frontend-web/public/sw.js` + `public/manifest.json`, registered by hand
   in `src/App.tsx` (`navigator.serviceWorker.register("/sw.js")`). This branch: `vite-plugin-pwa` in
   `vite.config.ts` generates `dist/sw.js` and `manifest.webmanifest` and registers itself
   (`registerSW.js`). Both produce `/sw.js`, so one overwrites the other in `dist/`. The base worker
   precaches `"/src/main.tsx"`, which is not in a production build, and `cache.addAll` rejects when any URL
   fails, so it most likely never installs in production. The plugin's worker precaches the built shell and
   all of `public/data/` and was tested offline (README §7). **Keep one**: if the plugin's, delete
   `public/sw.js`, `public/manifest.json` and the `useEffect` in `App.tsx`. The merged `index.html` links
   `/manifest.json` and `/logo.png` from base; with the plugin, the manifest link is injected
   automatically, so drop base's `<link rel="manifest">` to avoid two manifests.
2. **Two data paths.** Base caches the Feni dataset in `localStorage` (`DashboardCache`,
   `applyDashboardData`) and calls the live API. This branch serves the API's answers as static JSON
   (`public/data/`, `src/services/api.ts` with a live-API option) so the site needs no backend. They solve
   the same problem; keeping both adds a second cache that can go stale.
3. **Root `package.json`** (new on base) lists `leaflet`, `leaflet-draw`, `react-leaflet`. The app builds
   from `frontend-web/`; these probably belong in `frontend-web/package.json` only.

## `Dashboard.tsx`, region by region (line numbers in the trial-merge file)

| # | Lines | This branch (`improve/feni-v2`) | Base (`Zishan-backend-…`) |
|---|---|---|---|
| 1 | 39–44 | Imports `AppHeader` (compact Bangla-first header with the language switch) | Imports `FarmChatBot` and `FarmerHeader` (the original hero header) |
| 2 | 53–72 | Imports `AboutSections`, `Collapsible`, `FarmerVerdictSection` + `DEFAULT_FIELD`, `FieldPick`; lazy `ClimateShiftSection` and `DistrictContextSection` | Imports `FarmMap` (Leaflet with polygon drawing), `CropSelector`, `LanguageSwitcher` |
| 3 | 937–991 | State for the picked demo field (`pick`), an effect that re-ranks recommendations when the field changes, `recommendationsOpen` | `applyDashboardData()` restoring the dashboard from the `localStorage` cache, then the initial-load header |
| 4 | 1290–1299 | `updateRecommendations` asks for the **picked demo field** (`pick.fieldId`) | Sets recommendations from `data` (cached/test-plot path) |
| 5 | 1324–1330 | Scrolls to `#recommendations-details` (the collapsible) | Scrolls to `#recommendations` |
| 6 | 1513–2178 | Page order: header → map picker → **verdict card** with top 3 → compact priorities; everything else collapsed (≈ 13 lines, the rest auto-merged) | ≈ 650 lines: top bar (regional-dataset badge, online/offline pill), `FarmerHeader` hero, field status, **`FarmMap`**, "online map exploration result" (live NASA POWER for any drawn coordinates), **`FarmChatBot`**, prepared Feni environment, soil, climate shift, demo fields, crop selection — all open |
| 7 | 2283–2298 | Recommendations wrapped in `<Collapsible id="recommendations-details">` | Section header "12. RECOMMENDATIONS" |
| 8 | 2391–2728 | Climate, 64-district context, satellite timeline, field conditions and crop filter each inside a closed `<Collapsible>` | "13. HOW FIELD SHIFT WORKS" and the notice, inline (moved to `AboutSections.tsx` on this branch) |
| 9 | 2805–2873 | Earth-observation anchor + closing of the "field conditions" collapsible | Closing `</details>` of base's technical-details block |

### What each side adds that the other lacks

* **Only here:** verdict card (Keep / Adjust / Shift) with "Why?" lines from each field's satellite record;
  six-field map picker; field risk and the dry-season feasibility rule (Sonagazi); phone-first layout
  (≈ 2,600 px at 360 px); 64-district context chart; static JSON + in-browser ranking; tested offline PWA.
* **Only on base:** `FarmMap` with polygon drawing; live NASA POWER weather for any coordinates;
  `FarmChatBot` (online/offline, voice reply, reverse geocoding); `localStorage` dashboard cache;
  online/offline status pill.

### A reconciliation path (suggestion, not done)

1. Take this branch's Dashboard skeleton (header → map → verdict → priorities → collapsibles), since the
   verdict-first order and the 360 px layout were the brief.
2. Add base's `FarmChatBot` as one more `<Collapsible>` (or a floating button), and `FarmMap` +
   "map exploration result" as a collapsible "Explore any location (live NASA POWER)", labelled as outside
   the Feni recommendations.
3. Keep one service worker (see above) and one data path (static JSON + optional live API).
4. README: keep this branch's rewritten README. The base README still names Turso/LibSQL 16 times and
   PyTorch 3 times, which this code does not use; port base's PWA/Leaflet badges if still true after step 3.
5. Run `npm install` to regenerate `package-lock.json`, then `npm run build`, `npm test`,
   `cd data-pipeline && python -m pytest`, and the offline test in README §7.
