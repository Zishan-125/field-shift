# Data gaps — values to fill in

Values Field Shift needs but could not confirm from a source. Nothing here is
guessed in the data; empty cells stay empty until a source is found. Please add
the value **and** the source (document, table/page) when you fill one in.

## Crop calendar (`data-pipeline/reference/crop_calendar.csv`)

| Crop | Missing | Why it matters | Where to look |
|---|---|---|---|
| Sesame (তিল) | Sowing and harvest window, duration | 2 patterns (Potato–Sesame–T. Aman, Sesame–Fallow–T. Aman) are "unverified" | BARI *Krishi Projukti Hatboi*; DAE Feni office |
| Felon / cowpea (ফেলন) | Sowing and harvest window, duration | Felon–Fallow–T. Aman (2.2 % of regional NCA, 28 upazilas) and Felon–Aus–T. Aman are "unverified" | BARI pulse calendar; DAE |
| Grass pea / khesari (খেসারি) | A **Feni-region** window | Current window is farmers' practice in Barishal (KABIR_ISLAM_2012). Grass pea is often relay-sown into standing T. Aman, which our non-overlap rule cannot represent yet | BARI pulse calendar; DAE Feni |
| Mungbean (মুগ) | A Feni-region window for mungbean grown **before Aus** | Mungbean–Aus–T. Aman uses Barishal farmers' practice; the only DAE calendars are Kharif-1 Dhaka (April sowing, clashes with Aus) and "Rabi mungbean" Chattogram (September–November, clashes with T. Aman) | BARI; DAE Feni |
| Vegetables (group) | Calendars per vegetable | Vegetable patterns (2.7 % + 1.2 % of regional NCA) are "unverified" | BAMIS has brinjal, tomato, gourd, pumpkin calendars — choose which vegetables represent the group |
| Potato, groundnut | Planting window **after T. Aman harvest** | The DAE Chattogram calendars start potato (week 41) and groundnut (week 40) before the regional T. Aman harvest (weeks 41–42), so all 5 potato and both groundnut patterns are flagged as calendar conflicts although farmers grow them | BARI potato and groundnut recommendations; DAE Feni |
| Chili | Harvest end used for the next crop | Chili Rabi is harvested until early June (BAMIS weeks 18–22), so Chilli–Aus–T. Aman conflicts. Farmers may clear the field after early pickings | DAE Feni |
| T. Aman | Which calendar fits Feni | BAMIS Chattogram (133 days, harvest mid-October) and BRRI national (harvest November) differ by about a month; this decides which Rabi crops fit | BRRI Regional Station Sonagazi, Feni; which T. Aman varieties Feni farmers actually use |

## Production and water (`crop_yields.csv`, `food_energy.csv`, `fao56_crop_coefficients.csv`)

| Item | Gap | Effect |
|---|---|---|
| Vegetables | No single yield, energy or Kc for a group of crops | Vegetable patterns stay unscored |
| Groundnut, chili | BBS does not say whether production is in-shell / kernel (groundnut) or green / dry (chili) | Food output not computed for these crops |
| Grass pea energy | FCT_BD_2013 only has split grass pea (dal); BBS production is whole seed | Small overstatement of grass pea food energy |
| Small-area yields | Feni sesame (3 ha), wheat (52 ha) and Rabi maize (74 ha) yields come from very small areas; maize (8.9 t/ha) is high and puts Maize–Fallow–T. Aman at the top | Check against DAE Feni or a multi-year BBS average |
| One year | All yields are 2024-25 (most recent). Aman area that year was cut by the August 2024 floods | Consider a 3-year average once older yearbooks are added |
| FAO-56 page numbers | Kc values cite Table 11 / Table 12 of the official FAO HTML edition; the printed page numbers were not checked from an accessible copy | Add the page numbers from the printed FAO-56 |
| Mustard, grass pea, mungbean Kc | No FAO-56 rows: mustard uses Rapeseed (Table 12) with sesame stage proportions (Table 11); mungbean and grass pea use "Beans, dry and Pulses" | Labelled ASSUMPTION in the CSV |
| Kc climate adjustment | Table 12 values are for RHmin ≈ 45 %, u2 ≈ 2 m/s; the FAO-56 Eq. 62 adjustment for Feni's humidity was not applied | Kc mid/end may be slightly high |
| Paddy percolation | FAO_IWN "average" 6 mm/day used; Feni topsoil is clay loam (SoilGrids, about 38 % clay) | Rice water need could be 4–8 mm/day × field days; a measured Feni value would be better |
| Puddling water (SAT) | Charged to the first month in the field (FAO_IWN says the month before planting) | Slightly overstates T. Aman irrigation in July |
| Rainfall | GPM IMERG (about 2,450 mm/year here) is lower than NASA POWER (about 3,440 mm/year) | Irrigation needs may be overstated; check against the BMD Feni station (BBS Yearbook Table 6.1.x) |
| Mungbean end use | FAO may count mung (Vigna radiata) under 'Beans' (48 % food in Bangladesh) or 'Pulses, Other' (92 %); not settled for Bangladesh | Mungbean–Aus–T. Aman and Mungbean–Fallow–T. Aman are not ranked. Needs a Bangladesh mungbean utilisation figure (BBS/HIES, BARI pulses centre) |
| Groundnut end use | Needs groundnut oil energy and the BBS production basis | Groundnut patterns are calendar conflicts anyway |
| Wheat and rice end use | FAO books 51 % of Bangladesh wheat supply as feed (+21 % other uses) and 18.7 % of rice as feed | Wheat counts at 25 % food, rice at 75 %; check against BBS/HIES consumption |
| Vegetables end use | Group of crops | Unscored |
| Evidence-flag thresholds | Yield flag below 100 ha and market flag below 500 ha of the crop in Feni (BBS 2024-25) are judgement calls | Shown on the card; do not change the score |
| Water productivity | Defined as food per m³ of **total** crop water need, not per m³ of irrigation only: a rainfed single T. Aman would otherwise get an infinite score | Irrigation water is shown separately |

## Assumptions in the code

| Value | Where | Used for |
|---|---|---|
| Turnaround between crops = **7 days** | `ASSUMED_TURNAROUND_DAYS` in `data-pipeline/rotation/feasibility.py` | Only separates "feasible" from "tight". Rejections never depend on it. SHAHIDULLAH_2006 says turnaround after T. Aman in coastal Feni is "very short" but gives no number |
| Crop parameters in `crop_profiles` | `field_shift.db` | Soil-health and climate-resilience scores (see `docs/data-sources.md`, last section) |
| Default priority weights (food 0.30, water productivity 0.25, soil 0.20, climate 0.15, variety 0.10) | `DEFAULT_PATTERN_PRIORITIES` in `server.py` and `types/pattern.ts` | A UI starting point, not data; the farmer can change every weight |
| Historical soil context = **0.5** | `data-pipeline/build_farmer_priority_scenarios.py` (`safe_mean` default) | Soil score. It is a fallback, because `soil_topsoil_fertility_proxy` is null in every month (BASELINE.md) |

## Suspicious values

| Value | Concern |
|---|---|
| SoilGrids topsoil nitrogen = 18.8 (stored as g/kg) | Much higher than typical topsoil nitrogen. Check the scale factor in `data-pipeline/build_soil_profile.py` (÷100) against the SoilGrids unit documentation and the raw values. Not used in any score of the pattern recommendations |
| Pattern areas are from 2014-15 | They describe practice ten years ago; check against newer DAE/BBS data |
