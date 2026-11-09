const en = {
  language: {
    bangla: "বাংলা",
    english: "English",
  },

  common: {
    loading: "Loading...",
    analyze: "Analyze",
    update: "Update",
    selected: "selected",
    cancel: "Cancel",
    reset: "Reset",
    search: "Search",
    back: "Back",
    topMatch: "Top match",
    noResults: "No results found",
  },

  crops: {
    title: "Which crops do you want to grow?",
    subtitle:
      "Choose up to 5 crops. FIELD SHIFT will show the best crop rotations matching your choices.",
    selected: "crops selected",
    maximum: "Maximum 5",
    searchPlaceholder: "Search crops...",
    clear: "Clear all",
    limitReached:
      "You can select a maximum of 5 crops.",
    chooseAtLeastOne:
      "Please select at least one crop.",
  },

  priorities: {
    title: "Your farming priorities",
    subtitle:
      "Choose what matters most to you.",
    saveWater: "Save water",
    protectSoil: "Protect soil",
    handleClimate: "Handle climate",
    cropVariety: "More crop variety",

    saveWaterDescription:
      "Use less irrigation water",
    protectSoilDescription:
      "Keep your soil healthy",
    handleClimateDescription:
      "Prepare for changing weather",
    cropVarietyDescription:
      "Maintain crop diversity",

    apply: "Build my plan",
    applying: "Building plan...",
    currentProfile: "Current priorities",
  },

  recommendations: {
    title: "Best crop plans for you",
    subtitle:
      "Top rotations based on your selected crops, field data and farming priorities.",
    selectedCropFilter: "Based on your selected crops",
    topThree: "Top 3",
    noMatch:
      "No matching rotations were found for your selected crops.",
    changeCrops:
      "Try selecting different crops.",
    scenarios: "rotations",
  },

  patterns: {
    seasons: {
      rabi: "Rabi (winter)",
      kharif1: "Kharif-1 (summer)",
      kharif2: "Kharif-2 (monsoon)",
    },
    seasonMonths: {
      rabi: "Nov–Feb",
      kharif1: "Mar–Jun",
      kharif2: "Jul–Oct",
    },
    // Strip order: November -> October (Rabi, Kharif-1, Kharif-2)
    months: ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"],
    currentTitle: "What you grow now",
    currentSubtitle:
      "Boro – Fallow – T. Aman is the most common pattern in Feni. Every plan below is compared with it.",
    bestMatch: "Best match for your priorities",
    plan: "Plan",
    whatChanges: "What changes",
    change: {
      same: "No change",
      added: "Add",
      removed: "Leave fallow",
      replaced: "Change",
    },
    vsNow: "vs. now",
    points: "points",
    fewerHarvests:
      "Fewer crop seasons than now: fewer harvests. Income is not included in this comparison yet.",
    moreHarvests: "More crop seasons than now: more work and inputs.",
    tight:
      "Tight timing: the next crop must go in almost straight after harvest.",
    adoptionRegion:
      "Grown on {pct}% of cropland in the Chittagong region ({n} upazilas, 2014-15).",
    adoptionNational:
      "Not recorded in the Chittagong region; grown on {pct}% of cropland in Bangladesh.",
    inFeni: "Recorded in Feni upazilas:",
    riceSeasons: "Rice seasons",
    pulse: "Includes a pulse crop",
    details: "Details",
    hideDetails: "Hide details",
    calendarDates: "Field dates used for the calendar check",
    turnaround:
      "Assumes {n} days between harvest and the next planting. This number is an assumption, not from a source.",
    scoreParts: "Score parts (0–100, change vs. now)",
    indicator: {
      food_production_score: "Food",
      water_productivity_score: "Food per drop",
      soil_health_score: "Soil",
      climate_resilience_score: "Climate",
      crop_diversity_score: "Variety",
    },
    provisional:
      "Food and water use Feni district yields (BBS 2024-25) and FAO water methods. Soil and climate parts are still provisional (hand-set crop parameters). Cost and income are not included yet.",
    foodProduced: "Food produced",
    waterNeeded: "Irrigation water needed",
    riceEquivalent: "t rice-equivalent / ha / year",
    irrigationUnit: "mm / year",
    now: "Now",
    withPlan: "With this plan",
    improvement: "Better on both",
    tradeOff: "Trade-off",
    tradeOffs: {
      fewer_harvests: "Fewer harvests than now",
      less_food: "Less food than now",
      more_irrigation: "Needs more irrigation water",
      fewer_rice_seasons: "Fewer rice seasons than now",
      tight_timing: "Tight timing between crops",
    },
    perCrop: "Per crop (yield, irrigation)",
    endUse: {
      food_grain: "Food grain",
      pulse: "Pulse",
      oilseed: "Oilseed",
      feed: "Mostly animal feed",
      condiment: "Condiment",
      tuber: "Tuber",
      vegetable: "Vegetable",
    },
    eatenByPeople: "{pct}% eaten by people",
    endUseUnknown: "end use unknown",
    totalOutput:
      "Total harvest incl. animal feed and oil cake: {value} t rice-equivalent / ha / year",
    marketFlag:
      "Little grown locally — seed, market and advice may be hard to find",
    marketFlagCrop: "{crop}: about {area} ha in Feni",
    notInSurvey: "Not recorded in the regional crop survey",
    yieldFlag: "Yield is from a very small area in Feni ({crop}: {area} ha) — treat it with care",
    notScoredEndUse:
      "Not ranked: how much of {crop} is eaten by people in Bangladesh is not known yet",
    foodNote:
      "Food = Feni average yield × food energy, shown as tonnes of rice with the same food energy.",
    source: "Source",
    showMore: "Show more plans",
    showLess: "Show fewer plans",
    otherTitle: "Other patterns grown in the region",
    otherSubtitle:
      "Not ranked yet: crop data is missing or the calendar check failed.",
    status: {
      feasible: "Fits the crop calendar",
      tight: "Tight timing",
      infeasible: "Does not fit the crop calendar",
      unverified: "Calendar not checked yet",
      notScored: "No score yet (crop data missing)",
    },
    conflict:
      "Farmers do grow this pattern, so our calendar data is probably incomplete.",
    noMatch: "No plans contain your selected crops.",
  },

  fieldsFromSpace: {
    eyebrow: "NASA HLS and Sentinel-1, 2016–2025",
    title: "What satellites saw on six Feni fields",
    subtitle:
      "One demo field per upazila, chosen by rule on satellite cropland maps — not surveyed farms. Each square is one season.",
    coastalLine:
      "Coastal Sonagazi: the field lay fallow in {fallow} of {years} dry seasons. The five inland fields: fallow in {inland} of {inlandLabelled} dry seasons we could read.",
    coastalWhy:
      "Satellites see the empty winter field, not the salt. A fallow dry season on the coast is what soil salinity causes; no salinity was measured here.",
    rabi: "Rabi (winter)",
    kharif2: "Kharif-2 (monsoon)",
    label: {
      Boro: "Boro rice",
      Rabi_nonrice: "Other Rabi crop",
      Fallow: "Fallow",
      T_Aman: "T. Aman rice",
      none: "Not clear",
    },
    short: { Boro: "B", Rabi_nonrice: "R", Fallow: "F", T_Aman: "A", none: "?" },
    source: "Labels from phenology rules on the satellite series (weak labels, not ground truth).",
  },
  climateRisk: {
    eyebrow: "28 years of NASA satellite rain",
    title: "What your climate does to your crops",
    subtitle: "How often each crop of your current pattern was hit in {upazila}, 1998–2025.",
    shortRecord:
      "28 years is a short record. Trend tests have little power over it, so “no clear trend” does not mean “no change”. These are the frequencies you farm with today — not forecasts.",
    hitSentence: "{crop}: hit by {hazard} in {n} of the last {total} years.",
    lastHit: "Most recent: {years}.",
    notHit: "Not hit in the last {total} years: {items}.",
    hazard: {
      flood_rain: "a flood-size downpour ({mm} mm or more in 7 days, a once-in-5-years amount)",
      heat_flowering: "35 °C or more in its flowering week",
      heavy_rain_day: "a day with 50 mm or more rain",
      dry_spell: "20 or more dry days in a row",
    },
    hazardShort: {
      flood_rain: "flood-size downpour",
      heat_flowering: "heat at flowering",
      heavy_rain_day: "very heavy rain day",
      dry_spell: "long dry spell",
    },
    betterPatterns: "Hit less often with:",
    betterYears: "{n} years",
    noBetter: "No recommended pattern lowers this.",
    eraCaveat:
      "Rain counts may shift with the 2014 change of satellites ({before} hits before 2014, {after} from 2014).",
    heatCaveat:
      "Heat uses NASA temperature corrected to the BMD Feni station; the correction rests on two years of station data.",
    monsoonTitle: "Monsoon rain swings from year to year",
    monsoonSentence:
      "June–September rain: driest {driest} mm ({driestYear}), wettest {wettest} mm ({wettestYear}). A typical year is {cv}% above or below the average of {mean} mm.",
    monsoonSeries: "June–September rain (mm)",
    extremeTitle: "How rare was 2024?",
    extremeSentence:
      "Largest {days} rain in 2024: {value} mm — the {rankText} in 28 years. On the fitted curve that is about a once-in-{T}-years total.",
    rankFirst: "largest",
    rankOther: "number {rank}",
    window7: "7-day",
    window15: "15-day",
    axisReturn: "Once in … years (log scale)",
    axisTotal: "Rain total (mm)",
    seriesYears: "Largest total of each year",
    seriesFit: "Fitted curve (Gumbel)",
    series2024: "2024",
    tableShow: "Show as table",
    tableHide: "Hide table",
    year: "Year",
    returnPeriod: "Once in … years",
    recoveryTitle: "The 2024 flood at the Fulgazi demo field, seen from space",
    recoveryGreen: "Green crop",
    recoveryWater: "Under water",
    recoveryRegrow: "Green again",
    recoverySentence:
      "Green on {before} → under water {start} to {end} ({days} days) → green again on {green}, {total} days after the water came.",
    recoveryRule: "Sentinel-1 radar for water, NASA HLS for green; one 90 m demo field, not a surveyed plot.",
    projectionsTitle: "Climate model projections for 2041–2060",
    projectionsIntro:
      "Projections from {n} NASA-downscaled climate models, applied as changes to the observed climate. They are possibilities under each emissions path, not forecasts.",
    projHot: "Days of 35 °C or more in March–May",
    projRx5: "Wettest 5 days of the year (mm)",
    projNow: "Now (observed)",
    projMid: "SSP2-4.5 (middle path)",
    projHigh: "SSP5-8.5 (high emissions)",
    projRange: "{median} (models: {min}–{max})",
    trendToggle: "Has the climate changed? Trend tests and data checks",
    hideTrend: "Hide trend tests",
  },
  climate: {
    eyebrow: "40 years of NASA data",
    title: "Your climate has changed — or has it?",
    subtitle:
      "What NASA POWER shows for {upazila} since 1984, and how far it agrees with the BMD Feni weather station.",
    upazila: "Upazila",
    indicator: {
      tx90p_mar_may: "Unusually hot days in March–May",
      tx90p_boro_flowering: "Unusually hot days at Boro flowering (12–18 March)",
      tmax_mean_mar_may_bc: "Average daytime heat in March–May",
      hot_days_mar_may_bc: "Days of 35 °C or more in March–May (corrected)",
      hot_days_mar_may_raw: "Days of 35 °C or more in March–May (NASA, uncorrected)",
      hot_days_boro_flowering_bc: "Days of 35 °C or more at Boro flowering (corrected)",
      hot_days_boro_flowering_raw: "Days of 35 °C or more at Boro flowering (NASA, uncorrected)",
      extreme_rain_days: "Very heavy rain days (50 mm or more)",
      annual_rain_mm: "Rain per year",
      annual_rain_mm_power: "Rain per year (NASA POWER, for comparison)",
      kharif_rain_mm: "Kharif rain (March–October)",
      rabi_rain_mm: "Rabi rain (November–February)",
      annual_et0_mm: "Crop water demand of the air (ET0) per year",
      longest_dry_spell_kharif1: "Longest dry spell in Kharif-1",
      rainy_season_onset_doy: "Start of the rainy season",
      rainy_season_withdrawal_doy: "End of the rainy season",
      rainy_season_length_days: "Length of the rainy season",
    },
    unit: { days: "days", mm: "mm", "day of year": "days", C: "°C" },
    hotDayHint:
      "\"Unusually hot\" = hotter than 9 in 10 days at that time of year in 1998–2010.",
    gridGpm:
      "Rain is measured per upazila (NASA GPM, about 10 km). Temperature comes from one NASA grid cell for all of Feni, so the heat charts are the same for every upazila.",
    gridPower:
      "Rain and temperature both come from one NASA grid cell for all of Feni, so every upazila shows the same charts.",
    gpmSeries: "NASA GPM",
    biasTitle: "Temperature correction against the BMD Feni station",
    biasIntro:
      "NASA POWER daytime temperature runs cooler than the station. Each month is shifted by the average gap; the check below corrects one year using only the other year.",
    biasHeld: "Year checked",
    biasBefore: "Gap before (°C)",
    biasAfter: "Gap after (°C)",
    biasMonth: "Month",
    biasOffset: "Shift added (°C)",
    rose: "rose",
    fell: "fell",
    sentenceTrend:
      "{label} {verb} by {value} {unit} per decade since {year} in the NASA record.",
    sentenceStep:
      "The NASA record for {label} jumps around {year} (average {before} → {after} {unit}). That looks like a change in the data, not a steady trend, so we do not call it one.",
    sentenceNone:
      "{label}: no clear change since {year} — not statistically significant.",
    caveatGauge:
      "Careful: this NASA record does not match the BMD Feni weather station, so treat it as uncertain.",
    caveatSensorEra:
      "Careful: the satellites behind this rain record changed in 2014. A change in heavy-rain or dry days around then may come from the satellites, not the weather.",
    notSignificantBadge: "Not significant",
    trendBadge: "Trend (NASA)",
    stepBadge: "Data break, not a trend",
    gaugeSeries: "BMD Feni gauge",
    nasaSeries: "NASA POWER",
    details: "Statistics and data checks",
    hideDetails: "Hide statistics",
    table: {
      indicator: "Indicator",
      years: "Years",
      slope: "Change / decade",
      p: "p (Mann-Kendall)",
      breakYear: "Break year (p, Pettitt)",
      afterBreak: "After the break: change / decade (p)",
      status: "Status",
      gauge: "Station check",
    },
    gaugeTitle: "NASA POWER vs BMD Feni station (rain per year, mm)",
    adviceTitle: "What this means for your crops",
    adviceIntro:
      "Only changes that pass the trend tests are used here, with the station check shown.",
    adviceThreat: "If this is real, it puts {crops} in your current pattern at more risk.",
    adviceBenefit: "If this is real, it lowers the risk for {crops}.",
    adviceBenefitWater: "If this is real, your crops need a little less irrigation water.",
    adviceWater: "If this is real, your pattern needs more irrigation water.",
    betterPatterns: "Patterns with less exposure:",
    noBetter: "None of the recommended patterns reduces this exposure.",
    noAdvice: "No change in the NASA record passes the trend tests, so there is no climate advice yet.",
    hazard: {
      heat_mar_may: "More hot days in March–May",
      heat_boro_flowering: "More heat at Boro flowering",
      heavy_rain: "More very heavy rain days",
      wetter_monsoon: "More rain in the year",
      kharif1_dry_spell: "Longer dry spells in Kharif-1",
      drier_rabi: "Less Rabi rain",
      higher_water_demand: "Higher crop water demand",
      late_onset: "Later start of the rains",
      early_withdrawal: "Earlier end of the rains",
    },
    hazardReverse: {
      heat_mar_may: "Fewer hot days in March–May",
      heat_boro_flowering: "Less heat at Boro flowering",
      heavy_rain: "Fewer very heavy rain days",
      wetter_monsoon: "Less rain in the year",
      kharif1_dry_spell: "Shorter dry spells in Kharif-1",
      drier_rabi: "More Rabi rain",
      higher_water_demand: "Lower crop water demand",
      late_onset: "Earlier start of the rains",
      early_withdrawal: "Later end of the rains",
    },
  },

  field: {
    situation: "Field situation",
    environment: "Your field environment",
    localData: "Local field data",
    soil: "Soil condition",
    health: "Field health",
  },

  status: {
    updating: "Updating your farm plan",
    comparing: "Comparing crop rotations",
    updated: "Your crop plan has been updated",
    error: "Couldn't update the plan",
  },
};

export default en;