import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NATIVE_BACK_EVENT } from "@/client/nativeBack";
import type { ChildProfile, ReadingSession } from "@/domain/schemas";
import { createLocalRepository } from "@/storage/repository";
import { AppShell } from "./AppShell";

const profile: ChildProfile = {
  id: "child-coaching",
  name: "Reader",
  gradeOrAge: "Grade 5",
  readingLevel: "Independent",
  difficulty: "challenging",
  responseLength: "medium",
  createdAt: "2026-10-22T00:00:00.000Z",
  updatedAt: "2026-10-22T00:00:00.000Z",
};

const session: ReadingSession = {
  id: "session-coaching",
  childId: profile.id,
  childSnapshot: profile,
  book: {
    title: "A Book",
    author: "An Author",
    genre: "fiction",
    progress: "Complete",
  },
  specificity: "general",
  skills: ["inference"],
  parentNotes: "",
  parentSummary: "",
  detailNotes: "",
  generatedPrompts: [],
  prompts: [
    {
      id: "prompt-one",
      text: "Why did the character make this choice? Explain with evidence from the reading.",
      skill: "inference",
      explanation: "Practices inference with evidence.",
      required: true,
      suggestedResponseLength: "3-4 sentences",
      grounding: "generic",
      difficultyLevel: "challenging",
    },
    {
      id: "prompt-two",
      text: "How did the setting affect the problem? Explain your thinking clearly.",
      skill: "cause_and_effect",
      explanation: "Practices cause and effect.",
      required: true,
      suggestedResponseLength: "3-4 sentences",
      grounding: "generic",
      difficultyLevel: "challenging",
    },
  ],
  createdAt: "2026-10-22T00:00:00.000Z",
  updatedAt: "2026-10-22T00:00:00.000Z",
  status: "ready",
};

const feedback = {
  strengths: ["You stated a clear idea.", "You included a useful detail."],
  observedEvidence: ["The response explains a reason for the choice."],
  missedOrUnclear: [
    "The connection between the detail and the choice is unclear.",
  ],
  nextStep: "Explain how your detail supports your main idea.",
  revisionQuestion:
    "How does that detail prove why the character acted this way?",
  grounding: "response_and_prompt",
  limitation:
    "I can help improve the explanation, but I cannot confirm every book detail from the available information.",
} as const;

function storedState() {
  return Object.fromEntries(
    Array.from({ length: localStorage.length }, (_, index) => {
      const key = localStorage.key(index)!;
      return [key, localStorage.getItem(key)];
    }),
  );
}

async function openResponseReview(promptNumber = 1) {
  const user = userEvent.setup();
  render(<AppShell />);
  await user.click(
    await screen.findByRole("button", { name: "Saved reflections" }),
  );
  await user.click(screen.getByRole("button", { name: "View & reprint" }));
  const reviewButtons = screen.getAllByRole("button", {
    name: "Review a response",
  });
  await user.click(reviewButtons[promptNumber - 1]!);
  return user;
}

async function openStrictModeResponseReview() {
  const user = userEvent.setup();
  render(
    <StrictMode>
      <AppShell />
    </StrictMode>,
  );
  await user.click(
    await screen.findByRole("button", { name: "Saved reflections" }),
  );
  await user.click(screen.getByRole("button", { name: "View & reprint" }));
  await user.click(
    screen.getAllByRole("button", { name: "Review a response" })[0]!,
  );
  return user;
}

describe("typed response coaching", () => {
  beforeEach(() => {
    localStorage.clear();
    const repository = createLocalRepository(localStorage);
    repository.saveProfile(profile);
    repository.saveSession(session);
  });

  it("keeps the selected prompt visible, validates locally, and announces loading", async () => {
    let resolveRequest!: (response: Response) => void;
    const fetchMock = vi.fn(
      (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Promise<Response>((resolve) => (resolveRequest = resolve)),
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = await openResponseReview(2);

    expect(
      screen.getByRole("heading", { name: "Review this response" }),
    ).toBeInTheDocument();
    expect(screen.getByText(session.prompts[1]!.text)).toBeInTheDocument();

    const responseField = screen.getByLabelText("Student response");
    await user.click(screen.getByRole("button", { name: "Get feedback" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Enter the response before requesting feedback",
    );
    expect(responseField).toHaveFocus();
    expect(fetchMock).not.toHaveBeenCalled();

    await user.type(responseField, "The setting made the problem harder.");
    await user.click(screen.getByRole("button", { name: "Get feedback" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Reviewing response...",
    );
    expect(
      screen.getByRole("button", { name: "Reviewing response..." }),
    ).toBeDisabled();

    resolveRequest(
      Response.json({ feedback, provider: "mock", fallback: false }),
    );
    await screen.findByRole("heading", { name: "What you did well" });
    expect(fetchMock).toHaveBeenCalledOnce();
    const request = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({
      prompt: { text: session.prompts[1]!.text },
      responseText: "The setting made the problem harder.",
    });
  });

  it("retains the draft after failure, supports retry, and renders strength-first feedback", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(
        Response.json({ feedback, provider: "mock", fallback: false }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const user = await openResponseReview();
    const responseField = screen.getByLabelText("Student response");
    const draft = "The character chose to help because it was the fair choice.";
    fireEvent.change(responseField, { target: { value: draft } });
    await user.click(screen.getByRole("button", { name: "Get feedback" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Feedback is unavailable right now. Your response is still here, so you can try again.",
    );
    expect(responseField).toHaveValue(draft);

    await user.click(screen.getByRole("button", { name: "Try again" }));
    const strengthHeading = await screen.findByRole("heading", {
      name: "What you did well",
    });
    const evidenceHeading = screen.getByRole("heading", {
      name: "What your response includes",
    });
    const missingHeading = screen.getByRole("heading", {
      name: "What may be missing or unclear",
    });
    expect(strengthHeading.compareDocumentPosition(evidenceHeading)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(evidenceHeading.compareDocumentPosition(missingHeading)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(screen.getByText(feedback.nextStep)).toBeInTheDocument();
    expect(screen.getByText(feedback.revisionQuestion)).toBeInTheDocument();
    expect(screen.getByText(feedback.limitation)).toBeInTheDocument();
    expect(
      screen.queryByText(/score|grade|pass|fail/i),
    ).not.toBeInTheDocument();
  });

  it("settles failed and successful async reviews under StrictMode", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(
        Response.json({ feedback, provider: "mock", fallback: false }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const user = await openStrictModeResponseReview();
    fireEvent.change(screen.getByLabelText("Student response"), {
      target: { value: "The character chose to help because it was fair." },
    });
    await user.click(screen.getByRole("button", { name: "Get feedback" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Feedback is unavailable right now",
    );
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByRole("heading", { name: "What you did well" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Get feedback" })).toBeEnabled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("discards ephemeral review data on Done and native Back without changing storage", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ feedback, provider: "mock", fallback: false }),
      ),
    );
    const before = storedState();
    const user = await openResponseReview();
    fireEvent.change(screen.getByLabelText("Student response"), {
      target: { value: "A temporary answer that must never be saved." },
    });
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(
      screen.getByRole("region", { name: "Printable worksheet preview" }),
    ).toBeInTheDocument();
    expect(storedState()).toEqual(before);

    await user.click(
      screen.getAllByRole("button", { name: "Review a response" })[0]!,
    );
    fireEvent.change(screen.getByLabelText("Student response"), {
      target: { value: "Another temporary response." },
    });
    const nativeBack = new Event(NATIVE_BACK_EVENT, { cancelable: true });
    act(() => window.dispatchEvent(nativeBack));
    expect(nativeBack.defaultPrevented).toBe(true);
    expect(
      screen.getByRole("region", { name: "Printable worksheet preview" }),
    ).toBeInTheDocument();
    expect(storedState()).toEqual(before);
  });
});
