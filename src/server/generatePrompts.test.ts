import { describe, expect, it } from "vitest";
import type { PromptGenerator } from "@/domain/promptGenerator";
import type { GenerationInput } from "@/domain/schemas";
import { generateWithFallback } from "./generatePrompts";

const input: GenerationInput = {
  child: {
    name: "Lee",
    gradeOrAge: "Age 14-16",
    difficulty: "challenging",
    responseLength: "medium",
  },
  book: {
    title: "A Book",
    author: "An Author",
    genre: "nonfiction",
    progress: "Chapters 2-4",
  },
  specificity: "general",
  skills: ["inference"],
  parentNotes: "",
  parentSummary: "",
  detailNotes: "",
};

describe("provider fallback", () => {
  it("falls back to deterministic prompts when the primary provider fails", async () => {
    const failingProvider: PromptGenerator = {
      generate: async () => {
        throw new Error("provider failure");
      },
    };
    const result = await generateWithFallback(input, {
      providerName: "openai",
      apiKey: "not-used",
      primary: failingProvider,
    });
    expect(result.provider).toBe("mock");
    expect(result.fallback).toBe(true);
    expect(result.prompts).toHaveLength(4);
  });

  it("falls back when OpenAI mode has no key", async () => {
    const result = await generateWithFallback(input, {
      providerName: "openai",
      apiKey: "",
    });
    expect(result.fallback).toBe(true);
    expect(result.notice).toMatch(/not configured/i);
  });

  it("re-renders provider output through controlled no-invention templates", async () => {
    const unsafeProvider: PromptGenerator = {
      generate: async () => ({
        prompts: Array.from({ length: 4 }, (_, index) => ({
          text:
            index === 0
              ? "Explain why a dragon attacked the village and use evidence from the reading."
              : "Choose one important idea and support it with a detail from the reading.",
          skill: "evidence_and_explanation",
          explanation: "Practices explaining evidence from the reading.",
          required: index < 3,
          suggestedResponseLength: "3-4 sentences",
          grounding: "generic" as const,
          difficultyLevel: "challenging" as const,
        })),
      }),
    };
    const result = await generateWithFallback(input, {
      providerName: "openai",
      apiKey: "not-used",
      primary: unsafeProvider,
    });
    expect(result.provider).toBe("openai");
    expect(result.fallback).toBe(false);
    expect(
      result.prompts.some((prompt) => prompt.text.includes("dragon")),
    ).toBe(false);
  });

  it("rejects parent-summary grounding when no summary was supplied", async () => {
    const invalidGroundingProvider: PromptGenerator = {
      generate: async () => ({
        prompts: Array.from({ length: 4 }, (_, index) => ({
          text: "Choose one important idea and support it with a detail from the reading.",
          skill: "evidence_and_explanation",
          explanation: "Practices explaining evidence from the reading.",
          required: index < 3,
          suggestedResponseLength: "3-4 sentences",
          grounding: "parent_summary" as const,
          difficultyLevel: "challenging" as const,
        })),
      }),
    };
    const result = await generateWithFallback(input, {
      providerName: "openai",
      apiKey: "not-used",
      primary: invalidGroundingProvider,
    });
    expect(result.fallback).toBe(true);
    expect(
      result.prompts.every((prompt) => prompt.grounding === "generic"),
    ).toBe(true);
  });
});
