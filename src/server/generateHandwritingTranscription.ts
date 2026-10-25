import {
  handwritingTranscriptionSchema,
  type HandwritingTranscription,
  type HandwritingTranscriptionProvider,
} from "@/domain/handwritingTranscription";
import { OpenAIHandwritingTranscriptionProvider } from "./openAIHandwritingTranscriptionProvider";

export interface HandwritingTranscriptionOptions {
  providerName?: string;
  apiKey?: string;
  provider?: HandwritingTranscriptionProvider;
}

export interface HandwritingTranscriptionResult {
  transcription: HandwritingTranscription;
  provider: "openai";
  fallback: false;
}

export async function generateHandwritingTranscription(
  image: Uint8Array,
  options: HandwritingTranscriptionOptions,
): Promise<HandwritingTranscriptionResult> {
  const providerName = (options.providerName ?? "mock").toLowerCase();
  if (providerName !== "openai") {
    throw new Error("Handwriting transcription is unavailable");
  }
  const provider =
    options.provider ??
    new OpenAIHandwritingTranscriptionProvider(options.apiKey as string);
  return {
    transcription: handwritingTranscriptionSchema.parse(
      await provider.transcribe(image),
    ),
    provider: "openai",
    fallback: false,
  };
}
