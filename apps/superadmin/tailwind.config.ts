import type { Config } from "tailwindcss";
import { rakkuPreset } from "@rakku/ui/tailwind.preset";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx}",
  ],
  presets: [rakkuPreset],
  plugins: [],
};
export default config;
