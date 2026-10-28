import { describe, expect, it, vi } from "vitest";
import { handwritingAttestationRequestHash } from "../../src/domain/playIntegrityBinding";
import { createPlayIntegrityAttestation } from "./playIntegrityAttestation";

const installationToken = "00000000-0000-4000-8000-000000000000";

describe("Play Integrity attestation", () => {
  it("creates an unpadded base64url SHA-256 request hash", async () => {
    expect(
      await handwritingAttestationRequestHash(
        new Uint8Array([1, 2, 3]),
        installationToken,
      ),
    ).toBe("K5Zz_yZt3T_9Ut7GFXY_hAHTRNXzQMMJfsFFUnMEgPU");
  });

  it("binds the requested token to the exact image bytes", async () => {
    const plugin = {
      requestToken: vi.fn(async () => ({ token: "integrity-token" })),
      prepare: vi.fn(async () => undefined),
    };
    const attestation = createPlayIntegrityAttestation(plugin);

    await expect(
      attestation.tokenForImage(new Uint8Array([1, 2, 3]), installationToken),
    ).resolves.toBe("integrity-token");
    expect(plugin.requestToken).toHaveBeenCalledWith({
      requestHash: "K5Zz_yZt3T_9Ut7GFXY_hAHTRNXzQMMJfsFFUnMEgPU",
    });
  });
});
