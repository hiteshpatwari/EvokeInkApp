import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.readreflect.mobile",
  appName: "Read & Reflect",
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
