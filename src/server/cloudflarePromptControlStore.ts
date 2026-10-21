import { env } from "cloudflare:workers";
import type { PromptControlStore } from "./promptApiControls";

const GLOBAL_PROMPT_CONTROL_OBJECT = "global-v1";

/** Cloudflare production adapter for the platform-neutral prompt store. */
export class CloudflarePromptControlStore implements PromptControlStore {
  reserve(input: Parameters<PromptControlStore["reserve"]>[0]) {
    const stub = env.PROMPT_CONTROLS.getByName(GLOBAL_PROMPT_CONTROL_OBJECT);
    const { now, ...reservation } = input;
    return stub.reserve({
      ...reservation,
      nowMs: now.getTime(),
    });
  }
}
