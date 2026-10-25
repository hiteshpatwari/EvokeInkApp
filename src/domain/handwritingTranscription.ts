import { z } from "zod";

export const handwritingTranscriptionSchema = z
  .object({
    transcript: z.string().trim().min(1).max(4000),
    uncertainSegments: z.array(z.string().trim().min(1).max(200)).max(8),
  })
  .strict();

export type HandwritingTranscription = z.infer<
  typeof handwritingTranscriptionSchema
>;

export interface HandwritingTranscriptionProvider {
  transcribe(image: Uint8Array): Promise<HandwritingTranscription>;
}

export const handwritingTranscriptionResultSchema = z
  .object({
    transcription: handwritingTranscriptionSchema,
    provider: z.literal("openai"),
    fallback: z.literal(false),
  })
  .strict();
