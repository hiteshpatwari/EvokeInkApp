import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.evokeink.mobile",
  appName: "Evoke Ink",
  webDir: "dist",
  server: {
    hostname: "localhost",
    androidScheme: "https",
  },
  plugins: {
    SystemBars: {
      insetsHandling: "css",
      initialViewportFitValueHint: "cover",
      style: "LIGHT",
      hidden: false,
    },
  },
};

export default config;
