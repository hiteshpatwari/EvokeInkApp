import {
  networkGenerationInputSchema,
  type GenerationInput,
  type NetworkGenerationInput,
} from "@/domain/schemas";

const INSTALLATION_TOKEN_KEY = "read-reflect-installation-token-v1";
const INSTALLATION_TOKEN_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function toNetworkGenerationInput(
  input: GenerationInput,
): NetworkGenerationInput {
  const { name: _localName, ...child } = input.child;
  return networkGenerationInputSchema.parse({ ...input, child });
}

export function getInstallationToken(storage: Storage = localStorage): string {
  const existing = storage.getItem(INSTALLATION_TOKEN_KEY);
  if (existing && INSTALLATION_TOKEN_PATTERN.test(existing)) return existing;
  const token = crypto.randomUUID();
  storage.setItem(INSTALLATION_TOKEN_KEY, token);
  return token;
}
