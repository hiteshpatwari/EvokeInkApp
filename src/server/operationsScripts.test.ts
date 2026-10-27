import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const pwsh = process.platform === "win32" ? "pwsh.exe" : "pwsh";

function run(script: string, args: string[]) {
  return spawnSync(
    pwsh,
    [
      "-NoLogo",
      "-NoProfile",
      "-File",
      path.join(root, "scripts", script),
      ...args,
    ],
    { encoding: "utf8" },
  );
}

describe("operations scripts", () => {
  it("produces a non-mutating mock failover plan by default", () => {
    const result = run("Invoke-MockFailover.ps1", [
      "-Environment",
      "production",
      "-WorkerName",
      "evoke-ink-app",
      "-AllowedOrigin",
      "https://read.example",
      "-ProbeBaseUrl",
      "https://read.example",
      "-ConfirmTarget",
      "production/evoke-ink-app",
    ]);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      action: "mock_failover",
      dryRun: true,
      provider: "mock",
    });
  });

  it("rejects an ambiguous failover target", () => {
    const result = run("Invoke-MockFailover.ps1", [
      "-Environment",
      "production",
      "-WorkerName",
      "evoke-ink-app",
      "-AllowedOrigin",
      "https://read.example",
      "-ProbeBaseUrl",
      "https://read.example",
      "-ConfirmTarget",
      "wrong-target",
    ]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("ConfirmTarget must exactly equal");
  });

  it("produces a non-mutating rollback plan with an explicit version", () => {
    const version = "01234567-89ab-cdef-0123-456789abcdef";
    const result = run("Invoke-WorkerRollback.ps1", [
      "-Environment",
      "production",
      "-WorkerName",
      "evoke-ink-app",
      "-VerifiedVersionId",
      version,
      "-AllowedOrigin",
      "https://read.example",
      "-ProbeBaseUrl",
      "https://read.example",
      "-ConfirmTarget",
      `production/evoke-ink-app/${version}`,
    ]);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      action: "rollback",
      dryRun: true,
      version,
    });
  });
});
