import { describe, expect, it, vi } from "vitest";
import type { FlushableStorage } from "@/storage/repository";
import { bootstrapMobileApplication } from "./bootstrap";

describe("mobile startup", () => {
  it("awaits native persistence before rendering React", async () => {
    let release!: (storage: FlushableStorage) => void;
    const pending = new Promise<FlushableStorage>(
      (resolve) => (release = resolve),
    );
    const render = vi.fn();
    const startup = bootstrapMobileApplication(() => pending, render);
    expect(render).not.toHaveBeenCalled();
    const storage: FlushableStorage = {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    };
    release(storage);
    await startup;
    expect(render).toHaveBeenCalledWith(storage);
  });
});
