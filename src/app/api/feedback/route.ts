import {
  answerFeedbackApiConfigFromEnvironment,
  createAnswerFeedbackOptionsHandler,
  createAnswerFeedbackPostHandler,
  InMemoryAnswerFeedbackControlStore,
} from "@/server/answerFeedbackApiControls";
import { ConsoleAnswerFeedbackEventSink } from "@/server/answerFeedbackOperations";

export const runtime = "nodejs";

const globalControls = globalThis as typeof globalThis & {
  readReflectAnswerFeedbackControls?: InMemoryAnswerFeedbackControlStore;
};
const controls =
  globalControls.readReflectAnswerFeedbackControls ??
  new InMemoryAnswerFeedbackControlStore();
globalControls.readReflectAnswerFeedbackControls = controls;

let postHandlerPromise:
  | Promise<ReturnType<typeof createAnswerFeedbackPostHandler>>
  | undefined;

async function createPostHandler() {
  const feedbackControls =
    process.env["PROMPT_CONTROL_STORE"] === "cloudflare"
      ? new (
          await import("@/server/cloudflareAnswerFeedbackControlStore")
        ).CloudflareAnswerFeedbackControlStore()
      : controls;
  return createAnswerFeedbackPostHandler({
    controls: feedbackControls,
    config: answerFeedbackApiConfigFromEnvironment(),
    generationOptions: {
      providerName: "mock",
    },
    events: new ConsoleAnswerFeedbackEventSink(),
  });
}

export function POST(request: Request) {
  postHandlerPromise ??= createPostHandler();
  return postHandlerPromise.then((handler) => handler(request));
}

export function OPTIONS(request: Request) {
  return createAnswerFeedbackOptionsHandler({
    config: answerFeedbackApiConfigFromEnvironment(),
  })(request);
}
