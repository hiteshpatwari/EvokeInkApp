import { afterEach, describe, expect, it, vi } from "vitest";
import type { AnswerFeedbackProvider } from "@/domain/answerFeedbackProvider";
import {
  answerFeedbackApiConfigFromEnvironment,
  createAnswerFeedbackOptionsHandler,
  createAnswerFeedbackPostHandler,
  InMemoryAnswerFeedbackControlStore,
  type AnswerFeedbackControlStore,
  type AnswerFeedbackApiDependencies,
} from "./answerFeedbackApiControls";

const payload = {
  prompt: {
    text: "Explain the character's choice using a detail from the reading.",
    skill: "evidence_and_explanation",
    difficultyLevel: "grade_level" as const,
  },
  profile: {
    gradeOrAge: "Grade 3",
    difficulty: "grade_level" as const,
    responseLength: "medium" as const,
  },
  responseText: "The child response contains UNIQUE_PRIVATE_RESPONSE_TEXT.",
};

function request(
  body: unknown = payload,
  headers: Record<string, string> = {},
) {
  return new Request("https://read.example/api/feedback", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://read.example",
      "x-installation-token": "f4cd8e20-f680-4d02-97e3-d37a505afeb3",
      "x-forwarded-for": "203.0.113.10",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function dependencies(
  overrides: Partial<AnswerFeedbackApiDependencies> = {},
): AnswerFeedbackApiDependencies {
  return {
    controls: new InMemoryAnswerFeedbackControlStore(),
    config: {
      allowedOrigins: ["https://read.example"],
      maxBodyBytes: 8_000,
      installationLimit: 10,
      ipLimit: 100,
      monthlyBudgetMicros: 50_000_000,
      estimatedRequestCostMicros: 20_000,
      quotaHashSecret: "test-only-feedback-quota-key",
    },
    generationOptions: { providerName: "mock" },
    events: { record: vi.fn() },
    now: () => new Date("2026-10-22T12:00:00.000Z"),
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("answer feedback API controls", () => {
  it("returns deterministic schema-valid feedback with no-store and exact-origin CORS", async () => {
    const response =
      await createAnswerFeedbackPostHandler(dependencies())(request());

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "https://read.example",
    );
    await expect(response.json()).resolves.toMatchObject({
      provider: "mock",
      fallback: false,
      feedback: { grounding: "response_and_prompt" },
    });
  });

  it("accepts only the exact preflight contract", () => {
    const handler = createAnswerFeedbackOptionsHandler(dependencies());
    const allowed = handler(
      new Request("https://read.example/api/feedback", {
        method: "OPTIONS",
        headers: {
          origin: "https://read.example",
          "access-control-request-method": "POST",
          "access-control-request-headers":
            "content-type, x-installation-token",
        },
      }),
    );
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get("access-control-allow-origin")).toBe(
      "https://read.example",
    );

    const rejected = handler(
      new Request("https://read.example/api/feedback", {
        method: "OPTIONS",
        headers: {
          origin: "https://attacker.example",
          "access-control-request-method": "POST",
        },
      }),
    );
    expect(rejected.status).toBe(403);
    expect(rejected.headers.has("access-control-allow-origin")).toBe(false);
  });

  it("rejects disallowed origins, missing installation identity, unknown fields, and oversized bodies", async () => {
    const handler = createAnswerFeedbackPostHandler(dependencies());
    expect(
      (await handler(request(payload, { origin: "https://attacker.example" })))
        .status,
    ).toBe(403);
    expect(
      (await handler(request(payload, { "x-installation-token": "bad" })))
        .status,
    ).toBe(400);
    expect(
      (await handler(request({ ...payload, childName: "Private Name" })))
        .status,
    ).toBe(400);
    const small = dependencies();
    small.config = { ...small.config, maxBodyBytes: 100 };
    expect(
      (await createAnswerFeedbackPostHandler(small)(request())).status,
    ).toBe(413);
  });

  it("uses separate feedback environment limits and budget settings", () => {
    vi.stubEnv("ANSWER_FEEDBACK_INSTALLATION_MONTHLY_LIMIT", "7");
    vi.stubEnv("ANSWER_FEEDBACK_IP_MONTHLY_LIMIT", "77");
    vi.stubEnv("ANSWER_FEEDBACK_MONTHLY_BUDGET_USD", "3");
    vi.stubEnv("ANSWER_FEEDBACK_ESTIMATED_REQUEST_COST_USD", "0.02");
    vi.stubEnv("AI_INSTALLATION_MONTHLY_LIMIT", "999");

    expect(answerFeedbackApiConfigFromEnvironment()).toMatchObject({
      installationLimit: 7,
      ipLimit: 77,
      monthlyBudgetMicros: 3_000_000,
      estimatedRequestCostMicros: 20_000,
    });
  });

  it("reserves against the feedback category and enforces its own allowance", async () => {
    const controls = new InMemoryAnswerFeedbackControlStore();
    const reserve = vi.spyOn(controls, "reserve");
    const deps = dependencies({ controls });
    deps.config = { ...deps.config, installationLimit: 1 };
    const handler = createAnswerFeedbackPostHandler(deps);

    expect((await handler(request())).status).toBe(200);
    expect((await handler(request())).status).toBe(429);
    expect(reserve).toHaveBeenCalledWith(
      expect.objectContaining({ category: "answer_feedback_v1" }),
    );
  });

  it("does not inherit the prompt provider setting", () => {
    vi.stubEnv("AI_PROVIDER", "openai");
    vi.stubEnv("ANSWER_FEEDBACK_PROVIDER", "mock");
    vi.stubEnv("ANSWER_FEEDBACK_QUOTA_HASH_SECRET", "");

    expect(answerFeedbackApiConfigFromEnvironment().quotaHashSecret).toBe(
      "mock-only-feedback-no-budget",
    );
  });

  it.each(["openai", "claude", "unknown", " mock "])(
    "fails closed for unsupported feedback provider %s during initialization",
    (provider) => {
      vi.stubEnv("ANSWER_FEEDBACK_PROVIDER", provider);

      expect(() => answerFeedbackApiConfigFromEnvironment()).toThrow(
        "ANSWER_FEEDBACK_PROVIDER must be mock",
      );
    },
  );

  it("reports the provider that actually produced the response in mock mode", async () => {
    const events = { record: vi.fn() };
    const response = await createAnswerFeedbackPostHandler(
      dependencies({
        generationOptions: { providerName: "mock" },
        events,
      }),
    )(request());

    await expect(response.json()).resolves.toMatchObject({
      provider: "mock",
      fallback: false,
    });
    expect(events.record).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "mock" }),
    );
  });

  it("accepts fractional USD settings only when they produce positive safe integer micros", () => {
    vi.stubEnv("ANSWER_FEEDBACK_MONTHLY_BUDGET_USD", "3.125001");
    vi.stubEnv("ANSWER_FEEDBACK_ESTIMATED_REQUEST_COST_USD", "0.000001");

    expect(answerFeedbackApiConfigFromEnvironment()).toMatchObject({
      monthlyBudgetMicros: 3_125_001,
      estimatedRequestCostMicros: 1,
    });
  });

  it.each([
    ["ANSWER_FEEDBACK_INSTALLATION_MONTHLY_LIMIT", "1.5"],
    ["ANSWER_FEEDBACK_IP_MONTHLY_LIMIT", "NaN"],
    ["ANSWER_FEEDBACK_MAX_REQUEST_BYTES", "0"],
    ["ANSWER_FEEDBACK_MONTHLY_BUDGET_USD", "0.0000001"],
    ["ANSWER_FEEDBACK_MONTHLY_BUDGET_USD", String(Number.MAX_SAFE_INTEGER)],
    ["ANSWER_FEEDBACK_ESTIMATED_REQUEST_COST_USD", "Infinity"],
  ])("rejects invalid explicit config %s=%s", (name, value) => {
    vi.stubEnv(name, value);

    expect(() => answerFeedbackApiConfigFromEnvironment()).toThrow(name);
  });

  it("produces integer reservation values compatible with the Durable Object contract", async () => {
    vi.stubEnv("APP_ALLOWED_ORIGINS", "https://read.example");
    vi.stubEnv("ANSWER_FEEDBACK_INSTALLATION_MONTHLY_LIMIT", "7");
    vi.stubEnv("ANSWER_FEEDBACK_IP_MONTHLY_LIMIT", "77");
    vi.stubEnv("ANSWER_FEEDBACK_MONTHLY_BUDGET_USD", "3.125001");
    vi.stubEnv("ANSWER_FEEDBACK_ESTIMATED_REQUEST_COST_USD", "0.000001");
    const config = answerFeedbackApiConfigFromEnvironment();
    const reserve = vi.fn(
      (_input: Parameters<AnswerFeedbackControlStore["reserve"]>[0]) =>
        "allowed" as const,
    );

    await createAnswerFeedbackPostHandler(
      dependencies({ controls: { reserve }, config }),
    )(request());

    expect(reserve).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "answer_feedback_v1",
        installationLimit: 7,
        ipLimit: 77,
        budgetMicros: 3_125_001,
        estimatedCostMicros: 1,
      }),
    );
    for (const value of Object.values(reserve.mock.calls[0]![0]).filter(
      (candidate): candidate is number => typeof candidate === "number",
    )) {
      expect(Number.isSafeInteger(value)).toBe(true);
    }
  });

  it("ignores spoofed X-Forwarded-For and groups absent or invalid CF IPs into one bounded bucket", async () => {
    const reserve = vi.fn(
      (_input: Parameters<AnswerFeedbackControlStore["reserve"]>[0]) =>
        "allowed" as const,
    );
    const handler = createAnswerFeedbackPostHandler(
      dependencies({ controls: { reserve } }),
    );
    const token = () => crypto.randomUUID();

    await handler(
      request(payload, {
        "x-installation-token": token(),
        "x-forwarded-for": "198.51.100.1",
      }),
    );
    await handler(
      request(payload, {
        "x-installation-token": token(),
        "x-forwarded-for": "203.0.113.200",
      }),
    );
    await handler(
      request(payload, {
        "x-installation-token": token(),
        "cf-connecting-ip": "not-an-ip",
        "x-forwarded-for": "192.0.2.1",
      }),
    );

    const ipKeys = reserve.mock.calls.map(([reservation]) => reservation.ipKey);
    expect(new Set(ipKeys)).toHaveLength(1);
  });

  it("uses a valid Cloudflare connecting IP instead of X-Forwarded-For", async () => {
    const reserve = vi.fn(
      (_input: Parameters<AnswerFeedbackControlStore["reserve"]>[0]) =>
        "allowed" as const,
    );
    const handler = createAnswerFeedbackPostHandler(
      dependencies({ controls: { reserve } }),
    );

    await handler(
      request(payload, {
        "x-installation-token": crypto.randomUUID(),
        "cf-connecting-ip": "203.0.113.10",
        "x-forwarded-for": "198.51.100.1",
      }),
    );
    await handler(
      request(payload, {
        "x-installation-token": crypto.randomUUID(),
        "cf-connecting-ip": "2001:db8::10",
        "x-forwarded-for": "198.51.100.1",
      }),
    );

    const ipKeys = reserve.mock.calls.map(([reservation]) => reservation.ipKey);
    expect(new Set(ipKeys)).toHaveLength(2);
  });

  it("falls back after timeout or invalid provider output", async () => {
    for (const primary of [
      { generate: vi.fn(() => new Promise<never>(() => undefined)) },
      { generate: vi.fn(async () => ({ strengths: [] })) },
    ]) {
      const response = await createAnswerFeedbackPostHandler(
        dependencies({
          generationOptions: {
            providerName: "openai",
            primary: primary as unknown as AnswerFeedbackProvider,
            providerTimeoutMs: 5,
          },
        }),
      )(request());
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        provider: "mock",
        fallback: true,
      });
    }
  });

  it("emits content-free metadata even when provider and sink fail", async () => {
    const record = vi.fn(() => {
      throw new Error("sink saw private content");
    });
    const primary: AnswerFeedbackProvider = {
      generate: vi.fn(async () => {
        throw new Error("provider saw UNIQUE_PRIVATE_RESPONSE_TEXT");
      }),
    };
    const response = await createAnswerFeedbackPostHandler(
      dependencies({
        generationOptions: { providerName: "openai", primary },
        events: { record },
      }),
    )(request());

    expect(response.status).toBe(200);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        route: "/api/feedback",
        provider: "mock",
        fallback: true,
        errorCategory: "provider_failure",
      }),
    );
    expect(JSON.stringify(record.mock.calls)).not.toMatch(
      /UNIQUE_PRIVATE_RESPONSE_TEXT|character's choice/i,
    );
  });

  it("contains an asynchronously rejecting event sink", async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on("unhandledRejection", onUnhandled);
    try {
      const response = await createAnswerFeedbackPostHandler(
        dependencies({
          events: {
            record: vi.fn(() => Promise.reject(new Error("sink failed"))),
          },
        }),
      )(request());
      await new Promise<void>((resolve) => setTimeout(resolve, 0));

      expect(response.status).toBe(200);
      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });
});
