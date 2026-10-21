import { z } from "zod";

const MAX_DURATION_MS = 300_000;
const MAX_TOKEN_COUNT = 1_000_000;
const MAX_COST_MICROS = 1_000_000_000;

export const promptOperationalEventSchema = z.object({
  requestId: z.uuid(),
  timestamp: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z$/),
  durationMs: z.number().int().min(0).max(MAX_DURATION_MS),
  route: z.literal("/api/prompts"),
  status: z.union([
    z.literal(200),
    z.literal(400),
    z.literal(403),
    z.literal(413),
    z.literal(415),
    z.literal(429),
    z.literal(500),
  ]),
  provider: z.enum(["mock", "openai"]).optional(),
  fallback: z.boolean(),
  errorCategory: z.enum([
    "none",
    "content_type",
    "origin",
    "identity",
    "body_size",
    "invalid_request",
    "installation_quota",
    "ip_quota",
    "budget_open",
    "provider_failure",
    "internal_error",
  ]),
  rateLimitDecision: z.enum([
    "not_checked",
    "allowed",
    "installation_quota",
    "ip_quota",
    "budget_open",
  ]),
  abuseKey: z
    .string()
    .regex(/^[0-9a-f]{12}$/)
    .optional(),
  inputTokens: z.number().int().min(0).max(MAX_TOKEN_COUNT).optional(),
  outputTokens: z.number().int().min(0).max(MAX_TOKEN_COUNT).optional(),
  estimatedCostMicros: z.number().int().min(0).max(MAX_COST_MICROS).optional(),
});

export type PromptOperationalEvent = z.infer<
  typeof promptOperationalEventSchema
>;

export interface PromptEventSink {
  record(event: PromptOperationalEvent): void;
}

function finiteInteger(
  value: unknown,
  minimum: number,
  maximum: number,
): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, Math.round(value)))
    : undefined;
}

function coarseTimestamp(value: unknown): string {
  const parsed = typeof value === "string" ? new Date(value) : new Date();
  const date = Number.isFinite(parsed.getTime()) ? parsed : new Date();
  return date.toISOString().slice(0, 16) + "Z";
}

function enumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof value === "string" && allowed.includes(value as T)
    ? (value as T)
    : fallback;
}

export function sanitizePromptOperationalEvent(
  candidate: Record<string, unknown>,
): PromptOperationalEvent {
  const status = [200, 400, 403, 413, 415, 429, 500].includes(
    Number(candidate["status"]),
  )
    ? Number(candidate["status"])
    : 500;
  const provider = ["mock", "openai"].includes(String(candidate["provider"]))
    ? (candidate["provider"] as "mock" | "openai")
    : undefined;
  const event: Record<string, unknown> = {
    requestId: z.uuid().safeParse(candidate["requestId"]).success
      ? candidate["requestId"]
      : crypto.randomUUID(),
    timestamp: coarseTimestamp(candidate["timestamp"]),
    durationMs: finiteInteger(candidate["durationMs"], 0, MAX_DURATION_MS) ?? 0,
    route: "/api/prompts",
    status,
    fallback: candidate["fallback"] === true,
    errorCategory: enumValue(
      candidate["errorCategory"],
      [
        "none",
        "content_type",
        "origin",
        "identity",
        "body_size",
        "invalid_request",
        "installation_quota",
        "ip_quota",
        "budget_open",
        "provider_failure",
        "internal_error",
      ] as const,
      "internal_error",
    ),
    rateLimitDecision: enumValue(
      candidate["rateLimitDecision"],
      [
        "not_checked",
        "allowed",
        "installation_quota",
        "ip_quota",
        "budget_open",
      ] as const,
      "not_checked",
    ),
    abuseKey:
      typeof candidate["abuseKey"] === "string" &&
      /^[0-9a-f]{12}$/.test(candidate["abuseKey"])
        ? candidate["abuseKey"]
        : undefined,
    inputTokens: finiteInteger(candidate["inputTokens"], 0, MAX_TOKEN_COUNT),
    outputTokens: finiteInteger(candidate["outputTokens"], 0, MAX_TOKEN_COUNT),
    estimatedCostMicros: finiteInteger(
      candidate["estimatedCostMicros"],
      0,
      MAX_COST_MICROS,
    ),
  };
  if (provider) event["provider"] = provider;

  return promptOperationalEventSchema.parse(event);
}

export function emitPromptOperationalEvent(
  sink: PromptEventSink,
  candidate: Record<string, unknown>,
): boolean {
  try {
    const event = sanitizePromptOperationalEvent(candidate);
    sink.record(event);
    return true;
  } catch {
    return false;
  }
}

export class InMemoryPromptEventSink implements PromptEventSink {
  readonly events: PromptOperationalEvent[] = [];

  record(event: PromptOperationalEvent): void {
    this.events.push(promptOperationalEventSchema.parse(event));
  }
}

export function aggregatePromptOperationalEvents(
  rawEvents: readonly unknown[],
) {
  const events = rawEvents.map((event) =>
    promptOperationalEventSchema.parse(event),
  );
  const durationTotal = events.reduce(
    (sum, event) => sum + event.durationMs,
    0,
  );
  const byProvider: Record<string, number> = {};
  const byErrorCategory: Record<string, number> = {};
  for (const event of events) {
    if (event.provider) {
      byProvider[event.provider] = (byProvider[event.provider] ?? 0) + 1;
    }
    byErrorCategory[event.errorCategory] =
      (byErrorCategory[event.errorCategory] ?? 0) + 1;
  }
  return {
    requests: events.length,
    available: events.filter((event) => event.status < 500).length,
    errors: events.filter((event) => event.status >= 400).length,
    fallbacks: events.filter((event) => event.fallback).length,
    quotaDenials: events.filter((event) =>
      ["installation_quota", "ip_quota"].includes(event.rateLimitDecision),
    ).length,
    durationMs: {
      total: durationTotal,
      max: Math.max(0, ...events.map((event) => event.durationMs)),
      average:
        events.length === 0
          ? 0
          : Math.round((durationTotal / events.length) * 100) / 100,
    },
    estimatedCostMicros: events.reduce(
      (sum, event) => sum + (event.estimatedCostMicros ?? 0),
      0,
    ),
    byProvider,
    byErrorCategory,
  };
}
