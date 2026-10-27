import { NextResponse } from "next/server";
import { isIP } from "node:net";
import { z, ZodError } from "zod";
import { answerFeedbackInputSchema } from "@/domain/answerFeedbackSchemas";
import {
  generateAnswerFeedbackWithFallback,
  type AnswerFeedbackGenerationOptions,
} from "./generateAnswerFeedback";
import {
  emitAnswerFeedbackOperationalEvent,
  type AnswerFeedbackEventSink,
} from "./answerFeedbackOperations";

const installationTokenSchema = z.uuid();
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;
const CORS_METHODS = "POST, OPTIONS";
const CORS_HEADERS = "Content-Type, X-Installation-Token";
const ALLOWED_PREFLIGHT_HEADERS = new Set([
  "content-type",
  "x-installation-token",
]);
type Reservation =
  | "allowed"
  | "installation_quota"
  | "ip_quota"
  | "budget_open";

export interface AnswerFeedbackApiConfig {
  allowedOrigins: string[];
  maxBodyBytes: number;
  installationLimit: number;
  ipLimit: number;
  monthlyBudgetMicros: number;
  estimatedRequestCostMicros: number;
  quotaHashSecret: string;
}

export interface AnswerFeedbackControlStore {
  reserve(request: {
    category: "answer_feedback_v1";
    installationKey: string;
    ipKey: string;
    now: Date;
    installationLimit: number;
    ipLimit: number;
    budgetMicros: number;
    estimatedCostMicros: number;
    useProviderBudget: boolean;
  }): Reservation | Promise<Reservation>;
}

export interface AnswerFeedbackApiDependencies {
  controls: AnswerFeedbackControlStore;
  config: AnswerFeedbackApiConfig;
  generationOptions: AnswerFeedbackGenerationOptions;
  events: AnswerFeedbackEventSink;
  now?: () => Date;
}

interface Counter {
  count: number;
  startedAt: number;
}

/** Feedback has independent counters and budget; it never shares prompt state. */
export class InMemoryAnswerFeedbackControlStore implements AnswerFeedbackControlStore {
  private readonly installations = new Map<string, Counter>();
  private readonly ips = new Map<string, Counter>();
  private budget: Counter = { count: 0, startedAt: 0 };

  reserve(input: Parameters<AnswerFeedbackControlStore["reserve"]>[0]) {
    const now = input.now.getTime();
    const installation = this.current(
      this.installations,
      input.installationKey,
      now,
    );
    const ip = this.current(this.ips, input.ipKey, now);
    if (installation.count >= input.installationLimit)
      return "installation_quota" as const;
    if (ip.count >= input.ipLimit) return "ip_quota" as const;

    if (now - this.budget.startedAt >= MONTH_MS) {
      this.budget = { count: 0, startedAt: now };
    }
    installation.count += 1;
    ip.count += 1;
    if (
      input.useProviderBudget &&
      this.budget.count + input.estimatedCostMicros > input.budgetMicros
    ) {
      return "budget_open" as const;
    }
    if (input.useProviderBudget) this.budget.count += input.estimatedCostMicros;
    return "allowed" as const;
  }

  private current(
    counters: Map<string, Counter>,
    key: string,
    now: number,
  ): Counter {
    const current = counters.get(key);
    if (current && now - current.startedAt < MONTH_MS) return current;
    const next = { count: 0, startedAt: now };
    counters.set(key, next);
    return next;
  }
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

function withCors(
  response: Response,
  origin: string | null,
  allowedOrigins: string[],
): Response {
  response.headers.set("Vary", "Origin");
  if (origin && allowedOrigins.includes(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
  }
  return response;
}

export function createAnswerFeedbackOptionsHandler(
  dependencies: Pick<AnswerFeedbackApiDependencies, "config">,
) {
  return function OPTIONS(request: Request): Response {
    const origin = request.headers.get("origin");
    const method = request.headers
      .get("access-control-request-method")
      ?.toUpperCase();
    const headers = (
      request.headers.get("access-control-request-headers") ?? ""
    )
      .split(",")
      .map((header) => header.trim().toLowerCase())
      .filter(Boolean);
    const allowed =
      origin !== null &&
      dependencies.config.allowedOrigins.includes(origin) &&
      method === "POST" &&
      headers.every((header) => ALLOWED_PREFLIGHT_HEADERS.has(header));

    if (!allowed) {
      return withCors(
        jsonError("This cross-origin request is not allowed.", 403),
        origin,
        [],
      );
    }
    return withCors(
      new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Methods": CORS_METHODS,
          "Access-Control-Allow-Headers": CORS_HEADERS,
        },
      }),
      origin,
      dependencies.config.allowedOrigins,
    );
  };
}

function requestIp(request: Request): string {
  const cloudflareIp = request.headers.get("cf-connecting-ip")?.trim();
  return cloudflareIp && isIP(cloudflareIp) !== 0 ? cloudflareIp : "unknown";
}

async function quotaKey(value: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(value),
  );
  return Array.from(new Uint8Array(signature), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

class BodyTooLargeError extends Error {}
class InvalidJsonError extends Error {}

async function readBoundedJson(request: Request, maxBytes: number) {
  const declaredLength = request.headers.get("content-length");
  if (
    declaredLength &&
    /^\d+$/.test(declaredLength) &&
    Number(declaredLength) > maxBytes
  ) {
    throw new BodyTooLargeError();
  }
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new BodyTooLargeError();
      }
      chunks.push(value);
    }
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    ) as unknown;
  } catch {
    throw new InvalidJsonError();
  }
}

export function createAnswerFeedbackPostHandler(
  dependencies: AnswerFeedbackApiDependencies,
) {
  return async function POST(request: Request) {
    const startedAt = performance.now();
    const requestId = crypto.randomUUID();
    const origin = request.headers.get("origin");
    const record = (event: Record<string, unknown>) => {
      emitAnswerFeedbackOperationalEvent(dependencies.events, {
        requestId,
        timestamp: (dependencies.now ?? (() => new Date()))().toISOString(),
        durationMs: Math.round(performance.now() - startedAt),
        route: "/api/feedback",
        ...event,
      });
    };
    const finish = (response: Response) => {
      response.headers.set("Cache-Control", "no-store");
      return withCors(response, origin, dependencies.config.allowedOrigins);
    };

    const contentType =
      request.headers
        .get("content-type")
        ?.split(";", 1)[0]
        ?.trim()
        .toLowerCase() ?? "";
    if (contentType !== "application/json") {
      record({
        status: 415,
        fallback: false,
        errorCategory: "content_type",
        rateLimitDecision: "not_checked",
      });
      return finish(jsonError("JSON is required.", 415));
    }
    if (!origin || !dependencies.config.allowedOrigins.includes(origin)) {
      record({
        status: 403,
        fallback: false,
        errorCategory: "origin",
        rateLimitDecision: "not_checked",
      });
      return finish(jsonError("This request origin is not allowed.", 403));
    }
    const installationToken = request.headers.get("x-installation-token");
    if (!installationTokenSchema.safeParse(installationToken).success) {
      record({
        status: 400,
        fallback: false,
        errorCategory: "identity",
        rateLimitDecision: "not_checked",
      });
      return finish(
        jsonError("A valid installation identity is required.", 400),
      );
    }

    try {
      const input = answerFeedbackInputSchema.parse(
        await readBoundedJson(request, dependencies.config.maxBodyBytes),
      );
      const providerName = (
        dependencies.generationOptions.providerName ?? "mock"
      ).toLowerCase();
      const [installationKey, ipKey] = await Promise.all([
        quotaKey(
          `feedback:${installationToken!}`,
          dependencies.config.quotaHashSecret,
        ),
        quotaKey(
          `feedback:${requestIp(request)}`,
          dependencies.config.quotaHashSecret,
        ),
      ]);
      const reservation = await dependencies.controls.reserve({
        category: "answer_feedback_v1",
        installationKey,
        ipKey,
        now: (dependencies.now ?? (() => new Date()))(),
        installationLimit: dependencies.config.installationLimit,
        ipLimit: dependencies.config.ipLimit,
        budgetMicros: dependencies.config.monthlyBudgetMicros,
        estimatedCostMicros: dependencies.config.estimatedRequestCostMicros,
        useProviderBudget: providerName !== "mock",
      });

      if (reservation === "installation_quota" || reservation === "ip_quota") {
        record({
          status: 429,
          provider: providerName,
          fallback: false,
          errorCategory: reservation,
          rateLimitDecision: reservation,
          abuseKey: installationKey.slice(0, 12),
          estimatedCostMicros: 0,
        });
        return finish(
          jsonError(
            "The monthly response-review allowance has been reached.",
            429,
          ),
        );
      }

      const generated = await generateAnswerFeedbackWithFallback(
        input,
        reservation === "budget_open"
          ? { providerName: "mock" }
          : dependencies.generationOptions,
      );
      const result =
        reservation === "budget_open"
          ? {
              ...generated,
              fallback: true,
              notice:
                "The response-coaching budget was reached, so reliable general feedback was used instead.",
            }
          : generated;
      record({
        status: 200,
        provider: result.provider,
        fallback: result.fallback,
        errorCategory:
          reservation === "budget_open"
            ? "budget_open"
            : result.fallback
              ? "provider_failure"
              : "none",
        rateLimitDecision: reservation,
        estimatedCostMicros:
          providerName !== "mock" && reservation === "allowed"
            ? dependencies.config.estimatedRequestCostMicros
            : 0,
      });
      return finish(NextResponse.json(result));
    } catch (error) {
      if (error instanceof BodyTooLargeError) {
        record({
          status: 413,
          fallback: false,
          errorCategory: "body_size",
          rateLimitDecision: "not_checked",
        });
        return finish(jsonError("The request is too large.", 413));
      }
      if (error instanceof InvalidJsonError || error instanceof ZodError) {
        record({
          status: 400,
          fallback: false,
          errorCategory: "invalid_request",
          rateLimitDecision: "not_checked",
        });
        return finish(
          jsonError("Please check the response details and try again.", 400),
        );
      }
      record({
        status: 500,
        fallback: false,
        errorCategory: "internal_error",
        rateLimitDecision: "not_checked",
      });
      return finish(
        jsonError("Feedback could not be generated. Please try again.", 500),
      );
    }
  };
}

export function answerFeedbackApiConfigFromEnvironment(): AnswerFeedbackApiConfig {
  const positiveSafeInteger = (name: string, fallback: number) => {
    const configured = process.env[name];
    if (configured === undefined) return fallback;
    const parsed = Number(configured);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
      throw new Error(`${name} must be a positive safe integer.`);
    }
    return parsed;
  };
  const positiveUsdMicros = (name: string, fallbackUsd: number) => {
    const configured = process.env[name];
    const parsed = configured === undefined ? fallbackUsd : Number(configured);
    const micros = parsed * 1_000_000;
    if (
      !Number.isFinite(parsed) ||
      parsed <= 0 ||
      !Number.isSafeInteger(micros) ||
      micros <= 0
    ) {
      throw new Error(
        `${name} must convert to a positive safe integer number of micros.`,
      );
    }
    return micros;
  };
  const allowedOrigins = (
    process.env["APP_ALLOWED_ORIGINS"] ?? "http://localhost:3000"
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const providerName = process.env["ANSWER_FEEDBACK_PROVIDER"] ?? "mock";
  if (providerName !== "mock") {
    throw new Error(
      "ANSWER_FEEDBACK_PROVIDER must be mock until a real feedback provider is implemented and approved.",
    );
  }
  const quotaHashSecret =
    process.env["ANSWER_FEEDBACK_QUOTA_HASH_SECRET"]?.trim() || undefined;
  return {
    allowedOrigins,
    maxBodyBytes: positiveSafeInteger(
      "ANSWER_FEEDBACK_MAX_REQUEST_BYTES",
      8_000,
    ),
    installationLimit: positiveSafeInteger(
      "ANSWER_FEEDBACK_INSTALLATION_MONTHLY_LIMIT",
      30,
    ),
    ipLimit: positiveSafeInteger("ANSWER_FEEDBACK_IP_MONTHLY_LIMIT", 100),
    monthlyBudgetMicros: positiveUsdMicros(
      "ANSWER_FEEDBACK_MONTHLY_BUDGET_USD",
      50,
    ),
    estimatedRequestCostMicros: positiveUsdMicros(
      "ANSWER_FEEDBACK_ESTIMATED_REQUEST_COST_USD",
      0.02,
    ),
    quotaHashSecret: quotaHashSecret ?? "mock-only-feedback-no-budget",
  };
}
