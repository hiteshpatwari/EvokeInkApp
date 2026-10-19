import { z } from "zod";
import {
  bookSchema,
  childProfileSchema,
  readingSessionSchema,
  worksheetPromptSchema,
  type ChildProfile,
  type ReadingSession,
} from "@/domain/schemas";

export const BACKUP_FORMAT = "read-and-reflect-backup" as const;
export const BACKUP_VERSION = 1 as const;

const strictChildProfileSchema = childProfileSchema.strict();
const strictWorksheetPromptSchema = worksheetPromptSchema.strict();
const strictReadingSessionSchema = readingSessionSchema
  .extend({
    childSnapshot: strictChildProfileSchema,
    book: bookSchema.strict(),
    generatedPrompts: z.array(strictWorksheetPromptSchema),
    prompts: z.array(strictWorksheetPromptSchema),
  })
  .strict();

export const backupFileSchema = z
  .object({
    format: z.literal(BACKUP_FORMAT),
    version: z.literal(BACKUP_VERSION),
    exportedAt: z.string().datetime(),
    profiles: z.array(strictChildProfileSchema),
    sessions: z.array(strictReadingSessionSchema),
  })
  .strict()
  .superRefine((backup, context) => {
    addDuplicateIssues(backup.profiles, "profiles", context);
    addDuplicateIssues(backup.sessions, "sessions", context);
    backup.sessions.forEach((session, index) => {
      if (session.childId !== session.childSnapshot.id) {
        context.addIssue({
          code: "custom",
          message: "Session child identifiers must match their snapshots",
          path: ["sessions", index, "childSnapshot", "id"],
        });
      }
    });
  });

function addDuplicateIssues(
  records: ReadonlyArray<{ id: string }>,
  collection: "profiles" | "sessions",
  context: z.RefinementCtx,
) {
  const seen = new Set<string>();
  records.forEach((record, index) => {
    if (seen.has(record.id)) {
      context.addIssue({
        code: "custom",
        message: `Duplicate ${collection} identifier`,
        path: [collection, index, "id"],
      });
    }
    seen.add(record.id);
  });
}

export type BackupFile = z.infer<typeof backupFileSchema>;
export type BackupImportMode = "merge" | "replace";
export type BackupData = {
  profiles: ChildProfile[];
  sessions: ReadingSession[];
};

export class BackupValidationError extends Error {
  constructor() {
    super(
      "This file is not a valid Read & Reflect backup, or it uses an unsupported version.",
    );
    this.name = "BackupValidationError";
  }
}

export function createBackupJson(
  profiles: ChildProfile[],
  sessions: ReadingSession[],
  exportedAt = new Date().toISOString(),
): string {
  const backup = backupFileSchema.parse({
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt,
    profiles,
    sessions,
  });
  return `${JSON.stringify(backup, null, 2)}\n`;
}

export function parseBackupJson(text: string): BackupFile {
  let candidate: unknown;
  try {
    candidate = JSON.parse(text);
  } catch {
    throw new BackupValidationError();
  }

  const result = backupFileSchema.safeParse(candidate);
  if (!result.success) throw new BackupValidationError();
  return result.data;
}

function mergeById<T extends { id: string }>(existing: T[], incoming: T[]) {
  const incomingIds = new Set(incoming.map((record) => record.id));
  return [
    ...incoming,
    ...existing.filter((record) => !incomingIds.has(record.id)),
  ];
}

export function resolveBackupImport(
  existing: BackupData,
  incoming: Pick<BackupFile, "profiles" | "sessions">,
  mode: BackupImportMode,
): BackupData {
  if (mode === "replace") {
    return {
      profiles: [...incoming.profiles],
      sessions: [...incoming.sessions],
    };
  }

  return {
    profiles: mergeById(existing.profiles, incoming.profiles),
    sessions: mergeById(existing.sessions, incoming.sessions),
  };
}
