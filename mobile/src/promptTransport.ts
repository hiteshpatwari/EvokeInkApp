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
import { handwritingTranscriptionResultSchema } from "../../src/domain/handwritingTranscription";
import { z } from "zod";
import type { NativeImageAttestation } from "./playIntegrityAttestation";

const GENERAL_FALLBACK_NOTICE = "Offline mode used reliable general prompts.";
const NOTES_FALLBACK_NOTICE =
  "Offline mode used your supplied summary and notes on this device.";
const FEEDBACK_FALLBACK_NOTICE =
  "Response coaching was unavailable, so reliable general feedback was used instead.";
const TRANSCRIPTION_UNAVAILABLE_MESSAGE =
  "Automatic handwriting reading is unavailable right now. Type the response instead.";

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

function siblingApiFromPromptApi(
  configuredApi: string,
  route: "feedback" | "transcriptions",
): string | undefined {
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
    url.pathname = `${url.pathname.slice(0, -"prompts".length)}${route}`;
    return url.href;
  } catch {
    return undefined;
  }
}

function transcriptionUnavailableResponse() {
  return Response.json(
    {
      code: "transcription_unavailable",
      message: TRANSCRIPTION_UNAVAILABLE_MESSAGE,
    },
    { status: 503 },
  );
}

async function attestedTranscriptionInit(
  init: RequestInit | undefined,
  attestation: NativeImageAttestation,
  signal: AbortSignal,
): Promise<RequestInit> {
  if (!(init?.body instanceof FormData)) {
    throw new Error("A prepared transcription image is required");
  }
  const image = init.body.get("image");
  if (!image || typeof image === "string") {
    throw new Error("A prepared transcription image is required");
  }
  const bytes =
    typeof image.arrayBuffer === "function"
      ? new Uint8Array(await image.arrayBuffer())
      : await new Promise<Uint8Array>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () =>
            reader.result instanceof ArrayBuffer
              ? resolve(new Uint8Array(reader.result))
              : reject(new Error("The prepared image could not be read"));
          reader.onerror = () =>
            reject(
              reader.error ?? new Error("The prepared image could not be read"),
            );
          reader.readAsArrayBuffer(image);
        });
  const installationToken = new Headers(init.headers).get(
    "X-Installation-Token",
  );
  if (!installationToken) {
    throw new Error("An installation identity is required");
  }
  const integrityToken = await Promise.race([
    attestation.tokenForImage(bytes, installationToken),
    new Promise<never>((_resolve, reject) => {
      if (signal.aborted) {
        reject(new Error("Play Integrity timed out"));
        return;
      }
      signal.addEventListener(
        "abort",
        () => reject(new Error("Play Integrity timed out")),
        { once: true },
      );
    }),
  ]);
  const headers = new Headers(init.headers);
  headers.set("X-Play-Integrity-Token", integrityToken);
  return { ...init, headers };
}

export function createMobilePromptFetch(
  realFetch: FetchImplementation,
  configuredApi: string | undefined,
  timeoutMs = 8_000,
  attestation?: NativeImageAttestation,
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
    const isTranscriptionRequest = url === "/api/transcriptions";
    if (!isPromptRequest && !isFeedbackRequest && !isTranscriptionRequest) {
      return realFetch(input, init);
    }

    const hostedApi = isFeedbackRequest
      ? configuredApi && siblingApiFromPromptApi(configuredApi, "feedback")
      : isTranscriptionRequest
        ? configuredApi &&
          siblingApiFromPromptApi(configuredApi, "transcriptions")
        : configuredApi;

    if (hostedApi) {
      if (isTranscriptionRequest && !attestation) {
        return transcriptionUnavailableResponse();
      }
      const timeoutController = new AbortController();
      const abortFromCaller = () =>
        timeoutController.abort(init?.signal?.reason);
      init?.signal?.addEventListener("abort", abortFromCaller, { once: true });
      const timer = globalThis.setTimeout(
        () => timeoutController.abort(),
        timeoutMs,
      );
      try {
        const hostedInit = isTranscriptionRequest
          ? await attestedTranscriptionInit(
              init,
              attestation!,
              timeoutController.signal,
            )
          : init;
        const response = await realFetch(hostedApi, {
          ...hostedInit,
          signal: timeoutController.signal,
        });
        if (!response.ok) throw new Error("Hosted API was unavailable");
        const body: unknown = await response.clone().json();
        if (isFeedbackRequest) {
          answerFeedbackResultSchema.parse(body);
        } else if (isTranscriptionRequest) {
          handwritingTranscriptionResultSchema.parse(body);
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

    if (isFeedbackRequest) return deterministicFeedbackFallback(init);
    if (isTranscriptionRequest) return transcriptionUnavailableResponse();
    return deterministicFallback(init);
  };
}
