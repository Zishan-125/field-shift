# Field risk — hazard frequencies from each demo field's own record

Code: `field_hits()`, `field_pattern_risk()` and `risk_driver()` in
`backend/offline/server.py`; inputs built by
`backend/offline/build_field_tables.py` from
`data-pipeline/data/processed/<field_id>.csv` and
`data-pipeline/derived/demo_field_soil_water.csv`.

For a demo field, the pattern ranking's climate score is no longer the
hand-set crop prior. It is computed from what the satellites recorded on that
field, on each crop's own calendar window in each pattern. No probabilistic
model: frequencies only.

## Hazards (per crop window, per year)

| Hazard | Rule | Data | Years | Weight |
|---|---|---|---|---|
| Inundation | Rice: Sentinel-1 VH < −22 dB on consecutive passes for ≥ 15 days. Other crops: any pass < −22 dB | Sentinel-1 GRD, field mean | 2017– (three orbits) | 1.0 |
| Soil too dry | ≥ 10 consecutive days with root-zone moisture below θ_fc − p (θ_fc − θ_wp) | SMAP L4 root zone, on the field's soil | 2015– | 0.5 |
| Heat at flowering | ≥ 1 day ≥ 35 °C in the flowering week | NASA POWER Tmax corrected to BMD Feni (one grid cell, same for all fields) | 1998– | 0.25 |
| Rabi left fallow | Share of the labelled Rabi seasons the phenology rules called Fallow | HLS + Sentinel-1 rule labels | 2016– | 0.5 |

* **15 days.** In 2017–2025 the longest spell of standing water in the
  T. Aman window was at most 13 days on every field except Fulgazi in 2024
  (26 days). Paddy is flooded on purpose at transplanting; 15 days is longer
  than that and longer than the ~2 weeks of complete submergence that even
  Sub1 rice survives (Xu et al. 2006, *Nature* 442: 705–708).
* **Soil water.** θ_fc, θ_wp and saturation from Saxton & Rawls (2006) on
  SoilGrids 0–30 cm (`fields/field_soil_water.py`). SMAP is moved onto the
  field's soil through its degree of saturation:
  θ_field = sm_rootzone / SMAP porosity × θ_sat. p from FAO-56 Table 22
  (rice 0.20, wheat 0.55, maize 0.55, mustard 0.60, lentil 0.50, mungbean
  0.45, potato 0.35, groundnut 0.50, chili 0.30). Boro is irrigated and not
  counted; grass pea has no FAO-56 p and is skipped. The six fields sit in
  two SMAP 9 km cells, so this signal separates at most two groups.
* **Weights** say how far each signal is backed up: inundation is observed on
  the field and floods go with lost Aman production in BBS (−29 %,
  `climate/hazard_yield_check.py`); soil dryness is a model product not yet
  checked against yield; flowering heat did not line up with yield (exposure
  only); a fallow Rabi season is observed but its cause is unknown. They are
  our choices.

## From frequencies to the score

Per crop: risk = min(1, Σ weight × years hit / years seen). Per pattern:
mean over its crops (fallow seasons excluded; food production keeps fallow
from looking good). Climate score = 1 − risk, replacing the hand-set prior
in the default 15 % climate weight.

**Why a pattern is recommended.** `risk_driver` names the hazard for which
the recommended pattern's weighted exposure is lowest compared with the
current pattern, and quotes the field's own record for the current crop
worst hit by it ("under water during T. Aman in N of the last M years").
When a pattern is not less exposed to anything, the reason shown is food and
water instead.

The crop classifier is **not** used here (it failed the BBS area check);
the Rabi-fallow signal uses the phenology rule labels.

## Result on the six demo fields (default priorities, current Boro – Fallow – T. Aman)

| Field | Risk of current pattern | Top pick | Second pick |
|---|---|---|---|
| Daganbhuiyan | 0.14 | Mustard – Boro – T. Aman | Boro – Aus – T. Aman |
| Chhagalnaiya | 0.19 | Mustard – Boro – T. Aman | Lentil – Aus – T. Aman |
| Feni Sadar | 0.20 | Mustard – Boro – T. Aman | Boro – Aus – T. Aman |
| Parshuram | 0.21 | Mustard – Boro – T. Aman | Boro – Aus – T. Aman |
| Fulgazi | 0.31 | Mustard – Boro – T. Aman | Boro – Aus – T. Aman |
| **Sonagazi (coastal)** | **0.85** | Mustard – Boro – T. Aman | **Mungbean – Aus – T. Aman** |

Sonagazi: Rabi left fallow in 9 of 9 readable years, T. Aman under water
≥ 15 days in 5 of 10, Boro-window flooding in 3 of 9.

**Guard: FAILED, reported, not tuned.** The coastal field differs strongly
in risk and second choice, but all six share the same first choice. Every
recommended pattern has a Rabi crop, so Sonagazi's dry-season fallow
penalises them all alike, and Mustard – Boro – T. Aman wins everywhere on food
and water (it is not less exposed to any field hazard than the current
pattern, so its "Why?" line is food and water). The app says so on screen:
the fields in this sample are too similar for the ranking to separate their
top pick. `same_top_everywhere` in `GET /api/offline/demo-fields`; tests in
`data-pipeline/tests/test_classifier.py`.

## Observed-season feasibility (added 12 Nov 2026)

A score penalty was not enough: Sonagazi carried the highest risk yet still
got a dry-season pattern on top, because the food advantage outran the
penalty. A season that has **never been seen cropped** on a field is now
treated like a calendar conflict: patterns that need it leave the ranking
and are listed below it with the reason.

* **Dry season** = the Rabi window of the phenology rules (Oct–May). A
  pattern needs it if its Rabi slot is a crop, or if it has Boro in any
  slot (Boro grows December–April wherever a pattern files it).
* **Readable** = a Rabi season the rules labelled (Boro, Rabi_nonrice or
  Fallow); unlabelled seasons do not count either way.
* **Fires only** when a field has at least **5** readable Rabi seasons (half
  of 2016–2025) and none of them showed a crop. Chhagalnaiya (2 readable) and
  Parshuram (5 readable, 5 cropped) are not gated.
* **Wording**: "No dry-season crop observed on this field in 9 of 9 readable
  years." Salinity is not mentioned; it was not measured.
* Kharif-1 is not labelled by the rules and Sonagazi's monsoon seasons are
  all unlabelled, so no other season is gated.

| Field | Readable / cropped dry seasons | Top pick before | Top pick after |
|---|---|---|---|
| Chhagalnaiya | 2 / 2 | Mustard – Boro – T. Aman | Mustard – Boro – T. Aman |
| Daganbhuiyan | 8 / 8 | Mustard – Boro – T. Aman | Mustard – Boro – T. Aman |
| Feni Sadar | 8 / 8 | Mustard – Boro – T. Aman | Mustard – Boro – T. Aman |
| Fulgazi | 9 / 9 | Mustard – Boro – T. Aman | Mustard – Boro – T. Aman |
| Parshuram | 5 / 5 | Mustard – Boro – T. Aman | Mustard – Boro – T. Aman |
| **Sonagazi** | **9 / 0** | Mustard – Boro – T. Aman | **Fallow – Aus – T. Aman** (then Fallow – Fallow – T. Aman; 15 patterns not offered) |

**Guard now passes**: the six fields no longer share a top pick. No
threshold was changed to get there; the limitation text stays in the app and
shows only when the guard fails.
