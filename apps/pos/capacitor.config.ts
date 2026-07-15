import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.rakku.pos",
  appName: "Rakku POS",
  webDir: "public",
  server: {
    url: "https://pos-rakku.vercel.app",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
