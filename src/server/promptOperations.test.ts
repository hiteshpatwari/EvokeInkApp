import { describe, expect, it, vi } from "vitest";
import {
  aggregatePromptOperationalEvents,
  emitPromptOperationalEvent,
  InMemoryPromptEventSink,
} from "./promptOperations";

const base = {
  requestId: "019a0f19-7c48-7a0b-95f2-20f08765af62",
  timestamp: "2026-10-21T09:42Z",
  durationMs: 125,
  route: "/api/prompts" as const,
  status: 200,
  provider: "openai" as const,
  fallback: false,
  errorCategory: "none" as const,
  rateLimitDecision: "allowed" as const,
  estimatedCostMicros: 10_000,
};

describe("privacy-safe prompt operations", () => {
  it("drops every disallowed field and bounds identifiers and numbers", () => {
    const sink = new InMemoryPromptEventSink();
    const emitted = emitPromptOperationalEvent(sink, {
      ...base,
      requestId: "not-a-uuid",
      durationMs: 999_999_999,
      child: "Aavya",
      title: "A Book",
      notes: "private notes",
      requestBody: { private: true },
      headers: { authorization: "secret" },
      providerResponse: "private response",
      apiKey: "secret",
      ip: "203.0.113.10",
      installationToken: "private-token",
      abuseKey: "too-long-or-not-hex-private-value",
      error: new Error("private notes"),
    });

    expect(emitted).toBe(true);
    const json = JSON.stringify(sink.events);
    expect(json).not.toMatch(
      /Aavya|A Book|private notes|authorization|providerResponse|apiKey|203\.0\.113\.10|private-token/,
    );
    expect(sink.events[0]?.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(sink.events[0]?.durationMs).toBe(300_000);
    expect(sink.events[0]?.abuseKey).toBeUndefined();
  });

  it("contains sink failures and never forwards content to the sink", () => {
    const record = vi.fn(() => {
      throw new Error("sink unavailable");
    });
    expect(
      emitPromptOperationalEvent(
        { record },
        { ...base, notes: "must never arrive" },
      ),
    ).toBe(false);
    expect(record).toHaveBeenCalledOnce();
    expect(JSON.stringify(record.mock.calls)).not.toContain(
      "must never arrive",
    );
  });

  it("aggregates availability, error, latency, quota, fallback, and cost counters", () => {
    const summary = aggregatePromptOperationalEvents([
      base,
      {
        ...base,
        requestId: "019a0f19-7c48-7a0b-95f2-20f08765af63",
        status: 200,
        provider: "mock",
        fallback: true,
        errorCategory: "provider_failure",
        estimatedCostMicros: 0,
        durationMs: 75,
      },
      {
        ...base,
        requestId: "019a0f19-7c48-7a0b-95f2-20f08765af64",
        status: 429,
        provider: undefined,
        fallback: false,
        errorCategory: "installation_quota",
        rateLimitDecision: "installation_quota",
        estimatedCostMicros: 0,
        durationMs: 50,
      },
    ]);

    expect(summary).toEqual({
      requests: 3,
      available: 3,
      errors: 1,
      fallbacks: 1,
      quotaDenials: 1,
      durationMs: { total: 250, max: 125, average: 83.33 },
      estimatedCostMicros: 10_000,
      byProvider: { mock: 1, openai: 1 },
      byErrorCategory: {
        installation_quota: 1,
        none: 1,
        provider_failure: 1,
      },
    });
  });
});
