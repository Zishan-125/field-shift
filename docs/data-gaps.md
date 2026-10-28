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

## Assumptions in the code

| Value | Where | Used for |
|---|---|---|
| Turnaround between crops = **7 days** | `ASSUMED_TURNAROUND_DAYS` in `data-pipeline/rotation/feasibility.py` | Only separates "feasible" from "tight". Rejections never depend on it. SHAHIDULLAH_2006 says turnaround after T. Aman in coastal Feni is "very short" but gives no number |
| Crop parameters in `crop_profiles` | `field_shift.db` | All indicator scores (see `docs/data-sources.md`, last section) |
| Historical soil context = **0.5** | `data-pipeline/build_farmer_priority_scenarios.py` (`safe_mean` default) | Soil score. It is a fallback, because `soil_topsoil_fertility_proxy` is null in every month (BASELINE.md) |

## Suspicious values

| Value | Concern |
|---|---|
| SoilGrids topsoil nitrogen = 18.8 (stored as g/kg) | Much higher than typical topsoil nitrogen. Check the scale factor in `data-pipeline/build_soil_profile.py` (÷100) against the SoilGrids unit documentation and the raw values. Not used in any score of the pattern recommendations |
| Pattern areas are from 2014-15 | They describe practice ten years ago; check against newer DAE/BBS data |
