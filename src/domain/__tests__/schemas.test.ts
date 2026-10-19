import { describe, expect, it } from "vitest";
import { generationInputSchema, promptBatchSchema } from "../schemas";

const validInput = {
  child: {
    name: "Aavya",
    gradeOrAge: "Grade 3",
    readingLevel: "Independent high school-level texts",
    lexile: "1100L",
    difficulty: "advanced",
    responseLength: "medium",
  },
  book: {
    title: "Prince Caspian",
    author: "C. S. Lewis",
    genre: "fiction",
    progress: "Pages 1-60",
  },
  specificity: "general",
  skills: ["inference", "evidence_and_explanation"],
  parentNotes: "",
  parentSummary: "",
  detailNotes: "",
};

describe("generation input schema", () => {
  it("accepts a valid page range and optional empty notes", () => {
    expect(generationInputSchema.parse(validInput).book.progress).toBe(
      "Pages 1-60",
    );
  });

  it.each(["", "   ", "Pages", "1"])(
    'rejects an invalid progress value: "%s"',
    (progress) => {
      expect(() =>
        generationInputSchema.parse({
          ...validInput,
          book: { ...validInput.book, progress },
        }),
      ).toThrow();
    },
  );
});

describe("prompt output schema", () => {
  it("requires exactly three required prompts and one optional prompt", () => {
    const prompt = {
      text: "Choose one important idea and explain it with evidence from the reading.",
      skill: "evidence_and_explanation",
      explanation: "Practices supporting a claim with a detail.",
      required: true,
      suggestedResponseLength: "4-6 sentences",
      grounding: "generic",
      difficultyLevel: "advanced",
    };
    expect(() => promptBatchSchema.parse({ prompts: [prompt] })).toThrow();
    const prompts = [
      prompt,
      { ...prompt },
      { ...prompt },
      { ...prompt, required: false },
    ];
    expect(promptBatchSchema.parse({ prompts }).prompts).toHaveLength(4);
  });

  it("rejects unsupported grounding values", () => {
    const badPrompt = {
      text: "What did Edmund do?",
      skill: "inference",
      explanation: "Practices inference.",
      required: true,
      suggestedResponseLength: "3-4 sentences",
      grounding: "book_database",
      difficultyLevel: "grade_level",
    };
    expect(() =>
      promptBatchSchema.parse({
        prompts: [
          badPrompt,
          badPrompt,
          badPrompt,
          { ...badPrompt, required: false },
        ],
      }),
    ).toThrow();
  });
});
