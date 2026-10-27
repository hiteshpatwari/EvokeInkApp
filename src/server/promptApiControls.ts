import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { MockPromptGenerator } from "@/domain/mockPromptGenerator";
import {
  generationInputSchema,
  networkGenerationInputSchema,
} from "@/domain/schemas";
import {
  generateWithFallback,
  type GenerationOptions,
} from "./generatePrompts";
import {
  emitPromptOperationalEvent,
  type PromptEventSink,
  type PromptOperationalEvent,
} from "./promptOperations";

const installationTokenSchema = z.uuid();
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

export interface PromptApiConfig {
  allowedOrigins: string[];
  maxBodyBytes: number;
  installationLimit: number;
  ipLimit: number;
  monthlyBudgetMicros: number;
  estimatedRequestCostMicros: number;
  quotaHashSecret: string;
}

export interface PromptControlStore {
  reserve(request: {
    installationKey: string;
    ipKey: string;
    now: Date;
    installationLimit: number;
    ipLimit: number;
    budgetMicros: number;
    estimatedCostMicros: number;
    useProviderBudget: boolean;
  }):
    | "allowed"
    | "installation_quota"
    | "ip_quota"
    | "budget_open"
    | Promise<"allowed" | "installation_quota" | "ip_quota" | "budget_open">;
}

export type {
  PromptEventSink,
  PromptOperationalEvent,
} from "./promptOperations";

export interface PromptApiDependencies {
  controls: PromptControlStore;
  config: PromptApiConfig;
  generationOptions: GenerationOptions;
  events: PromptEventSink;
  now?: () => Date;
}

interface Counter {
  count: number;
  startedAt: number;
}

/**
 * Single-process reference implementation. Production multi-instance hosts must
 * bind PromptControlStore to an atomic shared store (for example, a Durable
 * Object). This implementation is concurrency-safe only within one isolate.
 */
export class InMemoryPromptControlStore implements PromptControlStore {
  private readonly installations = new Map<string, Counter>();
  private readonly ips = new Map<string, Counter>();
  private budget: Counter = { count: 0, startedAt: 0 };

  reserve(input: Parameters<PromptControlStore["reserve"]>[0]) {
    const now = input.now.getTime();
    const installation = this.currentCounter(
      this.installations,
      input.installationKey,
      now,
    );
    const ip = this.currentCounter(this.ips, input.ipKey, now);
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

  private currentCounter(
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

const CORS_METHODS = "POST, OPTIONS";
const CORS_HEADERS = "Content-Type, X-Installation-Token";
const ALLOWED_PREFLIGHT_HEADERS = new Set([
  "content-type",
  "x-installation-token",
]);
const NATIVE_APP_ORIGINS = new Set([
  "https://localhost",
  "capacitor://localhost",
]);

function withPromptCors(
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

export function createPromptOptionsHandler(
  dependencies: Pick<PromptApiDependencies, "config">,
) {
  return function OPTIONS(request: Request): Response {
    const origin = request.headers.get("origin");
    const requestedMethod = request.headers
      .get("access-control-request-method")
      ?.toUpperCase();
    const requestedHeaders = (
      request.headers.get("access-control-request-headers") ?? ""
    )
      .split(",")
      .map((header) => header.trim().toLowerCase())
      .filter(Boolean);
    const isAllowed =
      origin !== null &&
      dependencies.config.allowedOrigins.includes(origin) &&
      requestedMethod === "POST" &&
      requestedHeaders.every((header) => ALLOWED_PREFLIGHT_HEADERS.has(header));

    if (!isAllowed) {
      return withPromptCors(
        jsonError("This cross-origin request is not allowed.", 403),
        origin,
        [],
      );
    }

    return withPromptCors(
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
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
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

async function readBoundedJson(request: Request, maxBytes: number) {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength && /^\d+$/.test(declaredLength)) {
    if (Number(declaredLength) > maxBytes) throw new BodyTooLargeError();
  }

  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new BodyTooLargeError();
      }
      chunks.push(value);
    }
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const body = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return JSON.parse(body) as unknown;
  } catch {
    throw new InvalidJsonError();
  }
}

class BodyTooLargeError extends Error {}
class InvalidJsonError extends Error {}

export function createPromptPostHandler(dependencies: PromptApiDependencies) {
  return async function POST(request: Request) {
    const startedAt = performance.now();
    const requestId = crypto.randomUUID();
    const record = (event: Record<string, unknown>): void => {
      emitPromptOperationalEvent(dependencies.events, {
        requestId,
        timestamp: (dependencies.now ?? (() => new Date()))().toISOString(),
        durationMs: Math.round(performance.now() - startedAt),
        route: "/api/prompts",
        ...event,
      });
    };
    const origin = request.headers.get("origin");
    const finish = (response: Response) => {
      response.headers.set("Cache-Control", "no-store");
      return withPromptCors(
        response,
        origin,
        dependencies.config.allowedOrigins,
      );
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
      const raw = await readBoundedJson(
        request,
        dependencies.config.maxBodyBytes,
      );
      const networkInput = networkGenerationInputSchema.parse(raw);
      const providerName = (
        dependencies.generationOptions.providerName ??
        process.env["AI_PROVIDER"] ??
        "mock"
      ).toLowerCase();
      const [installationKey, ipKey] = await Promise.all([
        quotaKey(installationToken!, dependencies.config.quotaHashSecret),
        quotaKey(requestIp(request), dependencies.config.quotaHashSecret),
      ]);
      const reservation =
        providerName === "openai"
          ? await dependencies.controls.reserve({
              installationKey,
              ipKey,
              now: (dependencies.now ?? (() => new Date()))(),
              installationLimit: dependencies.config.installationLimit,
              ipLimit: dependencies.config.ipLimit,
              budgetMicros: dependencies.config.monthlyBudgetMicros,
              estimatedCostMicros:
                dependencies.config.estimatedRequestCostMicros,
              useProviderBudget: true,
            })
          : "allowed";

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
          jsonError("The monthly generation allowance has been reached.", 429),
        );
      }

      const input = generationInputSchema.parse({
        ...networkInput,
        child: { ...networkInput.child, name: "Reader" },
      });
      const result =
        reservation === "budget_open"
          ? {
              ...(await new MockPromptGenerator().generate(input)),
              provider: "mock" as const,
              fallback: true,
              notice:
                "The AI budget limit was reached, so reliable general prompts were used instead.",
            }
          : await generateWithFallback(input, dependencies.generationOptions);
      record({
        status: 200,
        provider: providerName,
        fallback: result.fallback,
        errorCategory:
          reservation === "budget_open"
            ? "budget_open"
            : result.fallback
              ? "provider_failure"
              : "none",
        rateLimitDecision: reservation,
        estimatedCostMicros:
          providerName === "openai" && reservation === "allowed"
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
          jsonError("Please check the worksheet details and try again.", 400),
        );
      }
      record({
        status: 500,
        fallback: false,
        errorCategory: "internal_error",
        rateLimitDecision: "not_checked",
      });
      return finish(
        jsonError("Prompts could not be generated. Please try again.", 500),
      );
    }
  };
}

export function promptApiConfigFromEnvironment(): PromptApiConfig {
  const numberFromEnvironment = (name: string, fallback: number) => {
    const parsed = Number(process.env[name]);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };
  const origins = (
    process.env["APP_ALLOWED_ORIGINS"] ?? "http://localhost:3000"
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const providerName = (process.env["AI_PROVIDER"] ?? "mock").toLowerCase();
  const configuredQuotaHashSecret =
    process.env["AI_QUOTA_HASH_SECRET"]?.trim() || undefined;
  if (providerName === "openai" && !configuredQuotaHashSecret) {
    throw new Error(
      "AI_QUOTA_HASH_SECRET is required when AI_PROVIDER=openai.",
    );
  }
  if (
    providerName === "openai" &&
    origins.some((origin) => NATIVE_APP_ORIGINS.has(origin))
  ) {
    throw new Error(
      "Native app origins require AI_PROVIDER=mock until verified device attestation is implemented.",
    );
  }
  return {
    allowedOrigins: origins,
    maxBodyBytes: numberFromEnvironment("AI_MAX_REQUEST_BYTES", 12_000),
    installationLimit: numberFromEnvironment(
      "AI_INSTALLATION_MONTHLY_LIMIT",
      20,
    ),
    ipLimit: numberFromEnvironment("AI_IP_MONTHLY_LIMIT", 200),
    monthlyBudgetMicros: Math.round(
      numberFromEnvironment("AI_MONTHLY_BUDGET_USD", 3) * 1_000_000,
    ),
    estimatedRequestCostMicros: Math.round(
      numberFromEnvironment("AI_ESTIMATED_REQUEST_COST_USD", 0.03) * 1_000_000,
    ),
    quotaHashSecret:
      configuredQuotaHashSecret ?? "mock-only-no-quota-reservations",
  };
}

export class ConsolePromptEventSink implements PromptEventSink {
  record(event: PromptOperationalEvent): void {
    console.info(JSON.stringify({ event: "prompt_api", ...event }));
  }
}
