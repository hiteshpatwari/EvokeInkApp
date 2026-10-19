import type { GenerationInput, PromptBatch } from "./schemas";

export interface PromptGenerator {
  generate(input: GenerationInput): Promise<PromptBatch>;
}
