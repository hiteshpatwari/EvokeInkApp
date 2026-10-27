// @vitest-environment node

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const androidRoot = fileURLToPath(new URL("../android/", import.meta.url));

describe("Android release security", () => {
  it("does not include child data in Android cloud backup", () => {
    const manifest = readFileSync(
      `${androidRoot}app/src/main/AndroidManifest.xml`,
      "utf8",
    );
    expect(manifest).toContain('android:allowBackup="false"');
    expect(manifest).toContain('android:fullBackupContent="false"');
  });

  it("minifies and signs a non-debuggable release build", () => {
    const build = readFileSync(`${androidRoot}app/build.gradle`, "utf8");
    expect(build).toMatch(
      /release\s*\{[\s\S]*signingConfig signingConfigs\.release/,
    );
    expect(build).toMatch(/release\s*\{[\s\S]*debuggable false/);
    expect(build).toMatch(/release\s*\{[\s\S]*minifyEnabled true/);
    expect(build).toMatch(/release\s*\{[\s\S]*shrinkResources true/);
  });
});
