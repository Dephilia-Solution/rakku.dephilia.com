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
        ivory: "#fffdf8",
      },
      borderColor: {
        brand: "rgba(24, 49, 38, 0.15)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "DM Sans", "Arial", "sans-serif"],
        display: ["var(--font-sans)", "DM Sans", "Arial", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "Consolas", "monospace"],
      },
      maxWidth: {
        shell: "1200px",
      },
      boxShadow: {
        card: "0 12px 26px rgba(24, 49, 38, 0.09)",
        preview: "0 24px 60px rgba(16, 44, 29, 0.16), 0 4px 14px rgba(16, 44, 29, 0.08)",
        cta: "0 20px 42px rgba(16, 44, 29, 0.16)",
      },
    },
  },
  plugins: [],
};

export default config;
