import { describe, expect, it, vi } from "vitest";
import { runSyntheticProbe } from "./syntheticProbe";

function json(body: unknown, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("synthetic production probe", () => {
  it("passes only the web, no-store health, and expected prompt provider contract", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("ok", { status: 200 }))
      .mockResolvedValueOnce(
        json({ status: "ok" }, 200, { "cache-control": "no-store" }),
      )
      .mockResolvedValueOnce(
        json(
          {
            prompts: Array.from({ length: 4 }, (_, index) => ({
              text: "Explain one idea using evidence from the reading.",
              skill: "inference",
              explanation: "Practices evidence-based inference.",
              required: index < 3,
              suggestedResponseLength: "2-3 sentences",
              grounding: "generic",
              difficultyLevel: "grade_level",
            })),
            provider: "mock",
            fallback: false,
          },
          200,
          { "cache-control": "no-store" },
        ),
      );

    await expect(
      runSyntheticProbe(
        "https://read.example",
        "https://read.example",
        fetcher,
      ),
    ).resolves.toEqual({
      ok: true,
      web: true,
      health: true,
      prompt: true,
      errors: [],
    });
    expect(JSON.stringify(fetcher.mock.calls)).not.toMatch(
      /Aavya|Prince Caspian|parent notes/i,
    );
  });

  it("can require a live OpenAI response without accepting fallback output", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("ok", { status: 200 }))
      .mockResolvedValueOnce(
        json({ status: "ok" }, 200, { "cache-control": "no-store" }),
      )
      .mockResolvedValueOnce(
        json(
          {
            prompts: Array.from({ length: 4 }, (_, index) => ({
              text: "Explain one idea using evidence from the reading.",
              skill: "inference",
              explanation: "Practices evidence-based inference.",
              required: index < 3,
              suggestedResponseLength: "2-3 sentences",
              grounding: "generic",
              difficultyLevel: "grade_level",
            })),
            provider: "openai",
            fallback: false,
          },
          200,
          { "cache-control": "no-store" },
        ),
      );

    await expect(
      runSyntheticProbe(
        "https://read.example",
        "https://read.example",
        fetcher,
        "openai",
      ),
    ).resolves.toMatchObject({ ok: true, prompt: true, errors: [] });
  });

  it("returns bounded machine-readable failures without response content", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("private web body", { status: 503 }))
      .mockRejectedValueOnce(new Error("secret provider response"))
      .mockResolvedValueOnce(json({ private: "notes" }, 500));

    const result = await runSyntheticProbe(
      "https://read.example",
      "https://read.example",
      fetcher,
    );
    expect(result).toEqual({
      ok: false,
      web: false,
      health: false,
      prompt: false,
      errors: [
        "web_status_503",
        "health_request_failed",
        "prompt_contract_failed",
      ],
    });
    expect(JSON.stringify(result)).not.toMatch(/private|secret|notes/);
  });
});
