import { describe, expect, it } from "vitest";
import { toNetworkAnswerFeedbackInput } from "./answerFeedbackRequest";

describe("answer feedback request privacy boundary", () => {
  it("selects only the strict feedback DTO from local worksheet data", () => {
    const dto = toNetworkAnswerFeedbackInput({
      prompt: {
        id: "prompt-private-id",
        text: "Explain the character's choice using a detail from the reading.",
        skill: "inference",
        difficultyLevel: "challenging",
        required: true,
        explanation: "private explanation",
        suggestedResponseLength: "3-4 sentences",
        grounding: "generic",
      },
      childSnapshot: {
        id: "child-private-id",
        name: "Private Name",
        gradeOrAge: "Grade 3",
        readingLevel: "Grade 5 text",
        lexile: "820L",
        difficulty: "challenging",
        responseLength: "medium",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      responseText: "The character helped because a friend needed support.",
      book: { title: "Private Book" },
      parentNotes: "Private notes",
      sessionId: "session-private-id",
    });

    expect(dto).toEqual({
      prompt: {
        text: "Explain the character's choice using a detail from the reading.",
        skill: "inference",
        difficultyLevel: "challenging",
      },
      profile: {
        gradeOrAge: "Grade 3",
        readingLevel: "Grade 5 text",
        lexile: "820L",
        difficulty: "challenging",
        responseLength: "medium",
      },
      responseText: "The character helped because a friend needed support.",
    });
    expect(JSON.stringify(dto)).not.toMatch(
      /Private Name|private-id|Private Book|Private notes|createdAt/i,
    );
  });
});
