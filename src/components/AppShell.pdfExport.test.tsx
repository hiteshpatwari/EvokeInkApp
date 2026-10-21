import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChildProfile, ReadingSession } from "@/domain/schemas";
import { installWorksheetExporter } from "@/pdf/worksheetExport";
import { createLocalRepository } from "@/storage/repository";
import { AppShell } from "./AppShell";

const profile: ChildProfile = {
  id: "child-pdf",
  name: "Reader",
  gradeOrAge: "Grade 5",
  difficulty: "grade_level",
  responseLength: "medium",
  createdAt: "2026-10-21T00:00:00.000Z",
  updatedAt: "2026-10-21T00:00:00.000Z",
};

const session: ReadingSession = {
  id: "session-pdf",
  childId: profile.id,
  childSnapshot: profile,
  book: {
    title: "A Book",
    author: "An Author",
    genre: "fiction",
    progress: "Pages 1-10",
  },
  specificity: "general",
  skills: ["inference"],
  parentNotes: "",
  parentSummary: "",
  detailNotes: "",
  generatedPrompts: [],
  prompts: [],
  createdAt: "2026-10-21T00:00:00.000Z",
  updatedAt: "2026-10-21T00:00:00.000Z",
  status: "ready",
};

let restoreExporter: (() => void) | undefined;

beforeEach(() => {
  localStorage.clear();
  const repository = createLocalRepository(localStorage);
  repository.saveProfile(profile);
  repository.saveSession(session);
});

afterEach(() => {
  restoreExporter?.();
  restoreExporter = undefined;
});

async function openPreview() {
  const user = userEvent.setup();
  render(<AppShell />);
  await user.click(
    await screen.findByRole("button", { name: "Saved reflections" }),
  );
  await user.click(screen.getByRole("button", { name: "View & reprint" }));
  return user;
}

describe("worksheet PDF export UI", () => {
  it("uses truthful native share copy and hides the non-working print action", async () => {
    const exportPdf = vi.fn(async () => ({ status: "shared" as const }));
    restoreExporter = installWorksheetExporter({
      experience: { primaryLabel: "Share PDF", printAvailable: false },
      export: exportPdf,
    });
    const user = await openPreview();

    expect(
      screen.queryByRole("button", { name: "Print" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Share PDF" }));
    expect(exportPdf).toHaveBeenCalledWith(
      expect.objectContaining({ id: session.id }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Share sheet closed. The temporary PDF was removed.",
    );
  });

  it("resets screen scroll without focusing preview actions under the sticky native header", async () => {
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    document.documentElement.scrollTop = 202;
    restoreExporter = installWorksheetExporter({
      experience: { primaryLabel: "Share PDF", printAvailable: false },
      export: vi.fn(async () => ({ status: "shared" as const })),
    });

    await openPreview();

    await waitFor(() => expect(document.documentElement.scrollTop).toBe(0));
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    focus.mockRestore();
  });

  it("surfaces unavailable sharing without claiming success", async () => {
    restoreExporter = installWorksheetExporter({
      experience: { primaryLabel: "Share PDF", printAvailable: false },
      export: vi.fn(async () => ({ status: "unavailable" as const })),
    });
    const user = await openPreview();
    await user.click(screen.getByRole("button", { name: "Share PDF" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "PDF sharing is unavailable on this device.",
    );
  });

  it("prevents duplicate export while the share operation is pending", async () => {
    let resolveExport: ((value: { status: "shared" }) => void) | undefined;
    const exportPdf = vi.fn(
      () =>
        new Promise<{ status: "shared" }>((resolve) => {
          resolveExport = resolve;
        }),
    );
    restoreExporter = installWorksheetExporter({
      experience: { primaryLabel: "Share PDF", printAvailable: false },
      export: exportPdf,
    });
    const user = await openPreview();
    await user.click(screen.getByRole("button", { name: "Share PDF" }));
    expect(
      screen.getByRole("button", { name: "Preparing PDF…" }),
    ).toBeDisabled();
    expect(exportPdf).toHaveBeenCalledTimes(1);
    resolveExport?.({ status: "shared" });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Share PDF" })).toBeEnabled(),
    );
  });
});
