# Model card — Feni crop classifier (LightGBM, weak labels)

**Status (12 Nov 2026): trained and evaluated. It reproduces the phenology
rules almost perfectly and does NOT see the 2024-25 Feni Aman collapse that
BBS reports. Not tuned after seeing that result.** Code: `data-pipeline/classifier/`.

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

## Labels

Rule labels per season-year (of 1,200 points): Rabi — Boro 592–882,
Rabi_nonrice 0–69, Fallow 14–46, unlabelled 285–535; Kharif-2 — T_Aman
793–974, Fallow 1–16, unlabelled 222–397. Training (≤ 2022) 11,485 labelled
samples; validation 2023: 1,752; test 2024: 1,707.

## Metrics (against the rule labels, held-out years)

| Class | Validate 2023 F1 (n) | Test 2024 F1 (n) |
|---|---|---|
| Boro | 0.999 (882) | 0.998 (793) |
| Rabi_nonrice | 0.900 (9) | 0.909 (15) |
| Fallow | 1.000 (21) | 1.000 (33) |
| T_Aman | 1.000 (840) | 1.000 (866) |
| macro F1 / accuracy | 0.975 / 0.999 | 0.977 / 0.998 |

Test 2024 confusion: Boro 790 right, 3 called Rabi_nonrice; everything else
on the diagonal. **These numbers measure how well the model copies the rules,
not crop accuracy.** Rabi_nonrice has 9–15 test samples.

**SHAP (mean |SHAP|, all classes):** rain (2.26 summed over dekads) > season
flag (0.83) > NDVI (0.68) > VH (0.53) > EVI (0.37) > SMAP (0.34) > LSWI (0.30)
> VV (0.24). Rain at dekads 20 and 8 tops the list: rain mainly tells the
model which season window it is in (Rabi is dry, Kharif-2 wet), i.e. it
separates Boro from T_Aman by season, not by crop. Within a season, NDVI and
VH carry the decision.

**Calibration:** only 0.7 % of predictions have a top probability below 0.6.
The model is confident because the rules are deterministic; that confidence
is not evidence of correctness. An "uncertain" output was not built.

## Validation against BBS (independent)

| Check | BBS | Model | Rules only |
|---|---|---|---|
| Aman 2024 / 2023, Feni | **0.405** | 0.988 | 1.015 |
| Aman 2024 / 2023, Noakhali | 0.829 | 0.966 | 0.870 |
| Aman 2024 / 2023, Cumilla | 0.875 | 0.983 | 1.317 |
| Boro 2025 / 2024, Feni / Noakhali / Cumilla | 0.99 / 0.99 / 1.01 | 0.90 / 1.07 / 0.98 | 1.20 / 1.07 / 1.01 |
| Boro / Aman 2023-24, Feni / Noakhali / Cumilla | 0.47 / 0.48 / 1.20 | 0.95 / 0.82 / 0.98 | — |

**Aman-collapse check (rule fixed before training: Feni ratio < 0.70 and the
lowest of three): FAILED** — model 0.988. Why, as far as we can tell:

1. The Kharif-2 classes are only T_Aman and Fallow, and Fallow has 1–16
   training samples a year. Almost any monsoon cropland point becomes T_Aman
   (99–100 % of points in every district and year). A field that was flooded,
   replanted late or lost is still "T_Aman" to this model; there is no
   "failed / not harvested" class.
2. The labels come from transplanting flood + radar rise. A flooded field
   that greens up again by October (Fulgazi: green 22 Oct 2024) satisfies the
   rule. BBS counts harvested area.
3. Points are only where WorldCover is sure of cropland (pure 90 m blocks),
   not a probability sample of BBS's Aman area; the Boro/Aman ratio (model
   about 0.8–1.0 everywhere vs BBS 0.47–1.20) shows the sample does not
   represent BBS's land.

The Cumilla vs Feni contrast in Boro/Aman (BBS 1.20 vs 0.47) is also not
reproduced. **The classifier cannot be used to estimate area or to
confirm the Aman collapse.** What it can do is give a consistent
season-by-season label where the rules abstain.

## Flood extent (Sentinel-1) against the BBS damage table

Share of Aman cropland under water, late Aug – Sep, 2024 minus the same
window in 2023 (transplanted paddy is flooded every year):

| District | Points (2023 rule-T_Aman, dekad VH < −20 dB in ≥ 2 of 4 dekads) | All WorldCover cropland (S1 VV mean < −18 dB) | BBS Aman damaged (Table 4.2.9) |
|---|---|---|---|
| Feni | 37 % → 69 % (**+32**) | 0.6 % → 14.1 % (**+13.5**) | 55 % |
| Noakhali | 51 % → 75 % (+24) | 2.6 % → 12.8 % (+10.2) | 44 % |
| Cumilla | 40 % → 60 % (+20) | 1.4 % → 10.6 % (+9.2) | partial row |

Both satellite measures rank Feni above Noakhali, as the damage table does,
and the Feni/Noakhali ratio is close (points 1.33, pixels 1.32, BBS 1.25).
The levels differ: "damaged" in BBS includes partial damage, and a 3-week
radar window misses floods that came and went. **The radar sees the flood;
the crop classifier does not turn it into lost area.**

## Limitations

* Weak labels, no ground truth.
* Monsoon cloud: Kharif-2 rests mostly on radar.
* One cropland mask (WorldCover 2021) for all years.
* Points sample only land WorldCover is sure is cropland; homestead-mixed
  fields are not represented.
