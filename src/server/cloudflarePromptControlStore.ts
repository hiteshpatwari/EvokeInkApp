import { env } from "cloudflare:workers";
import type { PromptControlStore } from "./promptApiControls";

export const GLOBAL_AI_CONTROL_OBJECT = "provider-ai-v2";

/** Cloudflare production adapter for the platform-neutral prompt store. */
export class CloudflarePromptControlStore implements PromptControlStore {
  reserve(input: Parameters<PromptControlStore["reserve"]>[0]) {
    const stub = env.PROMPT_CONTROLS.getByName(GLOBAL_AI_CONTROL_OBJECT);
    const { now, ...reservation } = input;
    return stub.reserve({
      ...reservation,
      nowMs: now.getTime(),
    });
  }
}
