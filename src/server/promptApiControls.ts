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

export interface PromptOperationalEvent {
  outcome: "success" | "rejected" | "fallback";
  category:
    | "generated"
    | "content_type"
    | "origin"
    | "identity"
    | "body_size"
    | "invalid_request"
    | "installation_quota"
    | "ip_quota"
    | "budget_open"
    | "internal_error";
  provider?: "mock" | "openai";
  durationMs: number;
}

export interface PromptEventSink {
  record(event: PromptOperationalEvent): void;
}

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
    const record = (
      event: Omit<PromptOperationalEvent, "durationMs">,
    ): void => {
      dependencies.events.record({
        ...event,
        durationMs: Math.round(performance.now() - startedAt),
      });
    };

    const contentType =
      request.headers
        .get("content-type")
        ?.split(";", 1)[0]
        ?.trim()
        .toLowerCase() ?? "";
    if (contentType !== "application/json") {
      record({ outcome: "rejected", category: "content_type" });
      return jsonError("JSON is required.", 415);
    }

    const origin = request.headers.get("origin");
    if (!origin || !dependencies.config.allowedOrigins.includes(origin)) {
      record({ outcome: "rejected", category: "origin" });
      return jsonError("This request origin is not allowed.", 403);
    }

    const installationToken = request.headers.get("x-installation-token");
    if (!installationTokenSchema.safeParse(installationToken).success) {
      record({ outcome: "rejected", category: "identity" });
      return jsonError("A valid installation identity is required.", 400);
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
        record({ outcome: "rejected", category: reservation });
        return jsonError(
          "The monthly generation allowance has been reached.",
          429,
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
        outcome: result.fallback ? "fallback" : "success",
        category: reservation === "budget_open" ? "budget_open" : "generated",
        provider: result.provider,
      });
      return NextResponse.json(result);
    } catch (error) {
      if (error instanceof BodyTooLargeError) {
        record({ outcome: "rejected", category: "body_size" });
        return jsonError("The request is too large.", 413);
      }
      if (error instanceof InvalidJsonError || error instanceof ZodError) {
        record({ outcome: "rejected", category: "invalid_request" });
        return jsonError(
          "Please check the worksheet details and try again.",
          400,
        );
      }
      record({ outcome: "rejected", category: "internal_error" });
      return jsonError(
        "Prompts could not be generated. Please try again.",
        500,
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
  return {
    allowedOrigins: origins,
    maxBodyBytes: numberFromEnvironment("AI_MAX_REQUEST_BYTES", 12_000),
    installationLimit: numberFromEnvironment(
      "AI_INSTALLATION_MONTHLY_LIMIT",
      20,
    ),
    ipLimit: numberFromEnvironment("AI_IP_MONTHLY_LIMIT", 200),
    monthlyBudgetMicros: Math.round(
      numberFromEnvironment("AI_MONTHLY_BUDGET_USD", 250) * 1_000_000,
    ),
    estimatedRequestCostMicros: Math.round(
      numberFromEnvironment("AI_ESTIMATED_REQUEST_COST_USD", 0.01) * 1_000_000,
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
