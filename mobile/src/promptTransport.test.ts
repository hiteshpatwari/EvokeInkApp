import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockPromptGenerator } from "../../src/domain/mockPromptGenerator";
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

async function validBatch() {
  return new MockPromptGenerator().generate({
    ...request,
    child: { ...request.child, name: "Reader" },
  });
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
