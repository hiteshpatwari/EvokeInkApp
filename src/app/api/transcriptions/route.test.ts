import { afterEach, describe, expect, it, vi } from "vitest";

describe("transcriptions route initialization", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("does not generate random values while loading", async () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockImplementation(() => {
      throw new Error("not available at module load");
    });
    await expect(import("./route")).resolves.toHaveProperty("POST");
  });
});
