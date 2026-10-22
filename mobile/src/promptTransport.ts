import { MockPromptGenerator } from "../../src/domain/mockPromptGenerator";
import { MockAnswerFeedbackProvider } from "../../src/domain/mockAnswerFeedbackProvider";
import {
  answerFeedbackInputSchema,
  answerFeedbackSchema,
} from "../../src/domain/answerFeedbackSchemas";
import {
  networkGenerationInputSchema,
  promptBatchSchema,
} from "../../src/domain/schemas";
import { z } from "zod";

const GENERAL_FALLBACK_NOTICE = "Offline mode used reliable general prompts.";
const NOTES_FALLBACK_NOTICE =
  "Offline mode used your supplied summary and notes on this device.";
const FEEDBACK_FALLBACK_NOTICE =
  "Response coaching was unavailable, so reliable general feedback was used instead.";

const answerFeedbackResultSchema = z
  .object({
    feedback: answerFeedbackSchema,
    provider: z.enum(["mock", "openai"]),
    fallback: z.boolean(),
    notice: z.string().trim().min(1).optional(),
  })
  .strict();

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

async function deterministicFeedbackFallback(init?: RequestInit) {
  const raw =
    typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
  const input = answerFeedbackInputSchema.parse(raw);
  const feedback = await new MockAnswerFeedbackProvider().generate(input);
  return Response.json({
    feedback,
    provider: "mock",
    fallback: true,
    notice: FEEDBACK_FALLBACK_NOTICE,
  });
}

function feedbackApiFromPromptApi(configuredApi: string): string | undefined {
  try {
    const url = new URL(configuredApi);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !url.pathname.endsWith("/api/prompts")
    ) {
      return undefined;
    }
    url.pathname = `${url.pathname.slice(0, -"prompts".length)}feedback`;
    return url.href;
  } catch {
    return undefined;
  }
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
    const isPromptRequest = url === "/api/prompts";
    const isFeedbackRequest = url === "/api/feedback";
    if (!isPromptRequest && !isFeedbackRequest) return realFetch(input, init);

    const hostedApi = isFeedbackRequest
      ? configuredApi && feedbackApiFromPromptApi(configuredApi)
      : configuredApi;

    if (hostedApi) {
      const timeoutController = new AbortController();
      const abortFromCaller = () =>
        timeoutController.abort(init?.signal?.reason);
      init?.signal?.addEventListener("abort", abortFromCaller, { once: true });
      const timer = globalThis.setTimeout(
        () => timeoutController.abort(),
        timeoutMs,
      );
      try {
        const response = await realFetch(hostedApi, {
          ...init,
          signal: timeoutController.signal,
        });
        if (!response.ok) throw new Error("Hosted API was unavailable");
        const body: unknown = await response.clone().json();
        if (isFeedbackRequest) {
          answerFeedbackResultSchema.parse(body);
        } else {
          promptBatchSchema.parse(body);
        }
        return response;
      } catch {
        // A native release remains usable without exposing transport details.
      } finally {
        globalThis.clearTimeout(timer);
        init?.signal?.removeEventListener("abort", abortFromCaller);
      }
    }

    return isFeedbackRequest
      ? deterministicFeedbackFallback(init)
      : deterministicFallback(init);
  };
}
