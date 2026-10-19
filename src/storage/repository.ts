import {
  childProfileSchema,
  readingSessionSchema,
  type ChildProfile,
  type ReadingSession,
} from "@/domain/schemas";

const PROFILE_KEY = "read-reflect:profiles:v1";
const SESSION_KEY = "read-reflect:sessions:v1";
const STATE_KEY = "read-reflect:state:v2";
const STATE_VERSION = 2 as const;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type StorageCollection = "profiles" | "sessions";
export type StorageDiagnostic = {
  collection: StorageCollection;
  issue: "invalid_json" | "invalid_shape" | "invalid_records";
  skippedRecords: number;
};

type InspectedArray<T> = {
  values: T[];
  invalidValues: unknown[];
  diagnostic?: Omit<StorageDiagnostic, "collection">;
};

type InspectedState = {
  profiles: InspectedArray<ChildProfile>;
  sessions: InspectedArray<ReadingSession>;
  blocked: boolean;
};

function emptyInspection<T>(
  issue?: "invalid_json" | "invalid_shape",
): InspectedArray<T> {
  return {
    values: [],
    invalidValues: [],
    ...(issue ? { diagnostic: { issue, skippedRecords: 1 } } : {}),
  };
}

function inspectArrayValue<T>(
  value: unknown,
  parse: (candidate: unknown) => T,
): InspectedArray<T> {
  if (!Array.isArray(value)) return emptyInspection("invalid_shape");

  const values: T[] = [];
  const invalidValues: unknown[] = [];
  for (const candidate of value) {
    try {
      values.push(parse(candidate));
    } catch {
      invalidValues.push(candidate);
    }
  }

  return invalidValues.length > 0
    ? {
        values,
        invalidValues,
        diagnostic: {
          issue: "invalid_records",
          skippedRecords: invalidValues.length,
        },
      }
    : { values, invalidValues };
}

function inspectLegacyArray<T>(
  storage: StorageLike,
  key: string,
  parse: (candidate: unknown) => T,
): InspectedArray<T> {
  const raw = storage.getItem(key);
  if (!raw) return emptyInspection();

  try {
    return inspectArrayValue(JSON.parse(raw), parse);
  } catch {
    return emptyInspection("invalid_json");
  }
}

function blocksMutation<T>(inspection: InspectedArray<T>): boolean {
  return (
    inspection.diagnostic?.issue === "invalid_json" ||
    inspection.diagnostic?.issue === "invalid_shape"
  );
}

function inspectState(storage: StorageLike): InspectedState {
  const canonicalRaw = storage.getItem(STATE_KEY);
  if (canonicalRaw !== null) {
    let candidate: unknown;
    try {
      candidate = JSON.parse(canonicalRaw);
    } catch {
      return {
        profiles: emptyInspection("invalid_json"),
        sessions: emptyInspection("invalid_json"),
        blocked: true,
      };
    }

    if (
      typeof candidate !== "object" ||
      candidate === null ||
      !("version" in candidate) ||
      candidate.version !== STATE_VERSION ||
      !("profiles" in candidate) ||
      !("sessions" in candidate)
    ) {
      return {
        profiles: emptyInspection("invalid_shape"),
        sessions: emptyInspection("invalid_shape"),
        blocked: true,
      };
    }

    const profiles = inspectArrayValue(candidate.profiles, (value) =>
      childProfileSchema.parse(value),
    );
    const sessions = inspectArrayValue(candidate.sessions, (value) =>
      readingSessionSchema.parse(value),
    );
    return {
      profiles,
      sessions,
      blocked: blocksMutation(profiles) || blocksMutation(sessions),
    };
  }

  const profiles = inspectLegacyArray(storage, PROFILE_KEY, (value) =>
    childProfileSchema.parse(value),
  );
  const sessions = inspectLegacyArray(storage, SESSION_KEY, (value) =>
    readingSessionSchema.parse(value),
  );
  return {
    profiles,
    sessions,
    blocked: blocksMutation(profiles) || blocksMutation(sessions),
  };
}

function withCollection(
  collection: StorageCollection,
  diagnostic: InspectedArray<unknown>["diagnostic"],
): StorageDiagnostic | undefined {
  if (!diagnostic) return undefined;
  return { collection, ...diagnostic };
}

function diagnosticsFor(state: InspectedState): StorageDiagnostic[] {
  const diagnostics = [
    withCollection("profiles", state.profiles.diagnostic),
    withCollection("sessions", state.sessions.diagnostic),
  ];
  return diagnostics.filter(
    (diagnostic): diagnostic is StorageDiagnostic => diagnostic !== undefined,
  );
}

function rawValues<T>(inspection: InspectedArray<T>): unknown[] {
  return [...inspection.values, ...inspection.invalidValues];
}

function removeLegacyKeys(storage: StorageLike) {
  // Once v2 is committed it is authoritative. Legacy cleanup is best-effort so
  // a removal failure cannot turn a successful atomic commit into an error.
  try {
    storage.removeItem(PROFILE_KEY);
    storage.removeItem(SESSION_KEY);
  } catch {
    // Stale v1 values are ignored whenever the canonical key exists.
  }
}

function persistState(
  storage: StorageLike,
  profiles: unknown[],
  sessions: unknown[],
) {
  storage.setItem(
    STATE_KEY,
    JSON.stringify({ version: STATE_VERSION, profiles, sessions }),
  );
  removeLegacyKeys(storage);
}

function assertMutable(state: InspectedState) {
  if (state.blocked) {
    throw new Error(
      "Saved data is damaged and cannot be updated safely. Clean up the saved data or restore a backup first.",
    );
  }
}

export type InvalidRecordCleanupResult = {
  profiles: number;
  sessions: number;
};

export function createLocalRepository(storage: StorageLike) {
  return {
    loadProfiles: () => inspectState(storage).profiles.values,
    loadSessions: () => inspectState(storage).sessions.values,
    getStorageDiagnostics: () => diagnosticsFor(inspectState(storage)),
    clearInvalidPersistedRecords(): InvalidRecordCleanupResult {
      const state = inspectState(storage);
      const result = {
        profiles: state.profiles.diagnostic?.skippedRecords ?? 0,
        sessions: state.sessions.diagnostic?.skippedRecords ?? 0,
      };
      if (result.profiles > 0 || result.sessions > 0) {
        persistState(storage, state.profiles.values, state.sessions.values);
      }
      return result;
    },
    saveProfile(profile: ChildProfile) {
      const state = inspectState(storage);
      assertMutable(state);
      const profiles = state.profiles.values.filter(
        (item) => item.id !== profile.id,
      );
      persistState(
        storage,
        [
          ...profiles,
          childProfileSchema.parse(profile),
          ...state.profiles.invalidValues,
        ],
        rawValues(state.sessions),
      );
    },
    deleteProfile(profileId: string) {
      const state = inspectState(storage);
      assertMutable(state);
      persistState(
        storage,
        [
          ...state.profiles.values.filter((item) => item.id !== profileId),
          ...state.profiles.invalidValues,
        ],
        rawValues(state.sessions),
      );
    },
    saveSession(session: ReadingSession) {
      const state = inspectState(storage);
      assertMutable(state);
      const sessions = state.sessions.values.filter(
        (item) => item.id !== session.id,
      );
      persistState(storage, rawValues(state.profiles), [
        readingSessionSchema.parse(session),
        ...sessions,
        ...state.sessions.invalidValues,
      ]);
    },
    deleteSession(sessionId: string) {
      const state = inspectState(storage);
      assertMutable(state);
      persistState(storage, rawValues(state.profiles), [
        ...state.sessions.values.filter((item) => item.id !== sessionId),
        ...state.sessions.invalidValues,
      ]);
    },
    replaceAllData(data: {
      profiles: ChildProfile[];
      sessions: ReadingSession[];
    }) {
      const profiles = data.profiles.map((profile) =>
        childProfileSchema.parse(profile),
      );
      const sessions = data.sessions.map((session) =>
        readingSessionSchema.parse(session),
      );

      try {
        persistState(storage, profiles, sessions);
      } catch {
        throw new Error(
          "The imported backup could not be saved. Your existing data was not changed.",
        );
      }
    },
  };
}
