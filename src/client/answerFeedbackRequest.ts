import {
  answerFeedbackInputSchema,
  type AnswerFeedbackInput,
} from "@/domain/answerFeedbackSchemas";
import type { ChildProfile, WorksheetPrompt } from "@/domain/schemas";

export interface LocalAnswerFeedbackRequest extends Record<string, unknown> {
  prompt: WorksheetPrompt;
  childSnapshot: ChildProfile;
  responseText: string;
}

export function toNetworkAnswerFeedbackInput(
  input: LocalAnswerFeedbackRequest,
): AnswerFeedbackInput {
  const { prompt, childSnapshot } = input;
  return answerFeedbackInputSchema.parse({
    prompt: {
      text: prompt.text,
      skill: prompt.skill,
      difficultyLevel: prompt.difficultyLevel,
    },
    profile: {
      gradeOrAge: childSnapshot.gradeOrAge,
      ...(childSnapshot.readingLevel
        ? { readingLevel: childSnapshot.readingLevel }
        : {}),
      ...(childSnapshot.lexile ? { lexile: childSnapshot.lexile } : {}),
      difficulty: childSnapshot.difficulty,
      responseLength: childSnapshot.responseLength,
    },
    responseText: input.responseText,
  });
}
