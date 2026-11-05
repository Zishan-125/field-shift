# Recommendation methodology

Version `season_patterns_v2` (replaces the crop-permutation scenarios of
`farmer_priority_v2`, which are still served by the deprecated
`/rotations` and `/recommendations` endpoints).

## 1. Candidates: real annual cropping patterns

Candidates are not generated. They are the annual cropping patterns recorded
by BRRI in the Chittagong agricultural region, which includes Feni
(`data-pipeline/reference/cropping_patterns.csv`, source `SHAHIDULLAH_2017`),
plus two national patterns from `NASIM_2017`. Each pattern is written
Rabi crop – Kharif-1 crop – Kharif-2 crop, e.g. Boro – Fallow – T. Aman.

The farmer's current pattern defaults to **Boro – Fallow – T. Aman**, the most
common pattern in the region (22.9 % of net cropped area) and in five of Feni's
six upazilas. In Sonagazi, single T. Aman is more common (27.3 % vs 2.9 %).

## 2. Calendar feasibility check

`data-pipeline/rotation/feasibility.py`, tested in `data-pipeline/tests/`.

* Each crop occupies the main field from its start (transplanting or sowing)
  for `field_days_min` days, and never leaves before the earliest harvest date
  of its calendar.
* Each crop must start inside its sourced start window and after the previous
  crop has left the field (+ turnaround).
* The sequence must close: next year's first crop must still fit after this
  year's last crop, i.e. everything fits in 365 days.
* A crop may have several calendar variants (DAE regional, BRRI/BARI
  national recommendation, farmers' practice); the best combination is kept.

| Status | Meaning |
|---|---|
| feasible | fits with the assumed 7-day turnaround |
| tight | fits only with less turnaround (shown to the farmer as a warning) |
| infeasible | does not fit even with zero turnaround; the reason names the crops and dates |
| unverified | a crop has no sourced calendar yet (see `docs/data-gaps.md`) |

A pattern that farmers do grow but that fails the check is flagged
`calendar_conflict`: the calendar data is incomplete, not the farmers wrong.
Only feasible and tight patterns are recommended.

## 3. Indicators

Built by `backend/offline/build_pattern_tables.py`. A fallow season adds
**neither water nor food**, so leaving land empty can no longer look like a
win. Patterns are scored only when every indicator is available.

### 3.1 Food production (sourced)

Food energy per hectare per year = Σ over the crops grown of
BBS Feni yield (t/ha, 2024-25) × edible-portion coefficient × food energy
(MJ/kg, FCT Bangladesh 2013 or USDA). Shown to farmers as tonnes of rice with
the same food energy. `food_production_score` = food energy ÷ the highest
value among the scored patterns.

### 3.2 Water productivity (sourced)

For each crop season, day by day:

* ET0 — FAO-56 Penman-Monteith from NASA POWER daily data (2015–2024), as
  monthly normals (`data-pipeline/derived/feni_monthly_climate.csv`);
* Kc — FAO-56 Table 12 (initial, mid, end) on the Table 11 stage lengths,
  scaled to the crop's field days (Fig. 25);
* crop water need = Σ Kc × ET0, plus for rice the FAO paddy terms
  (puddling 200 mm, water layer 100 mm, percolation 6 mm/day);
* effective rainfall from GPM IMERG monthly normals with the FAO formula;
* irrigation need = Σ over months of max(0, need − effective rain).

`water_productivity_score` = (food energy ÷ total crop water need, MJ/m³) ÷
the highest value among scored patterns. Total need is used rather than
irrigation alone because a rainfed pattern (single T. Aman) has almost no
irrigation and would get an unbounded score. **Irrigation water needed** is
reported separately (mm and m³/ha per year) and is never optimised on its own.

### 3.3 Soil health (provisional)

0.4 × historical soil context + 0.3 × legume seasons / 3 + 0.2 × crop
diversity + 0.1 × (1 − nitrogen load / 3), where the nitrogen load sums the
`soil_fertility_dependency` of the **non-legume** crops only.

* A fallow season adds no load: it rests the soil.
* A legume season (lentil, mungbean, grass pea, felon) also adds no load,
  because legumes fix atmospheric nitrogen (Herridge, Peoples & Boddey 2008),
  **and** it earns the legume credit, so it always scores above a bare fallow
  of the same season.

### 3.4 Climate resilience (provisional) and crop diversity

Unchanged: crop tolerances and environmental compatibility from
`crop_profiles`, averaged over the crops grown; diversity = distinct crop
groups / 3 seasons.

## 4. Farmer priorities and trade-offs

Score = Σ normalised weight × indicator. Default weights (a UI starting
point, not data): food production 0.30, water productivity 0.25, soil 0.20,
climate 0.15, variety 0.10. The farmer can raise or lower each one.

Every recommendation is compared with the current pattern on both sides —
food produced and irrigation water needed — and labelled
`change_kind = "trade_off"` when it has fewer harvests, less food, more
irrigation, fewer rice seasons or tight timing. A pattern with fewer harvests
is never presented as a plain improvement.

## 5. Guard tests

`data-pipeline/tests/test_recommendation_guards.py` runs the real API on the
committed database and fails if:

* Boro – Aus – T. Aman ranks last under the default weights;
* a single-crop pattern is in the top 3 under the default weights;
* a pattern with fewer harvests than the current one is not labelled a
  trade-off (checked for three different current patterns);
* any pattern's score does not change when the food-production weight (or
  any other weight) changes;
* a legume season does not beat a bare fallow on soil health.

`test_crop_water.py` checks Penman-Monteith against FAO-56 Example 18 and the
FAO effective-rainfall formula.

## 6. Limits

Yields are district averages for one year, not a forecast for this field.
Cost, income, salinity, flood and cyclone risk are not included yet. Soil and
climate scores still rest on unvalidated crop parameters. Open items are in
`docs/data-gaps.md`.
