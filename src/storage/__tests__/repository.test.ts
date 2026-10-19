import { beforeEach, describe, expect, it } from "vitest";
import { createLocalRepository } from "../repository";
import type { ChildProfile, ReadingSession } from "@/domain/schemas";

const profile: ChildProfile = {
  id: "child-1",
  name: "Aavya",
  gradeOrAge: "Grade 3",
  readingLevel: "Advanced independent reader",
  lexile: "1100L",
  difficulty: "advanced",
  responseLength: "medium",
  createdAt: "2026-10-12T00:00:00.000Z",
  updatedAt: "2026-10-12T00:00:00.000Z",
};

const session = {
  id: "session-1",
  childId: profile.id,
  childSnapshot: profile,
  book: {
    title: "Prince Caspian",
    author: "C. S. Lewis",
    genre: "fiction",
    progress: "Pages 1-60",
  },
  specificity: "general",
  skills: ["summary"],
  parentNotes: "",
  parentSummary: "",
  detailNotes: "",
  generatedPrompts: [],
  prompts: [],
  createdAt: "2026-10-12T00:00:00.000Z",
  updatedAt: "2026-10-12T00:00:00.000Z",
  status: "draft",
} satisfies ReadingSession;

function readCanonicalState() {
  return JSON.parse(localStorage.getItem("read-reflect:state:v2")!);
}

describe("local repository", () => {
  beforeEach(() => localStorage.clear());

  it("saves and reloads child profiles", () => {
    const repository = createLocalRepository(localStorage);
    repository.saveProfile(profile);
    expect(repository.loadProfiles()).toEqual([profile]);
  });

  it("keeps valid records when another persisted record is malformed", () => {
    localStorage.setItem(
      "read-reflect:profiles:v1",
      JSON.stringify([profile, { id: "broken-profile" }]),
    );
    const repository = createLocalRepository(localStorage);
    expect(repository.loadProfiles()).toEqual([profile]);
    expect(repository.getStorageDiagnostics()).toEqual([
      {
        collection: "profiles",
        issue: "invalid_records",
        skippedRecords: 1,
      },
    ]);
  });

  it("keeps valid sessions when another persisted session is malformed", () => {
    localStorage.setItem(
      "read-reflect:sessions:v1",
      JSON.stringify([{ id: "broken-session" }, session]),
    );
    const repository = createLocalRepository(localStorage);

    expect(repository.loadSessions()).toEqual([session]);
    expect(repository.getStorageDiagnostics()).toEqual([
      {
        collection: "sessions",
        issue: "invalid_records",
        skippedRecords: 1,
      },
    ]);
  });

  it("preserves an invalid profile record when saving and deleting profiles", () => {
    const invalidProfile = {
      id: "broken-profile",
      privateParentNote: "keep this private and unchanged",
    };
    const secondProfile = {
      ...profile,
      id: "child-2",
      name: "Ben",
    };
    localStorage.setItem(
      "read-reflect:profiles:v1",
      JSON.stringify([profile, invalidProfile]),
    );
    const repository = createLocalRepository(localStorage);

    repository.saveProfile(secondProfile);
    expect(readCanonicalState().profiles).toEqual([
      profile,
      secondProfile,
      invalidProfile,
    ]);
    expect(JSON.stringify(repository.getStorageDiagnostics())).not.toContain(
      "keep this private",
    );

    repository.deleteProfile(profile.id);
    expect(readCanonicalState().profiles).toEqual([
      secondProfile,
      invalidProfile,
    ]);
    expect(repository.getStorageDiagnostics()).toEqual([
      {
        collection: "profiles",
        issue: "invalid_records",
        skippedRecords: 1,
      },
    ]);
  });

  it("preserves an invalid session record when saving and deleting sessions", () => {
    const invalidSession = {
      id: "broken-session",
      privateParentSummary: "keep this private and unchanged",
    };
    const secondSession = {
      ...session,
      id: "session-2",
    };
    localStorage.setItem(
      "read-reflect:sessions:v1",
      JSON.stringify([invalidSession, session]),
    );
    const repository = createLocalRepository(localStorage);

    repository.saveSession(secondSession);
    expect(readCanonicalState().sessions).toEqual([
      secondSession,
      session,
      invalidSession,
    ]);
    expect(JSON.stringify(repository.getStorageDiagnostics())).not.toContain(
      "keep this private",
    );

    repository.deleteSession(session.id);
    expect(readCanonicalState().sessions).toEqual([
      secondSession,
      invalidSession,
    ]);
    expect(repository.getStorageDiagnostics()).toEqual([
      {
        collection: "sessions",
        issue: "invalid_records",
        skippedRecords: 1,
      },
    ]);
  });

  it("reports malformed collection data without exposing persisted contents", () => {
    localStorage.setItem(
      "read-reflect:profiles:v1",
      '{"privateParentNote":"do not expose this"',
    );

    const repository = createLocalRepository(localStorage);

    expect(repository.loadProfiles()).toEqual([]);
    const diagnostics = repository.getStorageDiagnostics();
    expect(diagnostics).toEqual([
      {
        collection: "profiles",
        issue: "invalid_json",
        skippedRecords: 1,
      },
    ]);
    expect(JSON.stringify(diagnostics)).not.toContain("privateParentNote");
  });

  it("does not overwrite a malformed collection during an ordinary mutation", () => {
    const malformedProfiles = '{"privateParentNote":"do not overwrite"';
    localStorage.setItem("read-reflect:profiles:v1", malformedProfiles);
    const repository = createLocalRepository(localStorage);

    expect(() => repository.saveSession(session)).toThrow(
      "cannot be updated safely",
    );
    expect(localStorage.getItem("read-reflect:profiles:v1")).toBe(
      malformedProfiles,
    );
    expect(localStorage.getItem("read-reflect:state:v2")).toBeNull();
  });

  it("clears only invalid persisted records and keeps valid records", () => {
    localStorage.setItem(
      "read-reflect:profiles:v1",
      JSON.stringify([profile, { id: "broken-profile" }]),
    );
    const repository = createLocalRepository(localStorage);

    expect(repository.clearInvalidPersistedRecords()).toEqual({
      profiles: 1,
      sessions: 0,
    });
    expect(repository.loadProfiles()).toEqual([profile]);
    expect(repository.getStorageDiagnostics()).toEqual([]);
    expect(readCanonicalState().profiles).toEqual([profile]);
  });

  it("rewrites each damaged collection with only its validated records", () => {
    localStorage.setItem(
      "read-reflect:profiles:v1",
      JSON.stringify([profile, { id: "broken-profile" }]),
    );
    localStorage.setItem(
      "read-reflect:sessions:v1",
      JSON.stringify([{ id: "broken-session" }, session]),
    );
    const repository = createLocalRepository(localStorage);

    expect(repository.clearInvalidPersistedRecords()).toEqual({
      profiles: 1,
      sessions: 1,
    });
    expect(repository.loadProfiles()).toEqual([profile]);
    expect(repository.loadSessions()).toEqual([session]);
    expect(repository.getStorageDiagnostics()).toEqual([]);
  });

  it("reports a non-array collection as damaged without exposing its data", () => {
    localStorage.setItem(
      "read-reflect:sessions:v1",
      JSON.stringify({ privateParentSummary: "do not expose this" }),
    );
    const repository = createLocalRepository(localStorage);

    expect(repository.loadSessions()).toEqual([]);
    const diagnostics = repository.getStorageDiagnostics();
    expect(diagnostics).toEqual([
      {
        collection: "sessions",
        issue: "invalid_shape",
        skippedRecords: 1,
      },
    ]);
    expect(JSON.stringify(diagnostics)).not.toContain("privateParentSummary");
  });

  it("preserves the profile snapshot on a saved session", () => {
    const repository = createLocalRepository(localStorage);
    repository.saveSession(session);
    repository.saveProfile({ ...profile, gradeOrAge: "Grade 4" });
    expect(repository.loadSessions()[0]?.childSnapshot.gradeOrAge).toBe(
      "Grade 3",
    );
  });

  it("replaces profiles and sessions together after validating the complete set", () => {
    const repository = createLocalRepository(localStorage);
    repository.replaceAllData({ profiles: [profile], sessions: [] });

    expect(repository.loadProfiles()).toEqual([profile]);
    expect(repository.loadSessions()).toEqual([]);
  });

  it("keeps the old canonical state intact if replacement persistently fails", () => {
    const values = new Map<string, string>();
    values.set(
      "read-reflect:state:v2",
      JSON.stringify({ version: 2, profiles: [profile], sessions: [] }),
    );
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (key === "read-reflect:state:v2") {
          throw new DOMException("Storage full", "QuotaExceededError");
        }
        values.set(key, value);
      },
      removeItem: (key: string) => {
        values.delete(key);
      },
    };
    const repository = createLocalRepository(storage);

    expect(() =>
      repository.replaceAllData({
        profiles: [{ ...profile, name: "Imported" }],
        sessions: [],
      }),
    ).toThrow("could not be saved");
    expect(repository.loadProfiles()).toEqual([profile]);
    expect(repository.loadSessions()).toEqual([]);
  });

  it("uses a committed canonical state when stale legacy keys remain", () => {
    localStorage.setItem(
      "read-reflect:profiles:v1",
      JSON.stringify([{ ...profile, name: "Stale legacy profile" }]),
    );
    localStorage.setItem(
      "read-reflect:sessions:v1",
      JSON.stringify([{ ...session, id: "stale-session" }]),
    );
    localStorage.setItem(
      "read-reflect:state:v2",
      JSON.stringify({ version: 2, profiles: [profile], sessions: [] }),
    );

    const repository = createLocalRepository(localStorage);

    expect(repository.loadProfiles()).toEqual([profile]);
    expect(repository.loadSessions()).toEqual([]);
  });

  it("does not remove legacy data before a canonical migration succeeds", () => {
    const values = new Map<string, string>();
    const legacyProfiles = JSON.stringify([profile]);
    const legacySessions = JSON.stringify([session]);
    values.set("read-reflect:profiles:v1", legacyProfiles);
    values.set("read-reflect:sessions:v1", legacySessions);
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (key === "read-reflect:state:v2") {
          throw new DOMException("Storage full", "QuotaExceededError");
        }
        values.set(key, value);
      },
      removeItem: (key: string) => {
        values.delete(key);
      },
    };
    const repository = createLocalRepository(storage);

    expect(() =>
      repository.saveProfile({ ...profile, id: "child-2", name: "Ben" }),
    ).toThrow("Storage full");
    expect(values.get("read-reflect:profiles:v1")).toBe(legacyProfiles);
    expect(values.get("read-reflect:sessions:v1")).toBe(legacySessions);
    expect(values.has("read-reflect:state:v2")).toBe(false);
  });
});
