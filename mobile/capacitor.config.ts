import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.readreflect.mobile",
  appName: "Read & Reflect",
  webDir: "dist",
  server: {
    hostname: "localhost",
    androidScheme: "https",
  },
};

export default config;
