import type { SoilProfile } from "../../types/soil";

interface Props {
  soil: SoilProfile;
  language?: "bn" | "en";
}

function numberValue(soil: SoilProfile, keys: string[]): number | null {
  for (const key of keys) {
    const raw = soil[key];

    if (raw === null || raw === undefined || raw === "") continue;

    const value = Number(raw);

    if (Number.isFinite(value)) return value;
  }

  return null;
}

function format(value: number | null, digits = 2): string {
  return value === null ? "—" : value.toFixed(digits);
}

export default function FarmerSoilView({ soil, language = "bn" }: Props) {
  const ph = numberValue(soil, ["soil_topsoil_ph", "soil_ph_0-5cm", "ph"]);

  const organicCarbon = numberValue(soil, [
    "soil_topsoil_organic_carbon",
    "soil_organic_carbon_0-5cm",
    "organic_carbon",
    "soil_organic_carbon",
  ]);

  const clay = numberValue(soil, [
    "soil_topsoil_clay",
    "soil_clay_0-5cm",
    "clay",
  ]);

  const sand = numberValue(soil, [
    "soil_topsoil_sand",
    "soil_sand_0-5cm",
    "sand",
  ]);

  const silt = numberValue(soil, [
    "soil_topsoil_silt",
    "soil_silt_0-5cm",
    "silt",
  ]);

  const cec = numberValue(soil, [
    "soil_topsoil_cec",
    "soil_cec_0-5cm",
    "cec",
  ]);

  const nitrogen = numberValue(soil, [
    "soil_topsoil_nitrogen",
    "soil_nitrogen_0-5cm",
    "nitrogen",
  ]);

  const depth = numberValue(soil, ["soil_depth_cm", "depth_cm"]);

  const rawSoil = soil as Record<string, unknown>;

  const source = String(rawSoil.soil_source ?? rawSoil.source ?? "SoilGrids");

  const isModelled =
    String(rawSoil.soil_values_are_modelled_predictions ?? "true") === "true" ||
    source.toLowerCase().includes("soilgrids");

  const rows = [
    {
      label: "pH",
      value: ph,
      unit: "",
      digits: 2,
    },
    {
      label: language === "bn" ? "জৈব কার্বন" : "Organic carbon",
      value: organicCarbon,
      unit: "",
      digits: 2,
    },
    {
      label: language === "bn" ? "কাদা" : "Clay",
      value: clay,
      unit: "%",
      digits: 1,
    },
    {
      label: language === "bn" ? "বালি" : "Sand",
      value: sand,
      unit: "%",
      digits: 1,
    },
    {
      label: language === "bn" ? "পলি" : "Silt",
      value: silt,
      unit: "%",
      digits: 1,
    },
  ].filter((row) => row.value !== null);

  const extraRows = [
    {
      label: "CEC",
      value: cec === null ? "—" : format(cec),
      unit: "",
    },
    {
      label: language === "bn" ? "নাইট্রোজেন" : "Nitrogen",
      value: nitrogen === null ? "—" : format(nitrogen),
      unit: "",
    },
    {
      label: language === "bn" ? "গভীরতা" : "Depth",
      value: depth === null ? "—" : String(Math.round(depth)),
      unit: depth === null ? "" : "cm",
    },
  ].filter((row) => row.value !== "—");

  const hasValues = rows.length > 0 || extraRows.length > 0;

  return (
    <section aria-labelledby="soil-title">
      <div className="fs-head">
        <div>
          <h2 id="soil-title">
            {language === "bn" ? "আপনার মাটি কেমন?" : "What is your soil like?"}
          </h2>

          <p>
            {language === "bn"
              ? "মাঠের জন্য পাওয়া surface-soil বৈশিষ্ট্যগুলো সহজভাবে দেখানো হচ্ছে।"
              : "A simple view of the surface-soil properties available for this field."}
          </p>
        </div>

        <span className="fs-head-meta">{source}</span>
      </div>

      {!hasValues ? (
        <div className="fs-empty">
          <h3>
            {language === "bn"
              ? "এই মাঠের মাটির তথ্য এখনো পাওয়া যায়নি"
              : "No soil values are available for this field yet"}
          </h3>

          <p>
            {language === "bn"
              ? "মাটির তথ্য পাওয়া গেলে এখানে মান দেখানো হবে।"
              : "Values will appear here once soil data is available."}
          </p>
        </div>
      ) : (
        <>
          {rows.length > 0 ? (
            <dl className="fs-soil">
              {rows.map((row) => (
                <div key={row.label}>
                  <dt>{row.label}</dt>

                  <dd>
                    {format(row.value, row.digits)}

                    {row.unit ? <span>{row.unit}</span> : null}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="fs-empty-line">
              {language === "bn"
                ? "উপরের মাটির মান পাওয়া যায়নি; নিচের বিস্তারিত দেখুন।"
                : "Surface values are unavailable; see the details below."}
            </p>
          )}

          {extraRows.length > 0 ? (
            <details className="fs-subdetails">
              <summary>
                {language === "bn"
                  ? "আরও মাটির তথ্য দেখুন"
                  : "View more soil details"}
              </summary>

              <div className="fs-subdetails-body">
                <dl className="fs-soil">
                  {extraRows.map((row) => (
                    <div key={row.label}>
                      <dt>{row.label}</dt>

                      <dd>
                        {row.value}

                        {row.unit ? <span>{row.unit}</span> : null}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </details>
          ) : null}
        </>
      )}

      <p className="fs-note">
        <strong>
          {isModelled
            ? language === "bn"
              ? "এগুলো modelled soil estimates। "
              : "These are modelled soil estimates. "
            : language === "bn"
              ? `তথ্যের উৎস: ${source}। `
              : `Source: ${source}. `}
        </strong>

        {isModelled
          ? language === "bn"
            ? "SoilGrids-এর modelled estimates; মাঠে সরাসরি মাপা soil sample নয়। মাটির তথ্য rotation comparison-এর একটি অংশ; এটি crop-specific soil diagnosis নয়।"
            : "SoilGrids modelled estimates; they are not direct field-measured soil samples. Soil information is one part of rotation comparison; it is not a crop-specific soil diagnosis."
          : language === "bn"
            ? "মাটির তথ্য rotation comparison-এর একটি অংশ; এটি crop-specific soil diagnosis নয়।"
            : "Soil information is one part of rotation comparison; it is not a crop-specific soil diagnosis."}
      </p>
    </section>
  );
}
