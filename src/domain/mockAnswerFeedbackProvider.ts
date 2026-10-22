import type { AnswerFeedbackProvider } from "./answerFeedbackProvider";
import {
  answerFeedbackInputSchema,
  answerFeedbackSchema,
  type AnswerFeedback,
  type AnswerFeedbackInput,
} from "./answerFeedbackSchemas";

const FACTUAL_LIMITATION =
  "I can coach response structure, but I cannot determine whether it answers the prompt and cannot verify book facts from the information provided.";

function isEarlyElementary(input: AnswerFeedbackInput): boolean {
  const grade = Number.parseInt(
    input.profile.gradeOrAge.match(/\d+/)?.[0] ?? "99",
    10,
  );
  return (
    input.profile.difficulty === "accessible" &&
    (/\b(?:kindergarten|grade)\s*[k12]\b/i.test(input.profile.gradeOrAge) ||
      grade <= 2)
  );
}

function isAdvanced(input: AnswerFeedbackInput): boolean {
  return (
    input.profile.difficulty === "advanced" ||
    /\b(?:adult|college|university)\b/i.test(
      `${input.profile.gradeOrAge} ${input.profile.readingLevel ?? ""}`,
    )
  );
}

function hasSupportingDetail(response: string): boolean {
  return /\b(?:for example|for instance|such as|in the (?:book|reading|story|text)|when|noticed|stopped|said|described)\b/i.test(
    response,
  );
}

function hasExplanation(response: string): boolean {
  return /\b(?:because|therefore|so|this (?:shows|suggests|means)|which (?:shows|suggests|means))\b/i.test(
    response,
  );
}

function isInsufficientResponse(response: string): boolean {
  const normalized = response.trim();
  if (/\b(?:i\s+)?(?:do\s+not|don['’]?t|dont)\s+know\b/i.test(normalized)) {
    return true;
  }

  const words = normalized.match(/[\p{L}\p{N}]+/gu) ?? [];
  return words.length <= 3;
}

function buildFeedback(input: AnswerFeedbackInput): AnswerFeedback {
  const early = isEarlyElementary(input);
  const advanced = isAdvanced(input);
  const insufficient = isInsufficientResponse(input.responseText);
  const hasDetail = hasSupportingDetail(input.responseText);
  const hasReasoning = hasExplanation(input.responseText);

  if (insufficient) {
    return {
      strengths: ["You have a starting point that you can build on."],
      observedEvidence: [
        "There is not enough clear information yet to identify a supported idea.",
      ],
      missedOrUnclear: [
        "A direct answer to the prompt is missing or unclear.",
        "A supporting detail from the reading is missing or unclear.",
        "The response does not yet explain how the detail supports the idea.",
      ],
      nextStep:
        "Write one sentence that directly answers the prompt, then add a supporting detail.",
      revisionQuestion: early
        ? "What is one idea that answers the question?"
        : "What main idea directly answers the prompt?",
      grounding: "response_and_prompt",
      limitation: FACTUAL_LIMITATION,
    };
  }

  const strengths = advanced
    ? ["You provided a response to examine and revise."]
    : early
      ? ["You started a response."]
      : ["You provided a response that can be revised."];

  if (hasDetail) {
    strengths.push(
      advanced
        ? "You used language that introduces a supporting detail."
        : early
          ? "You used words that introduce a detail."
          : "You used language that introduces a supporting detail.",
    );
  }

  const missedOrUnclear: string[] = [
    "The connection between the response and the prompt needs to be checked and made explicit.",
  ];
  if (!hasDetail) {
    missedOrUnclear.push(
      "A supporting detail from the reading is missing or unclear.",
    );
  }
  if (!hasReasoning) {
    missedOrUnclear.push(
      "The response does not yet explain how the detail supports the idea.",
    );
  }

  const nextStep = !hasDetail
    ? early
      ? "Check the prompt, then add one detail from the reading."
      : "Re-read the prompt, state your answer directly, and add one specific detail from the reading."
    : advanced
      ? "Clarify how the detail and reasoning cue connect to the prompt."
      : !hasReasoning
        ? "Explain how the detail connects to your answer to the prompt."
        : "Make the connection between the response and the prompt explicit.";

  const revisionQuestion = early
    ? "What happened in the reading that shows your idea?"
    : advanced
      ? "How does the selected detail substantiate your interpretation?"
      : "How does your detail show why your main idea makes sense?";

  return {
    strengths,
    observedEvidence: [
      hasDetail && hasReasoning
        ? "Your response uses both detail-introducing and reasoning cue language."
        : hasDetail
          ? "Your response uses language that introduces a detail."
          : hasReasoning
            ? "Your response uses reasoning cue language."
            : "Your response does not yet use a clear detail or reasoning cue.",
    ],
    missedOrUnclear,
    nextStep,
    revisionQuestion,
    grounding: "response_and_prompt",
    limitation: FACTUAL_LIMITATION,
  };
}

export class MockAnswerFeedbackProvider implements AnswerFeedbackProvider {
  async generate(input: AnswerFeedbackInput): Promise<AnswerFeedback> {
    const validatedInput = answerFeedbackInputSchema.parse(input);
    return answerFeedbackSchema.parse(buildFeedback(validatedInput));
  }
}
