# Phenology rules — weak crop labels from satellite time series

Code: `data-pipeline/classifier/phenology_labels.py`.
Input: 10-day (dekad) composites per point from
`data-pipeline/classifier/extract_point_dekads.py`.

These rules produce **weak labels**: they are not field observations. No
hand-labelled gold set exists for this project. They are used (a) to train
the crop classifier and (b) on their own as the fallback if the classifier
is not ready. The only independent check is the BBS district area statistics
(see `docs/ml/crop_classifier.md`).

## Classes and seasons

| Season (year Y) | Months | Classes |
|---|---|---|
| Rabi | Oct (Y−1) – May (Y) | **Boro**, **Rabi_nonrice** (mustard, wheat, maize, lentil, potato, vegetables …), **Fallow** |
| Kharif-2 | Jul – Nov (Y) | **T_Aman**, **Fallow** |

Kharif-1 (Aus, summer pulses) is not labelled: Feni has little Aus, and HLS
sees almost nothing through the pre-monsoon and monsoon clouds (0–13 clear
dates per Kharif-1 season at the Fulgazi field).

A point-season gets a label only when **exactly one** rule fires. No rule, or
two conflicting rules, leaves it **unlabelled**. Unlabelled samples are not
used for training.

## Inputs per dekad

| Signal | Definition | Source |
|---|---|---|
| NDVI, EVI, LSWI | Median of clear HLS L30 + S30 pixels (Fmask bits 0–4 masked, negative reflectance clamped to 0) | NASA HLS v2.0 |
| Optical flood | LSWI + 0.05 ≥ EVI | Xiao, X. et al. (2005). Mapping paddy rice agriculture in southern China using multi-temporal MODIS images. *Remote Sensing of Environment* 95: 480–492 |
| Radar flood | Sentinel-1 VH < −19 dB (dekad mean, orbits pooled) | Our threshold, see below |

Windows come from the DAE BAMIS Chattogram calendar in
`data-pipeline/reference/crop_calendar.csv`, widened for late planting.

## Rules

**Boro (Rabi Y).** A flooding signal (optical or radar) in 11 Dec (Y−1) –
10 Feb (Y), which covers BAMIS transplanting (17 Dec – 14 Jan) plus late
transplanting. **And** NDVI reaches ≥ 0.60 in 11 Feb – 30 Apr (flowering
12–18 Mar, harvest 2–22 Apr).

**Rabi_nonrice (Rabi Y).** NDVI ≥ 0.50 in 1 Dec – 20 Mar. **And** no flooding
signal in 21 Nov – 20 Feb, with at least 6 radar dekads seen (so "no
flooding" is not just "no data"). **And** NDVI < 0.50 in April, if April is
seen (the canopy is gone before Boro would peak; BAMIS harvests mustard 5–11
Mar, wheat and maize 12–25 Mar, lentil late Jan – early Feb, potato mid-Jan).

**Fallow (Rabi Y).** At least 6 clear HLS dekads in 1 Dec – 30 Apr, and NDVI
never reaches 0.40.

**T_Aman (Kharif-2 Y).** Radar flooding (VH < −19 dB) in 1 Jul – 31 Aug
(BAMIS transplanting 2–29 Jul; BRRI to 15 Aug). **And** VH rises to
≥ −17 dB in 11 Sep – 10 Nov, at least 4 dB above the July–August minimum.
**And**, if any clear HLS dekad falls in 1 Oct – 20 Nov, its NDVI reaches
≥ 0.60.

**Fallow (Kharif-2 Y).** At least 4 radar dekads in 1 Sep – 31 Oct, VH never
above −20 dB (standing water or bare soil all season), and no HLS NDVI
≥ 0.40 in Oct–Nov.

## Where the thresholds come from

* **LSWI + 0.05 ≥ EVI** is Xiao et al.'s flooding test, used unchanged.
* **NDVI 0.60 / 0.50 / 0.40** are round numbers for a closed rice canopy, a
  non-rice Rabi canopy and bare or sparse land. Not fitted.
* **Radar thresholds were set by looking at the six demo fields** (excluded
  from the training points by at least 1 km). At the Fulgazi field, single
  Sentinel-1 scenes over open water read VH −26 to −29 dB and a rice canopy
  −11 to −14 dB. A 10-day mean over three orbits flattens the short
  transplanting dip: with a −22 dB threshold the T. Aman rule fired in only
  23 of 60 demo field-seasons although Oct–Nov NDVI was 0.8–0.9 in most of the
  others. The threshold was moved to −19 dB and the required rise from 6 to
  4 dB. This is judgement on 6 fields, **not** tuned against labels or the
  BBS statistics.

## Known failure modes

| Failure | Effect | Mitigation |
|---|---|---|
| Monsoon cloud: HLS sees 0–7 clear dates per Kharif-2 season | T. Aman rests almost entirely on radar | NDVI is used only as a veto when available |
| Flood after transplanting (Aug 2024) | A destroyed crop that is replanted or regrows weeds looks like late T. Aman; a field that stays flooded looks like Kharif-2 fallow | Kept as is; the BBS 2024-25 check tests exactly this |
| Boro transplanted into saturated soil without standing water, or after 10 Feb | No flooding signal, so no Boro label; may become Rabi_nonrice if April is unseen | April NDVI veto; otherwise unlabelled |
| Long Rabi crops (chili to June, vegetables, sugarcane) | Green in April without flooding: matches no rule | Unlabelled (Chhagalnaiya demo field, most years) |
| Homestead trees, roads or water in the 30 m pixel | Mixed signal | Points only where the whole 90 m square is WorldCover cropland |
| Pre-2017 Sentinel-1 coverage is sparse (5 radar dates in Rabi 2016 at Fulgazi) | Few 2016 labels; "no flooding" cannot be shown | Minimum radar-dekad counts; 2016 samples are mostly unlabelled |
| Orbit mixing (ascending/descending differ by ≤ 1.3 dB at Fulgazi) | Extra noise in dekad VH | Small next to the ~10 dB crop cycle; accepted |
| WorldCover 2021 cropland mask used for every year | Land converted to ponds or buildings later still sampled | Shows up as unlabelled or Fallow |
| Rules and classifier see the same satellites | The classifier can only learn what the rules say; agreement with the rules is not accuracy | BBS district areas are the independent test |

## Demo fields, rules only (2016–2025)

T_Aman 35, Boro 29, Fallow 9, Rabi_nonrice 3, unlabelled 44 of 120
field-seasons. The coastal Sonagazi field is Rabi fallow in 9 of 10 years and
never meets the T. Aman rule (deep water in July–August, Oct–Nov NDVI
0.2–0.5). The Fulgazi field is Boro – T. Aman except in 2024, where the
rules decline to label the flooded Kharif-2 season.
