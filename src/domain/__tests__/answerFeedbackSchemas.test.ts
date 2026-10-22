import { describe, expect, it } from "vitest";
import {
  answerFeedbackInputSchema,
  answerFeedbackSchema,
} from "../answerFeedbackSchemas";

const validInput = {
  prompt: {
    text: "Explain the character's choice using a detail from the reading.",
    skill: "evidence_and_explanation",
    difficultyLevel: "grade_level",
  },
  profile: {
    gradeOrAge: "Grade 3",
    readingLevel: "Independent Grade 4 texts",
    lexile: "650L",
    difficulty: "challenging",
    responseLength: "medium",
  },
  responseText:
    "The character chose to help because she noticed her friend was struggling. For example, she stopped what she was doing and offered support.",
};

const validFeedback = {
  strengths: ["You answered the question with a clear idea."],
  observedEvidence: ["You included a detail from your response."],
  missedOrUnclear: [],
  nextStep: "Explain how your detail supports your main idea.",
  revisionQuestion:
    "How does the detail prove why the character made that choice?",
  grounding: "response_and_prompt",
  limitation:
    "I can coach how well your response addresses the prompt, but I cannot verify book facts from the information provided.",
};

describe("answer feedback input schema", () => {
  it("accepts only the prompt, learning profile, and confirmed response", () => {
    expect(answerFeedbackInputSchema.parse(validInput)).toEqual(validInput);
  });

  it.each([
    ["child name", { ...validInput, childName: "Aavya" }],
    ["local identifier", { ...validInput, sessionId: "session-1" }],
    ["book metadata", { ...validInput, book: { title: "A Book" } }],
    ["parent notes", { ...validInput, parentNotes: "Private notes" }],
    [
      "nested prompt identifier",
      { ...validInput, prompt: { ...validInput.prompt, id: "prompt-1" } },
    ],
    [
      "nested profile name",
      { ...validInput, profile: { ...validInput.profile, name: "Aavya" } },
    ],
  ])("rejects an unknown or private %s field", (_label, input) => {
    expect(() => answerFeedbackInputSchema.parse(input)).toThrow();
  });

  it.each(["", "   ", "x".repeat(4001)])(
    "rejects an empty or oversized response",
    (responseText) => {
      expect(() =>
        answerFeedbackInputSchema.parse({ ...validInput, responseText }),
      ).toThrow();
    },
  );
});

describe("answer feedback output schema", () => {
  it("accepts complete, bounded structured feedback", () => {
    expect(answerFeedbackSchema.parse(validFeedback)).toEqual(validFeedback);
  });

  it("requires one or two strengths", () => {
    expect(() =>
      answerFeedbackSchema.parse({ ...validFeedback, strengths: [] }),
    ).toThrow();
    expect(() =>
      answerFeedbackSchema.parse({
        ...validFeedback,
        strengths: ["One", "Two", "Three"],
      }),
    ).toThrow();
  });

  it.each(["observedEvidence", "nextStep", "revisionQuestion", "grounding"])(
    "rejects feedback missing %s",
    (field) => {
      const incomplete = { ...validFeedback } as Record<string, unknown>;
      delete incomplete[field];
      expect(() => answerFeedbackSchema.parse(incomplete)).toThrow();
    },
  );

  it("requires an explicit limitation field and rejects unknown grading fields", () => {
    const missingLimitation = { ...validFeedback } as Record<string, unknown>;
    delete missingLimitation["limitation"];
    expect(() => answerFeedbackSchema.parse(missingLimitation)).toThrow();
    expect(() =>
      answerFeedbackSchema.parse({ ...validFeedback, score: 85 }),
    ).toThrow();
  });

  it("rejects a null limitation", () => {
    expect(() =>
      answerFeedbackSchema.parse({ ...validFeedback, limitation: null }),
    ).toThrow();
  });
});
