import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReadingSession } from "@/domain/schemas";

const { downloadWorksheet } = vi.hoisted(() => ({
  downloadWorksheet: vi.fn(),
}));
vi.mock("../downloadWorksheet", () => ({ downloadWorksheet }));

import {
  exportWorksheet,
  getWorksheetExportExperience,
  installWorksheetExporter,
} from "../worksheetExport";

const restores: Array<() => void> = [];

afterEach(() => {
  while (restores.length) restores.pop()?.();
  downloadWorksheet.mockClear();
});

describe("worksheet export boundary", () => {
  it("preserves browser PDF download and print capabilities by default", async () => {
    const session = {} as ReadingSession;
    expect(getWorksheetExportExperience()).toEqual({
      primaryLabel: "Download PDF",
      printAvailable: true,
    });
    await expect(exportWorksheet(session)).resolves.toEqual({
      status: "downloaded",
    });
    expect(downloadWorksheet).toHaveBeenCalledWith(session);
  });

  it("installs and restores a host-specific exporter", async () => {
    const native = {
      experience: { primaryLabel: "Share PDF", printAvailable: false },
      export: vi.fn(async () => ({ status: "shared" as const })),
    };
    restores.push(installWorksheetExporter(native));
    expect(getWorksheetExportExperience()).toEqual(native.experience);
    await expect(exportWorksheet({} as ReadingSession)).resolves.toEqual({
      status: "shared",
    });
  });
});
