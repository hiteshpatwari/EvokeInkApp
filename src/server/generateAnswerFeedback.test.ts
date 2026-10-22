import { describe, expect, it, vi } from "vitest";
import type { AnswerFeedbackProvider } from "@/domain/answerFeedbackProvider";
import { generateAnswerFeedbackWithFallback } from "./generateAnswerFeedback";

const input = {
  prompt: {
    text: "Explain the character's choice using a detail from the reading.",
    skill: "evidence_and_explanation",
    difficultyLevel: "grade_level" as const,
  },
  profile: {
    gradeOrAge: "Grade 3",
    difficulty: "grade_level" as const,
    responseLength: "medium" as const,
  },
  responseText: "The character helped because her friend needed support.",
};

describe("answer feedback orchestration", () => {
  it("uses the deterministic mock without a real provider", async () => {
    const result = await generateAnswerFeedbackWithFallback(input);

    expect(result.provider).toBe("mock");
    expect(result.fallback).toBe(false);
    expect(result.feedback.limitation).toMatch(/cannot verify book facts/i);
  });

  it.each([
    [
      "failure",
      vi.fn(async () => Promise.reject(new Error("private content"))),
    ],
    ["timeout", vi.fn(() => new Promise<never>(() => undefined))],
    ["invalid output", vi.fn(async () => ({ strengths: [] }))],
  ])(
    "returns schema-valid mock feedback after provider %s",
    async (_case, generate) => {
      const primary = { generate } as unknown as AnswerFeedbackProvider;
      const result = await generateAnswerFeedbackWithFallback(input, {
        providerName: "openai",
        primary,
        providerTimeoutMs: 5,
      });

      expect(result.provider).toBe("mock");
      expect(result.fallback).toBe(true);
      expect(result.feedback.strengths.length).toBeGreaterThan(0);
      expect(result.notice).toMatch(/unavailable/i);
    },
  );
});
