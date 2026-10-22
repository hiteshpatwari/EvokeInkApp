import { z } from "zod";

export const answerFeedbackOperationalEventSchema = z
  .object({
    requestId: z.uuid(),
    timestamp: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z$/),
    durationMs: z.number().int().min(0).max(300_000),
    route: z.literal("/api/feedback"),
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
    estimatedCostMicros: z.number().int().min(0).max(1_000_000_000).optional(),
  })
  .strict();

export type AnswerFeedbackOperationalEvent = z.infer<
  typeof answerFeedbackOperationalEventSchema
>;

export interface AnswerFeedbackEventSink {
  record(event: AnswerFeedbackOperationalEvent): void | Promise<void>;
}

function coarseTimestamp(value: unknown): string {
  const parsed = typeof value === "string" ? new Date(value) : new Date();
  const date = Number.isFinite(parsed.getTime()) ? parsed : new Date();
  return `${date.toISOString().slice(0, 16)}Z`;
}

export function emitAnswerFeedbackOperationalEvent(
  sink: AnswerFeedbackEventSink,
  candidate: Record<string, unknown>,
): boolean {
  try {
    const status = [200, 400, 403, 413, 415, 429, 500].includes(
      Number(candidate["status"]),
    )
      ? Number(candidate["status"])
      : 500;
    const provider = ["mock", "openai"].includes(String(candidate["provider"]))
      ? (candidate["provider"] as "mock" | "openai")
      : undefined;
    const allowedErrors = [
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
    ] as const;
    const allowedDecisions = [
      "not_checked",
      "allowed",
      "installation_quota",
      "ip_quota",
      "budget_open",
    ] as const;
    const errorCandidate = String(candidate["errorCategory"]);
    const decisionCandidate = String(candidate["rateLimitDecision"]);
    const event = answerFeedbackOperationalEventSchema.parse({
      requestId: z.uuid().safeParse(candidate["requestId"]).success
        ? candidate["requestId"]
        : crypto.randomUUID(),
      timestamp: coarseTimestamp(candidate["timestamp"]),
      durationMs:
        typeof candidate["durationMs"] === "number" &&
        Number.isFinite(candidate["durationMs"])
          ? Math.min(300_000, Math.max(0, Math.round(candidate["durationMs"])))
          : 0,
      route: "/api/feedback",
      status,
      ...(provider ? { provider } : {}),
      fallback: candidate["fallback"] === true,
      errorCategory: allowedErrors.includes(
        errorCandidate as (typeof allowedErrors)[number],
      )
        ? errorCandidate
        : "internal_error",
      rateLimitDecision: allowedDecisions.includes(
        decisionCandidate as (typeof allowedDecisions)[number],
      )
        ? decisionCandidate
        : "not_checked",
      ...(typeof candidate["abuseKey"] === "string" &&
      /^[0-9a-f]{12}$/.test(candidate["abuseKey"])
        ? { abuseKey: candidate["abuseKey"] }
        : {}),
      ...(typeof candidate["estimatedCostMicros"] === "number" &&
      Number.isFinite(candidate["estimatedCostMicros"])
        ? {
            estimatedCostMicros: Math.min(
              1_000_000_000,
              Math.max(0, Math.round(candidate["estimatedCostMicros"])),
            ),
          }
        : {}),
    });
    const pending = sink.record(event);
    if (pending) void Promise.resolve(pending).catch(() => undefined);
    return true;
  } catch {
    return false;
  }
}

export class ConsoleAnswerFeedbackEventSink implements AnswerFeedbackEventSink {
  record(event: AnswerFeedbackOperationalEvent): void {
    console.info(JSON.stringify({ event: "answer_feedback_api", ...event }));
  }
}
