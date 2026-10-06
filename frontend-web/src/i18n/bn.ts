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