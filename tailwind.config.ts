import type { Config } from "tailwindcss";

// ============================================================================
// DESIGN SYSTEM — light, clean, productive.
//
// A soft off-white canvas with pure-white cards, a calm neutral ramp, and a
// single green brand colour reserved for primary actions and active state.
// Semantic hues (rose / amber / emerald / sky …) appear only to signal status.
//
// To re-skin the whole app, change the `brand` ramp below and the `--brand`
// variable in globals.css. Nothing else needs to move.
// ============================================================================

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Text",
          "Segoe UI",
          "system-ui",
          "sans-serif",
        ],
        mono: ["SF Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      colors: {
        // Canvas / surface tokens (light).
        canvas: {
          DEFAULT: "#f7f8fa", // page background
          raised: "#ffffff", // cards, sidebar, modals
          sunken: "#f1f3f7", // board columns, inset wells
        },

        // Brand — green. Balanced for white text at 500 and above.
        brand: {
          50: "#f0fdf4",
          100: "#dcfce7",
          200: "#bbf7d0",
          300: "#86efac",
          400: "#4ade80",
          500: "#2d7c5a",
          600: "#259651",
          700: "#1b7f43",
          800: "#165e3b",
          900: "#134e31",
        },

        // Neutral ramp (standard direction: 50 = lightest, 900 = darkest text).
        slate: {
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a",
        },

        // Semantic hues — 50/100 for chip fills, 600/700/800 for chip text.
        rose: { 50: "#fff1f2", 100: "#ffe4e6", 200: "#fecdd3", 300: "#fda4af", 500: "#f43f5e", 600: "#e11d48", 700: "#be123c", 800: "#9f1239" },
        emerald: { 50: "#ecfdf5", 100: "#d1fae5", 200: "#a7f3d0", 500: "#10b981", 600: "#059669", 700: "#047857", 800: "#065f46" },
        amber: { 50: "#fffbeb", 100: "#fef3c7", 200: "#fde68a", 300: "#fcd34d", 500: "#f59e0b", 600: "#d97706", 700: "#b45309", 800: "#92400e" },
        sky: { 50: "#f0f9ff", 100: "#e0f2fe", 200: "#bae6fd", 500: "#0ea5e9", 600: "#0284c7", 700: "#0369a1", 800: "#075985" },
        violet: { 50: "#f5f3ff", 100: "#ede9fe", 200: "#ddd6fe", 500: "#8b5cf6", 600: "#7c3aed", 700: "#6d28d9", 800: "#5b21b6" },
        fuchsia: { 50: "#fdf4ff", 100: "#fae8ff", 200: "#f5d0fe", 500: "#d946ef", 600: "#c026d3", 700: "#a21caf", 800: "#86198f" },
        indigo: { 50: "#eef2ff", 100: "#e0e7ff", 200: "#c7d2fe", 500: "#6366f1", 600: "#4f46e5", 700: "#4338ca", 800: "#3730a3" },
        orange: { 50: "#fff7ed", 100: "#ffedd5", 200: "#fed7aa", 500: "#f97316", 600: "#ea580c", 700: "#c2410c", 800: "#9a3412" },
        teal: { 50: "#f0fdfa", 100: "#ccfbf1", 500: "#14b8a6", 600: "#0d9488", 700: "#0f766e", 800: "#115e59" },
      },
      borderRadius: {
        xl: "0.75rem",
        "2xl": "1rem",
        "3xl": "1.375rem",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(15,23,42,0.04), 0 1px 3px rgba(15,23,42,0.06)",
        lift: "0 12px 32px rgba(15,23,42,0.10), 0 2px 8px rgba(15,23,42,0.06)",
        glow: "0 0 0 3px rgba(45,124,90,0.16)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.98)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        shimmer: { "100%": { transform: "translateX(100%)" } },
      },
      animation: {
        "fade-in": "fade-in 0.35s cubic-bezier(0.22,1,0.36,1) both",
        "scale-in": "scale-in 0.2s cubic-bezier(0.22,1,0.36,1) both",
      },
    },
  },
  plugins: [],
};
export default config;
