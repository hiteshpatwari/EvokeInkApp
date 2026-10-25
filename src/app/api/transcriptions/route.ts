import {
  ConsoleHandwritingTranscriptionEventSink,
  createHandwritingTranscriptionOptionsHandler,
  createHandwritingTranscriptionPostHandler,
  handwritingTranscriptionApiConfigFromEnvironment,
  InMemoryHandwritingTranscriptionControlStore,
} from "@/server/handwritingTranscriptionApiControls";

export const runtime = "nodejs";

const globalControls = globalThis as typeof globalThis & {
  readReflectHandwritingTranscriptionControls?: InMemoryHandwritingTranscriptionControlStore;
};
const controls =
  globalControls.readReflectHandwritingTranscriptionControls ??
  new InMemoryHandwritingTranscriptionControlStore();
globalControls.readReflectHandwritingTranscriptionControls = controls;

let postHandlerPromise:
  | Promise<ReturnType<typeof createHandwritingTranscriptionPostHandler>>
  | undefined;

async function createPostHandler() {
  const config = handwritingTranscriptionApiConfigFromEnvironment();
  const selectedControls =
    process.env["PROMPT_CONTROL_STORE"] === "cloudflare"
      ? new (
          await import("@/server/cloudflareHandwritingTranscriptionControlStore")
        ).CloudflareHandwritingTranscriptionControlStore()
      : controls;
  return createHandwritingTranscriptionPostHandler({
    controls: selectedControls,
    config,
    generationOptions: { providerName: config.providerName },
    events: new ConsoleHandwritingTranscriptionEventSink(),
  });
}

export function POST(request: Request) {
  postHandlerPromise ??= createPostHandler();
  return postHandlerPromise.then((handler) => handler(request));
}

export function OPTIONS(request: Request) {
  return createHandwritingTranscriptionOptionsHandler(
    handwritingTranscriptionApiConfigFromEnvironment(),
  )(request);
}
