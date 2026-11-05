# Climate shift in Feni — methodology and findings

What has changed in Feni since 1984, from NASA data, and how far that can be
trusted.

**Headline:** NASA POWER does not give a clean 40-year local record for Feni.
Its rainfall series has a break around 1997 (before it, Feni gets about half
the rain the BMD gauge records today) and still disagrees with the BMD Feni
gauge by −5 % to +68 % in 2016–2024; its maximum temperature is on average
2.2 °C cooler than the BMD Feni station. Three indicators pass the trend tests
(annual rain up, March–May hot days down, annual ET0 down), but none of them
also agrees with the station data. The app therefore shows them as "what the
NASA record says", with the caveat, and never as established facts.

## 1. Data

| Item | Detail |
|---|---|
| Source | NASA POWER daily point API, community AG, <https://power.larc.nasa.gov/api/temporal/daily/point>. Parameters T2M, T2M_MAX, T2M_MIN, PRECTOTCORR, RH2M, WS2M, ALLSKY_SFC_SW_DWN, GWETROOT, GWETTOP |
| What it is | **Reanalysis / satellite-model output, not a gauge or station record.** The file header names MERRA-2 for weather and soil wetness (0.5° × 0.625° cells) and CERES SYN1deg for solar radiation |
| Period | 1984-01-01 to 2026-11-02 (the latest day published when fetched on 2026-11-05). Indicators use complete years / seasons only |
| Points | Centroid of each Feni upazila (`data-pipeline/reference/feni_upazila_centroids.csv`), computed from geoBoundaries BGD ADM3 (source BBS / OCHA ROAP, CC BY 3.0 IGO), <https://www.geoboundaries.org/api/current/gbOpen/BGD/ADM3/>. The test plot lies in Feni Sadar |
| Grid limit | **All six upazilas fall in the same MERRA-2 cell**: their temperature, rainfall, humidity, wind and soil-wetness series are identical. Only solar radiation (CERES, two 1° cells) differs, so only ET0 varies slightly between upazilas. NASA POWER cannot show upazila-level differences in Feni |
| Cache | Raw API responses in `data-pipeline/data/raw/power/` (committed); `fetch_power_history.py --refresh` re-downloads |

## 2. Indicators (per year)

| Indicator | Definition | Reference |
|---|---|---|
| Rainy-season onset and withdrawal | Anomalous accumulation A(d) = Σ (R − R̄) over the calendar year, R̄ = mean daily rain of all complete years. Onset = day after the minimum of A; withdrawal = day of the maximum of A after onset. Years whose A never rises (minimum on the last day) have no rainy season and are left missing | Liebmann, B. & Marengo, J.A. (2001). Interannual variability of the rainy season and rainfall in the Brazilian Amazon Basin. *J. Climate* 14: 4308–4318. doi:10.1175/1520-0442(2001)014<4308:IVOTRS>2.0.CO;2 |
| Rainy-season length | Withdrawal − onset | as above |
| Hot days, March–May | Days with Tmax ≥ 35 °C, 1 March – 31 May | Threshold set in the project brief; heat at anthesis cuts rice spikelet fertility: Jagadish, S.V.K., Craufurd, P.Q. & Wheeler, T.R. (2007). *J. Exp. Bot.* 58: 1627–1635. doi:10.1093/jxb/erm003 |
| Hot days, Boro flowering | Days with Tmax ≥ 35 °C in the Boro flowering window from `crop_calendar.csv`: 12–18 March (DAE BAMIS Chattogram, standard week 11) | as above; BAMIS_CTG |
| Extreme rain days | Days with rain ≥ 50 mm | Threshold set in the project brief |
| Longest dry spell, Kharif-1 | Longest run of days with rain < 1 mm within 1 March – 30 June | Dry day as in the ETCCDI index CDD: Zhang, X. et al. (2011). Indices for monitoring changes in extremes based on daily temperature and precipitation data. *WIREs Climate Change* 2: 851–870. doi:10.1002/wcc.147 |
| Rabi rainfall | Rain from 1 November of the previous year to end of February | Season as in CLAUDE.md |
| Annual rainfall | Sum of daily PRECTOTCORR | |
| Annual ET0 | FAO-56 Penman-Monteith (same code as the crop water module, `water/crop_water.py`, checked against FAO-56 Example 18) | Allen et al. (1998), FAO-56 |

## 3. Trend tests

* **Mann-Kendall** test with **Sen's slope** (`pymannkendall.original_test`):
  Mann, H.B. (1945), *Econometrica* 13: 245, doi:10.2307/1907187;
  Sen, P.K. (1968), *JASA* 63: 1379–1389, doi:10.1080/01621459.1968.10480934;
  Hussain, M. & Mahmud, I. (2019), *JOSS* 4: 1556, doi:10.21105/joss.01556.
  Change per decade = Sen slope × 10.
* **Pettitt** change-point test: Pettitt, A.N. (1979). A non-parametric
  approach to the change-point problem. *Applied Statistics* 28(2): 126–135,
  doi:10.2307/2346729.
* Status:
  * `trend` — Mann-Kendall p < 0.05, and either no Pettitt break (p ≥ 0.05) or
    the years after the break (≥ 15) still trend the same way with p < 0.05;
  * `step_change_not_trend` — Mann-Kendall p < 0.05, but the series jumps once
    and the years after the jump show no significant trend;
  * `no_significant_trend` — Mann-Kendall p ≥ 0.05. **Nothing is called a
    trend unless p < 0.05.**
* The original Mann-Kendall test assumes no serial correlation; no
  correction was applied.

## 4. Results — Feni Sadar (identical for the other upazilas except ET0)

| Indicator | Years | Mean | Sen slope / decade | MK p | Pettitt break (p) | After break: slope / decade (p) | Status | Gauge agrees |
|---|---|---|---|---|---|---|---|---|
| Annual ET0 (mm) | 1984–2025 (42) | 1372.2 | −60.1 | <0.0001 | 1998 (<0.0001) | −24.2 (0.019) | trend | not checked |
| Annual rainfall (mm) | 1984–2025 (42) | 2314.0 | +586.1 | <0.0001 | 2007 (<0.0001) | +757.6 (0.036) | trend | **no** |
| Days with rain ≥ 50 mm | 1984–2025 (42) | 7.2 | +2.9 | <0.0001 | 2006 (0.0001) | +2.9 (0.242) | step change, not trend | **no** |
| Hot days (Tmax ≥ 35 °C), Boro flowering | 1984–2026 (43) | 1.6 | −0.7 | 0.0001 | 1998 (0.0003) | 0.0 (0.512) | step change, not trend | **no** |
| Hot days (Tmax ≥ 35 °C), March–May | 1984–2026 (43) | 27.3 | −10.0 | <0.0001 | 2000 (0.0003) | −7.6 (0.023) | trend | **no** |
| Longest dry spell, Kharif-1 (days) | 1984–2026 (43) | 20.4 | −1.7 | 0.081 | 2010 (0.532) | — | no significant trend | no |
| Rabi rainfall (mm) | 1985–2026 (42) | 82.8 | +12.3 | 0.079 | 2017 (0.108) | — | no significant trend | no |
| Rainy-season length (days) | 1997–2025 (29) | 149.1 | +25.0 | 0.0002 | 2016 (0.002) | — | step change, not trend | no |
| Rainy-season onset (day of year) | 1997–2025 (29) | 129.6 | −6.7 | 0.138 | 2017 (0.194) | — | no significant trend | no |
| Rainy-season withdrawal (day of year) | 1997–2025 (29) | 278.7 | +15.6 | 0.002 | 2015 (0.008) | — | step change, not trend | no |

Rainy-season dates start in 1997: in 1984–1996 POWER rain stays below the
long-term mean all year, so the Liebmann & Marengo method finds no rainy
season — itself a sign that the early POWER rainfall is too low for Feni.

## 5. Cross-checks — disagreements reported, not hidden

**Repo POWER file** (`Feni_Daily_Weather_NASA_POWER_ML.csv`, 2015-01-30 to
2024-12-31): identical to the new download for T2M_MAX, T2M_MIN, PRECTOTCORR,
RH2M and WS2M (same grid cell, no reprocessing). Solar radiation differs
(mean absolute difference 1.9 MJ m⁻² day⁻¹) because the old point
(23.016 N) and the Feni Sadar centroid (22.990 N) fall in different 1°
CERES cells.

**BMD Feni station** (gauge and thermometer), from BBS *Yearbook of
Agricultural Statistics 2025*, Tables 6.1.1–6.1.3 and 6.2.4–6.2.5
(`data-pipeline/reference/bmd_feni_station.csv`):

| Year | BMD gauge (mm) | NASA POWER (mm) | POWER / gauge |
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

* POWER monthly mean Tmax is cooler than the station in all 22 months
  available (2023–24): mean −2.2 °C, range −4.5 to −0.5 °C. Counts of days
  ≥ 35 °C from POWER are therefore far below what the station would count.
* In 1984–1996 POWER gives Feni 865–1,584 mm a year, about half of what the
  gauge records in 2016–2024. The rise in POWER rainfall is at least partly a
  change in the reanalysis record, not only a change in Feni's climate; the
  cause was not established from the sources consulted.
* POWER's solar data come from different products over time (the CERES
  record starts around 2000); the ET0 break in 1998 may partly reflect that.
  Not verified.
* No published 30-year BMD normals for Feni were found in an accessible
  source; only the 2016–2025 station values in the BBS yearbook were used.

## 6. From trends to advice

`GET /api/offline/climate-shift` turns each indicator with status `trend`
into advice with fixed rules (`CLIMATE_RULES` in `server.py`):

| Indicator rises / falls | Hazard | Crop exposed when… |
|---|---|---|
| Hot days March–May ↑, Boro-flowering hot days ↑ | heat at flowering | its flowering window (crop calendar) is in those months — Boro |
| Extreme rain days ↑, annual rain ↑ | wetter monsoon, waterlogging | it is in the field in June–September — T. Aman, Aus |
| Kharif-1 dry spell ↑ | dry spells | in the field March–June — Aus, Kharif-1 crops |
| Rabi rain ↓, annual ET0 ↑ | more irrigation needed | the pattern's irrigation need (FAO-56) is higher |
| Onset later / withdrawal earlier | season shifts | in the field May–July / September–October |

For an adverse trend the API lists the threatened crops of the current
pattern and up to two recommended patterns with less exposure, plain
improvements first; trade-offs keep their trade-off labels. A favourable
trend is reported as lowering a risk. With the current data:

* annual rain ↑ (POWER, disagrees with the gauge) → T. Aman exposed; the only
  pattern without a monsoon crop is Boro – Fallow – Fallow, a trade-off
  (fewer harvests, less food);
* March–May hot days ↓ and annual ET0 ↓ → lower heat and irrigation risk for
  Boro (if real).

## 7. Reproduce

```bash
python data-pipeline/climate/fetch_power_history.py    # uses the committed cache
python data-pipeline/climate/climate_shift.py           # derived CSVs
python backend/offline/build_climate_tables.py          # into field_shift.db
cd data-pipeline && python -m pytest tests/test_climate_shift.py
```
