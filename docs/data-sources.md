# Data sources

Every number used by Field Shift should trace back to a source on this page.
Source IDs (e.g. `BAMIS_CTG`) are the values used in the `source_id` columns of
`data-pipeline/reference/*.csv` and in the API responses.

Anything assumed rather than sourced is listed in [data-gaps.md](data-gaps.md).

## Crop calendars (sowing, transplanting and harvest windows)

Used in `data-pipeline/reference/crop_calendar.csv`.

| ID | Source | What we took |
|---|---|---|
| `BAMIS_CTG` | Department of Agricultural Extension (DAE), Bangladesh Agro-Meteorological Information Service (BAMIS), *crop-weather calendar, Chattogram region* (districts Chattogram, Cox's Bazar, Lakshmipur, Noakhali **and Feni**). Index: <https://www.bamis.gov.bd/en/calendar/> | Growth stages by standard meteorological week and total life duration for Aman, Aus and Boro rice, mustard, lentil, Rabi maize, potato, Rabi groundnut and Rabi chili. PDFs: Aman [4335](https://www.bamis.gov.bd/res/public/calendars/2019/08/04/4335.pdf), Aus [4320](https://www.bamis.gov.bd/res/public/calendars/2019/08/04/4320.pdf), Boro [4348](https://www.bamis.gov.bd/res/public/calendars/2019/08/04/4348.pdf), mustard [11000](https://www.bamis.gov.bd/res/public/calendars/2019/12/30/11000.pdf), lentil [8369](https://www.bamis.gov.bd/res/public/calendars/2019/11/07/8369.pdf), maize Rabi [4296](https://www.bamis.gov.bd/res/public/calendars/2019/08/04/4296.pdf), potato [8849](https://www.bamis.gov.bd/res/public/calendars/2019/11/14/8849.pdf), groundnut Rabi [9905](https://www.bamis.gov.bd/res/public/calendars/2019/12/07/9905.pdf), chili Rabi [26493](https://www.bamis.gov.bd/res/public/calendars/2023/03/16/26493.pdf) |
| `BAMIS_CUM` | DAE BAMIS crop-weather calendar, Cumilla region (neighbouring region; no Chattogram wheat calendar is published) | Wheat: PDF [4283](https://www.bamis.gov.bd/res/public/calendars/2019/08/04/4283.pdf) |
| `BAMIS_DHK` | DAE BAMIS crop-weather calendar, Dhaka region (no Chattogram Kharif-1 mungbean calendar is published) | Mungbean Kharif-1: PDF [10928](https://www.bamis.gov.bd/res/public/calendars/2019/12/30/10928.pdf) |
| `BRRI_FOSOL_PONJIKA` | Bangladesh Rice Research Institute, *ধানের বর্ষপঞ্জিকা* (rice crop calendars for Aus, Aman and Boro; charts credited "Source: BARC & AFACI"). <https://brri.gov.bd/pages/static-pages/6922dea6933eb65569e1c55f> | Seedbed sowing dates and seedling ages, quoted in the `notes` column only |
| `KABIR_ISLAM_2012` | Kabir, M.J. & Islam, M.M. (2012). Study on agronomically and economically dominant cropping patterns in some selected areas of Barisal district. *Bangladesh J. Agril. Res.* 37(1): 55–65. <https://banglajol.info/index.php/BJAR/article/view/11177> | p. 58: BRRI-recommended transplanting windows (T. Aman, Aus) and BARI-recommended sowing windows (mustard, lentil, wheat). Table 2: farmers' sowing and harvest dates for mungbean and grass pea **in Barishal**, not Feni |

How BAMIS weeks were converted: standard meteorological week *n* starts on day
of year 7(*n*−1)+1 (week 1 = 1–7 January, week 52 ends 31 December). Values
were read from the growth-stage row of each chart; the `source_detail` column
records the original weeks so they can be re-checked.

## Cropping patterns

Used in `data-pipeline/reference/cropping_patterns.csv` and
`data-pipeline/reference/feni_upazila_patterns.csv`.

| ID | Source | What we took |
|---|---|---|
| `SHAHIDULLAH_2017` | Shahidullah, S.M., Nasim, M., Quais, M.K. & Saha, A. (2017). Diversity of cropping systems in Chittagong region. *Bangladesh Rice Journal* 21(2): 109–122. <https://banglajol.info/index.php/BRJ/article/view/38199>. Survey of all 42 upazilas of the Chittagong agricultural region (Chattogram, Cox's Bazar, Noakhali, **Feni**, Lakshmipur), reference year 2014-15 | Pattern area (ha), % of net cropped area and number of upazilas (Tables 2–7); per-upazila area for Feni's six upazilas (Tables 8–12) |
| `NASIM_2017` | Nasim, M., Shahidullah, S.M., Saha, A., Muttaleb, M.A., Aditya, T.L., Ali, M.A. & Kabir, M.S. (2017). Distribution of crops and cropping patterns in Bangladesh. *Bangladesh Rice Journal* 21(2): 1–55. doi:[10.3329/brj.v21i2.38195](https://doi.org/10.3329/brj.v21i2.38195) | National area, % of NCA and upazila counts (Table 2) |
| `SHAHIDULLAH_2006` | Shahidullah, S.M., Talukder, M.S.A., Kabir, M.S., Khan, A.H. & Nur-E-Elahi (2006). Cropping patterns in the south east coastal region of Bangladesh. *J. Agric. Rural Dev.* 4(1&2): 53–60. <https://banglajol.info/index.php/JARD/article/view/768> | Background only (greater Noakhali incl. Feni, 2000–01): "the turn around time after T. Aman harvest in the coastal saline environment is very short to catch Rabi crop". No number is used from it |

## Yields (production dimension)

Used in `data-pipeline/reference/crop_yields.csv`.

| ID | Source | What we took |
|---|---|---|
| `BBS_YB_2025` | Bangladesh Bureau of Statistics (2026). *Yearbook of Agricultural Statistics-2025*, 37th series, June 2026. <https://bbs.gov.bd/site/page/3e838eb6-30a2-4709-be85-40484b0c16c6/-> ([PDF](https://objectstorage.ap-dcc-gazipur-1.oraclecloud15.com/n/axvjbnqprylg/b/V2Ministry/o/office-bbs/2026/5/cfb80ec8-1c7f-4632-8a59-7649b6ac7ffe.pdf)) | Feni district rows, 2023-24 and 2024-25 (2024-25 used). Rice, wheat and potato yields as published (t/ha); other crops derived as production (M.Ton) / (area in acres × 0.404686). Table numbers and PDF pages are in the CSV. Values were read from rendered page images because the PDF text layer scrambles some rows. Rice is reported as clean rice (Yearbook §1.2.8.3) |

## Food energy

Used in `data-pipeline/reference/food_energy.csv`.

| ID | Source | What we took |
|---|---|---|
| `FCT_BD_2013` | Shaheen, N., Rahim, A.T.M.A., Mohiduzzaman, M., Banu, C.P., Bari, M.L., Tukun, A.B., Mannan, M.A., Bhattacharjee, L. & Stadlmayr, B. (2013). *Food Composition Table for Bangladesh*. Institute of Nutrition and Food Science, University of Dhaka (with FAO). [PDF on fao.org](https://www.fao.org/fileadmin/templates/food_composition/documents/FCT_10_2_14_final_version.pdf) | Energy (kJ, kcal per 100 g edible portion) and edible-portion coefficient for raw rice (BR-28 parboiled milled), wheat, maize, potato, lentil, green gram, grass pea, mustard seed, sesame, groundnut, green chili. Food codes and PDF pages are in the CSV |
| `USDA_FDC_SR` | U.S. Department of Agriculture, Agricultural Research Service. *FoodData Central*, SR Legacy. Cowpeas, common, mature seeds, raw — fdcId 173758 (NDB 16062). <https://fdc.nal.usda.gov/> | Energy for felon (cowpea), which is not in FCT_BD_2013 |
| `FAOSTAT_FBS_BD` | FAO. *FAOSTAT Food Balance Sheets* (2010–), Bangladesh, bulk file `FoodBalanceSheets_E_Asia.zip` from <https://bulks-faostat.fao.org/production/FoodBalanceSheets_E_Asia.zip> (downloaded 2026-11-05; the FAOSTAT API was down) | End use: Food, Feed, Processing and Domestic supply for 2021–2023 (mean). Human-food share = Food / Domestic supply; for mustard and sesame, the energy that reaches people as oil (seed crushed × oil extraction × oil energy / seed energy). Mustard and sesame oil energy: FCT_BD_2013 13_0008 and 13_0011, PDF p.147 |

Two output figures are kept apart, never blended:

* **gross output** = yield × edible-portion coefficient × energy (all uses);
* **human food** = gross output × human-food share. Rankings use this one.

Both are shown to farmers as "tonnes of rice with the same food energy"
(energy ÷ 14.54 MJ/kg, FCT_BD_2013 rice 01_0012).

## Crop water requirement

| ID | Source | What we took |
|---|---|---|
| `FAO56` | Allen, R.G., Pereira, L.S., Raes, D. & Smith, M. (1998). *Crop evapotranspiration — Guidelines for computing crop water requirements*. FAO Irrigation and Drainage Paper 56. Chapter 4: <https://www.fao.org/4/x0490e/x0490e08.htm>; Chapter 6: <https://www.fao.org/4/x0490e/x0490e0b.htm> | ET0 by FAO Penman-Monteith (Eq. 6, with Eqs. 7, 8, 9, 11–13, 19, 21–25, 37–40, 42); checked against Example 18 (3.88 mm/day). Single crop coefficients Kc ini / mid / end from **Table 12** and stage lengths from **Table 11** (row per crop in `fao56_crop_coefficients.csv`); Kc curve as in Fig. 25. Printed page numbers could not be checked from an accessible copy — see data-gaps.md |
| `FAO_IWN` | Brouwer, C. & Heibloem, M. (1986). *Irrigation Water Management: Irrigation Water Needs*. FAO Training Manual No. 3. Chapter 4: <https://www.fao.org/4/s2022e/s2022e08.htm> | Effective rainfall (Section 4.2): Pe = 0.8 P − 25 if P > 75 mm/month, Pe = 0.6 P − 10 if P < 75 mm/month, never negative. Paddy rice (Section 4.4): IN = ET crop + SAT + PERC + WL − Pe with SAT = 200 mm, WL = 100 mm, PERC = 6 mm/day ("on average"; 4 for heavy clay, 8 for sandy soils) |
| `NASA_POWER_DAILY` | NASA POWER daily point API, community AG, lat 23.0159, lon 91.3971, 2015-01-30 to 2024-12-31 (`Feni_Daily_Weather_NASA_POWER_ML.csv`, checked against the live API). Elevation 10.66 m from the API response | T2M_MAX, T2M_MIN, RH2M, WS2M, ALLSKY_SFC_SW_DWN for Penman-Monteith ET0. The file's solar column is labelled kWh m⁻² day⁻¹ but holds MJ m⁻² day⁻¹ (POWER AG units) |
| GPM IMERG (see below) | `ag_rainfall_mm` in `monthly_environmental_features`, 2019-01 to 2024-09 | Monthly rainfall normals for effective rainfall |

## Soil health reasoning

| ID | Source | What we took |
|---|---|---|
| `HERRIDGE_2008` | Herridge, D.F., Peoples, M.B. & Boddey, R.M. (2008). Global inputs of biological nitrogen fixation in agricultural systems. *Plant and Soil* 311: 1–18. doi:[10.1007/s11104-008-9668-3](https://doi.org/10.1007/s11104-008-9668-3) | The principle that grain legumes fix atmospheric nitrogen. Used only to justify that a legume season adds no nitrogen load to the soil score (like a fallow) plus a legume credit; no number is taken from it |

## Earth observation and climate (existing pipeline)

Ingested by `data-pipeline/` and stored in `monthly_environmental_features` and
`field_soil_profiles`.

| Dataset | ID used in the pipeline |
|---|---|
| GPM IMERG precipitation | Earth Engine `NASA/GPM_L3/IMERG_V07` |
| SMAP L4 soil moisture | Earth Engine `NASA/SMAP/SPL4SMGP/008` |
| MODIS vegetation indices (NDVI, EVI) | Earth Engine `MODIS/061/MOD13Q1` |
| ECOSTRESS land-surface temperature | Earth Engine `NASA/ECOSTRESS/L2T_LSTE/V2` (`ingest_ecostress.py`) |
| GRACE/GRACE-FO terrestrial water storage | Earth Engine `NASA/GRACE/MASS_GRIDS_V04/MASCON_CRI` |
| NASA POWER daily weather | <https://power.larc.nasa.gov/api/temporal/daily/point>, community `AG` (`fetch_nasa_power.py`) |
| ISRIC SoilGrids 2.0 | Earth Engine `projects/soilgrids-isric/*_mean` (pH, SOC, clay, sand, silt, bulk density, CEC, nitrogen) |

## Crop parameters (NOT sourced)

`crop_profiles` (water demand, drought/heat/waterlogging tolerance, fertility
dependency …) carries `profile_status = scenario_prior` and the source text
"BARC Crop Zoning …" without a document, table or page. These numbers are
treated as **unvalidated assumptions**. Since `season_patterns_v2` they feed
only the soil-health and climate-resilience scores, which the API labels as
provisional. Food production and water productivity use the sourced data
above.
