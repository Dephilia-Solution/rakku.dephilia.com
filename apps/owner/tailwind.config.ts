import type { Config } from "tailwindcss";
import { rakkuPreset } from "@rakku/ui/tailwind.preset";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx}",
  ],
  presets: [rakkuPreset],
  plugins: [],
  theme: {
    extend: {
      colors: {
        cream: "#F7F5F0",
        moss: "#A9D6A2",
        muted: "#5C6560",
        line: "#DDE3DA",
        ink: "#1A1A1A",
        leaf: "#2E7D32",
        "leaf-dark": "#1B4F1F",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "DM Sans", "sans-serif"],
        serif: ["var(--font-serif)", "Fraunces", "serif"],
      },
      keyframes: {
        rkglow: {
          "0%, 100%": {
            boxShadow: "0 0 0 rgba(169,214,162,0)",
            transform: "translateY(0)",
          },
          "50%": {
            boxShadow: "0 10px 24px -4px rgba(169,214,162,0.5)",
            transform: "translateY(-3px)",
          },
        },
        rkfade: {
          from: { opacity: "0", transform: "translateY(5px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        rkglow: "rkglow 4.5s ease-in-out infinite",
        rkfade: "rkfade 0.3s ease",
      },
    },
  },
};
export default config;
