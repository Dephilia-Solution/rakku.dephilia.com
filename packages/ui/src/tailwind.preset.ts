import type { Config } from "tailwindcss";

export const rakkuPreset: Partial<Config> = {
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#0d631b",
          container: "#2e7d32",
          fixed: "#a3f69c",
          "fixed-dim": "#88d982",
          50: "#f0fdf4",
          100: "#dcfce7",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
          800: "#166534",
          900: "#14532d",
        },
        "on-primary": "#ffffff",
        "on-primary-container": "#cbffc2",
        forest: {
          DEFAULT: "#2E7D32",
          dark: "#1B5E20",
          light: "#4CAF50",
        },
        surface: {
          DEFAULT: "#f9f9f9",
          dim: "#dadada",
          bright: "#f9f9f9",
          container: "#eeeeee",
          "container-low": "#f3f3f3",
          "container-lowest": "#ffffff",
          "container-high": "#e8e8e8",
          "container-highest": "#e2e2e2",
        },
        "on-surface": "#1a1c1c",
        "on-surface-variant": "#40493d",
        outline: {
          DEFAULT: "#707a6c",
          variant: "#bfcaba",
        },
        error: {
          DEFAULT: "#ba1a1a",
          container: "#ffdad6",
        },
        "on-error": "#ffffff",
        "on-error-container": "#93000a",
        neutral: {
          50: "#fafafa",
          100: "#f4f4f5",
          200: "#e4e4e7",
          400: "#a1a1aa",
          600: "#52525b",
          900: "#18181b",
        },
        danger: "#ef4444",
        warning: "#f59e0b",
        success: "#10b981",
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      fontFamily: {
        display: ["Plus Jakarta Sans", "sans-serif"],
        body: ["DM Sans", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      fontSize: {
        "label-caps": [
          "11px",
          { lineHeight: "16px", letterSpacing: "0.06em", fontWeight: "700" },
        ],
        "display-title": [
          "24px",
          { lineHeight: "32px", fontWeight: "700" },
        ],
        "headline-sm": ["18px", { lineHeight: "26px", fontWeight: "600" }],
      },
      borderRadius: {
        card: "12px",
        modal: "16px",
      },
      keyframes: {
        "slide-up": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
        "slide-in-right": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "bounce-in": {
          "0%": { transform: "scale(0.3)", opacity: "0" },
          "50%": { transform: "scale(1.05)" },
          "70%": { transform: "scale(0.9)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
      animation: {
        "slide-up": "slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-in-right": "slide-in-right 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        "fade-in": "fade-in 0.2s ease-out",
        "bounce-in": "bounce-in 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
};
