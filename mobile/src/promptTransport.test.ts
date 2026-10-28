import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockPromptGenerator } from "../../src/domain/mockPromptGenerator";
import { MockAnswerFeedbackProvider } from "../../src/domain/mockAnswerFeedbackProvider";
import type { AnswerFeedbackInput } from "../../src/domain/answerFeedbackSchemas";
import type { NetworkGenerationInput } from "../../src/domain/schemas";
import { requireProductionPromptApiUrl } from "./promptApiConfig";
import { createMobilePromptFetch } from "./promptTransport";

const request: NetworkGenerationInput = {
  child: {
    gradeOrAge: "Grade 5",
    readingLevel: "Advanced",
    lexile: "900L",
    difficulty: "grade_level",
    responseLength: "medium",
  },
  book: {
    title: "A book",
    author: "An author",
    genre: "fiction",
    progress: "Chapters 1-3",
  },
  specificity: "general",
  skills: ["inference"],
  parentNotes: "",
  parentSummary: "",
  detailNotes: "",
};

const init: RequestInit = { method: "POST", body: JSON.stringify(request) };

const feedbackRequest: AnswerFeedbackInput = {
  prompt: {
    text: "Why did the character change their mind?",
    skill: "inference",
    difficultyLevel: "grade_level",
  },
  profile: {
    gradeOrAge: "Grade 5",
    readingLevel: "Advanced",
    lexile: "900L",
    difficulty: "grade_level",
    responseLength: "medium",
  },
  responseText:
    "The character changed their mind because they noticed the locked gate.",
};

const feedbackInit: RequestInit = {
  method: "POST",
  body: JSON.stringify(feedbackRequest),
};

const transcriptionBody = new FormData();
transcriptionBody.set(
  "image",
  new File([new Uint8Array([1, 2, 3])], "answer.jpg", {
    type: "image/jpeg",
  }),
);
const transcriptionInit: RequestInit = {
  method: "POST",
  headers: { "X-Installation-Token": "00000000-0000-4000-8000-000000000000" },
  body: transcriptionBody,
};

async function validBatch() {
  return new MockPromptGenerator().generate({
    ...request,
    child: { ...request.child, name: "Reader" },
  });
}

async function validFeedback() {
  return new MockAnswerFeedbackProvider().generate(feedbackRequest);
}

describe("requireProductionPromptApiUrl", () => {
  it("accepts an explicit HTTPS endpoint", () => {
    expect(
      requireProductionPromptApiUrl(
        "https://api.example.com/api/prompts",
        "production",
      ),
    ).toBe("https://api.example.com/api/prompts");
  });

  it.each([undefined, "", "http://api.example.com/api/prompts", "not-a-url"])(
    "rejects missing or unsafe production configuration: %s",
    (value) => {
      expect(() => requireProductionPromptApiUrl(value, "production")).toThrow(
        /VITE_PROMPT_API_URL.*HTTPS/,
      );
    },
  );

  it("permits an omitted endpoint outside production for local fallback", () => {
    expect(
      requireProductionPromptApiUrl(undefined, "development"),
    ).toBeUndefined();
  });
});

describe("createMobilePromptFetch", () => {
  beforeEach(() => vi.useRealTimers());

  it("routes only the prompt request to the configured HTTPS endpoint", async () => {
    const hosted = Response.json(await validBatch());
    const realFetch = vi.fn(async () => hosted);
    const mobileFetch = createMobilePromptFetch(
      realFetch,
      "https://api.example.com/api/prompts",
    );

    expect(await mobileFetch("/api/prompts", init)).toBe(hosted);
    expect(realFetch).toHaveBeenCalledWith(
      "https://api.example.com/api/prompts",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );

    await mobileFetch("/unrelated", { method: "GET" });
    expect(realFetch).toHaveBeenLastCalledWith("/unrelated", { method: "GET" });
  });

  it("routes feedback to the sibling hosted endpoint and preserves valid output", async () => {
    const hosted = Response.json({
      feedback: await validFeedback(),
      provider: "mock",
      fallback: false,
    });
    const realFetch = vi.fn(async () => hosted);
    const mobileFetch = createMobilePromptFetch(
      realFetch,
      "https://api.example.com/api/prompts",
    );

    expect(await mobileFetch("/api/feedback", feedbackInit)).toBe(hosted);
    expect(realFetch).toHaveBeenCalledWith(
      "https://api.example.com/api/feedback",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("routes transcription to the sibling hosted endpoint and preserves valid output", async () => {
    const hosted = Response.json({
      transcription: {
        transcript: "The character changed their mind.",
        uncertainSegments: [],
      },
      provider: "openai",
      fallback: false,
    });
    let sentInit: RequestInit | undefined;
    const realFetch = vi.fn(
      async (_input: RequestInfo | URL, requestInit?: RequestInit) => {
        sentInit = requestInit;
        return hosted;
      },
    );
    const attestation = {
      tokenForImage: vi.fn(async () => "play-integrity-token"),
    };
    const mobileFetch = createMobilePromptFetch(
      realFetch,
      "https://api.example.com/api/prompts",
      8_000,
      attestation,
    );

    expect(await mobileFetch("/api/transcriptions", transcriptionInit)).toBe(
      hosted,
    );
    expect(realFetch).toHaveBeenCalledWith(
      "https://api.example.com/api/transcriptions",
      expect.objectContaining({
        body: transcriptionInit.body,
        headers: expect.any(Headers),
        signal: expect.any(AbortSignal),
      }),
    );
    expect(attestation.tokenForImage).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      "00000000-0000-4000-8000-000000000000",
    );
    const hostedHeaders = sentInit?.headers as Headers;
    expect(hostedHeaders.get("X-Play-Integrity-Token")).toBe(
      "play-integrity-token",
    );
  });

  it("fails closed before upload when native attestation is unavailable", async () => {
    const realFetch = vi.fn();
    const mobileFetch = createMobilePromptFetch(
      realFetch,
      "https://api.example.com/api/prompts",
      8_000,
      {
        tokenForImage: vi.fn(async () => Promise.reject(new Error("no token"))),
      },
    );

    const response = await mobileFetch(
      "/api/transcriptions",
      transcriptionInit,
    );

    expect(response.status).toBe(503);
    expect(realFetch).not.toHaveBeenCalled();
  });

  it("never uploads a transcription image without an attestation provider", async () => {
    const realFetch = vi.fn();
    const mobileFetch = createMobilePromptFetch(
      realFetch,
      "https://api.example.com/api/prompts",
    );

    const response = await mobileFetch(
      "/api/transcriptions",
      transcriptionInit,
    );

    expect(response.status).toBe(503);
    expect(realFetch).not.toHaveBeenCalled();
  });

  it("times out stalled native attestation without uploading the image", async () => {
    vi.useFakeTimers();
    const realFetch = vi.fn();
    const mobileFetch = createMobilePromptFetch(
      realFetch,
      "https://api.example.com/api/prompts",
      25,
      { tokenForImage: vi.fn(() => new Promise<string>(() => undefined)) },
    );

    const pending = mobileFetch("/api/transcriptions", transcriptionInit);
    await vi.advanceTimersByTimeAsync(25);
    const response = await pending;

    expect(response.status).toBe(503);
    expect(realFetch).not.toHaveBeenCalled();
  });

  it.each([
    ["request rejection", () => Promise.reject(new Error("offline"))],
    [
      "non-2xx response",
      () => Promise.resolve(new Response("no", { status: 503 })),
    ],
    ["invalid JSON", () => Promise.resolve(new Response("not-json"))],
    [
      "invalid schema",
      () =>
        Promise.resolve(
          Response.json({
            transcription: { transcript: "Invented", uncertainSegments: [] },
            provider: "mock",
            fallback: true,
          }),
        ),
    ],
  ])(
    "returns an honest unavailable transcription after %s",
    async (_name, outcome) => {
      const mobileFetch = createMobilePromptFetch(
        vi.fn(outcome),
        "https://api.example.com/api/prompts",
      );

      const response = await mobileFetch(
        "/api/transcriptions",
        transcriptionInit,
      );
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({
        code: "transcription_unavailable",
        message:
          "Automatic handwriting reading is unavailable right now. Type the response instead.",
      });
    },
  );

  it("returns unavailable without a hosted endpoint and never fabricates a transcript", async () => {
    const realFetch = vi.fn();
    const mobileFetch = createMobilePromptFetch(realFetch, undefined);

    const response = await mobileFetch(
      "/api/transcriptions",
      transcriptionInit,
    );
    expect(response.status).toBe(503);
    expect(await response.json()).not.toHaveProperty("transcription");
    expect(realFetch).not.toHaveBeenCalled();
  });

  it.each([
    ["request rejection", () => Promise.reject(new Error("offline"))],
    [
      "non-2xx response",
      () => Promise.resolve(new Response("no", { status: 503 })),
    ],
    ["invalid JSON", () => Promise.resolve(new Response("not-json"))],
    [
      "invalid schema",
      () => Promise.resolve(Response.json({ feedback: { strengths: [] } })),
    ],
  ])(
    "uses deterministic schema-valid feedback after %s",
    async (_name, outcome) => {
      const mobileFetch = createMobilePromptFetch(
        vi.fn(outcome),
        "https://api.example.com/api/prompts",
      );

      const body = await (
        await mobileFetch("/api/feedback", feedbackInit)
      ).json();

      expect(body).toEqual({
        feedback: await validFeedback(),
        provider: "mock",
        fallback: true,
        notice:
          "Response coaching was unavailable, so reliable general feedback was used instead.",
      });
    },
  );

  it("uses deterministic feedback without a configured hosted endpoint", async () => {
    const realFetch = vi.fn();
    const mobileFetch = createMobilePromptFetch(realFetch, undefined);

    const body = await (
      await mobileFetch("/api/feedback", feedbackInit)
    ).json();

    expect(body.feedback).toEqual(await validFeedback());
    expect(body).toMatchObject({ provider: "mock", fallback: true });
    expect(realFetch).not.toHaveBeenCalled();
  });

  it.each([
    ["request rejection", () => Promise.reject(new Error("offline"))],
    [
      "non-2xx response",
      () => Promise.resolve(new Response("no", { status: 503 })),
    ],
    ["invalid JSON", () => Promise.resolve(new Response("not-json"))],
    ["invalid schema", () => Promise.resolve(Response.json({ prompts: [] }))],
  ])("uses deterministic general prompts after %s", async (_name, outcome) => {
    const mobileFetch = createMobilePromptFetch(
      vi.fn(outcome),
      "https://api.example.com/api/prompts",
    );
    const body = await (await mobileFetch("/api/prompts", init)).json();

    expect(body).toMatchObject({
      fallback: true,
      provider: "mock",
      notice: "Offline mode used reliable general prompts.",
    });
    expect(body.prompts).toHaveLength(4);
    expect(
      body.prompts.every(
        (prompt: { grounding: string }) => prompt.grounding === "generic",
      ),
    ).toBe(true);
  });

  it("preserves notes specificity and grounding in an offline fallback", async () => {
    const notesRequest: NetworkGenerationInput = {
      ...request,
      specificity: "notes",
      parentSummary: "The supplied summary describes a difficult decision.",
      parentNotes: "The reader wondered why the decision was delayed.",
      detailNotes: "The supplied detail mentions a locked gate.",
    };
    const mobileFetch = createMobilePromptFetch(
      vi.fn(async () => {
        throw new Error("offline");
      }),
      "https://api.example.com/api/prompts",
    );

    const body = await (
      await mobileFetch("/api/prompts", {
        method: "POST",
        body: JSON.stringify(notesRequest),
      })
    ).json();

    expect(body).toMatchObject({
      fallback: true,
      provider: "mock",
      notice:
        "Offline mode used your supplied summary and notes on this device.",
    });
    expect(
      body.prompts.map((prompt: { grounding: string }) => prompt.grounding),
    ).toEqual(["generic", "parent_summary", "parent_notes", "generic"]);
    expect(body.prompts[1].text).toContain("difficult decision");
    expect(body.prompts[2].text).toContain("decision was delayed");
    expect(body.prompts[2].text).toContain("locked gate");
  });

  it("aborts a hosted request at the configured timeout", async () => {
    const realFetch = vi.fn(
      (_input: RequestInfo | URL, hostedInit?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          hostedInit?.signal?.addEventListener("abort", () =>
            reject(new Error("aborted")),
          );
        }),
    );
    const mobileFetch = createMobilePromptFetch(
      realFetch,
      "https://api.example.com/api/prompts",
      5,
    );

    const body = await (await mobileFetch("/api/prompts", init)).json();
    expect(body.fallback).toBe(true);
    expect(realFetch.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });
});
