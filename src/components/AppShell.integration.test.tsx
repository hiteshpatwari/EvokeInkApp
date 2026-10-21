import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";
import type {
  ChildProfile,
  ReadingSession,
  WorksheetPrompt,
} from "@/domain/schemas";
import { createLocalRepository } from "@/storage/repository";
import { createBackupJson } from "@/storage/backup";
import { NATIVE_BACK_EVENT } from "@/client/nativeBack";

const generatedPrompts = Array.from({ length: 4 }, (_, index) => ({
  text: `Choose one important idea for reflection ${index + 1}. Give a detail and explain your reasoning.`,
  skill: index === 0 ? "concise_summary" : "evidence_and_explanation",
  explanation: "Practices a clear answer supported by evidence.",
  required: index < 3,
  suggestedResponseLength: "3-4 sentences",
  grounding: "generic" as const,
  difficultyLevel: "advanced" as const,
}));

function mockSuccessfulGeneration() {
  return vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) =>
      ({
        ok: true,
        json: async () => ({
          prompts: generatedPrompts,
          provider: "mock",
          fallback: false,
        }),
      }) as Response,
  );
}

describe("Read & Reflect workflow", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("fetch", mockSuccessfulGeneration());
  });

  it("uses native Back to return from application screens without exiting", async () => {
    const repository = createLocalRepository(localStorage);
    repository.saveProfile({
      id: "child-back",
      name: "Aavya",
      gradeOrAge: "Grade 3",
      difficulty: "advanced",
      responseLength: "medium",
      createdAt: "2026-10-12T00:00:00.000Z",
      updatedAt: "2026-10-12T00:00:00.000Z",
    });

    const user = userEvent.setup();
    render(<AppShell />);
    await user.click(
      await screen.findByRole("button", { name: "Create a worksheet" }),
    );
    expect(
      screen.getByRole("heading", { name: "What did Aavya read?" }),
    ).toBeInTheDocument();

    const createBack = new Event(NATIVE_BACK_EVENT, { cancelable: true });
    act(() => window.dispatchEvent(createBack));
    expect(createBack.defaultPrevented).toBe(true);
    expect(
      screen.getByRole("heading", {
        name: "Turn one good reading moment into thoughtful writing.",
      }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "+ Add reader" }));
    const profileBack = new Event(NATIVE_BACK_EVENT, { cancelable: true });
    act(() => window.dispatchEvent(profileBack));
    expect(profileBack.defaultPrevented).toBe(true);
    expect(
      screen.getByRole("heading", {
        name: "Turn one good reading moment into thoughtful writing.",
      }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Saved reflections" }));
    const savedBack = new Event(NATIVE_BACK_EVENT, { cancelable: true });
    act(() => window.dispatchEvent(savedBack));
    expect(savedBack.defaultPrevented).toBe(true);
    expect(
      screen.getByRole("heading", {
        name: "Turn one good reading moment into thoughtful writing.",
      }),
    ).toBeInTheDocument();
  });

  it("creates a profile, generates, validates edits, saves, and reloads a worksheet", async () => {
    const user = userEvent.setup();
    const first = render(<AppShell />);
    await user.click(
      await screen.findByRole("button", {
        name: "Create your first child profile",
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "Use Aavya demo values" }),
    );
    expect(screen.getByLabelText("Preferred difficulty")).toHaveValue(
      "advanced",
    );
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    await user.click(
      await screen.findByRole("button", { name: "Create a worksheet" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Load the Prince Caspian example" }),
    );
    expect(screen.getByText(/sent to our AI service/i)).toHaveTextContent(
      "When OpenAI generation is enabled, reading profile settings, book details, progress, selected skills, and any notes you add are sent to our AI service and OpenAI to create prompts. The child’s name is not sent to OpenAI.",
    );
    await user.click(
      screen.getByRole("button", { name: "Generate 4 prompts" }),
    );

    const firstPrompt = await screen.findByLabelText("Prompt 1");
    await user.clear(firstPrompt);
    await user.click(screen.getByRole("button", { name: "Save & preview" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /too small|check each prompt/i,
    );
    expect(
      screen.getByRole("heading", { name: /Shape the worksheet/i }),
    ).toBeInTheDocument();

    await user.type(
      firstPrompt,
      "Choose one important idea and explain it with evidence from the reading.",
    );
    await user.click(screen.getByRole("button", { name: "Save & preview" }));
    expect(
      await screen.findByRole("region", {
        name: "Printable worksheet preview",
      }),
    ).toBeInTheDocument();
    const savedSessions = createLocalRepository(localStorage).loadSessions();
    expect(savedSessions).toHaveLength(1);
    expect(savedSessions[0]?.generatedPrompts[0]?.text).toBe(
      generatedPrompts[0]?.text,
    );
    expect(savedSessions[0]?.prompts[0]?.text).not.toBe(
      savedSessions[0]?.generatedPrompts[0]?.text,
    );

    first.unmount();
    render(<AppShell />);
    expect(
      await screen.findByText("0 reflections completed"),
    ).toBeInTheDocument();
    expect(screen.getByText("1 saved worksheet")).toBeInTheDocument();
    expect(
      screen.getByText("The Chronicles of Narnia: Prince Caspian"),
    ).toBeInTheDocument();
  });

  it("validates notes mode, sends only the permitted notes payload, and labels grounded prompts", async () => {
    const repository = createLocalRepository(localStorage);
    repository.saveProfile({
      id: "child-notes",
      name: "Private Child Name",
      gradeOrAge: "Grade 5",
      readingLevel: "Advanced",
      lexile: "900L",
      difficulty: "challenging",
      responseLength: "medium",
      createdAt: "2026-10-12T00:00:00.000Z",
      updatedAt: "2026-10-12T00:00:00.000Z",
    });
    const groundedPrompts = generatedPrompts.map((prompt, index) => ({
      ...prompt,
      text:
        index === 1
          ? "Use the supplied summary to make a claim and support it from the book."
          : index === 2
            ? "Use the supplied parent notes and reading detail to form an inference."
            : prompt.text,
      grounding:
        index === 1
          ? ("parent_summary" as const)
          : index === 2
            ? ("parent_notes" as const)
            : ("generic" as const),
    }));
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        ({
          ok: true,
          json: async () => ({ prompts: groundedPrompts, provider: "mock" }),
        }) as Response,
    );
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<AppShell />);
    await user.click(
      await screen.findByRole("button", { name: "Create a worksheet" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Load the Prince Caspian example" }),
    );
    await user.click(
      screen.getByRole("radio", {
        name: /Use my notes for more specific prompts/,
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "Generate 4 prompts" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Add a summary or note, or choose general prompts.",
    );
    expect(fetchMock).not.toHaveBeenCalled();

    await user.type(
      screen.getByLabelText("Short summary of what was read"),
      "The supplied summary describes a difficult decision.",
    );
    await user.type(
      screen.getByLabelText("Parent notes"),
      "The reader wondered why the decision was delayed.",
    );
    await user.type(
      screen.getByLabelText("Vocabulary, character, event, or theme notes"),
      "The supplied detail mentions a locked gate.",
    );
    await user.click(
      screen.getByRole("button", { name: "Generate 4 prompts" }),
    );

    await screen.findByLabelText("Prompt 1");
    expect(screen.getByText("Based on parent summary")).toBeInTheDocument();
    expect(screen.getByText("Based on parent notes")).toBeInTheDocument();
    const requestOptions = fetchMock.mock.calls[0]?.[1];
    if (!requestOptions) throw new Error("Expected prompt request options");
    const payload = JSON.parse(String(requestOptions.body));
    expect(payload).toEqual({
      child: {
        gradeOrAge: "Grade 5",
        readingLevel: "Advanced",
        lexile: "900L",
        difficulty: "challenging",
        responseLength: "medium",
      },
      book: {
        title: "The Chronicles of Narnia: Prince Caspian",
        author: "C. S. Lewis",
        genre: "fiction",
        progress: "Pages 1-60",
      },
      specificity: "notes",
      skills: ["evidence_and_explanation", "inference"],
      parentNotes: "The reader wondered why the decision was delayed.",
      parentSummary: "The supplied summary describes a difficult decision.",
      detailNotes: "The supplied detail mentions a locked gate.",
      variant: 0,
    });
    expect(JSON.stringify(payload)).not.toContain("Private Child Name");
    expect(payload).not.toHaveProperty("profileId");
    expect(payload).not.toHaveProperty("worksheetId");
  });

  it("tracks completed reflections separately from saved worksheets", async () => {
    const repository = createLocalRepository(localStorage);
    const profile: ChildProfile = {
      id: "child-1",
      name: "Aavya",
      gradeOrAge: "Grade 3",
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
      generatedPrompts: generatedPrompts.map((prompt, index) => ({
        ...prompt,
        id: "generated-prompt-" + index,
      })),
      prompts: generatedPrompts.map((prompt, index) => ({
        ...prompt,
        id: "prompt-" + index,
      })),
      createdAt: "2026-10-12T00:00:00.000Z",
      updatedAt: "2026-10-12T00:00:00.000Z",
      status: "ready",
    };
    repository.saveProfile(profile);
    repository.saveSession(session);

    const user = userEvent.setup();
    render(<AppShell />);
    await user.click(
      await screen.findByRole("button", { name: "Saved reflections" }),
    );
    await user.click(screen.getByRole("button", { name: "Mark completed" }));
    expect(repository.loadSessions()[0]?.status).toBe("completed");
    await user.click(screen.getByRole("button", { name: "Home" }));
    expect(
      await screen.findByText("1 reflection completed"),
    ).toBeInTheDocument();
  });

  it("requires confirmation before deleting a saved worksheet", async () => {
    const repository = createLocalRepository(localStorage);
    const profile: ChildProfile = {
      id: "child-delete",
      name: "Aavya",
      gradeOrAge: "Grade 3",
      difficulty: "advanced",
      responseLength: "medium",
      createdAt: "2026-10-12T00:00:00.000Z",
      updatedAt: "2026-10-12T00:00:00.000Z",
    };
    const prompts: WorksheetPrompt[] = generatedPrompts.map(
      (prompt, index) => ({ ...prompt, id: `delete-prompt-${index}` }),
    );
    const session: ReadingSession = {
      id: "session-delete",
      childId: profile.id,
      childSnapshot: profile,
      book: {
        title: "Keep This Book",
        author: "An Author",
        genre: "fiction",
        progress: "Pages 1-10",
      },
      specificity: "general",
      skills: ["inference"],
      parentNotes: "",
      parentSummary: "",
      detailNotes: "",
      generatedPrompts: prompts.map((prompt) => ({ ...prompt })),
      prompts,
      createdAt: "2026-10-12T00:00:00.000Z",
      updatedAt: "2026-10-12T00:00:00.000Z",
      status: "ready",
    };
    repository.saveProfile(profile);
    repository.saveSession(session);

    const user = userEvent.setup();
    render(<AppShell />);
    await user.click(
      await screen.findByRole("button", { name: "Saved reflections" }),
    );

    const deleteTrigger = screen.getByRole("button", { name: "Delete" });
    await user.click(deleteTrigger);
    const confirmation = screen.getByRole("alertdialog", {
      name: "Delete this worksheet?",
    });
    expect(confirmation).toHaveAttribute("aria-modal", "true");
    expect(confirmation).toHaveTextContent("Keep This Book");
    expect(repository.loadSessions()).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: "Delete worksheet" }),
    ).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Home" }));
    expect(
      screen.getByRole("alertdialog", { name: "Delete this worksheet?" }),
    ).toBeInTheDocument();

    await user.tab({ shift: true });
    expect(
      screen.getByRole("button", { name: "Keep worksheet" }),
    ).toHaveFocus();
    await user.tab();
    expect(
      screen.getByRole("button", { name: "Delete worksheet" }),
    ).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(deleteTrigger).toHaveFocus();

    await user.click(deleteTrigger);
    await user.click(screen.getByRole("button", { name: "Delete worksheet" }));
    expect(repository.loadSessions()).toHaveLength(0);
    expect(screen.queryByText("Keep This Book")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Worksheet deleted from this device.",
    );
  });

  it("replaces saved data and clears stale filters and deletion state after import", async () => {
    const repository = createLocalRepository(localStorage);
    const existingProfile: ChildProfile = {
      id: "child-existing",
      name: "Existing reader",
      gradeOrAge: "Grade 3",
      difficulty: "grade_level",
      responseLength: "medium",
      createdAt: "2026-10-12T00:00:00.000Z",
      updatedAt: "2026-10-12T00:00:00.000Z",
    };
    const existingPrompts: WorksheetPrompt[] = generatedPrompts.map(
      (prompt, index) => ({ ...prompt, id: `existing-prompt-${index}` }),
    );
    const existingSession: ReadingSession = {
      id: "session-existing",
      childId: existingProfile.id,
      childSnapshot: existingProfile,
      book: {
        title: "Existing Book",
        author: "Existing Author",
        genre: "fiction",
        progress: "Pages 1-10",
      },
      specificity: "general",
      skills: ["inference"],
      parentNotes: "",
      parentSummary: "",
      detailNotes: "",
      generatedPrompts: existingPrompts.map((prompt) => ({ ...prompt })),
      prompts: existingPrompts,
      createdAt: "2026-10-12T00:00:00.000Z",
      updatedAt: "2026-10-12T00:00:00.000Z",
      status: "ready",
    };
    repository.saveProfile(existingProfile);
    repository.saveSession(existingSession);

    const importedProfile: ChildProfile = {
      ...existingProfile,
      id: "child-imported",
      name: "Imported reader",
      gradeOrAge: "Grade 8",
    };
    const importedSession: ReadingSession = {
      ...existingSession,
      id: "session-imported",
      childId: importedProfile.id,
      childSnapshot: importedProfile,
      book: {
        ...existingSession.book,
        title: "Imported Book",
      },
    };
    const backup = new File(
      [createBackupJson([importedProfile], [importedSession])],
      "replacement.json",
      { type: "application/json" },
    );

    const user = userEvent.setup();
    render(<AppShell />);
    await user.click(
      await screen.findByRole("button", { name: "Saved reflections" }),
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Filter by child" }),
      existingProfile.id,
    );
    await user.type(
      screen.getByRole("textbox", { name: /Filter by child or book/ }),
      "Existing",
    );
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(
      screen.getByRole("alertdialog", { name: "Delete this worksheet?" }),
    ).toBeInTheDocument();
    await user.keyboard("{Escape}");

    await user.upload(screen.getByLabelText("Choose backup file"), backup);
    await user.click(
      await screen.findByRole("button", { name: "Replace all data" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Confirm replacement" }),
    );

    expect(repository.loadProfiles()).toEqual([importedProfile]);
    expect(repository.loadSessions()).toEqual([importedSession]);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Filter by child" }),
    ).toHaveValue("all");
    expect(
      screen.getByRole("textbox", { name: /Filter by child or book/ }),
    ).toHaveValue("");
    expect(screen.getByText("Imported Book")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Home" }));
    expect(await screen.findByText("Imported reader")).toBeInTheDocument();
    expect(screen.queryByText("Existing reader")).not.toBeInTheDocument();
  });

  it("regenerates a saved worksheet using its generation-time profile snapshot", async () => {
    const repository = createLocalRepository(localStorage);
    const oldProfile: ChildProfile = {
      id: "child-1",
      name: "Aavya",
      gradeOrAge: "Grade 3",
      difficulty: "advanced",
      responseLength: "medium",
      createdAt: "2026-10-12T00:00:00.000Z",
      updatedAt: "2026-10-12T00:00:00.000Z",
    };
    const currentProfile = {
      ...oldProfile,
      gradeOrAge: "Grade 4",
      updatedAt: "2026-10-12T01:00:00.000Z",
    };
    const prompts: WorksheetPrompt[] = generatedPrompts.map(
      (prompt, index) => ({ ...prompt, id: `prompt-${index}` }),
    );
    const session: ReadingSession = {
      id: "session-1",
      childId: oldProfile.id,
      childSnapshot: oldProfile,
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
      generatedPrompts: prompts.map((prompt) => ({ ...prompt })),
      prompts,
      createdAt: "2026-10-12T00:00:00.000Z",
      updatedAt: "2026-10-12T00:00:00.000Z",
      status: "ready",
    };
    repository.saveProfile(currentProfile);
    repository.saveSession(session);
    const fetchMock = mockSuccessfulGeneration();
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<AppShell />);
    await user.click(
      await screen.findByRole("button", { name: "Saved reflections" }),
    );
    await user.click(screen.getByRole("button", { name: "View & reprint" }));
    await user.click(screen.getByRole("button", { name: "Edit prompts" }));
    await user.click(
      screen.getAllByRole("button", { name: "Regenerate this prompt" })[0]!,
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const request = fetchMock.mock.calls.at(-1)?.[1];
    if (!request) throw new Error("Expected prompt request options");
    const payload = JSON.parse(String(request.body)) as {
      child: { gradeOrAge: string };
    };
    expect(payload.child.gradeOrAge).toBe("Grade 3");
    expect(payload.child).not.toHaveProperty("name");
    expect(payload).not.toHaveProperty("profileId");
    expect(payload).not.toHaveProperty("worksheetId");
    expect(JSON.stringify(payload)).not.toContain(currentProfile.name);
    expect(new Headers(request.headers).get("x-installation-token")).toMatch(
      /^[0-9a-f-]{36}$/i,
    );
  });
});
