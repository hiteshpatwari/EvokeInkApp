import { describe, expect, it } from "vitest";
import { generateHandwritingTranscription } from "./generateHandwritingTranscription";

describe("handwriting transcription orchestration", () => {
  it("never fabricates a mock transcription", async () => {
    await expect(
      generateHandwritingTranscription(new Uint8Array([1]), {
        providerName: "mock",
      }),
    ).rejects.toThrow(/unavailable/i);
  });

  it("validates injected provider output", async () => {
    await expect(
      generateHandwritingTranscription(new Uint8Array([1]), {
        providerName: "openai",
        provider: {
          transcribe: async () => ({
            transcript: "Visible answer",
            uncertainSegments: [],
          }),
        },
      }),
    ).resolves.toMatchObject({ provider: "openai", fallback: false });
  });
});
