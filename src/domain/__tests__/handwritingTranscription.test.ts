import { describe, expect, it } from "vitest";
import {
  handwritingTranscriptionResultSchema,
  handwritingTranscriptionSchema,
} from "../handwritingTranscription";

describe("handwriting transcription schemas", () => {
  it("accepts a bounded structured transcription", () => {
    expect(
      handwritingTranscriptionResultSchema.parse({
        transcription: {
          transcript: "The character helped because it was fair.",
          uncertainSegments: ["[unclear word]"],
        },
        provider: "openai",
        fallback: false,
      }),
    ).toBeTruthy();
  });

  it("rejects empty and oversized provider output", () => {
    expect(() =>
      handwritingTranscriptionSchema.parse({
        transcript: " ",
        uncertainSegments: [],
      }),
    ).toThrow();
    expect(() =>
      handwritingTranscriptionSchema.parse({
        transcript: "x".repeat(4001),
        uncertainSegments: [],
      }),
    ).toThrow();
  });
});
