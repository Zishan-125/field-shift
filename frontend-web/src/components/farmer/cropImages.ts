/**
 * The eight crop photographs that ship with FIELD SHIFT.
 *
 * Kept in one place so the crop picker and the rotation ledger
 * always show the same picture for the same crop.
 */
const cropImages: Record<string, string> = {
  "aman rice": new URL("../../assets/aman.jpg", import.meta.url).href,
  "aus rice": new URL("../../assets/aus.jpg", import.meta.url).href,
  "boro rice": new URL("../../assets/boro.jpg", import.meta.url).href,
  maize: new URL("../../assets/maize.jpg", import.meta.url).href,
  lentil: new URL("../../assets/lentil.jpg", import.meta.url).href,
  mungbean: new URL("../../assets/mungbean.jpg", import.meta.url).href,
  mustard: new URL("../../assets/mustard.jpg", import.meta.url).href,
  wheat: new URL("../../assets/wheat.jpg", import.meta.url).href,
};

export function getCropImage(englishName: string): string | undefined {
  const key = englishName
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, " ");

  return cropImages[key];
}

export default cropImages;
