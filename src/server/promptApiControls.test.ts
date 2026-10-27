import { afterEach, describe, expect, it, vi } from "vitest";
import type { PromptGenerator } from "@/domain/promptGenerator";
import type { NetworkGenerationInput } from "@/domain/schemas";
import {
  createPromptPostHandler,
  createPromptOptionsHandler,
  InMemoryPromptControlStore,
  promptApiConfigFromEnvironment,
  type PromptApiDependencies,
} from "./promptApiControls";

const payload: NetworkGenerationInput = {
  child: {
    gradeOrAge: "Grade 3",
    readingLevel: "Independent: Grade 5",
    lexile: "820L",
    difficulty: "challenging",
    responseLength: "medium",
  },
  book: {
    title: "A Book",
    author: "An Author",
    genre: "fiction",
    progress: "Chapters 1-3",
  },
  specificity: "general",
  skills: ["inference"],
  parentNotes: "",
  parentSummary: "",
  detailNotes: "",
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function request(
  body: unknown = payload,
  headers: Record<string, string> = {},
) {
  return new Request("https://read.example/api/prompts", {
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
  overrides: Partial<PromptApiDependencies> = {},
): PromptApiDependencies {
  const primary: PromptGenerator = {
    generate: vi.fn(async () => ({
      prompts: Array.from({ length: 4 }, (_, index) => ({
        text: "Choose one important idea and support it with a detail from the reading.",
        skill: "inference",
        explanation: "Practices inference using evidence and reasoning.",
        required: index < 3,
        suggestedResponseLength: "3-4 sentences",
        grounding: "generic" as const,
        difficultyLevel: "challenging" as const,
      })),
    })),
  };
  return {
    controls: new InMemoryPromptControlStore(),
    config: {
      allowedOrigins: ["https://read.example"],
      maxBodyBytes: 12_000,
      installationLimit: 20,
      ipLimit: 200,
      monthlyBudgetMicros: 250_000_000,
      estimatedRequestCostMicros: 10_000,
      quotaHashSecret: "test-only-quota-key",
    },
    generationOptions: {
      providerName: "openai",
      apiKey: "test-key",
      primary,
    },
    now: () => new Date("2026-10-19T12:00:00.000Z"),
    events: { record: vi.fn() },
    ...overrides,
  };
}

describe("prompt API controls", () => {
  it("answers an exact allowed-origin preflight with only the prompt contract", async () => {
    const response = createPromptOptionsHandler(dependencies())(
      new Request("https://read.example/api/prompts", {
        method: "OPTIONS",
        headers: {
          origin: "https://read.example",
          "access-control-request-method": "POST",
          "access-control-request-headers":
            "content-type, x-installation-token",
        },
      }),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "https://read.example",
    );
    expect(response.headers.get("access-control-allow-methods")).toBe(
      "POST, OPTIONS",
    );
    expect(response.headers.get("access-control-allow-headers")).toBe(
      "Content-Type, X-Installation-Token",
    );
    expect(response.headers.get("vary")).toBe("Origin");
    expect(response.headers.has("access-control-allow-credentials")).toBe(
      false,
    );
  });

  it("rejects preflights from disallowed origins or for broader methods and headers", () => {
    const handler = createPromptOptionsHandler(dependencies());
    const preflight = (headers: Record<string, string>) =>
      handler(
        new Request("https://read.example/api/prompts", {
          method: "OPTIONS",
          headers: {
            origin: "https://read.example",
            "access-control-request-method": "POST",
            "access-control-request-headers":
              "content-type, x-installation-token",
            ...headers,
          },
        }),
      );

    expect(preflight({ origin: "https://attacker.example" }).status).toBe(403);
    expect(
      preflight({ "access-control-request-method": "DELETE" }).status,
    ).toBe(403);
    expect(
      preflight({ "access-control-request-headers": "authorization" }).status,
    ).toBe(403);
  });

  it("requires a stable quota hash secret before OpenAI mode can start", () => {
    vi.stubEnv("AI_PROVIDER", "openai");
    vi.stubEnv("AI_QUOTA_HASH_SECRET", "");

    expect(() => promptApiConfigFromEnvironment()).toThrow(
      "AI_QUOTA_HASH_SECRET is required",
    );
  });

  it("allows key-free mock mode without generating a runtime secret", () => {
    vi.stubEnv("AI_PROVIDER", "mock");
    vi.stubEnv("AI_QUOTA_HASH_SECRET", "");
    const randomUUID = vi.spyOn(globalThis.crypto, "randomUUID");

    expect(promptApiConfigFromEnvironment().quotaHashSecret).toBe(
      "mock-only-no-quota-reservations",
    );
    expect(randomUUID).not.toHaveBeenCalled();
  });

  it("reserves the observed pilot cost when no estimate override is set", () => {
    vi.stubEnv("AI_PROVIDER", "mock");
    vi.stubEnv("AI_ESTIMATED_REQUEST_COST_USD", "");

    expect(promptApiConfigFromEnvironment().estimatedRequestCostMicros).toBe(
      30_000,
    );
  });

  it("accepts a valid privacy-minimized generation request", async () => {
    const response = await createPromptPostHandler(dependencies())(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "https://read.example",
    );
    expect(response.headers.get("vary")).toBe("Origin");
    await expect(response.json()).resolves.toMatchObject({
      provider: "openai",
      fallback: false,
    });
  });

  it("never emits an allow-origin header for a disallowed POST origin", async () => {
    const response = await createPromptPostHandler(dependencies())(
      request(payload, { origin: "https://attacker.example" }),
    );

    expect(response.status).toBe(403);
    expect(response.headers.has("access-control-allow-origin")).toBe(false);
    expect(response.headers.get("vary")).toBe("Origin");
  });

  it("allows configured native origins only in mock mode", () => {
    vi.stubEnv(
      "APP_ALLOWED_ORIGINS",
      "https://localhost,capacitor://localhost",
    );
    vi.stubEnv("AI_PROVIDER", "mock");
    expect(promptApiConfigFromEnvironment().allowedOrigins).toEqual([
      "https://localhost",
      "capacitor://localhost",
    ]);

    vi.stubEnv("AI_PROVIDER", "openai");
    vi.stubEnv("AI_QUOTA_HASH_SECRET", "test-only-quota-key");
    expect(() => promptApiConfigFromEnvironment()).toThrow(
      "Native app origins require AI_PROVIDER=mock",
    );
  });

  it("rejects child names and local record identifiers at the network boundary", async () => {
    const handler = createPromptPostHandler(dependencies());
    for (const privateField of ["name", "id", "profileId", "worksheetId"]) {
      const response = await handler(
        request({
          ...payload,
          child: { ...payload.child, [privateField]: "private-local-value" },
        }),
      );
      expect(response.status, privateField).toBe(400);
    }

    const nestedBookId = await handler(
      request({
        ...payload,
        book: { ...payload.book, id: "private-local-value" },
      }),
    );
    expect(nestedBookId.status).toBe(400);
  });

  it("rejects wrong content types, disallowed origins, invalid JSON, and oversized bodies", async () => {
    const handler = createPromptPostHandler(dependencies());
    expect(
      (await handler(request(payload, { "content-type": "text/plain" })))
        .status,
    ).toBe(415);
    expect(
      (await handler(request(payload, { "content-type": "application/jsonp" })))
        .status,
    ).toBe(415);
    expect(
      (await handler(request(payload, { origin: "https://attacker.example" })))
        .status,
    ).toBe(403);
    const malformed = new Request("https://read.example/api/prompts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://read.example",
        "x-installation-token": "f4cd8e20-f680-4d02-97e3-d37a505afeb3",
      },
      body: "{",
    });
    expect((await handler(malformed)).status).toBe(400);
    expect(
      (
        await createPromptPostHandler(
          dependencies({
            config: {
              ...dependencies().config,
              maxBodyBytes: 100,
            },
          }),
        )(request())
      ).status,
    ).toBe(413);
  });

  it("atomically enforces installation quotas under high concurrency", async () => {
    const deps = dependencies();
    const handler = createPromptPostHandler(deps);
    const responses = await Promise.all(
      Array.from({ length: 100 }, () => handler(request())),
    );
    expect(responses.filter(({ status }) => status === 200)).toHaveLength(20);
    expect(responses.filter(({ status }) => status === 429)).toHaveLength(80);
  });

  it("enforces the independent coarse-IP quota", async () => {
    const deps = dependencies();
    deps.config = { ...deps.config, ipLimit: 1 };
    const handler = createPromptPostHandler(deps);
    expect((await handler(request())).status).toBe(200);
    expect(
      (
        await handler(
          request(payload, {
            "x-installation-token": "2ff3c5ad-47b5-4a56-8288-ea16020a361a",
          }),
        )
      ).status,
    ).toBe(429);
    expect(deps.events.record).toHaveBeenLastCalledWith(
      expect.objectContaining({
        rateLimitDecision: "ip_quota",
        abuseKey: expect.stringMatching(/^[0-9a-f]{12}$/),
      }),
    );
  });

  it("opens the budget circuit before sending a provider request", async () => {
    const deps = dependencies();
    deps.config = {
      ...deps.config,
      monthlyBudgetMicros: 5_000,
      estimatedRequestCostMicros: 10_000,
    };
    const handler = createPromptPostHandler(deps);
    const response = await handler(request());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      provider: "mock",
      fallback: true,
    });
    expect(deps.generationOptions.primary?.generate).not.toHaveBeenCalled();
  });

  it("atomically reserves budget under concurrent requests", async () => {
    const deps = dependencies();
    deps.config = {
      ...deps.config,
      installationLimit: 100,
      ipLimit: 100,
      monthlyBudgetMicros: 50_000,
      estimatedRequestCostMicros: 10_000,
    };
    const handler = createPromptPostHandler(deps);

    const responses = await Promise.all(
      Array.from({ length: 40 }, () => handler(request())),
    );
    const results = await Promise.all(
      responses.map((response) => response.json()),
    );

    expect(deps.generationOptions.primary?.generate).toHaveBeenCalledTimes(5);
    expect(
      results.filter(
        (result) =>
          typeof result === "object" &&
          result !== null &&
          "provider" in result &&
          result.provider === "mock",
      ),
    ).toHaveLength(35);
  });

  it("falls back deterministically when the provider times out or returns 429/5xx", async () => {
    for (const error of [
      new DOMException("timed out", "TimeoutError"),
      Object.assign(new Error("rate limited"), { status: 429 }),
      Object.assign(new Error("provider error"), { status: 503 }),
    ]) {
      const primary: PromptGenerator = {
        generate: vi.fn(async () => Promise.reject(error)),
      };
      const response = await createPromptPostHandler(
        dependencies({
          generationOptions: {
            providerName: "openai",
            apiKey: "test-key",
            primary,
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

  it("falls back when a provider exceeds the application timeout", async () => {
    const primary: PromptGenerator = {
      generate: vi.fn(() => new Promise<never>(() => undefined)),
    };
    const response = await createPromptPostHandler(
      dependencies({
        generationOptions: {
          providerName: "openai",
          apiKey: "test-key",
          primary,
          providerTimeoutMs: 5,
        },
      }),
    )(request());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      provider: "mock",
      fallback: true,
    });
  });

  it("emits a normalized provider-failure signal without provider content", async () => {
    const events = { record: vi.fn(() => undefined) };
    const primary: PromptGenerator = {
      generate: vi.fn(async () => {
        throw Object.assign(new Error("private provider response"), {
          status: 503,
          response: { data: "private book and notes" },
        });
      }),
    };
    const response = await createPromptPostHandler(
      dependencies({
        events,
        generationOptions: {
          providerName: "openai",
          apiKey: "test-key",
          primary,
        },
      }),
    )(request());

    expect(response.status).toBe(200);
    expect(events.record).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "openai",
        fallback: true,
        errorCategory: "provider_failure",
      }),
    );
    expect(JSON.stringify(events.record.mock.calls)).not.toMatch(
      /private provider response|private book and notes|A Book/,
    );
  });

  it("emits only bounded operational metadata", async () => {
    const events = { record: vi.fn(() => undefined) };
    await createPromptPostHandler(dependencies({ events }))(request());
    expect(events.record).toHaveBeenCalledWith(
      expect.objectContaining({
        route: "/api/prompts",
        status: 200,
        provider: "openai",
        fallback: false,
        errorCategory: "none",
        rateLimitDecision: "allowed",
      }),
    );
    expect(JSON.stringify(events.record.mock.calls)).not.toContain("A Book");
  });

  it("does not expose private data or break the response when the sink fails", async () => {
    const events = {
      record: vi.fn(() => {
        throw new Error("sink failed with private notes");
      }),
    };
    const response = await createPromptPostHandler(dependencies({ events }))(
      request({ ...payload, parentNotes: "private family details" }),
    );

    expect(response.status).toBe(200);
    expect(JSON.stringify(events.record.mock.calls)).not.toContain(
      "private family details",
    );
  });

  it("keeps status, body, and CORS identical when the sink rejects asynchronously", async () => {
    const baseline = await createPromptPostHandler(dependencies())(request());
    const baselineBody = await baseline.json();
    const record = vi.fn(() => Promise.reject(new Error("async sink failed")));
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on("unhandledRejection", onUnhandled);
    try {
      const response = await createPromptPostHandler(
        dependencies({ events: { record } }),
      )(request());
      const body = await response.json();
      await new Promise<void>((resolve) => setTimeout(resolve, 0));

      expect(response.status).toBe(baseline.status);
      expect(body).toEqual(baselineBody);
      expect(response.headers.get("access-control-allow-origin")).toBe(
        baseline.headers.get("access-control-allow-origin"),
      );
      expect(response.headers.get("vary")).toBe(baseline.headers.get("vary"));
      expect(response.headers.get("cache-control")).toBe(
        baseline.headers.get("cache-control"),
      );
      expect(record).toHaveBeenCalledOnce();
      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });
});
