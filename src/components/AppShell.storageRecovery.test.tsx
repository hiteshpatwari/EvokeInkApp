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

const profile: ChildProfile = {
  id: "child-recovery",
  name: "Aavya",
  gradeOrAge: "Grade 3",
  difficulty: "advanced",
  responseLength: "medium",
  createdAt: "2026-10-12T00:00:00.000Z",
  updatedAt: "2026-10-12T00:00:00.000Z",
};

const prompt: WorksheetPrompt = {
  id: "prompt-recovery",
  text: "Choose one important idea and explain it with evidence from the reading.",
  skill: "evidence_and_explanation",
  explanation: "Practices an evidence-based response.",
  required: true,
  suggestedResponseLength: "3-4 sentences",
  grounding: "generic",
  difficultyLevel: "advanced",
};

const session: ReadingSession = {
  id: "session-recovery",
  childId: profile.id,
  childSnapshot: profile,
  book: {
    title: "A Book Worth Keeping",
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

function seedDamagedData() {
  localStorage.setItem(
    "read-reflect:profiles:v1",
    JSON.stringify([
      profile,
      { id: "broken-profile", privateValue: "never show this profile value" },
    ]),
  );
  localStorage.setItem(
    "read-reflect:sessions:v1",
    JSON.stringify([
      { id: "broken-session", privateValue: "never show this session value" },
      session,
      { id: "another-broken-session" },
    ]),
  );
}

describe("saved-data recovery warning", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("reports skipped record counts without exposing stored contents and allows dismissal without cleanup", async () => {
    seedDamagedData();
    const user = userEvent.setup();
    render(<AppShell />);

    const warning = await screen.findByRole("alert", {
      name: "Some saved data could not be loaded",
    });
    expect(warning).toHaveTextContent("1 child profile");
    expect(warning).toHaveTextContent("2 worksheets");
    expect(warning).not.toHaveTextContent("never show this profile value");
    expect(warning).not.toHaveTextContent("never show this session value");
    expect(screen.getByText("A Book Worth Keeping")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Dismiss saved-data warning" }),
    );

    expect(
      screen.queryByRole("alert", {
        name: "Some saved data could not be loaded",
      }),
    ).not.toBeInTheDocument();
    expect(createLocalRepository(localStorage).getStorageDiagnostics()).toEqual(
      [
        {
          collection: "profiles",
          issue: "invalid_records",
          skippedRecords: 1,
        },
        {
          collection: "sessions",
          issue: "invalid_records",
          skippedRecords: 2,
        },
      ],
    );
  });

  it("cleans up only invalid records and keeps every valid profile and worksheet", async () => {
    seedDamagedData();
    const user = userEvent.setup();
    render(<AppShell />);

    await user.click(
      await screen.findByRole("button", { name: "Clean up saved data" }),
    );

    expect(
      screen.queryByRole("alert", {
        name: "Some saved data could not be loaded",
      }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Saved data cleaned up. 1 invalid child profile and 2 invalid worksheets were removed.",
    );

    const repository = createLocalRepository(localStorage);
    expect(repository.getStorageDiagnostics()).toEqual([]);
    expect(repository.loadProfiles()).toEqual([profile]);
    expect(repository.loadSessions()).toEqual([session]);
  });
});
