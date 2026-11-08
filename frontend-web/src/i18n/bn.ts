const bn = {
  language: {
    bangla: "বাংলা",
    english: "English",
  },

  brand: {
    subtitle: "কৃষি সহায়তা",
    farmer: "কৃষক",
    offline: "অফলাইন মোড প্রস্তুত",
    welcome: "আপনাকে দেখে ভালো লাগছে",
  },

  common: {
    loading: "লোড হচ্ছে...",
    search: "খুঁজুন",
    clear: "সব মুছুন",
    reset: "ডিফল্ট",
    analyze: "বিশ্লেষণ করুন",
    update: "আপডেট করুন",
    details: "বিস্তারিত",
    hide: "লুকান",
    live: "সরাসরি",
    start: "শুরু",
    next: "পরবর্তী",
    step: "ধাপ",
    selected: "নির্বাচিত",
    yes: "হ্যাঁ",
    no: "না",
  },

  health: {
    eyebrow: "আজকের মাঠের স্বাস্থ্য",
    title: "আপনার মাঠ কেমন আছে?",
    description:
      "আপনার মাঠের মাটি, পানি ও জলবায়ুর প্রধান তথ্যের সহজ চিত্র।",

    watch: "নজরে রাখুন",
    fieldSignal: "মাঠের সংকেত",
    keepWatching:
      "মাঠের কিছু অবস্থা পরিবর্তনের সাথে নজরে রাখা দরকার।",

    basedOn:
      "উপলব্ধ মাঠের তথ্যের ভিত্তিতে",

    soil: "মাটি",
    water: "পানি",
    climate: "জলবায়ু",

    good: "ভালো",
    moderate: "নজরে রাখুন",
    attention: "মনোযোগ প্রয়োজন",

    soilWatch:
      "মাটির অবস্থা নজরে রাখা দরকার।",

    waterWatch:
      "পানির অবস্থা নজরে রাখা দরকার।",

    climateWatch:
      "আবহাওয়ার অবস্থা নজরে রাখা দরকার।",

    meaningTitle: "এর অর্থ কী?",

    meaning:
      "FIELD SHIFT এই তথ্য ব্যবহার করে আপনার মাঠ ও কৃষি অগ্রাধিকারের সাথে মানানসই crop rotation তুলনা করে।",

    disclaimer:
      "এটি decision-support indicator; নির্দিষ্ট ফসলের agronomic diagnosis নয়।",

    anythingToWatch: "কিছু কি নজরে রাখা দরকার?",

    watchDescription:
      "FIELD SHIFT মাঠের জন্য পাওয়া প্রধান তথ্যগুলো পরীক্ষা করে।",

    decisionSupport:
      "এগুলো decision-support indicator; নির্দিষ্ট ফসলের agronomic diagnosis নয়।",
  },

  field: {
    eyebrow: "মাঠের অবস্থা",
    title: "আপনার মাঠে কী ঘটছে?",
    description:
      "আপনার মাঠের জন্য পাওয়া পরিবেশগত তথ্যের সহজ চিত্র।",

    current: "বর্তমান অবস্থা",
    environment: "আপনার মাঠের পরিবেশ",
    localData: "স্থানীয় মাঠের তথ্য",

    temperature: "তাপমাত্রা",
    recentConditions: "সাম্প্রতিক মাঠের অবস্থা",

    sunlight: "সূর্যালোক",
    solarEnergy: "সৌর শক্তি",

    wind: "বাতাস",
    averageWind: "গড় বাতাসের গতি",

    coverage: "তথ্যের পরিধি",
    observedLocally: "স্থানীয়ভাবে পর্যবেক্ষিত",

    conditions: "মাঠের অবস্থা",
    telling: "পরিবেশ কী বলছে?",

    available:
      "এই মাঠের জন্য পরিবেশগত তথ্য পাওয়া গেছে।",

    fieldWatch: "মাঠ নজরদারি",
  },

  soil: {
    eyebrow: "মাটির তথ্য",
    title: "আপনার মাটি কেমন?",
    description:
      "আপনার মাঠের জন্য পাওয়া মাটির তথ্যের সহজ চিত্র।",

    profile: "মাটির প্রোফাইল",
    surface: "উপরের মাটি",

    ph: "মাটির pH",
    unavailable:
      "pH-এর তথ্য পাওয়া যায়নি।",

    acidic: "অম্লীয়",
    moderate: "মাঝারি",
    alkaline: "ক্ষারীয়",

    carbon: "জৈব কার্বন",
    surfaceSoil: "উপরের মাটি",

    depth: "মাটির গভীরতা",
    depthAvailable:
      "তথ্য পাওয়া গেছে",

    whyMatters: "মাটি কেন গুরুত্বপূর্ণ?",

    explanation:
      "FIELD SHIFT crop rotation তুলনা করার সময় মাটির তথ্যকে decision-support প্রক্রিয়ার একটি অংশ হিসেবে ব্যবহার করে।",

    viewProfile:
      "গভীরতা অনুযায়ী মাটির প্রোফাইল দেখুন",

    profileData: "মাটির প্রোফাইলের তথ্য",
    source: "তথ্যের উৎস",
  },

  crops: {
    eyebrow: "ফসল নির্বাচন",

    title: "আপনি কোন ফসল চাষ করতে চান?",

    subtitle:
      "সর্বোচ্চ ৫টি ফসল নির্বাচন করুন। আপনার পছন্দ অনুযায়ী সেরা crop rotation দেখানো হবে।",

    selected: "নির্বাচিত",
    maximum: "সর্বোচ্চ ৫টি",

    searchPlaceholder:
      "ফসলের নাম খুঁজুন...",

    clear: "সব মুছুন",

    limitReached:
      "আপনি সর্বোচ্চ ৫টি ফসল নির্বাচন করতে পারবেন।",

    noResults:
      "কোনো ফসল পাওয়া যায়নি।",

    selectAtLeastOne:
      "অন্তত একটি ফসল নির্বাচন করুন।",
  },

  priorities: {
    eyebrow: "আপনার অগ্রাধিকার",

    title:
      "কোন বিষয়টি আপনার কাছে বেশি গুরুত্বপূর্ণ?",

    subtitle:
      "একটি প্রধান লক্ষ্য নির্বাচন করুন। FIELD SHIFT সেই অনুযায়ী rotation-এর score পরিবর্তন করবে।",

    reset: "ডিফল্ট",

    water: "পানি সাশ্রয়",
    waterDescription:
      "কম সেচের পানি ব্যবহার করতে চাই",

    soil: "মাটির স্বাস্থ্য",
    soilDescription:
      "মাটির স্বাস্থ্য ভালো রাখতে চাই",

    climate: "জলবায়ু মোকাবিলা",
    climateDescription:
      "পরিবর্তনশীল আবহাওয়ার জন্য প্রস্তুত থাকতে চাই",

    variety: "ফসলের বৈচিত্র্য",
    varietyDescription:
      "বিভিন্ন ধরনের ফসল চাষ করতে চাই",

    buildPlan: "পরিকল্পনা তৈরি করুন",
    buildingPlan:
      "পরিকল্পনা তৈরি হচ্ছে...",
  },

  recommendations: {
    eyebrow:
      "আপনার নির্বাচিত ফসল অনুযায়ী",

    title:
      "আপনার জন্য সেরা ফসল পরিকল্পনা",

    description:
      "আপনার নির্বাচিত ফসল, মাঠের তথ্য এবং অগ্রাধিকার মিলিয়ে সেরা rotation দেখানো হচ্ছে।",

    rotationCount: "rotation",
    rotations: "rotation",

    compared:
      "টি rotation তুলনা করা হয়েছে",

    rankingWeights:
      "বর্তমান ranking weight",

    rankingDescription:
      "এই weight ব্যবহার করে FIELD SHIFT rotation-গুলোকে rank করে।",

    topMatch:
      "আপনার অগ্রাধিকারের জন্য সেরা মিল",

    cropRotation: "ফসলের rotation",

    rankedUsing:
      "আপনার বর্তমান অগ্রাধিকার অনুযায়ী rank করা",

    priorityFit: "অগ্রাধিকার অনুযায়ী মিল",

    cropJourney: "আপনার ফসলের যাত্রা",

    priorityCalculation:
      "অগ্রাধিকার অনুযায়ী হিসাব",

    calculationDescription:
      "আপনার weight প্রতিটি factor-এর contribution পরিবর্তন করে।",

    hide: "লুকান ↑",
    details: "বিস্তারিত ↓",

    why:
      "কেন এই rotation?",

    whyDescription:
      "আপনার নির্বাচিত অগ্রাধিকার প্রতিটি factor-এর contribution নির্ধারণ করে।",

    currentCalculation: "বর্তমান হিসাব",

    score: "rotation score",
    weight: "Weight",
    contribution: "Contribution",

    priorityFitExplanation:
      "এই rotation-এর factor score এবং আপনার বর্তমান farmer priority ব্যবহার করে হিসাব করা হয়েছে।",

    currentPriorities:
      "আপনার বর্তমান অগ্রাধিকার",

    technicalCalculation:
      "Technical calculation",

    noMatch:
      "আপনার নির্বাচিত ফসলের সাথে কোনো matching rotation পাওয়া যায়নি।",

    changeCrops:
      "অন্য ফসল নির্বাচন করে আবার চেষ্টা করুন।",

    recommendationNotice:
      "এটি একটি সুপারিশ, নিশ্চয়তা নয়",

    notice:
      "এই ranking FIELD SHIFT-এর কাছে থাকা তথ্যের ভিত্তিতে আপনার সিদ্ধান্তে সহায়তা করে। বাস্তব ফলাফল স্থানীয় অবস্থা, ব্যবস্থাপনা ও মৌসুমের পরিবর্তনের কারণে ভিন্ন হতে পারে।",

    viewAll:
      "সব matching rotation দেখুন",
  },

  status: {
    updating:
      "আপনার farm plan আপডেট হচ্ছে",

    comparing:
      "নির্বাচিত crop rotation তুলনা করা হচ্ছে",

    updated:
      "আপনার crop plan আপডেট হয়েছে",

    updatedDescription:
      "আপনার নির্বাচিত ফসল এবং অগ্রাধিকার অনুযায়ী ফলাফল তৈরি হয়েছে।",

    error:
      "পরিকল্পনা আপডেট করা যায়নি",
  },

  howItWorks: {
    eyebrow:
      "FIELD SHIFT কীভাবে কাজ করে",

    title:
      "Earth observation থেকে কৃষি সিদ্ধান্ত",

    description:
      "FIELD SHIFT পরিবেশ, মাটি, ফসল এবং কৃষকের অগ্রাধিকার একসাথে ব্যবহার করে crop rotation-এর সিদ্ধান্তে সহায়তা করে।",

    nasa: "NASA তথ্য",
    nasaDescription:
      "NASA Earth data থেকে পরিবেশগত তথ্য।",

    soil: "স্থানীয় মাটি",
    soilDescription:
      "নির্বাচিত মাঠের মাটির তথ্য।",

    crops: "ফসলের বৈশিষ্ট্য",
    cropsDescription:
      "ফসল ও rotation-এর তথ্য।",

    priorities: "আপনার অগ্রাধিকার",
    prioritiesDescription:
      "আপনার farming goals decision score-কে প্রভাবিত করে।",
  },

  patterns: {
    seasons: {
      rabi: "রবি (শীত)",
      kharif1: "খরিফ-১ (গ্রীষ্ম)",
      kharif2: "খরিফ-২ (বর্ষা)",
    },
    seasonMonths: {
      rabi: "নভে–ফেব্রু",
      kharif1: "মার্চ–জুন",
      kharif2: "জুলাই–অক্টো",
    },
    // Strip order: November -> October (Rabi, Kharif-1, Kharif-2)
    months: ["নভে", "ডিসে", "জানু", "ফেব্রু", "মার্চ", "এপ্রি", "মে", "জুন", "জুলা", "আগ", "সেপ্টে", "অক্টো"],
    currentTitle: "আপনি এখন যা চাষ করেন",
    currentSubtitle:
      "বোরো – পতিত – রোপা আমন ফেনীর সবচেয়ে প্রচলিত শস্য বিন্যাস। নিচের প্রতিটি পরিকল্পনা এর সাথে তুলনা করা হয়েছে।",
    bestMatch: "আপনার অগ্রাধিকারের সেরা মিল",
    plan: "পরিকল্পনা",
    whatChanges: "কী বদলাবে",
    change: {
      same: "একই থাকবে",
      added: "যোগ করুন",
      removed: "পতিত রাখুন",
      replaced: "বদলান",
    },
    vsNow: "এখনকার তুলনায়",
    points: "পয়েন্ট",
    fewerHarvests:
      "এখনকার চেয়ে কম মৌসুমে ফসল: ফসল কম পাবেন। আয় এখনো এই তুলনায় ধরা হয়নি।",
    moreHarvests: "এখনকার চেয়ে বেশি মৌসুমে ফসল: বেশি শ্রম ও উপকরণ লাগবে।",
    tight:
      "সময় খুব কম: ফসল কাটার প্রায় সাথে সাথেই পরের ফসল লাগাতে হবে।",
    adoptionRegion:
      "চট্টগ্রাম অঞ্চলের {pct}% আবাদি জমিতে চাষ হয় ({n}টি উপজেলা, ২০১৪-১৫)।",
    adoptionNational:
      "চট্টগ্রাম অঞ্চলে লিপিবদ্ধ নয়; সারা দেশে {pct}% আবাদি জমিতে চাষ হয়।",
    inFeni: "ফেনীর যেসব উপজেলায় পাওয়া গেছে:",
    riceSeasons: "ধানের মৌসুম",
    pulse: "একটি ডাল ফসল আছে",
    details: "বিস্তারিত",
    hideDetails: "বিস্তারিত লুকান",
    calendarDates: "ক্যালেন্ডার যাচাইয়ে ব্যবহৃত মাঠের তারিখ",
    turnaround:
      "ফসল কাটা ও পরের ফসল লাগানোর মাঝে {n} দিন ধরা হয়েছে। এই সংখ্যাটি একটি অনুমান, কোনো উৎস থেকে নয়।",
    scoreParts: "স্কোরের অংশ (০–১০০, এখনকার তুলনায় পরিবর্তন)",
    indicator: {
      food_production_score: "খাদ্য",
      water_productivity_score: "পানি প্রতি খাদ্য",
      soil_health_score: "মাটি",
      climate_resilience_score: "জলবায়ু",
      crop_diversity_score: "বৈচিত্র্য",
    },
    provisional:
      "খাদ্য ও পানির হিসাব ফেনী জেলার ফলন (বিবিএস ২০২৪-২৫) ও FAO-এর পদ্ধতি থেকে। মাটি ও জলবায়ুর অংশ এখনো সাময়িক (হাতে-বসানো ফসলের মান)। খরচ ও আয় এখনো ধরা হয়নি।",
    foodProduced: "খাদ্য উৎপাদন",
    waterNeeded: "সেচের পানি লাগবে",
    riceEquivalent: "টন চালের সমান / হেক্টর / বছর",
    irrigationUnit: "মিমি / বছর",
    now: "এখন",
    withPlan: "এই পরিকল্পনায়",
    improvement: "দুই দিকেই ভালো",
    tradeOff: "কিছু ছাড় দিতে হবে",
    tradeOffs: {
      fewer_harvests: "এখনকার চেয়ে কম ফসল কাটা",
      less_food: "এখনকার চেয়ে কম খাদ্য",
      more_irrigation: "বেশি সেচের পানি লাগবে",
      fewer_rice_seasons: "এখনকার চেয়ে কম ধানের মৌসুম",
      tight_timing: "দুই ফসলের মাঝে সময় খুব কম",
    },
    perCrop: "ফসল অনুযায়ী (ফলন, সেচ)",
    endUse: {
      food_grain: "খাদ্যশস্য",
      pulse: "ডাল",
      oilseed: "তেলবীজ",
      feed: "মূলত পশুখাদ্য",
      condiment: "মসলা",
      tuber: "কন্দ",
      vegetable: "সবজি",
    },
    eatenByPeople: "{pct}% মানুষ খায়",
    endUseUnknown: "ব্যবহার জানা নেই",
    totalOutput:
      "পশুখাদ্য ও খৈলসহ মোট ফসল: {value} টন চালের সমান / হেক্টর / বছর",
    marketFlag:
      "এলাকায় কম চাষ হয় — বীজ, বাজার ও পরামর্শ পাওয়া কঠিন হতে পারে",
    marketFlagCrop: "{crop}: ফেনীতে প্রায় {area} হেক্টর",
    notInSurvey: "আঞ্চলিক ফসল জরিপে নেই",
    yieldFlag: "ফলনের হিসাব ফেনীর খুব ছোট এলাকা থেকে ({crop}: {area} হেক্টর) — সাবধানে দেখুন",
    notScoredEndUse:
      "র‍্যাংক করা হয়নি: বাংলাদেশে {crop}-এর কতটা মানুষ খায় তা এখনো জানা নেই",
    foodNote:
      "খাদ্য = ফেনীর গড় ফলন × খাদ্যশক্তি, একই খাদ্যশক্তির চালের টন হিসেবে দেখানো।",
    source: "উৎস",
    showMore: "আরও পরিকল্পনা দেখুন",
    showLess: "কম দেখান",
    otherTitle: "অঞ্চলে চাষ হওয়া অন্যান্য শস্য বিন্যাস",
    otherSubtitle:
      "এখনো র‍্যাংক করা হয়নি: ফসলের তথ্য নেই অথবা ক্যালেন্ডার যাচাইয়ে মেলেনি।",
    status: {
      feasible: "ফসল ক্যালেন্ডারে মেলে",
      tight: "সময় খুব কম",
      infeasible: "ফসল ক্যালেন্ডারে মেলে না",
      unverified: "ক্যালেন্ডার এখনো যাচাই হয়নি",
      notScored: "এখনো স্কোর নেই (ফসলের তথ্য নেই)",
    },
    conflict:
      "কৃষকেরা এই বিন্যাসে চাষ করেন, তাই আমাদের ক্যালেন্ডারের তথ্য সম্ভবত অসম্পূর্ণ।",
    noMatch: "আপনার নির্বাচিত ফসল দিয়ে কোনো পরিকল্পনা নেই।",
  },

  climate: {
    eyebrow: "নাসার ৪০ বছরের তথ্য",
    title: "আপনার জলবায়ু কি বদলেছে?",
    subtitle:
      "১৯৮৪ থেকে {upazila}-এর জন্য নাসা পাওয়ার (NASA POWER) কী দেখায়, আর তা বিএমডি-র ফেনী আবহাওয়া কেন্দ্রের সাথে কতটা মেলে।",
    upazila: "উপজেলা",
    indicator: {
      tx90p_mar_may: "মার্চ–মে মাসে অস্বাভাবিক গরম দিন",
      tx90p_boro_flowering: "বোরোর ফুল আসার সময় অস্বাভাবিক গরম দিন (১২–১৮ মার্চ)",
      tmax_mean_mar_may_bc: "মার্চ–মে মাসে দিনের গড় তাপমাত্রা",
      hot_days_mar_may_bc: "মার্চ–মে মাসে ৩৫ °সে বা বেশি গরম দিন (সংশোধিত)",
      hot_days_mar_may_raw: "মার্চ–মে মাসে ৩৫ °সে বা বেশি গরম দিন (নাসা, অসংশোধিত)",
      hot_days_boro_flowering_bc: "বোরোর ফুল আসার সময় ৩৫ °সে বা বেশি গরম দিন (সংশোধিত)",
      hot_days_boro_flowering_raw: "বোরোর ফুল আসার সময় ৩৫ °সে বা বেশি গরম দিন (নাসা, অসংশোধিত)",
      extreme_rain_days: "খুব ভারী বৃষ্টির দিন (৫০ মিমি বা বেশি)",
      annual_rain_mm: "বছরে বৃষ্টি",
      annual_rain_mm_power: "বছরে বৃষ্টি (নাসা পাওয়ার, তুলনার জন্য)",
      kharif_rain_mm: "খরিফ মৌসুমের বৃষ্টি (মার্চ–অক্টোবর)",
      rabi_rain_mm: "রবি মৌসুমের বৃষ্টি (নভেম্বর–ফেব্রুয়ারি)",
      annual_et0_mm: "বছরে বাতাসের পানি চাহিদা (ET0)",
      longest_dry_spell_kharif1: "খরিফ-১ মৌসুমে সবচেয়ে লম্বা শুকনো সময়",
      rainy_season_onset_doy: "বর্ষা শুরুর সময়",
      rainy_season_withdrawal_doy: "বর্ষা শেষের সময়",
      rainy_season_length_days: "বর্ষার দৈর্ঘ্য",
    },
    unit: { days: "দিন", mm: "মিমি", "day of year": "দিন", C: "°সে" },
    hotDayHint:
      "\"অস্বাভাবিক গরম\" = ১৯৯৮–২০১০ সালে বছরের ওই সময়ের ১০ দিনের ৯ দিনের চেয়ে বেশি গরম।",
    gridGpm:
      "বৃষ্টি প্রতিটি উপজেলার জন্য আলাদা মাপা (নাসা জিপিএম, প্রায় ১০ কিমি)। তাপমাত্রা পুরো ফেনীর জন্য নাসার একটি গ্রিড ঘর থেকে, তাই গরমের চার্ট সব উপজেলায় একই।",
    gridPower:
      "বৃষ্টি ও তাপমাত্রা দুটোই পুরো ফেনীর জন্য নাসার একটি গ্রিড ঘর থেকে, তাই সব উপজেলায় একই চার্ট দেখায়।",
    gpmSeries: "নাসা জিপিএম",
    biasTitle: "বিএমডি ফেনী কেন্দ্রের সাথে তাপমাত্রা সংশোধন",
    biasIntro:
      "নাসা পাওয়ারের দিনের তাপমাত্রা কেন্দ্রের চেয়ে কম। প্রতি মাসে গড় পার্থক্য যোগ করা হয়েছে; নিচের যাচাইয়ে এক বছর শুধু অন্য বছরের তথ্য দিয়ে সংশোধন করা হয়েছে।",
    biasHeld: "যাচাইয়ের বছর",
    biasBefore: "আগে পার্থক্য (°সে)",
    biasAfter: "পরে পার্থক্য (°সে)",
    biasMonth: "মাস",
    biasOffset: "যোগ করা (°সে)",
    rose: "বেড়েছে",
    fell: "কমেছে",
    sentenceTrend:
      "নাসার তথ্যে {year} থেকে {label} প্রতি দশকে {value} {unit} {verb}।",
    sentenceStep:
      "নাসার তথ্যে {label} {year} সালের দিকে হঠাৎ বদলেছে (গড় {before} → {after} {unit})। এটা ধীরে ধীরে বদলানো নয়, তথ্যের পরিবর্তন বলে মনে হয়, তাই আমরা একে প্রবণতা বলছি না।",
    sentenceNone:
      "{label}: {year} থেকে স্পষ্ট কোনো পরিবর্তন নেই — পরিসংখ্যানগতভাবে উল্লেখযোগ্য নয়।",
    caveatGauge:
      "সাবধান: নাসার এই তথ্য বিএমডি-র ফেনী আবহাওয়া কেন্দ্রের সাথে মেলে না, তাই এটি অনিশ্চিত।",
    notSignificantBadge: "উল্লেখযোগ্য নয়",
    trendBadge: "প্রবণতা (নাসা)",
    stepBadge: "তথ্যে ছেদ, প্রবণতা নয়",
    gaugeSeries: "বিএমডি ফেনী বৃষ্টিমাপক",
    nasaSeries: "নাসা পাওয়ার",
    details: "পরিসংখ্যান ও তথ্য যাচাই",
    hideDetails: "পরিসংখ্যান লুকান",
    table: {
      indicator: "সূচক",
      years: "বছর",
      slope: "প্রতি দশকে পরিবর্তন",
      p: "p (ম্যান-কেন্ডাল)",
      breakYear: "ছেদের বছর (p, পেটিট)",
      afterBreak: "ছেদের পরে: প্রতি দশকে পরিবর্তন (p)",
      status: "অবস্থা",
      gauge: "কেন্দ্রের সাথে মিল",
    },
    gaugeTitle: "নাসা পাওয়ার বনাম বিএমডি ফেনী কেন্দ্র (বছরে বৃষ্টি, মিমি)",
    adviceTitle: "আপনার ফসলের জন্য এর অর্থ",
    adviceIntro:
      "শুধু যেসব পরিবর্তন প্রবণতার পরীক্ষায় টিকেছে সেগুলো এখানে নেওয়া হয়েছে, কেন্দ্রের সাথে মিল দেখানো আছে।",
    adviceThreat: "এটা সত্যি হলে আপনার এখনকার বিন্যাসে {crops}-এর ঝুঁকি বাড়ে।",
    adviceBenefit: "এটা সত্যি হলে {crops}-এর ঝুঁকি কমে।",
    adviceBenefitWater: "এটা সত্যি হলে ফসলে একটু কম সেচ লাগবে।",
    adviceWater: "এটা সত্যি হলে আপনার বিন্যাসে বেশি সেচ লাগবে।",
    betterPatterns: "কম ঝুঁকির বিন্যাস:",
    noBetter: "সুপারিশ করা কোনো বিন্যাস এই ঝুঁকি কমায় না।",
    noAdvice: "নাসার তথ্যের কোনো পরিবর্তন প্রবণতার পরীক্ষায় টেকেনি, তাই এখনো জলবায়ু পরামর্শ নেই।",
    hazard: {
      heat_mar_may: "মার্চ–মে মাসে বেশি গরম দিন",
      heat_boro_flowering: "বোরোর ফুল আসার সময় বেশি গরম",
      heavy_rain: "বেশি খুব ভারী বৃষ্টির দিন",
      wetter_monsoon: "বছরে বেশি বৃষ্টি",
      kharif1_dry_spell: "খরিফ-১-এ লম্বা শুকনো সময়",
      drier_rabi: "রবি মৌসুমে কম বৃষ্টি",
      higher_water_demand: "ফসলের বেশি পানি চাহিদা",
      late_onset: "দেরিতে বর্ষা শুরু",
      early_withdrawal: "আগে বর্ষা শেষ",
    },
    hazardReverse: {
      heat_mar_may: "মার্চ–মে মাসে কম গরম দিন",
      heat_boro_flowering: "বোরোর ফুল আসার সময় কম গরম",
      heavy_rain: "কম খুব ভারী বৃষ্টির দিন",
      wetter_monsoon: "বছরে কম বৃষ্টি",
      kharif1_dry_spell: "খরিফ-১-এ ছোট শুকনো সময়",
      drier_rabi: "রবি মৌসুমে বেশি বৃষ্টি",
      higher_water_demand: "ফসলের কম পানি চাহিদা",
      late_onset: "আগে বর্ষা শুরু",
      early_withdrawal: "দেরিতে বর্ষা শেষ",
    },
  },

  notice: {
    title: "Decision-support তথ্য",

    description:
      "FIELD SHIFT crop-rotation scenario তুলনা করতে সাহায্য করে। এর score yield, profit বা farm performance-এর নিশ্চয়তা নয়।",
  },

  technical: {
    title: "Technical details",

    description:
      "FIELD SHIFT একটি local offline database ব্যবহার করে যেখানে NASA-derived environmental features, soil information এবং evaluated crop-rotation scenarios রয়েছে। Recommendation score একটি decision-support score; এটি সরাসরি yield, profit বা irrigation cost-এর prediction নয়।",

    runtime: "Runtime",
    offline: "Offline",

    scenarios: "Scenarios",

    internet: "Internet",
    notRequired: "প্রয়োজন নেই",
  },
};

export default bn;