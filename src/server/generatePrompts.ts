import type { PromptGenerator } from "@/domain/promptGenerator";
import { MockPromptGenerator } from "@/domain/mockPromptGenerator";
import {
  generationInputSchema,
  promptBatchSchema,
  type GenerationInput,
  type PromptBatch,
} from "@/domain/schemas";
import { OpenAIPromptGenerator } from "./openAIPromptGenerator";

export interface GenerationResult extends PromptBatch {
  provider: "mock" | "openai";
  fallback: boolean;
  notice?: string;
}

export function validateGroundingForInput(
  input: GenerationInput,
  batch: PromptBatch,
): PromptBatch {
  for (const prompt of batch.prompts) {
    if (input.specificity === "general" && prompt.grounding !== "generic") {
      throw new Error("The provider used parent grounding in general mode");
    }
    if (prompt.grounding === "parent_summary" && !input.parentSummary) {
      throw new Error("The provider cited a missing parent summary");
    }
    if (
      prompt.grounding === "parent_notes" &&
      !input.parentNotes &&
      !input.detailNotes
    ) {
      throw new Error("The provider cited missing parent notes");
    }
  }
  return batch;
}

async function renderControlledProviderBatch(
  input: GenerationInput,
  providerBatch: PromptBatch,
): Promise<PromptBatch> {
  validateGroundingForInput(input, providerBatch);
  const safeGenerator = new MockPromptGenerator();
  return safeGenerator.generate({
    ...input,
    skills: [
      ...input.skills,
      ...providerBatch.prompts.map((prompt) => prompt.skill),
    ].slice(0, 6),
  });
}

export async function generateWithFallback(
  rawInput: unknown,
  options: {
    providerName?: string;
    apiKey?: string;
    primary?: PromptGenerator;
    fallback?: PromptGenerator;
  } = {},
): Promise<GenerationResult> {
  const input = generationInputSchema.parse(rawInput);
  const providerName = (
    options.providerName ??
    process.env["AI_PROVIDER"] ??
    "mock"
  ).toLowerCase();
  const fallback = options.fallback ?? new MockPromptGenerator();

  if (providerName !== "openai") {
    return {
      ...promptBatchSchema.parse(await fallback.generate(input)),
      provider: "mock",
      fallback: false,
    };
  }

  const apiKey = options.apiKey ?? process.env["OPENAI_API_KEY"];
  if (!apiKey && !options.primary) {
    return {
      ...promptBatchSchema.parse(await fallback.generate(input)),
      provider: "mock",
      fallback: true,
      notice:
        "OpenAI is not configured, so reliable general prompts were used.",
    };
  }

  try {
    const primary =
      options.primary ?? new OpenAIPromptGenerator(apiKey as string);
    const parsed = promptBatchSchema.parse(await primary.generate(input));
    return {
      ...(await renderControlledProviderBatch(input, parsed)),
      provider: "openai",
      fallback: false,
    };
  } catch {
    return {
      ...promptBatchSchema.parse(await fallback.generate(input)),
      provider: "mock",
      fallback: true,
      notice:
        "The AI provider was unavailable, so reliable general prompts were used instead.",
    };
  }
}

export function makeGenerationInput(input: GenerationInput): GenerationInput {
  return generationInputSchema.parse(input);
}
