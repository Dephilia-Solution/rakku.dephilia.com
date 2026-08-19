import type { Config } from "tailwindcss";
import { rakkuPreset } from "@rakku/ui/tailwind.preset";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx}",
  ],
  presets: [rakkuPreset],
  theme: {
    extend: {
      colors: {
        green: {
          950: "#102c1d",
          900: "#173c27",
          800: "#1d5b38",
          700: "#2d7548",
          500: "#68a951",
          300: "#b9d99a",
        },
        lime: "#d3e66d",
        paper: "#f3efe6",
        "paper-deep": "#e9e2d3",
        ink: "#183126",
        muted: "#68756d",
        coral: "#d87959",
        ivory: "#fffdf8",
      },
      borderColor: {
        brand: "rgba(24, 49, 38, 0.15)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "DM Sans", "Arial", "sans-serif"],
        display: ["var(--font-display)", "Fraunces", "Georgia", "serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "Consolas", "monospace"],
      },
      maxWidth: {
        shell: "1180px",
      },
      boxShadow: {
        window: "0 36px 70px rgba(25, 55, 37, 0.17), 0 4px 12px rgba(25, 55, 37, 0.08)",
        card: "0 14px 28px rgba(24, 49, 38, 0.11)",
        cta: "0 25px 55px rgba(16, 44, 29, 0.19)",
      },
      keyframes: {
        "sticker-float": {
          "0%, 100%": { transform: "translateY(0) rotate(7deg)" },
          "50%": { transform: "translateY(-5px) rotate(7deg)" },
        },
        "sticker-float-reverse": {
          "0%, 100%": { transform: "translateY(0) rotate(-5deg)" },
          "50%": { transform: "translateY(4px) rotate(-5deg)" },
        },
        "live-pulse": {
          "0%, 100%": { boxShadow: "0 0 0 4px rgba(216, 121, 89, 0.15)" },
          "50%": { boxShadow: "0 0 0 7px rgba(216, 121, 89, 0.04)" },
        },
        "faq-open": {
          from: { opacity: "0", transform: "translateY(-5px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "sticker-float": "sticker-float 4.5s ease-in-out 900ms infinite",
        "sticker-float-reverse": "sticker-float-reverse 5s ease-in-out 1.2s infinite",
        "live-pulse": "live-pulse 2.4s ease-in-out infinite",
        "faq-open": "faq-open 220ms ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
