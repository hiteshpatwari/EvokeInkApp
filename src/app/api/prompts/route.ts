import {
  ConsolePromptEventSink,
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

let postHandler: ReturnType<typeof createPromptPostHandler> | undefined;

export function POST(request: Request) {
  postHandler ??= createPromptPostHandler({
    controls,
    config: promptApiConfigFromEnvironment(),
    generationOptions: {},
    events: new ConsolePromptEventSink(),
  });
  return postHandler(request);
}
