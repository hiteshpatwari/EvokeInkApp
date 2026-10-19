import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { PromptGenerator } from "@/domain/promptGenerator";
import {
  promptBatchSchema,
  type GenerationInput,
  type PromptBatch,
} from "@/domain/schemas";

const SYSTEM_INSTRUCTIONS = `You create calm, age-respectful handwritten reading reflection prompts.
Return exactly three required prompts and one optional prompt.
Adapt vocabulary, abstraction, reasoning, and response length using BOTH school grade/age and independent reading level when provided. Never treat grade as a reading ceiling.
Never invent an event, character, place, object, quote, or other book detail. A title, author, genre, or page range does not prove any story detail. If supplied context is insufficient, use a universal prompt and grounding "generic".
Every generic prompt must begin with one of these neutral words: Choose, Make, What, Identify, Explain, Compare, Tell, Use, Write, Analyze, Form, Develop, or Synthesize. Do not capitalize any other word in a generic prompt unless normal punctuation starts a new sentence.
Only use grounding "parent_summary" for facts present in the supplied summary and "parent_notes" for facts present in the supplied notes. Never introduce another grounding value.
Use these exact skill identifiers when applicable: concise_summary, evidence_and_explanation, inference, cause_and_effect, character_motivation, conflict_and_problem_solving, theme_or_message, authors_purpose, comparison, prediction, personal_response.
Prefer claim, evidence, and explanation. Keep the full worksheet completable in about 10-15 minutes.`;

export function serializeOpenAIContext(input: GenerationInput): string {
  const mayUseNotes = input.specificity === "notes";
  return JSON.stringify({
    child: {
      gradeOrAge: input.child.gradeOrAge,
      readingLevel: input.child.readingLevel,
      lexile: input.child.lexile,
      difficulty: input.child.difficulty,
      responseLength: input.child.responseLength,
    },
    book: input.book,
    specificity: input.specificity,
    desiredSkills: input.skills,
    parentProvidedSummary: mayUseNotes ? input.parentSummary || null : null,
    parentProvidedNotes: mayUseNotes ? input.parentNotes || null : null,
    parentProvidedVocabularyCharacterEventOrThemeNotes: mayUseNotes
      ? input.detailNotes || null
      : null,
  });
}

export class OpenAIPromptGenerator implements PromptGenerator {
  private readonly client: Pick<OpenAI, "responses">;
  private readonly model: string;

  constructor(
    apiKey: string,
    model = process.env["OPENAI_MODEL"] || "gpt-5-mini",
    client?: Pick<OpenAI, "responses">,
  ) {
    this.client = client ?? new OpenAI({ apiKey });
    this.model = model;
  }

  async generate(input: GenerationInput): Promise<PromptBatch> {
    const response = await this.client.responses.parse({
      model: this.model,
      store: false,
      instructions: SYSTEM_INSTRUCTIONS,
      input: serializeOpenAIContext(input),
      text: {
        format: zodTextFormat(promptBatchSchema, "reading_reflection_prompts"),
      },
    });
    if (!response.output_parsed) {
      throw new Error("The AI provider did not return a usable prompt batch");
    }
    return promptBatchSchema.parse(response.output_parsed);
  }
}
