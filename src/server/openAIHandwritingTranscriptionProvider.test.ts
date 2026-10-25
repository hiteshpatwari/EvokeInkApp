import { describe, expect, it, vi } from "vitest";
import {
  handwritingOpenAIRequestPolicy,
  OpenAIHandwritingTranscriptionProvider,
} from "./openAIHandwritingTranscriptionProvider";

describe("OpenAI handwriting transcription provider", () => {
  it("never retries a paid image request implicitly", () => {
    vi.stubEnv("OPENAI_MAX_RETRIES", "2");
    expect(handwritingOpenAIRequestPolicy()).toMatchObject({ maxRetries: 0 });
    vi.unstubAllEnvs();
  });

  it("disables storage and sends a JPEG image with structured output", async () => {
    const parse = vi.fn(async (_request: unknown) => ({
      output_parsed: { transcript: "Student text", uncertainSegments: [] },
    }));
    const provider = new OpenAIHandwritingTranscriptionProvider(
      "test-key",
      "test-model",
      { responses: { parse } } as never,
    );
    await expect(
      provider.transcribe(new Uint8Array([0xff, 0xd8, 0xff, 0xd9])),
    ).resolves.toMatchObject({ transcript: "Student text" });
    expect(parse).toHaveBeenCalledWith(
      expect.objectContaining({ store: false, model: "test-model" }),
    );
    expect(JSON.stringify(parse.mock.calls[0]?.[0])).toContain(
      "data:image/jpeg;base64,",
    );
  });
});
