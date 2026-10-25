import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProcessedResponsePhoto } from "@/client/responsePhotoProcessing";
import type { ChildProfile, WorksheetPrompt } from "@/domain/schemas";
import { ResponseReview } from "./ResponseReview";

const profile: ChildProfile = {
  id: "photo-child",
  name: "Reader",
  gradeOrAge: "Grade 5",
  readingLevel: "Independent",
  difficulty: "challenging",
  responseLength: "medium",
  createdAt: "2026-10-22T00:00:00.000Z",
  updatedAt: "2026-10-22T00:00:00.000Z",
};

const prompt: WorksheetPrompt = {
  id: "photo-prompt",
  text: "Explain the character's choice with one detail from the reading.",
  skill: "evidence_and_explanation",
  explanation: "Practices explaining evidence.",
  required: true,
  suggestedResponseLength: "3-4 sentences",
  grounding: "generic",
  difficultyLevel: "challenging",
};

const feedback = {
  strengths: ["You stated a clear idea."],
  observedEvidence: ["The response includes a reason."],
  missedOrUnclear: ["A reading detail is missing."],
  nextStep: "Add one detail from the reading.",
  revisionQuestion: "Which detail best supports the idea?",
  grounding: "response_and_prompt",
  limitation:
    "I can coach the response structure, but I cannot verify book facts.",
} as const;

function processedPhoto(dispose = vi.fn()): ProcessedResponsePhoto {
  return {
    blob: new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], {
      type: "image/jpeg",
    }),
    previewUrl: "blob:response-photo",
    width: 1200,
    height: 800,
    dispose,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("response photo preparation", () => {
  it("requires transcript confirmation and a separate feedback action", async () => {
    const user = userEvent.setup();
    const dispose = vi.fn();
    const processPhoto = vi.fn(async () => processedPhoto(dispose));
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        Response.json({ feedback, provider: "mock", fallback: false }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const view = render(
      <ResponseReview
        childSnapshot={profile}
        prompt={prompt}
        onDone={vi.fn()}
        processPhoto={processPhoto}
      />,
    );

    await user.type(
      screen.getByLabelText("Student response"),
      "Keep this typed draft until confirmation.",
    );
    await user.click(screen.getByRole("button", { name: "Use a photo" }));
    expect(screen.getByText(/processed temporarily/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Prepare one response photo" }),
    ).toHaveFocus();
    expect(
      screen.queryByRole("button", { name: "Get feedback" }),
    ).not.toBeInTheDocument();
    fireEvent.submit(view.container.querySelector("form")!);
    expect(fetchMock).not.toHaveBeenCalled();

    const file = new File(
      [new Uint8Array([0xff, 0xd8, 0xff, 0xd9])],
      "answer.jpg",
      {
        type: "image/jpeg",
      },
    );
    await user.upload(screen.getByLabelText("Choose one response photo"), file);
    expect(
      await screen.findByAltText("Selected response photo"),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Rotate right" }));
    await screen.findByAltText("Selected response photo");
    await user.click(screen.getByRole("button", { name: "Trim edges" }));
    await screen.findByAltText("Selected response photo");
    expect(fetchMock).not.toHaveBeenCalled();

    const transcript = screen.getByLabelText("Provisional transcript");
    await user.type(
      transcript,
      "The character chose to help because it was the fair choice.",
    );
    fireEvent.submit(view.container.querySelector("form")!);
    expect(fetchMock).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole("button", { name: "Confirm transcript" }),
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Student response")).toHaveValue(
      "The character chose to help because it was the fair choice.",
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Student response")).toHaveFocus(),
    );
    expect(dispose).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Get feedback" }));
    await screen.findByRole("heading", { name: "What you did well" });
    expect(fetchMock).toHaveBeenCalledOnce();
    const request = fetchMock.mock.calls[0]![1] as RequestInit;
    const body = JSON.parse(String(request.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      responseText:
        "The character chose to help because it was the fair choice.",
    });
    expect(JSON.stringify(body)).not.toMatch(/image|filename|blob|data:/i);
  });

  it("cleans up on discard and unmount without replacing a typed draft", async () => {
    const user = userEvent.setup();
    const firstDispose = vi.fn();
    const secondDispose = vi.fn();
    const processPhoto = vi
      .fn()
      .mockResolvedValueOnce(processedPhoto(firstDispose))
      .mockResolvedValueOnce(processedPhoto(secondDispose));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const view = render(
      <ResponseReview
        childSnapshot={profile}
        prompt={prompt}
        onDone={vi.fn()}
        processPhoto={processPhoto}
      />,
    );
    await user.type(screen.getByLabelText("Student response"), "Typed draft");
    await user.click(screen.getByRole("button", { name: "Use a photo" }));
    const fileInput = screen.getByLabelText("Choose one response photo");
    await user.upload(
      fileInput,
      new File([new Uint8Array([0xff, 0xd8, 0xff])], "one.jpg", {
        type: "image/jpeg",
      }),
    );
    await screen.findByAltText("Selected response photo");
    await user.click(screen.getByRole("button", { name: "Discard photo" }));
    expect(firstDispose).toHaveBeenCalledOnce();
    expect(screen.getByLabelText("Student response")).not.toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Type the response instead" }),
    );
    expect(screen.getByLabelText("Student response")).toHaveValue(
      "Typed draft",
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Student response")).toHaveFocus(),
    );

    await user.click(screen.getByRole("button", { name: "Use a photo" }));
    await user.upload(
      screen.getByLabelText("Choose one response photo"),
      new File([new Uint8Array([0xff, 0xd8, 0xff])], "two.jpg", {
        type: "image/jpeg",
      }),
    );
    await screen.findByAltText("Selected response photo");
    view.unmount();
    expect(secondDispose).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("offers safe recovery after processing rejection", async () => {
    const user = userEvent.setup();
    const processPhoto = vi.fn(async () => {
      throw new Error("decoder stack details");
    });
    vi.stubGlobal("fetch", vi.fn());
    render(
      <ResponseReview
        childSnapshot={profile}
        prompt={prompt}
        onDone={vi.fn()}
        processPhoto={processPhoto}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Use a photo" }));
    await user.upload(
      screen.getByLabelText("Choose one response photo"),
      new File([new Uint8Array([0xff, 0xd8, 0xff])], "bad.jpg", {
        type: "image/jpeg",
      }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "could not be prepared",
    );
    expect(screen.queryByText(/decoder stack/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Type the response instead" }),
    ).toBeEnabled();
    await user.click(
      screen.getByRole("button", { name: "Type the response instead" }),
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Student response")).toHaveFocus(),
    );
  });
});
