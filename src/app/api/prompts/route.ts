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

export const POST = createPromptPostHandler({
  controls,
  config: promptApiConfigFromEnvironment(),
  generationOptions: {},
  events: new ConsolePromptEventSink(),
});
