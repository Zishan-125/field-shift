import { useMemo, useState } from "react";

import type {
  NormalizedCrop,
} from "../../types/crop";

import {
  getBanglaCropName,
  getCropIcon,
} from "../../types/crop";

import bn from "../../i18n/bn";
import en from "../../i18n/en";

interface CropSelectorProps {
  crops: NormalizedCrop[];
  selectedCrops: string[];
  onChange: (
    cropIds: string[],
  ) => void;
  language?: "bn" | "en";
}

const cropImages: Record<
  string,
  string
> = {
  "aman rice": new URL(
    "../../assets/aman.jpg",
    import.meta.url,
  ).href,

  "aus rice": new URL(
    "../../assets/aus.jpg",
    import.meta.url,
  ).href,

  "boro rice": new URL(
    "../../assets/boro.jpg",
    import.meta.url,
  ).href,

  maize: new URL(
    "../../assets/maize.jpg",
    import.meta.url,
  ).href,

  lentil: new URL(
    "../../assets/lentil.jpg",
    import.meta.url,
  ).href,

  mungbean: new URL(
    "../../assets/mungbean.jpg",
    import.meta.url,
  ).href,

  mustard: new URL(
    "../../assets/mustard.jpg",
    import.meta.url,
  ).href,

  wheat: new URL(
    "../../assets/wheat.jpg",
    import.meta.url,
  ).href,
};

function getCropImage(
  englishName: string,
): string | undefined {
  const key = englishName
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, " ");

  return cropImages[key];
}

export default function CropSelector({
  crops,
  selectedCrops,
  onChange,
  language = "bn",
}: CropSelectorProps) {
  const t =
    language === "bn" ? bn : en;

  const cropText = {
    eyebrow:
      language === "bn"
        ? "ফসল নির্বাচন"
        : "Crop selection",

    title: t.crops.title,

    subtitle:
      t.crops.subtitle,

    selected:
      t.crops.selected,

    maximum:
      t.crops.maximum,

    searchPlaceholder:
      t.crops.searchPlaceholder,

    clear:
      t.crops.clear,

    limitReached:
      t.crops.limitReached,

    noResults:
      "noResults" in t.crops
        ? t.crops.noResults
        : language === "bn"
          ? "কোনো ফসল পাওয়া যায়নি।"
          : "No crops found.",

    selectAtLeastOne:
      "selectAtLeastOne" in
      t.crops
        ? t.crops.selectAtLeastOne
        : "chooseAtLeastOne" in
            t.crops
          ? t.crops
              .chooseAtLeastOne
          : language === "bn"
            ? "অন্তত একটি ফসল নির্বাচন করুন।"
            : "Please select at least one crop.",

    crop:
      language === "bn"
        ? "ফসল"
        : "Crop",
  };

  const [search, setSearch] =
    useState("");

  const preparedCrops =
    useMemo(() => {
      return crops.map(
        (crop) => ({
          ...crop,

          banglaName:
            crop.banglaName &&
            crop.banglaName !==
              crop.englishName
              ? crop.banglaName
              : getBanglaCropName(
                  crop.englishName,
                ),

          icon:
            crop.icon &&
            crop.icon !== "🌱"
              ? crop.icon
              : getCropIcon(
                  crop.englishName,
                ),
        }),
      );
    }, [crops]);

  const filteredCrops =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      if (!query) {
        return preparedCrops;
      }

      return preparedCrops.filter(
        (crop) =>
          crop.englishName
            .toLowerCase()
            .includes(query) ||
          crop.banglaName
            .toLowerCase()
            .includes(query),
      );
    }, [
      preparedCrops,
      search,
    ]);

  function toggleCrop(
    cropId: string,
  ) {
    if (
      selectedCrops.includes(
        cropId,
      )
    ) {
      onChange(
        selectedCrops.filter(
          (id) =>
            id !== cropId,
        ),
      );

      return;
    }

    if (
      selectedCrops.length >= 5
    ) {
      return;
    }

    onChange([
      ...selectedCrops,
      cropId,
    ]);
  }

  return (
    <section className="fs-crop-section">
      <div className="fs-section-heading-row">
        <div>
          <p className="fs-eyebrow">
            {cropText.eyebrow}
          </p>

          <h2 className="fs-section-title">
            {cropText.title}
          </h2>

          <p className="fs-section-description">
            {cropText.subtitle}
          </p>
        </div>

        <div className="fs-selection-counter">
          <strong>
            {selectedCrops.length}
            <span>/5</span>
          </strong>

          <small>
            {cropText.selected}
          </small>
        </div>
      </div>

      <div className="fs-crop-toolbar">
        <div className="fs-search-box">
          <span>⌕</span>

          <input
            type="text"
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value,
              )
            }
            placeholder={
              cropText.searchPlaceholder
            }
          />
        </div>

        {selectedCrops.length >
          0 && (
          <button
            type="button"
            onClick={() =>
              onChange([])
            }
            className="fs-clear-button"
          >
            {cropText.clear}
          </button>
        )}
      </div>

      {selectedCrops.length >=
        5 && (
        <div className="fs-crop-limit">
          {cropText.limitReached}
        </div>
      )}

      <div className="fs-crop-grid">
        {filteredCrops.map(
          (crop) => {
            const selected =
              selectedCrops.includes(
                crop.id,
              );

            const disabled =
              !selected &&
              selectedCrops.length >=
                5;

            const banglaName =
              getBanglaCropName(
                crop.englishName,
              );

            const icon =
              getCropIcon(
                crop.englishName,
              );

            const image =
              getCropImage(
                crop.englishName,
              );

            return (
              <button
                key={crop.id}
                type="button"
                onClick={() =>
                  toggleCrop(
                    crop.id,
                  )
                }
                disabled={disabled}
                aria-pressed={
                  selected
                }
                className={[
                  "fs-crop-card",
                  selected
                    ? "selected"
                    : "",
                  disabled
                    ? "disabled"
                    : "",
                ].join(" ")}
              >
                <div className="fs-crop-image">
                  {image ? (
                    <img
                      src={image}
                      alt={
                        crop.englishName
                      }
                    />
                  ) : (
                    <span>
                      {icon}
                    </span>
                  )}

                  <div className="fs-crop-image-overlay" />

                  {selected && (
                    <span className="fs-crop-check">
                      ✓
                    </span>
                  )}
                </div>

                <div className="fs-crop-card-body">
                  <p>
                    {language === "bn"
                      ? banglaName
                      : crop.englishName}
                  </p>

                  <span>
                    {language === "bn"
                      ? crop.englishName
                      : banglaName}
                  </span>

                  <div className="fs-crop-card-footer">
                    <span>
                      {cropText.crop}
                    </span>

                    <span>
                      →
                    </span>
                  </div>
                </div>
              </button>
            );
          },
        )}
      </div>

      {filteredCrops.length ===
        0 && (
        <div className="fs-empty-state">
          <div>🌱</div>

          <p>
            {cropText.noResults}
          </p>
        </div>
      )}
    </section>
  );
}