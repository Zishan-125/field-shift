import { useMemo, useState } from "react";

import { Sprout } from "lucide-react";

import type { NormalizedCrop } from "../../types/crop";

import { getBanglaCropName } from "../../types/crop";

import { getCropImage } from "./cropImages";

import bn from "../../i18n/bn";
import en from "../../i18n/en";

interface CropSelectorProps {
  crops: NormalizedCrop[];
  selectedCrops: string[];
  onChange: (cropIds: string[]) => void;
  language?: "bn" | "en";
}

export default function CropSelector({
  crops,
  selectedCrops,
  onChange,
  language = "bn",
}: CropSelectorProps) {
  const t = language === "bn" ? bn : en;

  const noResults =
    "noResults" in t.crops
      ? t.crops.noResults
      : language === "bn"
        ? "কোনো ফসল পাওয়া যায়নি।"
        : "No crops found.";

  const [search, setSearch] = useState("");

  const preparedCrops = useMemo(() => {
    return crops.map((crop) => ({
      ...crop,

      banglaName:
        crop.banglaName && crop.banglaName !== crop.englishName
          ? crop.banglaName
          : getBanglaCropName(crop.englishName),
    }));
  }, [crops]);

  const filteredCrops = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return preparedCrops;
    }

    return preparedCrops.filter(
      (crop) =>
        crop.englishName.toLowerCase().includes(query) ||
        crop.banglaName.toLowerCase().includes(query),
    );
  }, [preparedCrops, search]);

  function toggleCrop(cropId: string) {
    if (selectedCrops.includes(cropId)) {
      onChange(selectedCrops.filter((id) => id !== cropId));

      return;
    }

    if (selectedCrops.length >= 5) {
      return;
    }

    onChange([...selectedCrops, cropId]);
  }

  return (
    <section className="fs-panel-block" aria-labelledby="crops-title">
      <div className="fs-panel-head">
        <div>
          <h2 id="crops-title" className="fs-panel-title">
            {t.crops.title}
          </h2>

          <p className="fs-panel-sub">{t.crops.subtitle}</p>
        </div>

        <span className="fs-counter" aria-live="polite">
          {selectedCrops.length}/5
        </span>
      </div>

      <input
        className="fs-input"
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={t.crops.searchPlaceholder}
        aria-label={t.crops.searchPlaceholder}
      />

      {selectedCrops.length >= 5 ? (
        <p className="fs-hint">{t.crops.limitReached}</p>
      ) : null}

      {selectedCrops.length > 0 ? (
        <button
          type="button"
          className="fs-link-button"
          onClick={() => onChange([])}
        >
          {t.crops.clear}
        </button>
      ) : null}

      <div className="fs-crops">
        {filteredCrops.map((crop) => {
          const selected = selectedCrops.includes(crop.id);

          const disabled = !selected && selectedCrops.length >= 5;

          const banglaName = getBanglaCropName(crop.englishName);

          const primary =
            language === "bn" ? banglaName : crop.englishName;

          const secondary =
            language === "bn" ? crop.englishName : banglaName;

          const image = getCropImage(crop.englishName);

          return (
            <button
              key={crop.id}
              type="button"
              onClick={() => toggleCrop(crop.id)}
              disabled={disabled}
              aria-pressed={selected}
              className="fs-crop"
            >
              {image ? (
                <img
                  className="fs-crop-thumb"
                  src={image}
                  alt=""
                  width={34}
                  height={34}
                  loading="lazy"
                />
              ) : (
                <span
                  className="fs-crop-thumb"
                  data-empty="true"
                  aria-hidden="true"
                >
                  <Sprout size={15} strokeWidth={2} />
                </span>
              )}

              <span className="fs-crop-text">
                <span className="fs-crop-name">{primary}</span>

                {secondary && secondary !== primary ? (
                  <span className="fs-crop-sub">{secondary}</span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>

      {filteredCrops.length === 0 ? (
        <p className="fs-empty-line">{noResults}</p>
      ) : null}
    </section>
  );
}
