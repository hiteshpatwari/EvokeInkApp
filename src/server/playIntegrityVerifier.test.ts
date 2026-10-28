import { describe, expect, it, vi } from "vitest";
import { GooglePlayIntegrityVerifier } from "./playIntegrityVerifier";

const now = new Date("2026-10-28T20:00:00Z");
const requestHash = "bound-image-hash";
const certificateDigest = "release-certificate-digest";

function base64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function privateKeyPem() {
  const pair = (await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  const pkcs8 = new Uint8Array(
    await crypto.subtle.exportKey("pkcs8", pair.privateKey),
  );
  return `-----BEGIN PRIVATE KEY-----\n${base64(pkcs8)}\n-----END PRIVATE KEY-----`;
}

function verdict(overrides: Record<string, unknown> = {}) {
  return {
    requestDetails: {
      requestPackageName: "app.evokeink.mobile",
      requestHash,
      timestampMillis: String(now.getTime() - 30_000),
    },
    appIntegrity: {
      appRecognitionVerdict: "PLAY_RECOGNIZED",
      packageName: "app.evokeink.mobile",
      certificateSha256Digest: [certificateDigest],
    },
    accountDetails: { appLicensingVerdict: "LICENSED" },
    deviceIntegrity: {
      deviceRecognitionVerdict: ["MEETS_DEVICE_INTEGRITY"],
    },
    ...overrides,
  };
}

async function verifierFor(verdictPayload: unknown) {
  const fetchImplementation = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      Response.json({
        access_token: "oauth-token",
        expires_in: 3600,
        token_type: "Bearer",
      }),
    )
    .mockResolvedValueOnce(
      Response.json({ tokenPayloadExternal: verdictPayload }),
    );
  const verifier = new GooglePlayIntegrityVerifier(
    {
      packageName: "app.evokeink.mobile",
      expectedCertificateDigests: [certificateDigest],
      serviceAccountEmail: "integrity@example.iam.gserviceaccount.com",
      serviceAccountPrivateKey: await privateKeyPem(),
      maxTokenAgeMs: 120_000,
    },
    fetchImplementation,
  );
  return { verifier, fetchImplementation };
}

describe("Google Play Integrity verifier", () => {
  it("accepts a fresh request-bound recognized licensed genuine app verdict", async () => {
    const { verifier, fetchImplementation } = await verifierFor(verdict());
    await expect(
      verifier.verify({ integrityToken: "encrypted-token", requestHash, now }),
    ).resolves.toBeUndefined();
    expect(fetchImplementation).toHaveBeenLastCalledWith(
      "https://playintegrity.googleapis.com/v1/app.evokeink.mobile:decodeIntegrityToken",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer oauth-token",
        }),
        body: JSON.stringify({ integrity_token: "encrypted-token" }),
      }),
    );
  });

  it.each([
    [
      "wrong request hash",
      verdict({
        requestDetails: { ...verdict().requestDetails, requestHash: "other" },
      }),
    ],
    [
      "stale token",
      verdict({
        requestDetails: {
          ...verdict().requestDetails,
          timestampMillis: String(now.getTime() - 121_000),
        },
      }),
    ],
    [
      "unrecognized app",
      verdict({
        appIntegrity: {
          ...verdict().appIntegrity,
          appRecognitionVerdict: "UNRECOGNIZED_VERSION",
        },
      }),
    ],
    [
      "wrong certificate",
      verdict({
        appIntegrity: {
          ...verdict().appIntegrity,
          certificateSha256Digest: ["other"],
        },
      }),
    ],
    [
      "unlicensed install",
      verdict({ accountDetails: { appLicensingVerdict: "UNLICENSED" } }),
    ],
    [
      "compromised device",
      verdict({ deviceIntegrity: { deviceRecognitionVerdict: [] } }),
    ],
  ])("rejects %s", async (_label, payload) => {
    const { verifier } = await verifierFor(payload);
    await expect(
      verifier.verify({ integrityToken: "encrypted-token", requestHash, now }),
    ).rejects.toThrow(/not trusted/i);
  });
});
