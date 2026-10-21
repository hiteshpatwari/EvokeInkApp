import {
  ConsolePromptEventSink,
  createPromptOptionsHandler,
  createPromptPostHandler,
  InMemoryPromptControlStore,
  promptApiConfigFromEnvironment,
} from "@/server/promptApiControls";

export const runtime = "nodejs";

const globalControls = globalThis as typeof globalThis & {
  readReflectPromptControls?: InMemoryPromptControlStore;
};
const controls =
  globalControls.readReflectPromptControls ?? new InMemoryPromptControlStore();
globalControls.readReflectPromptControls = controls;

let postHandlerPromise:
  | Promise<ReturnType<typeof createPromptPostHandler>>
  | undefined;

async function createPostHandler() {
  const promptControls =
    process.env["PROMPT_CONTROL_STORE"] === "cloudflare"
      ? new (
          await import("@/server/cloudflarePromptControlStore")
        ).CloudflarePromptControlStore()
      : controls;
  return createPromptPostHandler({
    controls: promptControls,
    config: promptApiConfigFromEnvironment(),
    generationOptions: {},
    events: new ConsolePromptEventSink(),
  });
}

export async function POST(request: Request) {
  postHandlerPromise ??= createPostHandler();
  return (await postHandlerPromise)(request);
}

export function OPTIONS(request: Request) {
  return createPromptOptionsHandler({
    config: promptApiConfigFromEnvironment(),
  })(request);
}
