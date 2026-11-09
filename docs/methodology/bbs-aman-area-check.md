# Is Feni's 2024-25 Aman collapse real or a unit error?

BBS reports Feni's Total Aman area as 66,130 ha in 2023-24 and 26,753 ha in
2024-25 (−60 %). The question raised (9 Nov 2026): 66,130 / 2.47105 =
26,762, within 0.03 % of the 2024-25 figure, so one of the two could be acres
read as hectares. This page records what was checked. Checked 9 Nov 2026.

## 1. Column units

Both years come from one table, BBS *Yearbook of Agricultural Statistics
2025*, Table 3.5 (p. 87). Every area column carries its unit in the header:
"Acre" and "Hectare" for 2023-24, again "Acre" and "Hectare" for 2024-25.
`bbs_district_rice_area.csv` stores the hectare column for every year and now
records both headers (`area_acre_column_header`, `area_ha_column_header`).
In all 64 district rows of both years, acre / hectare = 2.471. **No row mixes
units, and our extraction did not mix columns.**

## 2. District sum vs national total (Table 3.5, Yearbook 2025)

| Year | Sum of 64 districts (ha) | National total (ha) | Ratio |
|---|---|---|---|
| 2023-24 | 5,750,757 | 5,750,755 | 1.0000 |
| 2024-25 | 5,612,036 | 5,612,036 | 1.0000 |

5.75 million ha is the expected size of Bangladesh's Aman crop. **The table is
in hectares, as labelled.** (The printed 2024-25 national acre total,
1,386,734, has lost a digit; the district acres sum to 13,867,341.)

## 3. More years for the three districts

| District | 2021-22 | 2022-23 | 2023-24 | 2024-25 |
|---|---|---|---|---|
| Feni | 65,935 | 65,995 | 66,130 | **26,753** |
| Noakhali | 150,955 | 159,801 | 160,051 | 132,648 |
| Cumilla | — | 130,401 | 128,373 | 112,304 |

Sources: Yearbook 2023 Table 3.4 p. 89 (2021-22), Yearbook 2024 Table 3.5
p. 86 (2022-23; its 2023-24 column repeats the values above), Yearbook 2025
Table 3.5 p. 87. The Cumilla 2021-22 row did not parse and was not entered.

**Independent of BBS:** the Feni district office of DAE reported T. Aman on
**66,525 ha** across the six upazilas in 2020 (Sadar 15,940; Sonagazi 20,970;
Chhagalnaiya 9,250; Daganbhuiyan 8,510; Fulgazi 6,205; Parshuram 5,850 ha),
quoted in Bangla Tribune, 26 Oct 2020,
<https://www.banglatribune.com/country/649610/>.

**So 2023-24 is not an acre figure.** About 66,000 ha is Feni's normal Aman
area in four years and two independent sources.

## 4. Aman area vs net cropped area, every district

Aman area 2023-24 ÷ net cropped area 2022-23 (Table 5.1, p. 456, both in
acres), for the 56 districts whose names matched:

| District | 2023-24 | 2024-25 |
|---|---|---|
| Feni | **1.23** | 0.50 |
| Noakhali | 1.17 | 0.97 |
| Chattogram | 1.04 | 1.00 |
| Sherpur | 1.01 | 0.79 |
| Cumilla | 0.62 | 0.55 |

Four districts exceed 1.0 in 2023-24. Since Feni's Aman area has been about
66,000 ha for years, the inconsistency lies between the land-use table and
the crop tables (the BBS land-use series understates net cropped area in
these districts, or classes some cropped char land elsewhere), not in one
year's Aman figure. **The net-cropped ratio cannot be used as a unit test.**

## 5. What remains open about 2024-25

* **For a real fall:** the same Yearbook's flood-damage table (4.2.9,
  pp. 447–448) gives Feni's Aman "area under crop" in Aug–Sep 2024 as 74,106
  acres (29,990 ha), less than half the usual 66,000 ha. That matches a crop
  partly unplanted after the July and early-August floods. 96.8 % of Feni's
  Aman **seedbeds** were damaged, so little replanting was possible. The DAE
  director-general put national Aman area down about 100,000 ha
  (*Financial Express*, 6 Jul 2025), and BBS's national fall is 138,719 ha, led
  by the flood districts: Feni −39,377, Noakhali −27,403, Sherpur −20,881,
  Cumilla −16,069, Chandpur −8,376 ha. Feni is the most extreme ratio of all 64
  districts (0.405) and was the worst-hit district.
* **For a data-entry slip in 2024-25:** Feni's 2024-25 *acre* figure (66,107)
  equals its previous hectare level (66,130) to 0.03 %. Typing the hectare
  value into the acre column would produce exactly this, and the hectare and
  production columns would then follow from it. Most districts are nearly
  flat year on year, so "flat at about 66,100 ha" is what an unaffected year
  looks like. By chance alone, a match this close is unlikely.

The published numbers cannot tell these apart. The damage table points to a
real loss of planted area of roughly this size; the coincidence points to a
slip. **We treat the BBS 2024-25 Feni figure as plausible but unconfirmed.**

## 6. Consequence for the classifier check

* The units are verified, so the year-on-year ratio test stays. It is no longer
  a single pass/fail headline. It is reported next to the three-year BBS
  baseline and with the open question above.
* BBS **production** is area × yield and inherits the same doubt. BBS **yield**
  (Feni 3.107 → 3.164 t/ha) is per harvested hectare: fields that were
  destroyed drop out of the area rather than lowering the yield, so yield
  does not measure the flood. Neither is a better target.
* An independent target the satellites can measure directly: the share of
  Aman cropland under water in late August – September 2024 (Sentinel-1),
  against the damage table's share of crop damaged (Feni 55 %, Noakhali 44 %).
