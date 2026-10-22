import { env } from "cloudflare:workers";
import type { AnswerFeedbackControlStore } from "./answerFeedbackApiControls";

const GLOBAL_ANSWER_FEEDBACK_CONTROL_OBJECT = "answer-feedback-v1";

/**
 * Uses a dedicated Durable Object instance so feedback quotas and budget never
 * share counters with prompt generation.
 */
export class CloudflareAnswerFeedbackControlStore implements AnswerFeedbackControlStore {
  reserve(input: Parameters<AnswerFeedbackControlStore["reserve"]>[0]) {
    const stub = env.PROMPT_CONTROLS.getByName(
      GLOBAL_ANSWER_FEEDBACK_CONTROL_OBJECT,
    );
    const { category: _category, now, ...reservation } = input;
    return stub.reserve({
      ...reservation,
      nowMs: now.getTime(),
    });
  }
}
