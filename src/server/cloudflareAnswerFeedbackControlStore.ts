import { env } from "cloudflare:workers";
import type { AnswerFeedbackControlStore } from "./answerFeedbackApiControls";
import { GLOBAL_AI_CONTROL_OBJECT } from "./cloudflarePromptControlStore";

/**
 * Feature-prefixed quota hashes remain independent while every paid AI feature
 * reserves against one atomic provider-budget counter.
 */
export class CloudflareAnswerFeedbackControlStore implements AnswerFeedbackControlStore {
  reserve(input: Parameters<AnswerFeedbackControlStore["reserve"]>[0]) {
    const stub = env.PROMPT_CONTROLS.getByName(GLOBAL_AI_CONTROL_OBJECT);
    const { category: _category, now, ...reservation } = input;
    return stub.reserve({
      ...reservation,
      nowMs: now.getTime(),
    });
  }
}
