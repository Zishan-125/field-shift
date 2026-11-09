# Model card — Feni crop classifier (LightGBM, weak labels)

**Status (9 Nov 2026): data and code ready; metrics are filled in below
when training runs.** Code: `data-pipeline/classifier/`.

## What it does

For a cropland location and a season, it gives the probability that the
satellites saw **Boro**, **Rabi_nonrice** (mustard, wheat, maize, pulses,
potato …) or **Fallow** in the Rabi season, and **T_Aman** or **Fallow** in
Kharif-2. In the app it feeds "What satellites saw on your field", a
season-by-season timeline for the six demo fields from 2016.

It is **not** a yield model and not a field survey. It has never been checked
against a farmer's own record of what they planted.

## Data

| Item | Detail |
|---|---|
| Points | 1,200 locations, 400 each in Feni, Noakhali, Cumilla, on pure ESA WorldCover cropland (the whole 90 m square), ≥ 500 m apart, ≥ 1 km from the demo fields (`classifier/sample_points.py`) |
| Inputs | 10-day composites 2015-11 to 2025-12: HLS L30+S30 NDVI/EVI/LSWI (Fmask bits 0–4 masked), Sentinel-1 VV/VH (orbits pooled), GPM IMERG rain, SMAP L4 root-zone moisture (`classifier/extract_point_dekads.py`) |
| Labels | Phenology rules, weak labels (`docs/methodology/phenology.md`) |
| Features | 21-dekad season windows; gaps ≤ 60 days interpolated, Savitzky-Golay (5, 2); counts of clear optical and radar dekads kept as features (`classifier/features.py`) |
| Split | By season year: train ≤ 2022, validate 2023, test 2024 |

## How independent the labels and the timelines are

* The labels come from rules on the same satellite series the model learns
  from. Agreement between model and rules on the held-out year measures how
  well the model reproduces the rules, **not** how often it is right about
  the crop. The BBS district statistics and the Sentinel-1 flood-extent
  check are the independent tests.
* **The radar thresholds of the rules (−19 dB for flooding, a rise of at
  least 4 dB to canopy) were set by eye on the six demo fields.** The 1,200
  training points are separate from those fields (≥ 1 km away), but the
  timelines shown for the demo fields are therefore **not fully independent
  of the threshold choice**: the thresholds were chosen so that the rules
  behaved sensibly on exactly those fields.

## Sentinel-1 orbit mix

Observations per orbit per demo field and year: `data-pipeline/derived/s1_orbit_mix.csv`
(`fields/orbit_mix.py`). 2017–2025: about 30 passes a year on each of
ASC114, ASC41 and DES77, stable. 2015–2016: DES77 only (11–14 passes).
Offset of each orbit from the all-orbit mean of the same field and month:
ASC114 −0.7 to −0.8 dB, ASC41 +0.4 to +0.8 dB, DES77 +0.05 to +0.25 dB.
Pooled 2015–16 dekads are therefore biased by at most about +0.25 dB, small
against the ~10 dB crop cycle and the 4 dB rule. No per-orbit
normalisation is applied; this is a recorded decision, not an oversight.

## Metrics

To be filled from `data-pipeline/derived/classifier_metrics.csv` and
`classifier_confusion.csv`.

## Validation against BBS

To be filled from `classifier_bbs_check.csv`. BBS units were verified
(`docs/methodology/bbs-aman-area-check.md`); the Feni 2024-25 Aman figure is
treated as real, with the 0.03 % coincidence documented.

## Flood extent (Sentinel-1) against the BBS damage table

To be filled from `data-pipeline/derived/flood_extent_check.csv`.

## Limitations

* Weak labels, no ground truth.
* Monsoon cloud: Kharif-2 rests mostly on radar.
* One cropland mask (WorldCover 2021) for all years.
* Points sample only land WorldCover is sure is cropland; homestead-mixed
  fields are not represented.
