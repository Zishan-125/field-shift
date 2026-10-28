# Recommendation methodology

Version `season_patterns_v1` (replaces the crop-permutation scenarios of
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

## 3. Provisional indicators

`backend/offline/build_pattern_tables.py` scores patterns whose crops all have
a `crop_profiles` entry. The component formulas are those of
`build_farmer_priority_scenarios.py`, adapted to a year with three seasons:

* water: crop water-demand indices **summed** over the crops and divided by 3
  seasons (so an extra crop never looks thriftier), then the same
  historical-water-context adjustment as before;
* soil: 0.4 × historical soil context + 0.3 × legume seasons / 3 +
  0.2 × diversity + 0.1 × (1 − summed fertility dependency / 3);
* climate: crop tolerances and environmental compatibility averaged over the
  crops grown, + 0.2 × historical climate context;
* diversity: distinct crop groups / 3 seasons.

The farmer-priority score is the weighted sum of the four indicators, and every
recommendation is reported as the change against the current pattern.

**Limits (stated in the API and UI):** the crop parameters are hand-set and not
validated; the three historical contexts are constants for the field (soil
context is a 0.5 fallback); yield, cost and income are not included, so
patterns with fewer crop seasons can score higher on water. The UI warns when a
recommendation has fewer crop seasons than the current pattern.
