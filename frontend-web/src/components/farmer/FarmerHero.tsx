import { ArrowRight, Satellite, Sprout } from "lucide-react";

import fieldHero from "../../assets/field-hero.jpg";
import fieldHeroSmall from "../../assets/field-hero-1200.jpg";

/*
 * The hero keeps the old page's concept: one photograph with the
 * type laid over it. The copy is verbatim and stays in English in
 * both languages, so the block declares its own language.
 */
export default function FarmerHero() {
  return (
    <section className="fs-hero" aria-labelledby="hero-title" lang="en">
      <img
        className="fs-hero-photo"
        src={fieldHero}
        srcSet={`${fieldHeroSmall} 1200w, ${fieldHero} 2000w`}
        sizes="(min-width: 1180px) 1180px, 100vw"
        width={2000}
        height={1125}
        alt="Agricultural field"
        fetchPriority="high"
        decoding="async"
      />

      <div className="fs-hero-scrim" aria-hidden="true" />

      <div className="fs-hero-head">
        <p className="fs-hero-kicker">NASA Earth observations + local data</p>

        <h1 id="hero-title" className="fs-hero-title">
          Your field is shifting.
          <span className="fs-hero-title-accent">Plan with confidence.</span>
        </h1>
      </div>

      <div className="fs-hero-body">
        <p className="fs-hero-lede">
          Explore crop rotations using NASA Earth observations, soil
          information, crop characteristics and your farming priorities.
        </p>

        <div className="fs-hero-actions">
          <a className="fs-hero-action" href="#recommendations">
            <Sprout size={17} strokeWidth={2} aria-hidden="true" />
            Explore rotation
            <ArrowRight
              className="fs-hero-action-arrow"
              size={16}
              strokeWidth={2}
              aria-hidden="true"
            />
          </a>

          <a
            className="fs-hero-action fs-hero-action-quiet"
            href="#earth-observations"
          >
            <Satellite size={16} strokeWidth={2} aria-hidden="true" />
            View NASA data
          </a>
        </div>
      </div>
    </section>
  );
}
