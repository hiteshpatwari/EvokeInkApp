import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createHandwritingTranscriptionPostHandler,
  handwritingTranscriptionApiConfigFromEnvironment,
  InMemoryHandwritingTranscriptionControlStore,
  type HandwritingTranscriptionApiConfig,
} from "./handwritingTranscriptionApiControls";

const token = "11111111-1111-4111-8111-111111111111";
function jpeg(width = 1, height = 1) {
  return new Uint8Array([
    0xff,
    0xd8,
    0xff,
    0xc0,
    0x00,
    0x0b,
    0x08,
    (height >> 8) & 0xff,
    height & 0xff,
    (width >> 8) & 0xff,
    width & 0xff,
    0x01,
    0x01,
    0x11,
    0x00,
    0xff,
    0xda,
    0x00,
    0x08,
    0x01,
    0x01,
    0x00,
    0x00,
    0x3f,
    0x00,
    0x00,
    0xff,
    0xd9,
  ]);
}

function config(
  overrides: Partial<HandwritingTranscriptionApiConfig> = {},
): HandwritingTranscriptionApiConfig {
  return {
    allowedOrigins: ["https://read.example"],
    maxBodyBytes: 1024,
    maxImageBytes: 512,
    installationLimit: 2,
    ipLimit: 4,
    monthlyBudgetMicros: 1_000_000,
    estimatedRequestCostMicros: 10_000,
    quotaHashSecret: "test-transcription-secret",
    providerName: "mock",
    ...overrides,
  };
}

function request(body: BodyInit, contentType?: string) {
  return new Request("https://read.example/api/transcriptions", {
    method: "POST",
    headers: {
      Origin: "https://read.example",
      "X-Installation-Token": token,
      ...(contentType ? { "Content-Type": contentType } : {}),
    },
    body,
  });
}

function multipart(bytes = jpeg(), type = "image/jpeg") {
  const boundary = "read-reflect-test-boundary";
  const encoder = new TextEncoder();
  const header = encoder.encode(
    `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="answer.jpg"\r\nContent-Type: ${type}\r\n\r\n`,
  );
  const footer = encoder.encode(`\r\n--${boundary}--\r\n`);
  const body = new Uint8Array(header.length + bytes.length + footer.length);
  body.set(header);
  body.set(bytes, header.length);
  body.set(footer, header.length + bytes.length);
  return request(body, `multipart/form-data; boundary=${boundary}`);
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("handwriting transcription API", () => {
  it("truthfully returns unavailable in mock mode after validating the image", async () => {
    const events = { record: vi.fn() };
    const handler = createHandwritingTranscriptionPostHandler({
      controls: new InMemoryHandwritingTranscriptionControlStore(),
      config: config(),
      events,
    });
    const response = await handler(multipart());
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: "transcription_unavailable",
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(JSON.stringify(events.record.mock.calls)).not.toMatch(
      /Student|answer\.jpg|ffd8/i,
    );
  });

  it.each([
    ["wrong MIME", multipart(jpeg(), "image/png")],
    ["wrong signature", multipart(new Uint8Array([1, 2, 3]))],
    [
      "truncated segment",
      multipart(new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08])),
    ],
    [
      "missing start of frame",
      multipart(
        new Uint8Array([
          0xff, 0xd8, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
          0x00, 0x00, 0xff, 0xd9,
        ]),
      ),
    ],
    ["excessive width", multipart(jpeg(8193, 1))],
    ["excessive dimensions", multipart(jpeg(8192, 4096))],
    ["wrong content type", request("not multipart", "text/plain")],
  ])("rejects %s", async (_label, invalidRequest) => {
    const handler = createHandwritingTranscriptionPostHandler({
      controls: new InMemoryHandwritingTranscriptionControlStore(),
      config: config(),
    });
    expect((await handler(invalidRequest)).status).toBe(400);
  });

  it("returns schema-valid provider output and uses an independent category", async () => {
    const controls = { reserve: vi.fn(async () => "allowed" as const) };
    const handler = createHandwritingTranscriptionPostHandler({
      controls,
      config: config({ providerName: "openai" }),
      generationOptions: {
        providerName: "openai",
        provider: {
          transcribe: async () => ({
            transcript: "The student response.",
            uncertainSegments: [],
          }),
        },
      },
    });
    const response = await handler(multipart());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      transcription: { transcript: "The student response." },
      provider: "openai",
      fallback: false,
    });
    expect(controls.reserve).toHaveBeenCalledWith(
      expect.objectContaining({ category: "handwriting_transcription_v1" }),
    );
  });

  it("rejects a malformed JPEG before quota reservation or provider work", async () => {
    const controls = { reserve: vi.fn(async () => "allowed" as const) };
    const transcribe = vi.fn(async () => ({
      transcript: "must not run",
      uncertainSegments: [],
    }));
    const handler = createHandwritingTranscriptionPostHandler({
      controls,
      config: config({ providerName: "openai" }),
      generationOptions: {
        providerName: "openai",
        provider: { transcribe },
      },
    });
    expect(
      (await handler(multipart(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]))))
        .status,
    ).toBe(400);
    expect(controls.reserve).not.toHaveBeenCalled();
    expect(transcribe).not.toHaveBeenCalled();
  });
});

describe("handwriting transcription environment gates", () => {
  it("defaults to truthful mock mode", () => {
    vi.stubEnv("HANDWRITING_TRANSCRIPTION_PROVIDER", "mock");
    expect(
      handwritingTranscriptionApiConfigFromEnvironment().providerName,
    ).toBe("mock");
  });

  it("fails closed without approval, stable quota secret, or native attestation", () => {
    vi.stubEnv("HANDWRITING_TRANSCRIPTION_PROVIDER", "openai");
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    expect(() => handwritingTranscriptionApiConfigFromEnvironment()).toThrow(
      /approval/i,
    );
    vi.stubEnv("HANDWRITING_TRANSCRIPTION_LIVE_APPROVED", "true");
    expect(() => handwritingTranscriptionApiConfigFromEnvironment()).toThrow(
      /quota secret/i,
    );
    vi.stubEnv("HANDWRITING_TRANSCRIPTION_QUOTA_HASH_SECRET", "stable-secret");
    vi.stubEnv("APP_ALLOWED_ORIGINS", "https://localhost");
    expect(() => handwritingTranscriptionApiConfigFromEnvironment()).toThrow(
      /attestation/i,
    );
  });
});
