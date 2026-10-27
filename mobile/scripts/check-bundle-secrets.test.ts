// @vitest-environment node

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { zipSync } from "fflate";
import { afterEach, describe, expect, it } from "vitest";
import { scanProductionArtifacts } from "./check-bundle-secrets.mjs";

const temporaryDirectories: string[] = [];

async function temporaryMobileRoot() {
  const root = await mkdtemp(path.join(os.tmpdir(), "read-reflect-scan-test-"));
  temporaryDirectories.push(root);
  return root;
}

async function createRequiredArtifacts(
  root: string,
  apkEntries: Record<string, Uint8Array> = {
    "assets/public/index.js": new TextEncoder().encode("safe bundle"),
  },
) {
  const dist = path.join(root, "dist");
  const assets = path.join(root, "android/app/src/main/assets");
  const apk = path.join(
    root,
    "android/app/build/outputs/apk/debug/app-debug.apk",
  );
  await mkdir(dist, { recursive: true });
  await mkdir(assets, { recursive: true });
  await mkdir(path.dirname(apk), { recursive: true });
  await writeFile(path.join(dist, "index.js"), "safe distribution");
  await writeFile(path.join(assets, "capacitor.config.json"), "{}");
  await writeFile(apk, zipSync(apkEntries));
  return apk;
}

afterEach(async () => {
  for (const directory of temporaryDirectories.splice(0)) {
    const resolved = path.resolve(directory);
    expect(path.dirname(resolved)).toBe(path.resolve(os.tmpdir()));
    expect(path.basename(resolved)).toMatch(/^read-reflect-scan-test-/);
    await rm(resolved, { recursive: true, force: true });
  }
});

describe("scanProductionArtifacts", () => {
  it("fails closed when a required production artifact is missing", async () => {
    const root = await temporaryMobileRoot();
    await expect(scanProductionArtifacts({ mobileRoot: root })).rejects.toThrow(
      /Required mobile build directory is missing/,
    );
  });

  it("detects a provider secret inside a compressed APK entry", async () => {
    const root = await temporaryMobileRoot();
    const apk = await createRequiredArtifacts(root, {
      "assets/public/index.js": new TextEncoder().encode(
        "const token = 'sk-proj-compressed-entry-secret';",
      ),
    });

    await expect(
      scanProductionArtifacts({ mobileRoot: root, artifacts: [apk] }),
    ).rejects.toThrow(
      /Forbidden provider secret marker found.*assets[\\/]public[\\/]index\.js/,
    );
  });

  it("passes when all required artifacts contain no provider secret", async () => {
    const root = await temporaryMobileRoot();
    const apk = await createRequiredArtifacts(root);
    await expect(
      scanProductionArtifacts({ mobileRoot: root, artifacts: [apk] }),
    ).resolves.toBeUndefined();
  });
});
