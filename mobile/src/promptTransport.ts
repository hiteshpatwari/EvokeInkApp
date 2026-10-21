import { MockPromptGenerator } from "../../src/domain/mockPromptGenerator";
import {
  networkGenerationInputSchema,
  promptBatchSchema,
} from "../../src/domain/schemas";

const GENERAL_FALLBACK_NOTICE = "Offline mode used reliable general prompts.";
const NOTES_FALLBACK_NOTICE =
  "Offline mode used your supplied summary and notes on this device.";

type FetchImplementation = typeof fetch;

function parseRequestBody(init?: RequestInit) {
  const raw =
    typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
  return networkGenerationInputSchema.parse(raw);
}

async function deterministicFallback(init?: RequestInit) {
  const networkInput = parseRequestBody(init);
  const result = await new MockPromptGenerator().generate({
    ...networkInput,
    child: { ...networkInput.child, name: "Reader" },
  });
  return Response.json({
    ...result,
    provider: "mock",
    fallback: true,
    notice:
      networkInput.specificity === "notes"
        ? NOTES_FALLBACK_NOTICE
        : GENERAL_FALLBACK_NOTICE,
  });
}

export function createMobilePromptFetch(
  realFetch: FetchImplementation,
  configuredApi: string | undefined,
  timeoutMs = 8_000,
): FetchImplementation {
  return async (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    if (url !== "/api/prompts") return realFetch(input, init);

    if (configuredApi) {
      const timeoutController = new AbortController();
      const abortFromCaller = () =>
        timeoutController.abort(init?.signal?.reason);
      init?.signal?.addEventListener("abort", abortFromCaller, { once: true });
      const timer = globalThis.setTimeout(
        () => timeoutController.abort(),
        timeoutMs,
      );
      try {
        const response = await realFetch(configuredApi, {
          ...init,
          signal: timeoutController.signal,
        });
        if (!response.ok) throw new Error("Hosted prompt API was unavailable");
        const body: unknown = await response.clone().json();
        promptBatchSchema.parse(body);
        return response;
      } catch {
        // A native release remains usable without exposing transport details.
      } finally {
        globalThis.clearTimeout(timer);
        init?.signal?.removeEventListener("abort", abortFromCaller);
      }
    }

    return deterministicFallback(init);
  };
}
