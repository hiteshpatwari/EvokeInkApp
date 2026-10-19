import { describe, expect, it } from "vitest";
import type { GenerationInput } from "@/domain/schemas";
import { serializeOpenAIContext } from "@/server/openAIPromptGenerator";

const input: GenerationInput = {
  child: {
    name: "Aavya Private Name",
    gradeOrAge: "Grade 3",
    readingLevel: "Independent: Grade 5",
    lexile: "820L",
    difficulty: "challenging",
    responseLength: "medium",
  },
  book: {
    title: "The Lion, the Witch and the Wardrobe",
    author: "C. S. Lewis",
    genre: "fiction",
    progress: "Chapters 1-3",
  },
  specificity: "notes",
  skills: ["inference", "evidence_and_explanation"],
  parentNotes: "The reader noticed a difficult choice.",
  parentSummary: "A supplied summary.",
  detailNotes: "A supplied detail.",
};

describe("serializeOpenAIContext", () => {
  it("excludes the child's name while retaining every reading-adaptation field", () => {
    const serialized = serializeOpenAIContext(input);
    const context = JSON.parse(serialized) as Record<string, unknown>;

    expect(serialized).not.toContain("Aavya Private Name");
    expect(context).toMatchObject({
      child: {
        gradeOrAge: "Grade 3",
        readingLevel: "Independent: Grade 5",
        lexile: "820L",
        difficulty: "challenging",
        responseLength: "medium",
      },
    });
    expect(context["child"]).not.toHaveProperty("name");
  });
});
