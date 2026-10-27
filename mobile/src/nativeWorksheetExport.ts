import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import type { ReadingSession } from "@/domain/schemas";
import { buildWorksheetPdf } from "@/pdf/downloadWorksheet";
import type {
  WorksheetExporter,
  WorksheetExportResult,
} from "@/pdf/worksheetExport";

const MAX_FILENAME_LENGTH = 96;
const FILENAME_SUFFIX = "-reflection.pdf";

export function sanitizeWorksheetFilename(title: string): string {
  const stem = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  const bounded = (stem || "reading")
    .slice(0, MAX_FILENAME_LENGTH - FILENAME_SUFFIX.length)
    .replace(/-$/g, "");
  return `${bounded || "reading"}${FILENAME_SUFFIX}`;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    for (const byte of chunk) binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export interface NativeWorksheetExportDependencies {
  buildPdfBytes(session: ReadingSession): Uint8Array;
  canShare(): Promise<boolean>;
  writeCacheFile(filename: string, base64Data: string): Promise<string>;
  shareFile(uri: string, filename: string): Promise<void>;
  deleteCacheFile(filename: string): Promise<void>;
}

export class WorksheetShareError extends Error {
  readonly cleanupFailed: boolean;

  constructor(cause: unknown, cleanupFailed: boolean) {
    super("The PDF could not be shared. Please try again.", { cause });
    this.name = "WorksheetShareError";
    this.cleanupFailed = cleanupFailed;
  }
}

function isCancellation(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.name === "AbortError" ||
    /cancel(?:led|ed)|dismissed|user did not share/i.test(error.message)
  );
}

export function createNativeWorksheetExporter(
  dependencies: NativeWorksheetExportDependencies,
): WorksheetExporter {
  return {
    experience: { primaryLabel: "Share PDF", printAvailable: false },
    async export(session): Promise<WorksheetExportResult> {
      if (!(await dependencies.canShare())) return { status: "unavailable" };

      const filename = sanitizeWorksheetFilename(session.book.title);
      let outcome: WorksheetExportResult | undefined;
      let primaryError: unknown;
      let cacheWriteAttempted = false;
      try {
        const bytes = dependencies.buildPdfBytes(session);
        cacheWriteAttempted = true;
        const uri = await dependencies.writeCacheFile(
          filename,
          bytesToBase64(bytes),
        );
        try {
          await dependencies.shareFile(uri, filename);
          outcome = { status: "shared" };
        } catch (error) {
          if (isCancellation(error)) outcome = { status: "cancelled" };
          else primaryError = error;
        }
      } catch (error) {
        primaryError = error;
      }

      let cleanupFailed = false;
      if (cacheWriteAttempted) {
        try {
          await dependencies.deleteCacheFile(filename);
        } catch {
          cleanupFailed = true;
        }
      }

      if (primaryError)
        throw new WorksheetShareError(primaryError, cleanupFailed);
      if (!outcome) throw new WorksheetShareError(undefined, cleanupFailed);
      return cleanupFailed ? { ...outcome, cleanupFailed: true } : outcome;
    },
  };
}

export const nativeWorksheetExporter = createNativeWorksheetExporter({
  buildPdfBytes(session) {
    return new Uint8Array(buildWorksheetPdf(session).output("arraybuffer"));
  },
  async canShare() {
    const result = await Share.canShare();
    return result.value;
  },
  async writeCacheFile(filename, base64Data) {
    const result = await Filesystem.writeFile({
      path: filename,
      data: base64Data,
      directory: Directory.Cache,
    });
    return result.uri;
  },
  async shareFile(uri, filename) {
    await Share.share({
      title: "Evoke Ink worksheet",
      text: filename,
      files: [uri],
      dialogTitle: "Share worksheet PDF",
    });
  },
  async deleteCacheFile(filename) {
    await Filesystem.deleteFile({
      path: filename,
      directory: Directory.Cache,
    });
  },
});
