import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ChildProfile,
  ReadingSession,
  WorksheetPrompt,
} from "@/domain/schemas";
import { createLocalRepository } from "@/storage/repository";
import { AppShell } from "./AppShell";

const aavya: ChildProfile = {
  id: "child-aavya",
  name: "Aavya",
  gradeOrAge: "Grade 3",
  difficulty: "advanced",
  responseLength: "medium",
  createdAt: "2026-10-12T00:00:00.000Z",
  updatedAt: "2026-10-12T00:00:00.000Z",
};

const ben: ChildProfile = {
  ...aavya,
  id: "child-ben",
  name: "Ben",
  gradeOrAge: "Grade 5",
};

const prompt: WorksheetPrompt = {
  id: "prompt-1",
  text: "Choose one important idea and explain it with evidence from the reading.",
  skill: "evidence_and_explanation",
  explanation: "Practices an evidence-based response.",
  required: true,
  suggestedResponseLength: "3-4 sentences",
  grounding: "generic",
  difficultyLevel: "advanced",
};

const historicalSession: ReadingSession = {
  id: "session-aavya",
  childId: aavya.id,
  childSnapshot: aavya,
  book: {
    title: "A Historical Book",
    author: "An Author",
    genre: "fiction",
    progress: "Pages 1-10",
  },
  specificity: "general",
  skills: ["evidence_and_explanation"],
  parentNotes: "",
  parentSummary: "",
  detailNotes: "",
  generatedPrompts: [prompt],
  prompts: [prompt],
  createdAt: "2026-10-12T00:00:00.000Z",
  updatedAt: "2026-10-12T00:00:00.000Z",
  status: "ready",
};

describe("child profile deletion", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("retains historical worksheets, restores focus on cancel, and selects another active child", async () => {
    const repository = createLocalRepository(localStorage);
    repository.saveProfile(aavya);
    repository.saveProfile(ben);
    repository.saveSession(historicalSession);

    const user = userEvent.setup();
    render(<AppShell />);

    const deleteTrigger = await screen.findByRole("button", {
      name: "Delete Aavya profile",
    });
    await user.click(deleteTrigger);
    const confirmation = screen.getByRole("alertdialog", {
      name: "Delete Aavya’s profile?",
    });
    expect(confirmation).toHaveAttribute("aria-modal", "true");
    expect(confirmation).toHaveTextContent(
      "1 saved worksheet will stay available with Aavya’s original reading-profile details",
    );
    expect(
      screen.getByRole("button", { name: "Delete profile" }),
    ).toHaveFocus();

    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Keep profile" })).toHaveFocus();
    await user.tab();
    expect(
      screen.getByRole("button", { name: "Delete profile" }),
    ).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(deleteTrigger).toHaveFocus();

    await user.click(deleteTrigger);
    await user.click(screen.getByRole("button", { name: "Delete profile" }));

    expect(repository.loadProfiles()).toEqual([ben]);
    expect(repository.loadSessions()).toEqual([historicalSession]);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Aavya’s profile was deleted. 1 saved worksheet was kept.",
    );
    expect(
      screen.queryByRole("button", { name: "Delete Aavya profile" }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Create a worksheet" }),
    );
    expect(
      await screen.findByRole("heading", { name: "What did Ben read?" }),
    ).toBeInTheDocument();
  });

  it("keeps a deleted child available as a historical saved-library filter", async () => {
    const repository = createLocalRepository(localStorage);
    repository.saveProfile(aavya);
    repository.saveSession(historicalSession);

    const user = userEvent.setup();
    render(<AppShell />);
    await user.click(
      await screen.findByRole("button", { name: "Delete Aavya profile" }),
    );
    await user.click(screen.getByRole("button", { name: "Delete profile" }));
    await user.click(screen.getByRole("button", { name: "Saved reflections" }));

    const childFilter = screen.getByRole("combobox", {
      name: "Filter by child",
    });
    expect(childFilter).toHaveTextContent("Aavya (profile deleted)");
    await user.selectOptions(childFilter, aavya.id);
    expect(
      screen.getByRole("heading", { name: "A Historical Book" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "View & reprint" }),
    ).toBeInTheDocument();
  });
});
