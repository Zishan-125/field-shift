import type {
  ScheduledCrop,
  Season,
} from "../../types/pattern";

import bn from "../../i18n/bn";
import en from "../../i18n/en";

interface SeasonStripProps {
  schedule: ScheduledCrop[];
  language?: "bn" | "en";
  showMonths?: boolean;
}

const YEAR_DAYS = 365;

// The strip starts on 1 November (day of year 305), so the seasons appear
// in pattern order: Rabi, Kharif-1, Kharif-2.
const STRIP_ORIGIN_DOY = 305;

const SEASON_BANDS: {
  season: Season;
  days: number;
  className: string;
}[] = [
  { season: "rabi", days: 120, className: "bg-sky-50 text-sky-800" },
  { season: "kharif1", days: 122, className: "bg-amber-50 text-amber-800" },
  { season: "kharif2", days: 123, className: "bg-emerald-50 text-emerald-800" },
];

const CROP_COLORS: Record<string, string> = {
  rice_boro: "bg-emerald-600",
  rice_aus: "bg-lime-600",
  rice_aman: "bg-green-700",
  lentil: "bg-amber-600",
  mungbean: "bg-amber-500",
  grasspea: "bg-amber-700",
  felon: "bg-amber-800",
  mustard: "bg-yellow-500",
  wheat: "bg-orange-400",
  maize: "bg-orange-500",
  potato: "bg-stone-500",
  groundnut: "bg-orange-700",
  sesame: "bg-yellow-700",
  chili: "bg-red-600",
  vegetables: "bg-teal-600",
};

function stripPosition(doy: number): number {
  return ((doy - STRIP_ORIGIN_DOY + YEAR_DAYS) % YEAR_DAYS) / YEAR_DAYS;
}

/**
 * A crop's field period as one or two segments on the strip
 * (two when it crosses the end of October).
 */
function segments(crop: ScheduledCrop): [number, number][] {
  const start = stripPosition(crop.start_doy);
  const length = Math.min(crop.field_days, YEAR_DAYS) / YEAR_DAYS;
  const end = start + length;

  if (end <= 1) {
    return [[start, end]];
  }

  return [
    [start, 1],
    [0, end - 1],
  ];
}

export default function SeasonStrip({
  schedule,
  language = "bn",
  showMonths = true,
}: SeasonStripProps) {
  const t = language === "bn" ? bn.patterns : en.patterns;

  return (
    <div className="w-full">
      {/* Season bands */}
      <div className="flex overflow-hidden rounded-t-xl text-[10px] font-black sm:text-[11px]">
        {SEASON_BANDS.map((band) => (
          <div
            key={band.season}
            className={`${band.className} truncate px-1.5 py-1 text-center`}
            style={{ width: `${(band.days / YEAR_DAYS) * 100}%` }}
          >
            {t.seasons[band.season]}
          </div>
        ))}
      </div>

      {/* Crop bars */}
      <div className="relative h-9 overflow-hidden border-x border-slate-200 bg-slate-50">
        {SEASON_BANDS.slice(0, -1).map((band, index) => {
          const offset = SEASON_BANDS.slice(0, index + 1).reduce(
            (sum, item) => sum + item.days,
            0,
          );

          return (
            <div
              key={band.season}
              className="absolute inset-y-0 w-px bg-slate-200"
              style={{ left: `${(offset / YEAR_DAYS) * 100}%` }}
            />
          );
        })}

        {schedule.map((crop) =>
          segments(crop).map(([from, to], index) => (
            <div
              key={`${crop.crop_id}-${index}`}
              className={`${CROP_COLORS[crop.crop_id] ?? "bg-slate-500"} absolute inset-y-1.5 flex items-center overflow-hidden rounded-md px-1.5 text-[10px] font-black text-white shadow-sm sm:text-xs`}
              style={{
                left: `${from * 100}%`,
                width: `${(to - from) * 100}%`,
              }}
              title={`${language === "bn" ? crop.name_bn : crop.name_en}: ${crop.start} → ${crop.end}`}
            >
              <span className="truncate">
                {language === "bn" ? crop.name_bn : crop.name_en}
              </span>
            </div>
          )),
        )}
      </div>

      {/* Months */}
      {showMonths && (
        <div className="flex rounded-b-xl border border-t-0 border-slate-200 bg-white">
          {t.months.map((month) => (
            <div
              key={month}
              className="flex-1 truncate py-0.5 text-center text-[9px] font-bold text-slate-400 sm:text-[10px]"
            >
              {month}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
