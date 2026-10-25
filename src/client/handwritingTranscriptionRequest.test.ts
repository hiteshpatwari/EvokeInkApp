import { afterEach, describe, expect, it, vi } from "vitest";
import { requestHandwritingTranscription } from "./handwritingTranscriptionRequest";

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("handwriting transcription request", () => {
  it("sends one prepared image as multipart and validates the result", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({
        transcription: {
          transcript: "A checked response.",
          uncertainSegments: ["checked"],
        },
        provider: "openai",
        fallback: false,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const image = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], {
      type: "image/jpeg",
    });

    await expect(requestHandwritingTranscription(image)).resolves.toEqual({
      transcript: "A checked response.",
      uncertainSegments: ["checked"],
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/transcriptions");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toHaveProperty("X-Installation-Token");
    expect(init?.headers).not.toHaveProperty("Content-Type");
    expect(init?.body).toBeInstanceOf(FormData);
    expect((init!.body as FormData).get("image")).toBeInstanceOf(Blob);
  });

  it.each([
    Response.json(
      { transcription: { transcript: "", uncertainSegments: [] } },
      { status: 200 },
    ),
    Response.json(
      {
        transcription: { transcript: "Invented", uncertainSegments: [] },
        provider: "mock",
        fallback: true,
      },
      { status: 200 },
    ),
    Response.json({ message: "Unavailable" }, { status: 503 }),
  ])("rejects unavailable or untrusted output", async (response) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response.clone()),
    );
    const image = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], {
      type: "image/jpeg",
    });
    await expect(requestHandwritingTranscription(image)).rejects.toThrow();
  });
});
