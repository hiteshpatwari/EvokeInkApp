import { z } from "zod";
import { difficultySchema, responseLengthSchema } from "./schemas";

const feedbackPromptSchema = z
  .object({
    text: z.string().trim().min(15).max(800),
    skill: z.string().trim().min(2).max(80),
    difficultyLevel: difficultySchema,
  })
  .strict();

const feedbackProfileSchema = z
  .object({
    gradeOrAge: z.string().trim().min(1).max(80),
    readingLevel: z.string().trim().max(120).optional(),
    lexile: z.string().trim().max(40).optional(),
    difficulty: difficultySchema,
    responseLength: responseLengthSchema,
  })
  .strict();

export const answerFeedbackInputSchema = z
  .object({
    prompt: feedbackPromptSchema,
    profile: feedbackProfileSchema,
    responseText: z
      .string()
      .trim()
      .min(1, "Enter the response before requesting feedback")
      .max(4000, "Keep the response under 4,000 characters"),
  })
  .strict();

const coachingStatementSchema = z.string().trim().min(3).max(240);

export const answerFeedbackSchema = z
  .object({
    strengths: z.array(coachingStatementSchema).min(1).max(2),
    observedEvidence: z.array(coachingStatementSchema).min(1).max(2),
    missedOrUnclear: z.array(coachingStatementSchema).max(3),
    nextStep: coachingStatementSchema,
    revisionQuestion: z.string().trim().min(5).max(240),
    grounding: z.literal("response_and_prompt"),
    limitation: z.string().trim().min(8).max(300),
  })
  .strict();

export type AnswerFeedbackInput = z.infer<typeof answerFeedbackInputSchema>;
export type AnswerFeedback = z.infer<typeof answerFeedbackSchema>;
