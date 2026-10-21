import { describe, expect, it } from "vitest";
import capacitorConfig from "../capacitor.config";

describe("production Capacitor navigation boundary", () => {
  it("loads only bundled local assets", () => {
    expect(capacitorConfig.webDir).toBe("dist");
    expect(capacitorConfig.server).toEqual({
      hostname: "localhost",
      androidScheme: "https",
    });
    expect(capacitorConfig.server).not.toHaveProperty("url");
    expect(capacitorConfig.server).not.toHaveProperty("allowNavigation");
    expect(capacitorConfig.server).not.toHaveProperty("cleartext");
  });

  it("enables Capacitor 8 system-bar inset handling for API 36", () => {
    expect(capacitorConfig.plugins?.["SystemBars"]).toEqual({
      insetsHandling: "css",
      initialViewportFitValueHint: "cover",
      style: "LIGHT",
      hidden: false,
    });
  });
});
