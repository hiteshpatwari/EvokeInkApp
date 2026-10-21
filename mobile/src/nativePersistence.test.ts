import { describe, expect, it, vi } from "vitest";
import { STATE_KEY } from "@/storage/repository";
import {
  createNativePersistence,
  MIGRATION_KEY,
  NativePersistenceError,
  type PreferencesLike,
} from "./nativePersistence";

const valid = JSON.stringify({ version: 2, profiles: [], sessions: [] });

function memory(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    storage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
      removeItem: (key: string) => void values.delete(key),
    },
  };
}

function preferences(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const api: PreferencesLike = {
    get: vi.fn(async ({ key }) => ({ value: values.get(key) ?? null })),
    set: vi.fn(async ({ key, value }) => void values.set(key, value)),
    remove: vi.fn(async ({ key }) => void values.delete(key)),
  };
  return { values, api };
}

describe("native canonical persistence", () => {
  it("migrates valid canonical WebView state once and verifies its marker", async () => {
    const native = preferences();
    const web = memory({ [STATE_KEY]: valid, unrelated: "keep" });
    const storage = await createNativePersistence(native.api, web.storage);
    expect(storage.getItem(STATE_KEY)).toBe(valid);
    expect(native.values.get(STATE_KEY)).toBe(valid);
    expect(native.values.get(MIGRATION_KEY)).toBe("complete");
    expect(web.values.get("unrelated")).toBe("keep");
  });

  it.each([
    "broken",
    JSON.stringify({ version: 3, profiles: [], sessions: [] }),
    JSON.stringify({ version: 2, profiles: [{ id: "bad" }], sessions: [] }),
  ])(
    "rejects invalid or unsupported WebView state without deleting it (%s)",
    async (candidate) => {
      const native = preferences();
      const web = memory({ [STATE_KEY]: candidate });
      const storage = await createNativePersistence(native.api, web.storage);
      expect(storage.getItem(STATE_KEY)).toBeNull();
      expect(native.values.has(STATE_KEY)).toBe(false);
      expect(native.values.has(MIGRATION_KEY)).toBe(false);
      expect(web.values.get(STATE_KEY)).toBe(candidate);
    },
  );

  it("makes native state authoritative even when it is corrupt", async () => {
    const native = preferences({ [STATE_KEY]: "corrupt-native" });
    const web = memory({ [STATE_KEY]: valid });
    const storage = await createNativePersistence(native.api, web.storage);
    expect(storage.getItem(STATE_KEY)).toBe("corrupt-native");
    expect(native.api.set).not.toHaveBeenCalled();
  });

  it("leaves an empty migration undecided for a later valid launch", async () => {
    const native = preferences();
    const storage = await createNativePersistence(native.api, memory().storage);
    expect(storage.getItem(STATE_KEY)).toBeNull();
    expect(native.values.has(MIGRATION_KEY)).toBe(false);
  });

  it("migrates valid state on a later launch after rejecting invalid state", async () => {
    const native = preferences();
    await createNativePersistence(
      native.api,
      memory({ [STATE_KEY]: "invalid" }).storage,
    );
    expect(native.values.has(MIGRATION_KEY)).toBe(false);

    const storage = await createNativePersistence(
      native.api,
      memory({ [STATE_KEY]: valid }).storage,
    );
    expect(storage.getItem(STATE_KEY)).toBe(valid);
    expect(native.values.get(STATE_KEY)).toBe(valid);
    expect(native.values.get(MIGRATION_KEY)).toBe("complete");
  });

  it("rolls back copied state when the migration marker cannot be verified", async () => {
    const native = preferences();
    let failMarkerReadback = true;
    native.api.get = vi.fn(async ({ key }) => {
      if (
        key === MIGRATION_KEY &&
        native.values.has(MIGRATION_KEY) &&
        failMarkerReadback
      ) {
        failMarkerReadback = false;
        return { value: "mismatch" };
      }
      return { value: native.values.get(key) ?? null };
    });

    await expect(
      createNativePersistence(
        native.api,
        memory({ [STATE_KEY]: valid }).storage,
      ),
    ).rejects.toMatchObject({ rollbackVerified: true });
    expect(native.values.has(STATE_KEY)).toBe(false);
    expect(native.values.has(MIGRATION_KEY)).toBe(false);
  });

  it("serializes rapid writes and verifies the final value", async () => {
    const native = preferences({ [MIGRATION_KEY]: "complete" });
    const storage = await createNativePersistence(native.api, memory().storage);
    storage.setItem(STATE_KEY, "first");
    storage.setItem(STATE_KEY, "second");
    await storage.flush?.();
    expect(native.values.get(STATE_KEY)).toBe("second");
    expect(
      (native.api.set as ReturnType<typeof vi.fn>).mock.calls.map(
        ([arg]) => arg.value,
      ),
    ).toEqual(["first", "second"]);
  });

  it("rejects a read-back mismatch and restores the last durable value", async () => {
    const native = preferences({ [STATE_KEY]: valid });
    native.api.get = vi.fn(async ({ key }) => ({
      value: key === STATE_KEY ? valid : (native.values.get(key) ?? null),
    }));
    const storage = await createNativePersistence(native.api, memory().storage);
    storage.setItem(STATE_KEY, "new");
    await expect(storage.flush?.()).rejects.toBeInstanceOf(
      NativePersistenceError,
    );
    expect(storage.getItem(STATE_KEY)).toBe(valid);
    expect(native.values.get(STATE_KEY)).toBe(valid);

    const reloaded = await createNativePersistence(
      native.api,
      memory().storage,
    );
    expect(reloaded.getItem(STATE_KEY)).toBe(valid);
  });

  it("hard-disables later writes after failure without leaving phantom state", async () => {
    const native = preferences({ [STATE_KEY]: valid });
    let failNextWrite = true;
    native.api.set = vi.fn(async ({ key, value }) => {
      native.values.set(key, value);
      if (key === STATE_KEY && failNextWrite) {
        failNextWrite = false;
        throw new Error("write failed after mutation");
      }
    });
    const storage = await createNativePersistence(native.api, memory().storage);
    storage.setItem(STATE_KEY, "failed-value");
    storage.setItem(STATE_KEY, "phantom-second-value");

    await expect(storage.flush?.()).rejects.toMatchObject({
      rollbackVerified: true,
    });
    expect(storage.getItem(STATE_KEY)).toBe(valid);
    expect(native.values.get(STATE_KEY)).toBe(valid);
    expect(
      (native.api.set as ReturnType<typeof vi.fn>).mock.calls.some(
        ([argument]) => argument.value === "phantom-second-value",
      ),
    ).toBe(false);

    const reloaded = await createNativePersistence(
      native.api,
      memory().storage,
    );
    expect(reloaded.getItem(STATE_KEY)).toBe(valid);
  });

  it("removes a partially written value when no prior durable state existed", async () => {
    const native = preferences({ [MIGRATION_KEY]: "complete" });
    let failNextWrite = true;
    native.api.set = vi.fn(async ({ key, value }) => {
      native.values.set(key, value);
      if (key === STATE_KEY && failNextWrite) {
        failNextWrite = false;
        throw new Error("write failed after mutation");
      }
    });
    const storage = await createNativePersistence(native.api, memory().storage);
    storage.setItem(STATE_KEY, "partial");
    await expect(storage.flush?.()).rejects.toMatchObject({
      rollbackVerified: true,
    });
    expect(storage.getItem(STATE_KEY)).toBeNull();
    expect(native.values.has(STATE_KEY)).toBe(false);

    const reloaded = await createNativePersistence(
      native.api,
      memory().storage,
    );
    expect(reloaded.getItem(STATE_KEY)).toBeNull();
  });

  it("reports indeterminate rollback without claiming prior data was preserved", async () => {
    const native = preferences({ [STATE_KEY]: valid });
    native.api.set = vi.fn(async ({ key, value }) => {
      native.values.set(key, value);
      throw new Error("storage unavailable");
    });
    const storage = await createNativePersistence(native.api, memory().storage);
    storage.setItem(STATE_KEY, "possibly-written");
    const failure = await storage.flush?.().catch((error: unknown) => error);
    expect(failure).toMatchObject({ rollbackVerified: false });
    expect((failure as Error).message).not.toMatch(/unchanged|preserved/i);
    expect(storage.getItem(STATE_KEY)).toBe(valid);
    expect(native.values.get(STATE_KEY)).toBe(valid);
  });

  it("verifies removal and leaves unrelated WebView keys untouched", async () => {
    const native = preferences({ [STATE_KEY]: valid });
    const web = memory({ unrelated: "keep" });
    const storage = await createNativePersistence(native.api, web.storage);
    storage.removeItem(STATE_KEY);
    await storage.flush?.();
    expect(native.values.has(STATE_KEY)).toBe(false);
    expect(web.values.get("unrelated")).toBe("keep");
  });
});
