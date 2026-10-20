import { afterEach, describe, expect, it, vi } from "vitest";

describe("prompt route initialization", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("does not generate random values while the route module loads", async () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockImplementation(() => {
      throw new Error("random generation is unavailable in global scope");
    });

    await expect(import("./route")).resolves.toHaveProperty("POST");
  });
});
