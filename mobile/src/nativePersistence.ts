import { Preferences } from "@capacitor/preferences";
import {
  isValidCanonicalState,
  STATE_KEY,
  type FlushableStorage,
  type StorageLike,
} from "@/storage/repository";

export const MIGRATION_KEY = "read-reflect:native-migration:v1";
const MIGRATION_COMPLETE = "complete";

export interface PreferencesLike {
  get(options: { key: string }): Promise<{ value: string | null }>;
  set(options: { key: string; value: string }): Promise<void>;
  remove(options: { key: string }): Promise<void>;
}

export class NativePersistenceError extends Error {
  constructor() {
    super(
      "Saved data could not be written safely. Your previous saved data is unchanged.",
    );
    this.name = "NativePersistenceError";
  }
}

async function setAndVerify(
  preferences: PreferencesLike,
  key: string,
  value: string,
) {
  await preferences.set({ key, value });
  if ((await preferences.get({ key })).value !== value) {
    throw new NativePersistenceError();
  }
}

async function removeAndVerify(preferences: PreferencesLike, key: string) {
  await preferences.remove({ key });
  if ((await preferences.get({ key })).value !== null) {
    throw new NativePersistenceError();
  }
}

export async function createNativePersistence(
  preferences: PreferencesLike,
  webStorage: StorageLike,
): Promise<FlushableStorage> {
  const values = new Map<string, string>();
  const nativeValue = (await preferences.get({ key: STATE_KEY })).value;

  if (nativeValue !== null) {
    values.set(STATE_KEY, nativeValue);
  } else {
    const migration = (await preferences.get({ key: MIGRATION_KEY })).value;
    if (migration !== MIGRATION_COMPLETE) {
      const webValue = webStorage.getItem(STATE_KEY);
      if (webValue !== null && isValidCanonicalState(webValue)) {
        await setAndVerify(preferences, STATE_KEY, webValue);
        values.set(STATE_KEY, webValue);
      }
      await setAndVerify(preferences, MIGRATION_KEY, MIGRATION_COMPLETE);
    }
  }

  let queue = Promise.resolve();
  let failure: NativePersistenceError | null = null;
  let durableValue = values.get(STATE_KEY) ?? null;

  const enqueue = (operation: () => Promise<void>) => {
    queue = queue.then(async () => {
      if (failure) throw failure;
      try {
        await operation();
      } catch {
        failure = new NativePersistenceError();
        if (durableValue === null) values.delete(STATE_KEY);
        else values.set(STATE_KEY, durableValue);
        throw failure;
      }
    });
    // The rejection remains observable through flush without becoming an
    // unhandled promise rejection before the UI awaits the durability gate.
    void queue.catch(() => undefined);
  };

  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      if (key !== STATE_KEY) {
        values.set(key, value);
        return;
      }
      values.set(key, value);
      enqueue(async () => {
        await setAndVerify(preferences, key, value);
        durableValue = value;
      });
    },
    removeItem(key) {
      if (key !== STATE_KEY) {
        values.delete(key);
        return;
      }
      values.delete(key);
      enqueue(async () => {
        await removeAndVerify(preferences, key);
        durableValue = null;
      });
    },
    async flush() {
      try {
        await queue;
      } catch {
        throw failure ?? new NativePersistenceError();
      }
    },
  };
}

export const createMobilePersistence = (webStorage: StorageLike) =>
  createNativePersistence(Preferences, webStorage);
