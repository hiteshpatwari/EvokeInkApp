import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ChildProfile, ReadingSession } from "@/domain/schemas";
import { createBackupJson } from "@/storage/backup";
import { DataBackupPanel } from "./DataBackupPanel";

const profile: ChildProfile = {
  id: "child-1",
  name: "Aavya",
  gradeOrAge: "Grade 3",
  difficulty: "challenging",
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

function backupFile(profiles = [profile], sessions = [session]) {
  return new File([createBackupJson(profiles, sessions)], "backup.json", {
    type: "application/json",
  });
}

describe("DataBackupPanel", () => {
  it("previews and merges a valid backup", async () => {
    const user = userEvent.setup();
    const onImport = vi.fn();
    render(<DataBackupPanel profiles={[]} sessions={[]} onImport={onImport} />);

    await user.upload(
      screen.getByLabelText("Choose backup file"),
      backupFile(),
    );
    expect(
      await screen.findByRole("heading", { name: "Review this backup" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/1 child profiles and/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Merge backup" }));
    expect(onImport).toHaveBeenCalledWith({
      profiles: [profile],
      sessions: [session],
    });
    expect(screen.getByRole("status")).toHaveTextContent("Backup merged");
  });

  it("requires a second confirmation before replacing current data", async () => {
    const user = userEvent.setup();
    const onImport = vi.fn();
    render(
      <DataBackupPanel
        profiles={[profile]}
        sessions={[session]}
        onImport={onImport}
      />,
    );

    await user.upload(
      screen.getByLabelText("Choose backup file"),
      backupFile([], []),
    );
    await user.click(
      await screen.findByRole("button", { name: "Replace all data" }),
    );
    expect(onImport).not.toHaveBeenCalled();
    const dialog = screen.getByRole("alertdialog", {
      name: "Replace all saved data?",
    });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(
      screen.getByRole("button", { name: "Confirm replacement" }),
    ).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Merge backup" }));
    expect(onImport).not.toHaveBeenCalled();

    await user.tab({ shift: true });
    expect(
      screen.getByRole("button", { name: "Keep current data" }),
    ).toHaveFocus();
    await user.tab();
    expect(
      screen.getByRole("button", { name: "Confirm replacement" }),
    ).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    const replaceTrigger = screen.getByRole("button", {
      name: "Replace all data",
    });
    expect(replaceTrigger).toHaveFocus();

    await user.click(replaceTrigger);

    await user.click(
      screen.getByRole("button", { name: "Confirm replacement" }),
    );
    expect(onImport).toHaveBeenCalledWith({ profiles: [], sessions: [] });
  });

  it("rejects malformed files without calling the import boundary", async () => {
    const user = userEvent.setup();
    const onImport = vi.fn();
    render(<DataBackupPanel profiles={[]} sessions={[]} onImport={onImport} />);

    await user.upload(
      screen.getByLabelText("Choose backup file"),
      new File(["not json"], "broken.json", { type: "application/json" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "not a valid Read & Reflect backup",
    );
    expect(onImport).not.toHaveBeenCalled();
  });

  it("keeps the candidate available and reports a failed save", async () => {
    const user = userEvent.setup();
    const onImport = vi.fn(() => {
      throw new Error("Storage is unavailable");
    });
    render(<DataBackupPanel profiles={[]} sessions={[]} onImport={onImport} />);

    await user.upload(
      screen.getByLabelText("Choose backup file"),
      backupFile(),
    );
    await user.click(
      await screen.findByRole("button", { name: "Merge backup" }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Reload the app and confirm your current data",
    );
    expect(
      screen.getByRole("heading", { name: "Review this backup" }),
    ).toBeInTheDocument();
  });
});
