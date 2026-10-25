import { getInstallationToken } from "./promptRequest";

export interface HandwritingTranscription {
  transcript: string;
  uncertainSegments: string[];
}

interface HandwritingTranscriptionResponse {
  transcription: HandwritingTranscription;
  provider: "openai";
  fallback: false;
}

function parseResponse(value: unknown): HandwritingTranscriptionResponse {
  if (!value || typeof value !== "object") throw new Error("Invalid response");
  const candidate = value as Record<string, unknown>;
  const transcription = candidate["transcription"];
  if (!transcription || typeof transcription !== "object") {
    throw new Error("Invalid response");
  }
  const fields = transcription as Record<string, unknown>;
  const transcript =
    typeof fields["transcript"] === "string" ? fields["transcript"].trim() : "";
  const uncertainSegments = fields["uncertainSegments"];
  if (
    candidate["provider"] !== "openai" ||
    candidate["fallback"] !== false ||
    transcript.length < 1 ||
    transcript.length > 4000 ||
    !Array.isArray(uncertainSegments) ||
    uncertainSegments.length > 8 ||
    !uncertainSegments.every(
      (item) =>
        typeof item === "string" &&
        item.trim().length > 0 &&
        item.length <= 200,
    )
  ) {
    throw new Error("Invalid response");
  }
  return {
    transcription: {
      transcript,
      uncertainSegments: uncertainSegments.map((item) => item.trim()),
    },
    provider: "openai",
    fallback: false,
  };
}

export async function requestHandwritingTranscription(
  image: Blob,
): Promise<HandwritingTranscription> {
  const body = new FormData();
  body.append("image", image, "prepared-response.jpg");
  const response = await fetch("/api/transcriptions", {
    method: "POST",
    headers: { "X-Installation-Token": getInstallationToken() },
    body,
  });
  if (!response.ok) throw new Error("Transcription unavailable");
  return parseResponse(await response.json()).transcription;
}
