import type { ReadingSession } from "@/domain/schemas";
import { downloadWorksheet } from "./downloadWorksheet";

export type WorksheetExportStatus =
  | "downloaded"
  | "shared"
  | "cancelled"
  | "unavailable";

export interface WorksheetExportResult {
  status: WorksheetExportStatus;
  cleanupFailed?: boolean;
}

export interface WorksheetExportExperience {
  primaryLabel: string;
  printAvailable: boolean;
}

export interface WorksheetExporter {
  experience: WorksheetExportExperience;
  export(session: ReadingSession): Promise<WorksheetExportResult>;
}

const browserExporter: WorksheetExporter = {
  experience: { primaryLabel: "Download PDF", printAvailable: true },
  export(session) {
    downloadWorksheet(session);
    return Promise.resolve({ status: "downloaded" });
  },
};

let activeExporter = browserExporter;

export function installWorksheetExporter(
  exporter: WorksheetExporter,
): () => void {
  const previous = activeExporter;
  activeExporter = exporter;
  return () => {
    activeExporter = previous;
  };
}

export function getWorksheetExportExperience(): WorksheetExportExperience {
  return activeExporter.experience;
}

export function exportWorksheet(
  session: ReadingSession,
): Promise<WorksheetExportResult> {
  return activeExporter.export(session);
}
