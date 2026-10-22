import type { AnswerFeedbackProvider } from "@/domain/answerFeedbackProvider";
import { MockAnswerFeedbackProvider } from "@/domain/mockAnswerFeedbackProvider";
import {
  answerFeedbackInputSchema,
  answerFeedbackSchema,
  type AnswerFeedback,
} from "@/domain/answerFeedbackSchemas";

export interface AnswerFeedbackResult {
  feedback: AnswerFeedback;
  provider: "mock" | "openai";
  fallback: boolean;
  notice?: string;
}

export interface AnswerFeedbackGenerationOptions {
  providerName?: "mock" | "openai";
  primary?: AnswerFeedbackProvider;
  fallback?: AnswerFeedbackProvider;
  providerTimeoutMs?: number;
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new DOMException("Provider timed out", "TimeoutError")),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function generateAnswerFeedbackWithFallback(
  rawInput: unknown,
  options: AnswerFeedbackGenerationOptions = {},
): Promise<AnswerFeedbackResult> {
  const input = answerFeedbackInputSchema.parse(rawInput);
  const providerName = options.providerName ?? "mock";
  const fallback = options.fallback ?? new MockAnswerFeedbackProvider();

  if (providerName === "mock") {
    return {
      feedback: answerFeedbackSchema.parse(await fallback.generate(input)),
      provider: "mock",
      fallback: false,
    };
  }

  try {
    if (!options.primary) throw new Error("Feedback provider is unavailable");
    return {
      feedback: answerFeedbackSchema.parse(
        await withTimeout(
          options.primary.generate(input),
          options.providerTimeoutMs ?? 15_000,
        ),
      ),
      provider: "openai",
      fallback: false,
    };
  } catch {
    return {
      feedback: answerFeedbackSchema.parse(await fallback.generate(input)),
      provider: "mock",
      fallback: true,
      notice:
        "Response coaching was unavailable, so reliable general feedback was used instead.",
    };
  }
}
