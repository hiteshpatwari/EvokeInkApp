import { registerPlugin } from "@capacitor/core";
import { handwritingAttestationRequestHash } from "../../src/domain/playIntegrityBinding";

interface PlayIntegrityPlugin {
  prepare(): Promise<void>;
  requestToken(input: { requestHash: string }): Promise<{ token: string }>;
}

export interface NativeImageAttestation {
  tokenForImage(image: Uint8Array, installationToken: string): Promise<string>;
}

const nativePlayIntegrity =
  registerPlugin<PlayIntegrityPlugin>("PlayIntegrity");

export function createPlayIntegrityAttestation(
  plugin: PlayIntegrityPlugin = nativePlayIntegrity,
): NativeImageAttestation & { prepare(): Promise<void> } {
  return {
    prepare: () => plugin.prepare(),
    async tokenForImage(image, installationToken) {
      const requestHash = await handwritingAttestationRequestHash(
        image,
        installationToken,
      );
      const result = await plugin.requestToken({ requestHash });
      if (!result.token || result.token.length > 16_384) {
        throw new Error("Play Integrity did not return a valid token");
      }
      return result.token;
    },
  };
}

export const playIntegrityAttestation = createPlayIntegrityAttestation();
