import { describe, expect, it } from "vitest";
import type { ChildProfile, ReadingSession } from "@/domain/schemas";
import {
  BackupValidationError,
  createBackupJson,
  parseBackupJson,
  resolveBackupImport,
} from "../backup";

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

const session: ReadingSession = {
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
  skills: ["inference"],
  parentNotes: "",
  parentSummary: "",
  detailNotes: "",
  generatedPrompts: [],
  prompts: [],
  createdAt: "2026-10-12T00:00:00.000Z",
  updatedAt: "2026-10-12T00:00:00.000Z",
  status: "ready",
};

describe("versioned backups", () => {
  it("exports and parses a complete version 1 backup", () => {
    const json = createBackupJson(
      [profile],
      [session],
      "2026-10-14T12:00:00.000Z",
    );

    expect(parseBackupJson(json)).toEqual({
      format: "read-and-reflect-backup",
      version: 1,
      exportedAt: "2026-10-14T12:00:00.000Z",
      profiles: [profile],
      sessions: [session],
    });
  });

  it("rejects malformed or unsupported files without accepting partial data", () => {
    const malformed = JSON.stringify({
      format: "read-and-reflect-backup",
      version: 2,
      exportedAt: "not-a-date",
      profiles: [profile],
      sessions: [{ ...session, status: "unknown" }],
      extra: true,
    });

    expect(() => parseBackupJson(malformed)).toThrow(BackupValidationError);
  });

  it("rejects duplicate record identifiers and inconsistent snapshots", () => {
    const duplicateProfiles = createBackupJson([profile], [session]);
    const parsed = JSON.parse(duplicateProfiles) as Record<string, unknown>;
    parsed["profiles"] = [profile, profile];
    expect(() => parseBackupJson(JSON.stringify(parsed))).toThrow(
      BackupValidationError,
    );

    parsed["profiles"] = [profile];
    parsed["sessions"] = [
      { ...session, childSnapshot: { ...profile, id: "another-child" } },
    ];
    expect(() => parseBackupJson(JSON.stringify(parsed))).toThrow(
      BackupValidationError,
    );
  });

  it("replaces all data when replace mode is selected", () => {
    const incomingProfile = { ...profile, name: "Imported Aavya" };
    const incomingSession = {
      ...session,
      childSnapshot: incomingProfile,
    };

    expect(
      resolveBackupImport(
        { profiles: [profile], sessions: [session] },
        { profiles: [incomingProfile], sessions: [incomingSession] },
        "replace",
      ),
    ).toEqual({
      profiles: [incomingProfile],
      sessions: [incomingSession],
    });
  });

  it("merges deterministically with imported records winning identifier conflicts", () => {
    const existingOther = { ...profile, id: "child-2", name: "Mira" };
    const imported = { ...profile, name: "Imported Aavya" };
    const importedSession = { ...session, childSnapshot: imported };

    expect(
      resolveBackupImport(
        { profiles: [profile, existingOther], sessions: [session] },
        { profiles: [imported], sessions: [importedSession] },
        "merge",
      ),
    ).toEqual({
      profiles: [imported, existingOther],
      sessions: [importedSession],
    });
  });
});
