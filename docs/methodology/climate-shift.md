# Climate shift in Feni — methodology and findings

What has changed in Feni, from NASA data, and how far that can be trusted.

**Story in one line:** we tried a 40-year NASA POWER record, found a
discontinuity, validated it against the BMD Feni station, and switched data:
GPM IMERG for rainfall, and NASA POWER temperature only from 1998,
bias-corrected against the station and counted with percentile thresholds.

**Status (8 Nov 2026):** done. Rainfall indicators now come from GPM IMERG
V07, 1998–2025, per upazila (fetched through Earth Engine project
`field-shift-bd`, cached in the repo). **The GPM rain series are
break-free:** the Pettitt test finds no change point (p ≥ 0.05) in any of the
8 rainfall indicators in any of the 6 upazilas (48 of 48). GPM tracks the BMD
Feni gauge far better than POWER (annual r = 0.95 vs 0.77) but reads about
13 % low. One indicator trends, days with ≥ 50 mm rain, and only downward;
it falls at the 2014 change of satellite inputs and is flagged rather than
turned into advice (§6).

## 1. Why the first attempt was not trustworthy

With NASA POWER alone (1984–2025):

* **One grid cell.** All six upazilas fall in the same MERRA-2 cell
  (0.5° × 0.625°); rainfall, T2M and T2M_MAX are identical across the six
  files.
* **Rain break around 1997.** POWER gives Feni about 1,280 mm/yr before 1997
  and about 2,780 mm/yr after (+117 %). 1984–1996 values (865–1,584 mm) are far
  too dry for Feni. The "+586 mm per decade" trend is that jump.
* **Gauge disagreement.** POWER annual rain is 0.95–1.68 × the BMD Feni gauge
  in 2016–2024 (table in §6).
* **Cold bias.** POWER monthly mean Tmax is 2.2 °C below the BMD Feni station
  on average (all 22 months of 2023–24 below; range −4.5 to −0.5 °C), which
  wrecks any fixed-threshold count such as "days ≥ 35 °C".

We did not publish those trends.

## 2. Data now used

| Use | Source | Detail |
|---|---|---|
| Rainfall indicators | **NASA GPM IMERG V07** (Earth Engine `NASA/GPM_L3/IMERG_V07`, half-hourly, 0.1°) | Daily totals (mm/hr × 0.5 h per image, UTC days), area-averaged over each upazila polygon at 1 km so each 0.1° cell counts by the area it covers. 1998 onward (V07 in Earth Engine starts 1998-01-01). Half-hours per day recorded (`imerg_v07_halfhours_per_day.csv`): 3 incomplete days in 10,538, all in 2026; days with 36–47 half-hours are scaled to 24 h as in the NASA daily product (GPM_3IMERGDF), fewer are left missing. Cached in `data-pipeline/data/raw/gpm/` |
| Temperature, ET0 | NASA POWER daily, community AG (MERRA-2; solar from CERES) | 1998 onward only. One grid cell for all of Feni. Cached in `data-pipeline/data/raw/power/` |
| Station check | BMD Feni station, BBS *Yearbook of Agricultural Statistics 2025*, Tables 6.1.1–6.1.3, 6.2.4–6.2.5 | Annual rain 2016–2024, monthly rain and monthly mean Tmax 2023–24 (`data-pipeline/reference/bmd_feni_station.csv`) |
| Upazila polygons | geoBoundaries BGD ADM3 (BBS / OCHA ROAP, CC BY 3.0 IGO), simplified 0.0005° | `data-pipeline/reference/feni_upazilas.geojson` |

**What can be shown per upazila:** GPM rainfall at about 10 km does differ
between upazilas. NASA POWER temperature cannot: the heat charts are the same
for all six, and the app says so on screen.

**Both are model or satellite products, not station records.** NASA POWER is
reanalysis; GPM IMERG blends satellite estimates with gauge analyses.

## 3. Temperature: bias correction and percentile heat

**Period.** Temperature and ET0 trends use 1998 onward, after the Pettitt
breaks found in 1998–2000 in the POWER temperature and solar series.

**Bias correction (delta / mean-bias method by calendar month).** For each
calendar month, offset = mean (BMD Feni monthly mean Tmax − POWER monthly mean
Tmax) over the overlapping months (2023 Jan–Oct, 2024 Jan–Dec; November and
December have one month each). The offset is added to every daily POWER Tmax
in that month. Offsets range from +0.98 °C (August) to +4.54 °C (November).

**Out-of-sample check (leave one year out).** Offsets from one year correct
the other year:

| Year corrected | Gap before (POWER − station) | Gap after | Mean absolute error before → after |
|---|---|---|---|
| 2023 (10 months) | −1.96 °C | −0.06 °C | 1.96 → 0.78 °C |
| 2024 (12 months) | −2.31 °C | −0.35 °C | 2.31 → 1.05 °C |

Limits: only 22 station months, monthly means (not daily values), one station.
The correction removes the average cold bias; it cannot fix day-to-day
errors.

**Percentile heat (TX90p-style).** A day is "unusually hot" when its
bias-corrected Tmax exceeds the 90th percentile of Tmax for that calendar day
in 1998–2010, pooling a ±2-day window, the same construction as the ETCCDI
index TX90p (Zhang et al. 2011). A constant offset moves the threshold and the
values equally, so the residual bias barely affects these counts.

**Before vs after correction (Feni, 1998–2026 means):**

| Indicator | Uncorrected POWER | Bias-corrected | Percentile (TX90p) |
|---|---|---|---|
| Days in March–May | 19.3 days ≥ 35 °C | 37.0 days ≥ 35 °C | 6.9 days above P90 |
| Days at Boro flowering (12–18 March) | 0.55 days ≥ 35 °C | 2.59 days ≥ 35 °C | 0.55 days above P90 |

The fixed threshold more than halves the count of hot days when the cold bias
is not corrected; the percentile count does not depend on it.

## 4. Indicators (per year)

| Indicator | Definition | Reference |
|---|---|---|
| Rainy-season onset and withdrawal | Anomalous accumulation A(d) = Σ (R − R̄) over the calendar year, R̄ = mean daily rain of all complete years. Onset = day after the minimum of A; withdrawal = day of the maximum after onset. Years with no rise are left missing | Liebmann & Marengo (2001), *J. Climate* 14: 4308–4318, doi:10.1175/1520-0442(2001)014<4308:IVOTRS>2.0.CO;2 |
| Rainy-season length | Withdrawal − onset | |
| Extreme rain days | Days with rain ≥ 50 mm | Project brief |
| Longest dry spell, Kharif-1 | Longest run of days with rain < 1 mm in March–June | Dry day as in ETCCDI CDD: Zhang et al. (2011), *WIREs Climate Change* 2: 851–870, doi:10.1002/wcc.147 |
| Rabi / Kharif / annual rain | Sums over Nov (previous year)–Feb, Mar–Oct, and the calendar year | |
| Unusually hot days (March–May; Boro flowering 12–18 March) | Bias-corrected Tmax above the 1998–2010 calendar-day 90th percentile | As TX90p (Zhang et al. 2011); heat at anthesis cuts rice fertility: Jagadish et al. (2007), *J. Exp. Bot.* 58: 1627–1635, doi:10.1093/jxb/erm003 |
| Mean Tmax March–May | Bias-corrected | |
| Days ≥ 35 °C (raw and corrected) | Kept for comparison only; not used for advice | |
| Annual ET0 | FAO-56 Penman-Monteith from POWER (`water/crop_water.py`, checked against FAO-56 Example 18) | Allen et al. (1998) |

## 5. Trend tests

* **Mann-Kendall** with **Sen's slope** (`pymannkendall.original_test`):
  Mann (1945) doi:10.2307/1907187; Sen (1968) doi:10.1080/01621459.1968.10480934;
  Hussain & Mahmud (2019) doi:10.21105/joss.01556. Change per decade = slope × 10.
* **Pettitt** change point: Pettitt (1979) doi:10.2307/2346729. Reported for
  every series (`pettitt_break_free` in the API) — no series is assumed to be
  break-free, including GPM.
* Status: `trend` (MK p < 0.05, and no break or the post-break years trend the
  same way), `step_change_not_trend`, `no_significant_trend`. **Nothing is
  called a trend unless p < 0.05.** No serial-correlation correction.

## 6. Results — Feni Sadar

| Indicator | Source | Years | Sen slope / decade | MK p | Pettitt break (p) | Status |
|---|---|---|---|---|---|---|
| Unusually hot days, March–May | POWER (corrected) | 1998–2026 | −2.27 days | 0.089 | 2016 (0.107) | no significant trend |
| Unusually hot days, Boro flowering | POWER (corrected) | 1998–2026 | 0.00 days | 0.755 | 2017 (1.000) | no significant trend |
| Mean Tmax March–May | POWER (corrected) | 1998–2026 | −0.60 °C | 0.022 | 2015 (0.028) | step change, not trend |
| Days ≥ 35 °C March–May (corrected, comparison) | POWER | 1998–2026 | −9.76 days | 0.024 | 2017 (0.038) | step change, not trend |
| Days ≥ 35 °C March–May (uncorrected, comparison) | POWER | 1998–2026 | −7.36 days | 0.020 | 2015 (0.013) | step change, not trend |
| Annual ET0 | POWER | 1998–2025 | −24.2 mm | 0.019 | 2015 (0.006) | step change, not trend |
| Annual rain | GPM | 1998–2025 | −143 mm | 0.138 | 2008 (0.436) | no significant trend |
| Kharif rain | GPM | 1998–2025 | −152 mm | 0.066 | 2005 (0.490) | no significant trend |
| Days with rain ≥ 50 mm | GPM | 1998–2025 | −2.5 days | 0.007 | 2018 (0.115) | trend (down), **sensor-era caveat**, not used for advice |
| Longest dry spell, Kharif-1 | GPM | 1998–2025 | +3.7 days | 0.065 | 2012 (0.339) | no significant trend (sensor-era caveat) |
| Rabi rain | GPM | 1999–2025 | −4.1 mm | 0.868 | 2017 (0.744) | no significant trend |
| Rainy-season onset | GPM | 1998–2025 | +5.3 days | 0.406 | 2003 (0.339) | no significant trend |
| Rainy-season withdrawal | GPM | 1998–2025 | −0.8 days | 0.874 | 2022 (1.000) | no significant trend |
| Rainy-season length | GPM | 1998–2025 | −6.8 days | 0.286 | 2003 (0.634) | no significant trend |
| Annual rain (comparison only) | POWER | 1984–2025 | +586 mm | <0.001 | 2007 (<0.001) | the 1997 jump, see §1; not used |

**With the corrected temperature record, no heat indicator shows a
significant trend since 1998.** The one with p < 0.05 (mean March–May Tmax)
jumps once around 2015 rather than changing steadily.

**Is GPM break-free? Yes, by the test.** Pettitt p ≥ 0.05 for every rain
indicator in every upazila (48/48). Computed, not assumed; stored as
`pettitt_break_free`.

**But daily intensities shift across 2014.** IMERG V07 uses TRMM-era
satellite inputs before 2014 and GPM-era inputs after (GPM Core Observatory
launched 27 Feb 2014). Annual totals do not move (Feni Sadar mean 2,654 mm in
1998–2013 vs 2,616 mm in 2014–2025), yet days ≥ 50 mm fall from 12.7 to 9.7 a
year and the longest Kharif-1 dry spell rises from 17.4 to 24.2 days. Unchanged
totals with fewer heavy days and longer dry runs is what a change in how rain
intensity is estimated looks like, but without daily gauge data we cannot tell
it from a real change. These two indicators carry `caveat = imerg_sensor_eras`
(with the era means), the app shows a warning under them, and **the advice
skips them**. The heavy-rain decline is "significant" in 4 of 6 upazilas
(Feni Sadar, Fulgazi, Parshuram, Sonagazi).

**Annual rain vs BMD Feni gauge (mm), 2016–2024.** The BBS Yearbook 2025 has
no 2025 annual value (Table 6.1.4 gives January–November 2025, December
"not available"), so annual totals cover 2016–2024 and 2025 is checked month
by month (table below).

| Year | BMD gauge | GPM IMERG (Feni Sadar) | GPM / gauge | NASA POWER | POWER / gauge |
|---|---|---|---|---|---|
| 2016 | 3091 | 2602 | 0.84 | 4007 | 1.30 |
| 2017 | 4476 | 3701 | 0.83 | 6676 | 1.49 |
| 2018 | 2662 | 2427 | 0.91 | 4010 | 1.51 |
| 2019 | 2603 | 2371 | 0.91 | 4380 | 1.68 |
| 2020 | 3193 | 2704 | 0.85 | 3718 | 1.16 |
| 2021 | 2449 | 2512 | 1.03 | 2934 | 1.20 |
| 2022 | 2480 | 2025 | 0.82 | 2562 | 1.03 |
| 2023 | 2295 | 2118 | 0.92 | 2924 | 1.27 |
| 2024 | 4221 | 3171 | 0.75 | 4021 | 0.95 |
| **Mean** | | | **0.87** | | **1.29** |

Correlation of annual totals with the gauge: GPM 0.95, POWER 0.77.

**Monthly, 2023 – November 2025 (33 gauge months):**

| Year | Months | GPM / gauge (sum) | GPM r | POWER / gauge (sum) | POWER r |
|---|---|---|---|---|---|
| 2023 | 10 | 0.93 | 0.98 | 1.28 | 0.96 |
| 2024 | 12 | 0.75 | 0.98 | 0.95 | 0.97 |
| 2025 (Jan–Nov) | 11 | 0.78 | 0.94 | 1.09 | 0.96 |

GPM misses most in the gauge's wettest months (July 2025: 630 vs 1,144 mm). GPM is consistently low (the area mean of a 0.1° cell against a
point gauge), so GPM totals understate Feni rain by about 13 %; year-to-year
changes follow the gauge. The ±15 % "agrees" test still fails in 2016, 2017,
2022 and 2024, so the app keeps the gauge caveat. The "Annual rainfall" chart
draws GPM, POWER (dashed) and the gauge on one axis.

**Repo POWER file check:** identical to the new download for T2M_MAX, T2M_MIN,
PRECTOTCORR, RH2M and WS2M (2015-01-30 to 2024-12-31); solar differs because
the old point lies in another 1° CERES cell.

## 7. From trends to advice

`GET /api/offline/climate-shift` turns each **primary** indicator with status
`trend` into advice with fixed rules (`CLIMATE_RULES` in `server.py`), once
per hazard:

| Indicator rises / falls | Hazard | Crop exposed when… |
|---|---|---|
| Unusually hot days ↑ (March–May, Boro flowering), mean March–May Tmax ↑ | heat at flowering | its flowering window is in those months — Boro |
| Extreme rain days ↑, annual / Kharif rain ↑ | wetter monsoon | in the field June–September — T. Aman, Aus |
| Kharif-1 dry spell ↑ | dry spells | in the field March–June |
| Rabi rain ↓, annual ET0 ↑ | more irrigation | the pattern's FAO-56 irrigation need is higher |
| Onset later / withdrawal earlier | season shifts | in the field May–July / September–October |

The API lists the threatened crops of the current pattern and up to two
recommended patterns with less exposure, plain improvements first;
trade-offs keep their labels. Indicators with the `imerg_sensor_eras`
caveat are skipped. **With GPM rain and corrected temperature there is no
climate advice at present:** no indicator has a trustworthy adverse trend.
The earlier "wetter monsoon" advice came from the POWER rain break and is
gone.

## 8. What the climate does to your crops (frequencies, not slopes)

No trend passes the tests, and that is not evidence of no change: 28 years
of GPM (1998–2025) is a short record, and Mann-Kendall has little power over
it. The app therefore leads with **how often** each crop was hit in the
climate Feni already has, and keeps the trend tests behind a toggle. Code:
`data-pipeline/climate/climate_extremes.py` (variability, return periods,
recovery) and `crop_exposure()` in `backend/offline/server.py` (crop counts,
on each pattern's own calendar).

**Variability (Feni Sadar, June–September GPM rain, 1998–2025).** Mean
1,865 mm, standard deviation 300 mm, coefficient of variation 16 %. Driest
1,386 mm (2022), wettest 2,508 mm (2017); 2024: 2,440 mm.

**Return periods.** Annual maxima of 7-day and 15-day rain totals, Weibull
plotting position T = (n + 1) / rank, and a Gumbel (EV1) fit by maximum
likelihood (`scipy.stats.gumbel_r`).

| Feni Sadar | 2-year | 5-year | 10-year | 25-year | 2024 | 2024 rank | 2024 return period (empirical / Gumbel) |
|---|---|---|---|---|---|---|---|
| Wettest 7 days | 344 mm | 408 mm | 450 mm | 504 mm | **550 mm** | 1 of 28 | 29 / 56 years |
| Wettest 15 days | 480 mm | 576 mm | 640 mm | 720 mm | 684 mm | 2 of 28 | 14.5 / 16.5 years |

28 maxima cannot pin down a 50-year return level; the Gumbel figure for 2024
is an order of magnitude, shown as "about once in N years".

**Hazards counted on each crop's own field window** (the start day and
duration in the pattern's schedule; flowering week = BAMIS flowering offset
from field start, 7 days):

| Hazard | Rule | Applies to | Why |
|---|---|---|---|
| Flood-size downpour | 7-day rain ≥ the 5-year return level of the annual-maximum 7-day total at that upazila (Feni Sadar 408 mm) | all crops | Rare enough to matter, frequent enough to count in 28 years |
| Heat at flowering | ≥ 1 day with bias-corrected Tmax ≥ 35 °C in the flowering week | rice | Spikelet sterility at anthesis above about 35 °C (Jagadish et al. 2007) |
| Very heavy rain day | ≥ 1 day with ≥ 50 mm | non-rice crops | Lodging and rot of mustard, pulses, potato near harvest |
| Long dry spell | ≥ 20 consecutive days < 1 mm | Kharif-1 crops | Rainfed Aus and summer pulses |

The thresholds are our choices (listed in `EXPOSURE_HAZARDS`, server.py).
A year is "hit" if the crop's window contains the event; a window crossing
New Year counts for the year it ends, so Rabi crops have 27 complete years.

**Current pattern Boro – Fallow – T. Aman, Feni Sadar:**

| Crop | Hazard | Years hit | Before 2014 / from 2014 |
|---|---|---|---|
| T. Aman | flood-size downpour | **4 of 28** (2004, 2017, 2019, 2024) | 1 / 3 |
| T. Aman | heat at flowering | 11 of 28 | 2 / 9 |
| Boro | heat at flowering | 16 of 27 | 11 / 5 |
| Boro | flood-size downpour | 0 of 27 | — |

Caveats shown in the app next to each count: rain counts can shift at the
June 2014 seam between TRMM-era and GPM-era IMERG inputs (Huffman, G.J.
(2019), *Caveats for IMERG in the TRMM Era*, NASA GPM,
<https://gpm.nasa.gov/sites/default/files/document_files/IMERGV06_TRMMera-caveats-190503.pdf>;
written for V06, and our V07 series shows the same shift in daily
intensities, §6). Heat counts rest on a bias correction built from 22
station months (two Septembers, two Marches).

**From frequency to advice.** For each hazard that hit a current crop, the
API lists up to two recommended patterns (plain improvements first) whose
crops were hit in fewer years. A pattern's count is the number of years in
which at least one of its crops was hit. Trade-offs keep their labels: the
only pattern with less flood exposure than Boro – Fallow – T. Aman is
Boro – Fallow – Fallow, which drops Aman.

**Do the flags line up with yield? (`climate/hazard_yield_check.py`)**
BBS Feni district Total Boro and Total Aman, 2011-12 to 2024-25, from the
Yearbooks 2013–2025 (`reference/bbs_feni_rice_series.csv`; the 2014-15 to
2016-17 Boro totals are HYV + Hybrid because those editions have no Total
Boro table and Local Boro is 0 in Feni, a rule that reproduces the
published totals for 2013-14 and 2017-18 exactly). A year is flagged when the
hazard hit the crop's window in at least half of the six upazilas. Flagged
minus unflagged, exact permutation test; "local" = each year minus the median
of the other years within ±3 years (Aman yield steps up about 0.4 t/ha in
2020-21):

| Hazard | Flagged years | Yield, local | Production, local | Verdict |
|---|---|---|---|---|
| Boro, heat at flowering | 7 of 14 (2012–16, 2023, 2025) | −0.02 t/ha (−0.5 %), p = 0.79 | +1 %, p = 0.78 | **exposure only** |
| T. Aman, flood-size downpour | 3 of 14 (2017, 2019, 2024) | −0.09 t/ha (−3 %), p = 0.24 | **−29 %, p = 0.008** | **linked to loss** |
| T. Aman, heat at flowering | 8 of 14 | −2 %, p = 0.42 | −11 %, p = 0.36 | exposure only |

* Boro heat at flowering fires in 59 % of years and those years did **not**
  have lower Boro yields. It most likely describes normal March weather. The
  app now calls it **exposure, not proven damage**, and says so in Bangla and
  English. The threshold was **not** retuned to find a yield effect.
* T. Aman flooding goes with lower **production**, not much lower yield:
  destroyed fields leave the harvested area. The result is dominated by 2024;
  without 2024, the two flagged years (2017, 2019) still have 8–10 % less
  production and 7–10 % lower yield than the others, p ≈ 0.04–0.05 with only
  two flagged years: suggestive, same direction.
* Sample: 14 years, one district, district-level statistics against
  upazila-level flags. The raw (not local) Boro production difference of
  +9 % (p = 0.04) is the area trend (more Boro area in 2012–16), not heat.

**Two hot-day numbers, one record.** The CMIP6 table shows 45 hot days a
year in March–May; §3 shows 37.0. Both are the same bias-corrected NASA POWER
series counted on the same days (Tmax ≥ 35 °C, March–May), over different
years: 45.1 is the 1998–2014 mean (the years that overlap the models'
1995–2014 baseline, needed for the delta method), 37.0 is 1998–2026, and
2015–2025 averages 26.5. The corrected record steps down around 2015 (the
Pettitt break in §6; some years are near zero, 2017: 0, 2018: 1, 2020: 3, with
no station data to check them). The app names the period under the number and
tells the reader to read the change, not the count.

**CMIP6 projections (`climate/fetch_cmip6.py`, `climate/climate_projections.py`).**
NASA NEX-GDDP-CMIP6 (Earth Engine `NASA/GDDP-CMIP6`), area mean over Feni
district, 10 GCMs (ACCESS-CM2, CNRM-CM6-1, EC-Earth3, GFDL-ESM4,
IPSL-CM6A-LR, MIROC6, MPI-ESM1-2-HR, MRI-ESM2-0, NorESM2-MM, UKESM1-0-LL),
historical 1995–2014 vs 2041–2060. Delta change factors applied to
observations, never raw model values: additive monthly Tmax change on the
corrected 1998–2014 Tmax; multiplicative change of the median annual
wettest-5-day total on the GPM 1998–2014 median (medians because one extreme
model year, IPSL historical 1998, made a mean-based factor 0.49).

| Indicator | 1998–2014 observed | SSP2-4.5 median (10 models' range) | SSP5-8.5 median (range) |
|---|---|---|---|
| Days ≥ 35 °C, March–May | 45 | 60 (47–70) | 64 (48–70) |
| Mean March–May Tmax change | — | +1.2 °C (0.2–1.9) | +1.4 °C (0.3–2.1) |
| Wettest 5 days of the year | 297 mm | 301 mm, +1 % (250–373) | 308 mm, +4 % (273–387) |

The models agree on more heat and disagree on the sign of the change in
extreme 5-day rain. These are projections under each emissions path, not
forecasts; the delta method keeps today's day-to-day variability.

**The 2024 flood at the Fulgazi demo field** (its own series,
`data-pipeline/data/processed/feni_fulgazi_01.csv`): NDVI 0.65 on 29 July →
Sentinel-1 VH below −22 dB (open water) on most passes from 4 August to
14 September (41 days; lowest −30.1 dB) → first clear HLS NDVI ≥ 0.5 on
22 October, 79 days after the water came. One 90 m field, not a survey.

## 9. Reproduce

```bash
python data-pipeline/climate/fetch_power_history.py              # cached
python data-pipeline/climate/fetch_gpm_imerg.py --project field-shift-bd   # cached; needs Earth Engine
python data-pipeline/climate/climate_shift.py
python data-pipeline/climate/climate_extremes.py
python data-pipeline/climate/fetch_cmip6.py --project field-shift-bd    # cached
python data-pipeline/climate/climate_projections.py
python backend/offline/build_climate_tables.py
cd data-pipeline && python -m pytest tests/test_climate_shift.py
```
