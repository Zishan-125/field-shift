import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        space: {
          DEFAULT: "var(--bg-deep-space)",
          panel: "var(--surface-panel-solid)",
          border: "var(--surface-panel-border)",
        },
        signal: {
          cyan: "var(--accent-cyan)",
          emerald: "var(--accent-emerald)",
          amber: "var(--accent-amber)",
          crimson: "var(--accent-crimson)",
          violet: "var(--accent-violet)",
        },
        ink: {
          primary: "var(--text-primary)",
          muted: "var(--text-muted)",
        },
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      backdropBlur: {
        panel: "12px",
      },
      boxShadow: {
        "glow-cyan": "0 0 0 1px rgba(0,242,254,0.25), 0 0 24px rgba(0,242,254,0.18)",
        "glow-emerald": "0 0 0 1px rgba(16,185,129,0.25), 0 0 24px rgba(16,185,129,0.18)",
        "glow-amber": "0 0 0 1px rgba(245,158,11,0.25), 0 0 24px rgba(245,158,11,0.18)",
        "glow-crimson": "0 0 0 1px rgba(239,68,68,0.25), 0 0 24px rgba(239,68,68,0.18)",
        "glow-violet": "0 0 0 1px rgba(139,92,246,0.25), 0 0 24px rgba(139,92,246,0.18)",
        panel: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 8px 30px rgba(0,0,0,0.35)",
      },
      keyframes: {
        "pulse-ring": {
          "0%": { opacity: "0.6", transform: "scale(0.94)" },
          "70%": { opacity: "0", transform: "scale(1.35)" },
          "100%": { opacity: "0", transform: "scale(1.35)" },
        },
        "sweep": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        "skeleton-pulse": {
          "0%, 100%": { opacity: "0.45" },
          "50%": { opacity: "0.85" },
        },
      },
      animation: {
        "pulse-ring": "pulse-ring 2.2s cubic-bezier(0.2,0.6,0.4,1) infinite",
        "sweep": "sweep 1.8s ease-in-out infinite",
        "skeleton-pulse": "skeleton-pulse 1.6s ease-in-out infinite",
      },
      transitionDuration: {
        DEFAULT: "180ms",
      },
    },
  },
  plugins: [],
} satisfies Config;
