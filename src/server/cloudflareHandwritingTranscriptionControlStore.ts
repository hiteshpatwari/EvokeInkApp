import { env } from "cloudflare:workers";
import type { HandwritingTranscriptionControlStore } from "./handwritingTranscriptionApiControls";
import { GLOBAL_AI_CONTROL_OBJECT } from "./cloudflarePromptControlStore";

export class CloudflareHandwritingTranscriptionControlStore implements HandwritingTranscriptionControlStore {
  reserve(
    input: Parameters<HandwritingTranscriptionControlStore["reserve"]>[0],
  ) {
    const stub = env.PROMPT_CONTROLS.getByName(GLOBAL_AI_CONTROL_OBJECT);
    const { category: _category, now, ...reservation } = input;
    return stub.reserve({ ...reservation, nowMs: now.getTime() });
  }
}
