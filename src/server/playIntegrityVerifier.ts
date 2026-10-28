import { z } from "zod";

const PLAY_INTEGRITY_SCOPE = "https://www.googleapis.com/auth/playintegrity";
const OAUTH_AUDIENCE = "https://oauth2.googleapis.com/token";
const MAX_TOKEN_LENGTH = 16_384;
const GOOGLE_REQUEST_TIMEOUT_MS = 10_000;

const verdictSchema = z.object({
  requestDetails: z.object({
    requestPackageName: z.string(),
    requestHash: z.string(),
    timestampMillis: z.string().regex(/^\d+$/),
  }),
  appIntegrity: z.object({
    appRecognitionVerdict: z.string(),
    packageName: z.string(),
    certificateSha256Digest: z.array(z.string()),
  }),
  accountDetails: z.object({ appLicensingVerdict: z.string() }),
  deviceIntegrity: z.object({
    deviceRecognitionVerdict: z.array(z.string()),
  }),
});

const decodeResponseSchema = z.object({ tokenPayloadExternal: verdictSchema });
const oauthResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().positive(),
  token_type: z.literal("Bearer"),
});

export interface PlayIntegrityVerifier {
  verify(input: {
    integrityToken: string;
    requestHash: string;
    now: Date;
  }): Promise<void>;
}

export interface GooglePlayIntegrityConfig {
  packageName: string;
  expectedCertificateDigests: string[];
  serviceAccountEmail: string;
  serviceAccountPrivateKey: string;
  maxTokenAgeMs: number;
}

type FetchImplementation = typeof fetch;

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function encodeJson(value: unknown): string {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function privateKeyBytes(pem: string): Uint8Array<ArrayBuffer> {
  const normalized = pem.replace(/\\n/g, "\n").trim();
  const match = normalized.match(
    /^-----BEGIN PRIVATE KEY-----\s+([A-Za-z0-9+/=\s]+)\s+-----END PRIVATE KEY-----$/,
  );
  if (!match?.[1]) throw new Error("Invalid Play Integrity private key.");
  const binary = atob(match[1].replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function serviceAccountAssertion(
  config: GooglePlayIntegrityConfig,
  now: Date,
): Promise<string> {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const header = encodeJson({ alg: "RS256", typ: "JWT" });
  const claims = encodeJson({
    iss: config.serviceAccountEmail,
    scope: PLAY_INTEGRITY_SCOPE,
    aud: OAUTH_AUDIENCE,
    iat: issuedAt,
    exp: issuedAt + 3600,
  });
  const unsigned = `${header}.${claims}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    privateKeyBytes(config.serviceAccountPrivateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );
  return `${unsigned}.${base64Url(new Uint8Array(signature))}`;
}

export class GooglePlayIntegrityVerifier implements PlayIntegrityVerifier {
  private accessToken?: { value: string; expiresAt: number };

  constructor(
    private readonly config: GooglePlayIntegrityConfig,
    private readonly fetchImplementation: FetchImplementation = fetch,
  ) {}

  async verify(input: {
    integrityToken: string;
    requestHash: string;
    now: Date;
  }): Promise<void> {
    if (
      input.integrityToken.length === 0 ||
      input.integrityToken.length > MAX_TOKEN_LENGTH
    ) {
      throw new Error("Invalid Play Integrity token.");
    }
    const accessToken = await this.getAccessToken(input.now);
    const response = await this.fetchWithTimeout(
      `https://playintegrity.googleapis.com/v1/${encodeURIComponent(this.config.packageName)}:decodeIntegrityToken`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ integrity_token: input.integrityToken }),
      },
    );
    if (!response.ok) throw new Error("Play Integrity verification failed.");
    const { tokenPayloadExternal: verdict } = decodeResponseSchema.parse(
      await response.json(),
    );
    const requestedAt = Number(verdict.requestDetails.timestampMillis);
    const age = input.now.getTime() - requestedAt;
    const expectedCertificate =
      verdict.appIntegrity.certificateSha256Digest.some((digest) =>
        this.config.expectedCertificateDigests.includes(digest),
      );
    if (
      verdict.requestDetails.requestPackageName !== this.config.packageName ||
      verdict.requestDetails.requestHash !== input.requestHash ||
      age < 0 ||
      age > this.config.maxTokenAgeMs ||
      verdict.appIntegrity.appRecognitionVerdict !== "PLAY_RECOGNIZED" ||
      verdict.appIntegrity.packageName !== this.config.packageName ||
      !expectedCertificate ||
      verdict.accountDetails.appLicensingVerdict !== "LICENSED" ||
      !verdict.deviceIntegrity.deviceRecognitionVerdict.includes(
        "MEETS_DEVICE_INTEGRITY",
      )
    ) {
      throw new Error("Play Integrity verdict was not trusted.");
    }
  }

  private async getAccessToken(now: Date): Promise<string> {
    if (
      this.accessToken &&
      this.accessToken.expiresAt - 60_000 > now.getTime()
    ) {
      return this.accessToken.value;
    }
    const assertion = await serviceAccountAssertion(this.config, now);
    const response = await this.fetchWithTimeout(OAUTH_AUDIENCE, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    });
    if (!response.ok) throw new Error("Play Integrity authorization failed.");
    const token = oauthResponseSchema.parse(await response.json());
    this.accessToken = {
      value: token.access_token,
      expiresAt: now.getTime() + token.expires_in * 1000,
    };
    return token.access_token;
  }

  private async fetchWithTimeout(
    input: RequestInfo | URL,
    init: RequestInit,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      GOOGLE_REQUEST_TIMEOUT_MS,
    );
    try {
      return await this.fetchImplementation(input, {
        ...init,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }
}

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for Play Integrity.`);
  return value;
}

export function playIntegrityVerifierFromEnvironment(): PlayIntegrityVerifier {
  const expectedCertificateDigests = requiredEnvironment(
    "PLAY_INTEGRITY_CERTIFICATE_SHA256_DIGESTS",
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (expectedCertificateDigests.length === 0) {
    throw new Error(
      "At least one Play Integrity certificate digest is required.",
    );
  }
  if (
    expectedCertificateDigests.some(
      (digest) => !/^[A-Za-z0-9_-]{43}$/.test(digest),
    )
  ) {
    throw new Error(
      "Play Integrity certificate digests must be SHA-256 base64url values.",
    );
  }
  return new GooglePlayIntegrityVerifier({
    packageName:
      process.env["PLAY_INTEGRITY_PACKAGE_NAME"]?.trim() ||
      "app.evokeink.mobile",
    expectedCertificateDigests,
    serviceAccountEmail: requiredEnvironment(
      "PLAY_INTEGRITY_SERVICE_ACCOUNT_EMAIL",
    ),
    serviceAccountPrivateKey: requiredEnvironment(
      "PLAY_INTEGRITY_SERVICE_ACCOUNT_PRIVATE_KEY",
    ),
    maxTokenAgeMs: 2 * 60 * 1000,
  });
}
