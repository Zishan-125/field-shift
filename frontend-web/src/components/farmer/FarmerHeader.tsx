import {
  Bell,
  ChevronDown,
  Droplets,
  Leaf,
  MapPin,
  Menu,
  Satellite,
  Sprout,
  Sun,
  Waves,
} from "lucide-react";

import fieldImage from "../../assets/field.jpg";

import OfflineStatus from "../OfflineStatus";

interface FarmerHeaderProps {
  backendAvailable?: boolean;
  farmerName?: string;
  fieldName?: string;
  [key: string]: unknown;
}

export default function FarmerHeader({
  backendAvailable = true,
  farmerName = "Farmer",
  fieldName = "Your field",
}: FarmerHeaderProps) {
  const firstName =
    farmerName.trim().split(/\s+/)[0] || "Farmer";

  return (
    <>
      {/* =====================================================
          DESKTOP / WEB HEADER
      ====================================================== */}
      <header className="fs-dashboard-header">
        <div className="fs-header-inner">
          {/* Brand */}
          <div className="fs-brand">
            <div className="fs-brand-mark">
              <Leaf
                size={25}
                strokeWidth={2.2}
              />
            </div>

            <div>
              <div className="fs-brand-name">
                Field Shift
              </div>

              <div className="fs-brand-subtitle">
                Adapting Farms with NASA Data
              </div>
            </div>
          </div>

          {/* NASA message */}
          <div className="fs-header-center">
            <div className="fs-nasa-badge">
              <Satellite size={17} />

              <div>
                <strong>
                  NASA Space Apps Challenge 2026
                </strong>

                <span>
                  Real Earth data&nbsp;&nbsp; + &nbsp;&nbsp;
                  Local knowledge&nbsp;&nbsp; + &nbsp;&nbsp;
                  Farmer priorities
                </span>
              </div>
            </div>
          </div>

          {/* User controls */}
          <div className="fs-header-actions">
            <button
              type="button"
              className="fs-icon-button"
              aria-label="Notifications"
            >
              <Bell size={18} />

              <span className="fs-notification-dot" />
            </button>

            <div className="fs-user-avatar">
              {firstName.charAt(0).toUpperCase()}
            </div>

            <div className="fs-user-copy">
              <strong>{firstName}</strong>

              <span>
                Farm owner
              </span>
            </div>

            <ChevronDown
              size={16}
              className="fs-user-chevron"
            />
          </div>
        </div>
      </header>

      {/* =====================================================
          HERO / FIELD OVERVIEW
      ====================================================== */}
      <section className="fs-hero-wrap">
        <div className="fs-hero">
          {/* Image */}
          <img
            src={fieldImage}
            alt="Agricultural field"
            className="fs-hero-image"
          />

          <div className="fs-hero-overlay" />

          {/* Hero content */}
          <div className="fs-hero-content">
            <div className="fs-hero-topline">
              <span className="fs-hero-location">
                <MapPin size={14} />

                {fieldName}
              </span>

              <span className="fs-live-pill">
                <span />
                Live field view
              </span>
            </div>

            <div className="fs-hero-copy">
              <div className="fs-hero-eyebrow">
                NASA EARTH OBSERVATIONS + LOCAL DATA
              </div>

              <h1>
                Your field is shifting.
                <br />
                <span>
                  Plan with confidence.
                </span>
              </h1>

              <p>
                Explore crop rotations using NASA
                Earth observations, soil information,
                crop characteristics and your farming
                priorities.
              </p>

              <div className="fs-hero-buttons">
                <button
                  type="button"
                  className="fs-hero-primary"
                  onClick={() =>
                    document
                      .getElementById(
                        "recommendations",
                      )
                      ?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      })
                  }
                >
                  <Sprout size={17} />

                  Explore rotation

                  <span>→</span>
                </button>

                <button
                  type="button"
                  className="fs-hero-secondary"
                  onClick={() =>
                    document
                      .getElementById(
                        "earth-observations",
                      )
                      ?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      })
                  }
                >
                  <Satellite size={16} />

                  View NASA data
                </button>
              </div>
            </div>

            {/* Hero field metrics */}
            <div className="fs-hero-metrics">
              <div className="fs-hero-metric">
                <div className="fs-hero-metric-icon temperature">
                  <Sun size={17} />
                </div>

                <div>
                  <span>Climate</span>

                  <strong>
                    NASA monitored
                  </strong>
                </div>
              </div>

              <div className="fs-hero-metric">
                <div className="fs-hero-metric-icon water">
                  <Droplets size={17} />
                </div>

                <div>
                  <span>Water</span>

                  <strong>
                    Conservation ready
                  </strong>
                </div>
              </div>

              <div className="fs-hero-metric">
                <div className="fs-hero-metric-icon soil">
                  <Leaf size={17} />
                </div>

                <div>
                  <span>Soil</span>

                  <strong>
                    Health monitored
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Hero supporting strip */}
        <div className="fs-hero-strip">
          <div className="fs-hero-strip-item">
            <Satellite size={18} />

            <div>
              <strong>
                NASA Earth data
              </strong>

              <span>
                Weather, vegetation & land surface
              </span>
            </div>
          </div>

          <div className="fs-hero-strip-divider" />

          <div className="fs-hero-strip-item">
            <Waves size={18} />

            <div>
              <strong>
                Water efficiency
              </strong>

              <span>
                Compare water-aware crop rotations
              </span>
            </div>
          </div>

          <div className="fs-hero-strip-divider" />

          <div className="fs-hero-strip-item">
            <Sprout size={18} />

            <div>
              <strong>
                Resilient farming
              </strong>

              <span>
                Decisions built around your priorities
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Existing connection status */}
      <div className="fs-status-holder">
        <OfflineStatus
          backendAvailable={
            backendAvailable
          }
        />
      </div>

      {/* =====================================================
          MOBILE HEADER
      ====================================================== */}
      <div className="fs-mobile-header">
        <div className="fs-mobile-brand">
          <div className="fs-brand-mark">
            <Leaf size={21} />
          </div>

          <div>
            <strong>
              Field Shift
            </strong>

            <span>
              {fieldName}
            </span>
          </div>
        </div>

        <div className="fs-mobile-actions">
          <button
            type="button"
            className="fs-icon-button"
            aria-label="Menu"
          >
            <Menu size={20} />
          </button>
        </div>
      </div>
    </>
  );
}