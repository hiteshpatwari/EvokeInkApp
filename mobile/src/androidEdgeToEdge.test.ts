import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Android edge-to-edge host", () => {
  it("enables AndroidX edge-to-edge after the Capacitor bridge starts", () => {
    const mobileRoot = existsSync(path.join(process.cwd(), "android"))
      ? process.cwd()
      : path.join(process.cwd(), "mobile");
    const activity = readFileSync(
      path.join(
        mobileRoot,
        "android",
        "app",
        "src",
        "main",
        "java",
        "app",
        "evokeink",
        "mobile",
        "MainActivity.java",
      ),
      "utf8",
    );

    expect(activity).toMatch(
      /super\.onCreate\(savedInstanceState\);\s*EdgeToEdge\.enable\(this\);/,
    );
  });
});
