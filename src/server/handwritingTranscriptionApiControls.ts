import { NextResponse } from "next/server";
import { isIP } from "node:net";
import { z } from "zod";
import {
  generateHandwritingTranscription,
  type HandwritingTranscriptionOptions,
} from "./generateHandwritingTranscription";

const installationTokenSchema = z.uuid();
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;
const CORS_HEADERS = "Content-Type, X-Installation-Token";
type Reservation =
  | "allowed"
  | "installation_quota"
  | "ip_quota"
  | "budget_open";

export interface HandwritingTranscriptionApiConfig {
  allowedOrigins: string[];
  maxBodyBytes: number;
  maxImageBytes: number;
  installationLimit: number;
  ipLimit: number;
  monthlyBudgetMicros: number;
  estimatedRequestCostMicros: number;
  quotaHashSecret: string;
  providerName: "mock" | "openai";
}

export interface HandwritingTranscriptionControlStore {
  reserve(request: {
    category: "handwriting_transcription_v1";
    installationKey: string;
    ipKey: string;
    now: Date;
    installationLimit: number;
    ipLimit: number;
    budgetMicros: number;
    estimatedCostMicros: number;
    useProviderBudget: boolean;
  }): Reservation | Promise<Reservation>;
}

export interface HandwritingTranscriptionEventSink {
  record(event: {
    requestId: string;
    route: "/api/transcriptions";
    status: number;
    provider?: "mock" | "openai";
    errorCategory: string;
    durationMs: number;
  }): void | Promise<void>;
}

interface Dependencies {
  controls: HandwritingTranscriptionControlStore;
  config: HandwritingTranscriptionApiConfig;
  generationOptions?: HandwritingTranscriptionOptions;
  events?: HandwritingTranscriptionEventSink;
  now?: () => Date;
}

interface Counter {
  count: number;
  startedAt: number;
}

export class InMemoryHandwritingTranscriptionControlStore implements HandwritingTranscriptionControlStore {
  private readonly installations = new Map<string, Counter>();
  private readonly ips = new Map<string, Counter>();
  private budget: Counter = { count: 0, startedAt: 0 };

  reserve(
    input: Parameters<HandwritingTranscriptionControlStore["reserve"]>[0],
  ) {
    const now = input.now.getTime();
    const installation = this.current(
      this.installations,
      input.installationKey,
      now,
    );
    const ip = this.current(this.ips, input.ipKey, now);
    if (installation.count >= input.installationLimit)
      return "installation_quota" as const;
    if (ip.count >= input.ipLimit) return "ip_quota" as const;
    if (now - this.budget.startedAt >= MONTH_MS)
      this.budget = { count: 0, startedAt: now };
    if (
      input.useProviderBudget &&
      this.budget.count + input.estimatedCostMicros > input.budgetMicros
    )
      return "budget_open" as const;
    installation.count += 1;
    ip.count += 1;
    if (input.useProviderBudget) this.budget.count += input.estimatedCostMicros;
    return "allowed" as const;
  }

  private current(map: Map<string, Counter>, key: string, now: number) {
    const value = map.get(key);
    if (value && now - value.startedAt < MONTH_MS) return value;
    const next = { count: 0, startedAt: now };
    map.set(key, next);
    return next;
  }
}

class BodyTooLargeError extends Error {}
class InvalidMultipartError extends Error {}

const JPEG_MAX_DIMENSION = 8192;
const JPEG_MAX_PIXELS = 32_000_000;
const START_OF_FRAME_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

function validateJpegStructure(bytes: Uint8Array) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new InvalidMultipartError();
  }
  let offset = 2;
  let sawFrame = false;
  let sawScan = false;
  let inScan = false;

  while (offset < bytes.length) {
    if (inScan) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const next = bytes[offset + 1];
      if (next === undefined) throw new InvalidMultipartError();
      if (next === 0x00 || (next >= 0xd0 && next <= 0xd7)) {
        offset += 2;
        continue;
      }
      if (next === 0xff) {
        offset += 1;
        continue;
      }
      inScan = false;
    }

    if (bytes[offset] !== 0xff) throw new InvalidMultipartError();
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset];
    if (marker === undefined || marker === 0x00) {
      throw new InvalidMultipartError();
    }
    offset += 1;

    if (marker === 0xd9) {
      if (!sawFrame || !sawScan || offset !== bytes.length) {
        throw new InvalidMultipartError();
      }
      return;
    }
    if (
      marker === 0xd8 ||
      marker === 0x01 ||
      (marker >= 0xd0 && marker <= 0xd7)
    ) {
      throw new InvalidMultipartError();
    }
    if (offset + 2 > bytes.length) throw new InvalidMultipartError();
    const segmentLength = (bytes[offset]! << 8) | bytes[offset + 1]!;
    if (segmentLength < 2 || offset + segmentLength > bytes.length) {
      throw new InvalidMultipartError();
    }

    if (START_OF_FRAME_MARKERS.has(marker)) {
      if (segmentLength < 8) throw new InvalidMultipartError();
      const componentCount = bytes[offset + 7]!;
      if (componentCount <= 0 || segmentLength !== 8 + componentCount * 3) {
        throw new InvalidMultipartError();
      }
      const height = (bytes[offset + 3]! << 8) | bytes[offset + 4]!;
      const width = (bytes[offset + 5]! << 8) | bytes[offset + 6]!;
      if (
        width <= 0 ||
        height <= 0 ||
        width > JPEG_MAX_DIMENSION ||
        height > JPEG_MAX_DIMENSION ||
        width * height > JPEG_MAX_PIXELS
      ) {
        throw new InvalidMultipartError();
      }
      sawFrame = true;
    }

    if (marker === 0xda) {
      const componentCount = bytes[offset + 2]!;
      if (
        !sawFrame ||
        componentCount <= 0 ||
        segmentLength !== 6 + componentCount * 2
      ) {
        throw new InvalidMultipartError();
      }
      sawScan = true;
      inScan = true;
    }
    offset += segmentLength;
  }
  throw new InvalidMultipartError();
}

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json({ ...(code ? { code } : {}), message }, { status });
}

function withHeaders(
  response: Response,
  origin: string | null,
  allowed: string[],
) {
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Vary", "Origin");
  if (origin && allowed.includes(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
  }
  return response;
}

async function readBoundedBytes(request: Request, maxBytes: number) {
  const declared = request.headers.get("content-length");
  if (declared && /^\d+$/.test(declared) && Number(declared) > maxBytes) {
    throw new BodyTooLargeError();
  }
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new BodyTooLargeError();
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function imageFromRequest(
  request: Request,
  maxBodyBytes: number,
  maxImageBytes: number,
) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^multipart\/form-data\s*;/i.test(contentType))
    throw new InvalidMultipartError();
  const boundaryMatch = contentType.match(
    /boundary=(?:"([A-Za-z0-9'()+_,\-./:=? ]{1,70})"|([A-Za-z0-9'()+_,\-./:=?]{1,70}))/i,
  );
  const boundary = boundaryMatch?.[1] ?? boundaryMatch?.[2];
  if (!boundary) throw new InvalidMultipartError();
  const bytes = await readBoundedBytes(request, maxBodyBytes);
  const encoder = new TextEncoder();
  const prefix = encoder.encode(`--${boundary}\r\n`);
  const headerEnd = encoder.encode("\r\n\r\n");
  const suffix = encoder.encode(`\r\n--${boundary}--`);
  const startsWith = (candidate: Uint8Array, expected: Uint8Array) =>
    expected.every((value, index) => candidate[index] === value);
  const indexOf = (
    candidate: Uint8Array,
    expected: Uint8Array,
    from: number,
  ) => {
    for (
      let index = from;
      index <= candidate.length - expected.length;
      index += 1
    ) {
      if (
        expected.every((value, offset) => candidate[index + offset] === value)
      )
        return index;
    }
    return -1;
  };
  if (!startsWith(bytes, prefix)) throw new InvalidMultipartError();
  const headersEndAt = indexOf(bytes, headerEnd, prefix.length);
  if (headersEndAt < 0) throw new InvalidMultipartError();
  const headers = new TextDecoder("utf-8", { fatal: true }).decode(
    bytes.slice(prefix.length, headersEndAt),
  );
  if (
    !/^content-disposition:\s*form-data;\s*name="image";\s*filename="[^"\r\n]{1,255}"\r\ncontent-type:\s*image\/jpeg$/i.test(
      headers,
    )
  ) {
    throw new InvalidMultipartError();
  }
  const imageStart = headersEndAt + headerEnd.length;
  const imageEnd = indexOf(bytes, suffix, imageStart);
  if (imageEnd < 0 || imageEnd + suffix.length > bytes.length)
    throw new InvalidMultipartError();
  const trailing = bytes.slice(imageEnd + suffix.length);
  if (
    !(
      trailing.length === 0 ||
      (trailing.length === 2 && trailing[0] === 0x0d && trailing[1] === 0x0a)
    )
  )
    throw new InvalidMultipartError();
  const imageBytes = bytes.slice(imageStart, imageEnd);
  if (imageBytes.length === 0 || imageBytes.length > maxImageBytes)
    throw new InvalidMultipartError();
  validateJpegStructure(imageBytes);
  return imageBytes;
}

function requestIp(request: Request) {
  const value = request.headers.get("cf-connecting-ip")?.trim();
  return value && isIP(value) ? value : "unknown";
}

async function quotaKey(value: string, secret: string) {
  const encoded = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoded.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, encoded.encode(value));
  return Array.from(new Uint8Array(signed), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function createHandwritingTranscriptionOptionsHandler(
  config: HandwritingTranscriptionApiConfig,
) {
  return (request: Request) => {
    const origin = request.headers.get("origin");
    const requestedHeaders = (
      request.headers.get("access-control-request-headers") ?? ""
    )
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
    const allowed =
      origin !== null &&
      config.allowedOrigins.includes(origin) &&
      request.headers.get("access-control-request-method")?.toUpperCase() ===
        "POST" &&
      requestedHeaders.every((header) =>
        ["content-type", "x-installation-token"].includes(header),
      );
    if (!allowed)
      return withHeaders(
        jsonError("This cross-origin request is not allowed.", 403),
        origin,
        [],
      );
    return withHeaders(
      new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": CORS_HEADERS,
        },
      }),
      origin,
      config.allowedOrigins,
    );
  };
}

export function createHandwritingTranscriptionPostHandler(
  dependencies: Dependencies,
) {
  return async (request: Request) => {
    const started = performance.now();
    const requestId = crypto.randomUUID();
    const origin = request.headers.get("origin");
    const finish = (response: Response) =>
      withHeaders(response, origin, dependencies.config.allowedOrigins);
    const record = (
      status: number,
      errorCategory: string,
      provider?: "mock" | "openai",
    ) => {
      const pending = dependencies.events?.record({
        requestId,
        route: "/api/transcriptions",
        status,
        ...(provider ? { provider } : {}),
        errorCategory,
        durationMs: Math.max(0, Math.round(performance.now() - started)),
      });
      if (pending) void Promise.resolve(pending).catch(() => undefined);
    };
    if (!origin || !dependencies.config.allowedOrigins.includes(origin)) {
      record(403, "origin");
      return finish(jsonError("This request origin is not allowed.", 403));
    }
    const token = request.headers.get("x-installation-token");
    if (!installationTokenSchema.safeParse(token).success) {
      record(400, "identity");
      return finish(
        jsonError("A valid installation identity is required.", 400),
      );
    }
    try {
      const image = await imageFromRequest(
        request,
        dependencies.config.maxBodyBytes,
        dependencies.config.maxImageBytes,
      );
      if (dependencies.config.providerName === "mock") {
        record(503, "provider_unavailable", "mock");
        return finish(
          jsonError(
            "Automatic handwriting reading is not available yet. Type the response instead.",
            503,
            "transcription_unavailable",
          ),
        );
      }
      const [installationKey, ipKey] = await Promise.all([
        quotaKey(
          `transcription:${token!}`,
          dependencies.config.quotaHashSecret,
        ),
        quotaKey(
          `transcription:${requestIp(request)}`,
          dependencies.config.quotaHashSecret,
        ),
      ]);
      const reservation = await dependencies.controls.reserve({
        category: "handwriting_transcription_v1",
        installationKey,
        ipKey,
        now: (dependencies.now ?? (() => new Date()))(),
        installationLimit: dependencies.config.installationLimit,
        ipLimit: dependencies.config.ipLimit,
        budgetMicros: dependencies.config.monthlyBudgetMicros,
        estimatedCostMicros: dependencies.config.estimatedRequestCostMicros,
        useProviderBudget: true,
      });
      if (reservation !== "allowed") {
        const status = reservation === "budget_open" ? 503 : 429;
        record(status, reservation, "openai");
        return finish(
          jsonError(
            reservation === "budget_open"
              ? "Automatic handwriting reading is temporarily unavailable. Type the response instead."
              : "The handwriting-reading allowance has been reached.",
            status,
            "transcription_unavailable",
          ),
        );
      }
      const apiKey = process.env["OPENAI_API_KEY"];
      const result = await generateHandwritingTranscription(image, {
        providerName: "openai",
        ...(apiKey ? { apiKey } : {}),
        ...dependencies.generationOptions,
      });
      record(200, "none", "openai");
      return finish(NextResponse.json(result));
    } catch (error) {
      if (error instanceof BodyTooLargeError) {
        record(413, "body_size");
        return finish(jsonError("The photo request is too large.", 413));
      }
      if (error instanceof InvalidMultipartError) {
        record(400, "invalid_image");
        return finish(jsonError("Choose one valid prepared JPEG photo.", 400));
      }
      record(503, "provider_failure", dependencies.config.providerName);
      return finish(
        jsonError(
          "Automatic handwriting reading is temporarily unavailable. Type the response instead.",
          503,
          "transcription_unavailable",
        ),
      );
    }
  };
}

function positiveInteger(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new Error(`${name} must be a positive safe integer.`);
  return value;
}

function usdMicros(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback);
  const micros = value * 1_000_000;
  if (!Number.isFinite(value) || value <= 0 || !Number.isSafeInteger(micros))
    throw new Error(`${name} must be a positive USD amount.`);
  return micros;
}

function isNativeOrigin(origin: string) {
  return (
    origin === "https://localhost" ||
    origin.startsWith("capacitor://") ||
    origin.startsWith("ionic://")
  );
}

export function handwritingTranscriptionApiConfigFromEnvironment(): HandwritingTranscriptionApiConfig {
  const providerName = (
    process.env["HANDWRITING_TRANSCRIPTION_PROVIDER"] ?? "mock"
  ).toLowerCase();
  if (providerName !== "mock" && providerName !== "openai")
    throw new Error(
      "HANDWRITING_TRANSCRIPTION_PROVIDER must be mock or openai.",
    );
  const allowedOrigins = (
    process.env["APP_ALLOWED_ORIGINS"] ?? "http://localhost:3000"
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const quotaHashSecret =
    process.env["HANDWRITING_TRANSCRIPTION_QUOTA_HASH_SECRET"]?.trim() ?? "";
  if (providerName === "openai") {
    if (process.env["HANDWRITING_TRANSCRIPTION_LIVE_APPROVED"] !== "true")
      throw new Error(
        "Live handwriting transcription requires explicit approval.",
      );
    if (!process.env["OPENAI_API_KEY"]?.trim())
      throw new Error(
        "OPENAI_API_KEY is required for live handwriting transcription.",
      );
    if (!quotaHashSecret)
      throw new Error(
        "A stable handwriting transcription quota secret is required.",
      );
    if (allowedOrigins.some(isNativeOrigin))
      throw new Error(
        "Native handwriting transcription requires verified device attestation.",
      );
  }
  return {
    allowedOrigins,
    maxBodyBytes: positiveInteger(
      "HANDWRITING_TRANSCRIPTION_MAX_REQUEST_BYTES",
      MAX_IMAGE_BYTES + 64 * 1024,
    ),
    maxImageBytes: MAX_IMAGE_BYTES,
    installationLimit: positiveInteger(
      "HANDWRITING_TRANSCRIPTION_INSTALLATION_MONTHLY_LIMIT",
      20,
    ),
    ipLimit: positiveInteger("HANDWRITING_TRANSCRIPTION_IP_MONTHLY_LIMIT", 200),
    monthlyBudgetMicros: usdMicros(
      "HANDWRITING_TRANSCRIPTION_MONTHLY_BUDGET_USD",
      50,
    ),
    estimatedRequestCostMicros: usdMicros(
      "HANDWRITING_TRANSCRIPTION_ESTIMATED_REQUEST_COST_USD",
      0.03,
    ),
    quotaHashSecret: quotaHashSecret || "mock-only-transcription-no-budget",
    providerName,
  };
}

export class ConsoleHandwritingTranscriptionEventSink implements HandwritingTranscriptionEventSink {
  record(event: Parameters<HandwritingTranscriptionEventSink["record"]>[0]) {
    console.info(
      JSON.stringify({ event: "handwriting_transcription_api", ...event }),
    );
  }
}
