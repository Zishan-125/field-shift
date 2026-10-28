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
      water_conservation_score: "Water",
      soil_health_score: "Soil",
      climate_resilience_score: "Climate",
      crop_diversity_score: "Variety",
    },
    provisional:
      "Scores are provisional. They come from hand-set crop parameters that are not validated yet, and they do not include yield, cost or income.",
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