import { describe, expect, it, vi } from "vitest";
import type { GenerationInput } from "@/domain/schemas";
import {
  OpenAIPromptGenerator,
  openAIRequestPolicy,
  serializeOpenAIContext,
} from "@/server/openAIPromptGenerator";

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

  it("disables OpenAI response storage", async () => {
    const output = {
      prompts: Array.from({ length: 4 }, (_, index) => ({
        text: "Choose one important idea and explain it using evidence.",
        skill: "evidence_and_explanation",
        explanation: "Practices a supported written explanation.",
        required: index < 3,
        suggestedResponseLength: "3-4 sentences",
        grounding: "generic" as const,
        difficultyLevel: "challenging" as const,
      })),
    };
    const parse = vi.fn().mockResolvedValue({ output_parsed: output });
    const client = {
      responses: { parse },
    } as unknown as ConstructorParameters<typeof OpenAIPromptGenerator>[2];

    await new OpenAIPromptGenerator("test-key", "test-model", client).generate(
      input,
    );

    expect(parse).toHaveBeenCalledWith(
      expect.objectContaining({
        store: false,
        instructions: expect.stringMatching(/untrusted reference data/i),
      }),
    );
  });
});

describe("openAIRequestPolicy", () => {
  it("bounds timeout and output tokens and never retries paid requests", () => {
    process.env["OPENAI_TIMEOUT_MS"] = "999999";
    process.env["OPENAI_MAX_RETRIES"] = "99";
    expect(openAIRequestPolicy()).toEqual({
      timeout: 45_000,
      maxRetries: 0,
      maxOutputTokens: 2_500,
    });
    delete process.env["OPENAI_TIMEOUT_MS"];
    delete process.env["OPENAI_MAX_RETRIES"];
  });
});
