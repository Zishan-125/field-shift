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
treated as **unvalidated assumptions**; every score built from them is labelled
`provisional_indicator_from_unvalidated_crop_priors`.
