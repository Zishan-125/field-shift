# Climate shift in Feni — methodology and findings

What has changed in Feni, from NASA data, and how far that can be trusted.

**Story in one line:** we tried a 40-year NASA POWER record, found a
discontinuity, validated it against the BMD Feni station, and switched data:
GPM IMERG for rainfall, and NASA POWER temperature only from 1998,
bias-corrected against the station and counted with percentile thresholds.

**Status (8 Nov 2026):** the temperature rework is done. The GPM IMERG fetch
(`data-pipeline/climate/fetch_gpm_imerg.py`) is written but has not run yet:
it needs an Earth Engine-enabled Google Cloud project. Until it runs, the
rain indicators still come from NASA POWER and the app shows them with the
gauge caveat.

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
| Rainfall indicators | **NASA GPM IMERG V07** (Earth Engine `NASA/GPM_L3/IMERG_V07`, half-hourly, 0.1°) | Daily totals (mm/hr × 0.5 h per image, UTC days), area-averaged over each upazila polygon at 1 km so each 0.1° cell counts by the area it covers. 2001 onward (IMERG starts June 2000). Cached in `data-pipeline/data/raw/gpm/`. **Not yet fetched** — POWER rain is used until then |
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

## 6. Results — Feni Sadar (rain still from POWER)

| Indicator | Source | Years | Sen slope / decade | MK p | Pettitt break (p) | Status |
|---|---|---|---|---|---|---|
| Unusually hot days, March–May | POWER (corrected) | 1998–2026 | −2.27 days | 0.089 | 2016 (0.107) | no significant trend |
| Unusually hot days, Boro flowering | POWER (corrected) | 1998–2026 | 0.00 days | 0.755 | 2017 (1.000) | no significant trend |
| Mean Tmax March–May | POWER (corrected) | 1998–2026 | −0.60 °C | 0.022 | 2015 (0.028) | step change, not trend |
| Days ≥ 35 °C March–May (corrected, comparison) | POWER | 1998–2026 | −9.76 days | 0.024 | 2017 (0.038) | step change, not trend |
| Days ≥ 35 °C March–May (uncorrected, comparison) | POWER | 1998–2026 | −7.36 days | 0.020 | 2015 (0.013) | step change, not trend |
| Annual ET0 | POWER | 1998–2025 | −24.2 mm | 0.019 | 2015 (0.006) | step change, not trend |
| Annual rain | POWER (to be replaced by GPM) | 1984–2025 | +586 mm | <0.001 | 2007 (<0.001) | "trend" — not trusted, see §1 |
| Kharif rain | POWER (to be replaced) | 1984–2025 | +584 mm | <0.001 | 2007 (<0.001) | "trend" — not trusted |
| Days with rain ≥ 50 mm | POWER (to be replaced) | 1984–2025 | +2.9 days | <0.001 | 2006 (<0.001) | step change, not trend |
| Longest dry spell, Kharif-1 | POWER (to be replaced) | 1984–2025 | −1.4 days | 0.174 | 2010 (0.795) | no significant trend |
| Rabi rain | POWER (to be replaced) | 1985–2025 | +15.3 mm | 0.058 | 2017 (0.082) | no significant trend |
| Rainy-season onset | POWER (to be replaced) | 1997–2025 | −6.7 days | 0.138 | 2017 (0.194) | no significant trend |
| Rainy-season withdrawal / length | POWER (to be replaced) | 1997–2025 | +15.6 / +25 days | 0.002 / <0.001 | 2015 / 2016 | step change, not trend |

**With the corrected temperature record, no heat indicator shows a
significant trend since 1998.** The one with p < 0.05 (mean March–May Tmax)
jumps once around 2015 rather than changing steadily.

**Annual rain vs BMD Feni gauge (mm):** GPM column to be added when fetched.

| Year | BMD gauge | NASA POWER | POWER / gauge |
|---|---|---|---|
| 2016 | 3091 | 4007 | 1.30 |
| 2017 | 4476 | 6676 | 1.49 |
| 2018 | 2662 | 4010 | 1.51 |
| 2019 | 2603 | 4380 | 1.68 |
| 2020 | 3193 | 3718 | 1.16 |
| 2021 | 2449 | 2934 | 1.20 |
| 2022 | 2480 | 2562 | 1.03 |
| 2023 | 2295 | 2924 | 1.27 |
| 2024 | 4221 | 4021 | 0.95 |

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
trade-offs keep their labels. With the current data the only advice comes
from the POWER rain "trend" (wetter monsoon → T. Aman), shown with the gauge
caveat; it will be recomputed from GPM.

## 8. Reproduce

```bash
python data-pipeline/climate/fetch_power_history.py              # cached
python data-pipeline/climate/fetch_gpm_imerg.py --project <id>   # needs Earth Engine
python data-pipeline/climate/climate_shift.py
python backend/offline/build_climate_tables.py
cd data-pipeline && python -m pytest tests/test_climate_shift.py
```
