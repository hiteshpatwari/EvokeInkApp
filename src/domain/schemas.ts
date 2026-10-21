import { z } from "zod";

export const difficultySchema = z.enum([
  "accessible",
  "grade_level",
  "challenging",
  "advanced",
]);
export const responseLengthSchema = z.enum(["short", "medium", "long"]);
export const genreSchema = z.enum([
  "fiction",
  "nonfiction",
  "biography",
  "poetry",
  "other",
]);
export const groundingSchema = z.enum([
  "generic",
  "parent_notes",
  "parent_summary",
]);

export const childProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, "Child name is required").max(80),
  gradeOrAge: z
    .string()
    .trim()
    .min(1, "Grade or age range is required")
    .max(80),
  readingLevel: z.string().trim().max(120).optional(),
  lexile: z.string().trim().max(40).optional(),
  difficulty: difficultySchema,
  responseLength: responseLengthSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const childGenerationSchema = childProfileSchema.pick({
  name: true,
  gradeOrAge: true,
  readingLevel: true,
  lexile: true,
  difficulty: true,
  responseLength: true,
});

export const bookSchema = z.object({
  title: z.string().trim().min(1, "Book title is required").max(200),
  author: z.string().trim().min(1, "Author is required").max(160),
  genre: genreSchema,
  progress: z
    .string()
    .trim()
    .min(3, "Enter pages or chapters completed")
    .max(100)
    .refine(
      (value) =>
        /(?:page|pages|p\.?|chapter|chapters|ch\.?)\s*\d/i.test(value) ||
        /^\d+\s*[-–—]\s*\d+$/.test(value) ||
        /^(?:full|complete|completed)$/i.test(value),
      "Use a value such as “1-60”, “Pages 1-60”, “Chapters 1-3”, or “Complete”",
    ),
});

export const generationInputSchema = z.object({
  child: childGenerationSchema,
  book: bookSchema,
  specificity: z.enum(["general", "notes"]),
  skills: z.array(z.string().trim().min(1)).min(1).max(6),
  parentNotes: z.string().trim().max(3000),
  parentSummary: z.string().trim().max(3000),
  detailNotes: z.string().trim().max(3000),
  variant: z.number().int().min(0).max(1000).optional(),
});

export const networkChildGenerationSchema = childGenerationSchema
  .omit({ name: true })
  .strict();

export const networkGenerationInputSchema = generationInputSchema
  .omit({ child: true, book: true })
  .extend({
    child: networkChildGenerationSchema,
    book: bookSchema.strict(),
  })
  .strict();

export const promptSchema = z.object({
  text: z.string().trim().min(15).max(800),
  skill: z.string().trim().min(2).max(80),
  explanation: z.string().trim().min(8).max(240),
  required: z.boolean(),
  suggestedResponseLength: z.string().trim().min(3).max(80),
  grounding: groundingSchema,
  difficultyLevel: difficultySchema,
});

export const promptBatchSchema = z
  .object({ prompts: z.array(promptSchema).length(4) })
  .superRefine(({ prompts }, context) => {
    const requiredCount = prompts.filter((prompt) => prompt.required).length;
    if (requiredCount !== 3) {
      context.addIssue({
        code: "custom",
        message:
          "Prompt batches must contain exactly three required prompts and one optional prompt",
        path: ["prompts"],
      });
    }
  });

export const worksheetPromptSchema = promptSchema.extend({
  id: z.string().min(1),
  parentEdited: z.boolean().optional(),
});

export const readingSessionSchema = z.object({
  id: z.string().min(1),
  childId: z.string().min(1),
  childSnapshot: childProfileSchema,
  book: bookSchema,
  specificity: z.enum(["general", "notes"]),
  skills: z.array(z.string()),
  parentNotes: z.string(),
  parentSummary: z.string(),
  detailNotes: z.string(),
  generatedPrompts: z.array(worksheetPromptSchema).default([]),
  prompts: z.array(worksheetPromptSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  status: z.enum(["draft", "ready", "completed"]),
});

export type Difficulty = z.infer<typeof difficultySchema>;
export type ResponseLength = z.infer<typeof responseLengthSchema>;
export type ChildProfile = z.infer<typeof childProfileSchema>;
export type Book = z.infer<typeof bookSchema>;
export type GenerationInput = z.infer<typeof generationInputSchema>;
export type NetworkGenerationInput = z.infer<
  typeof networkGenerationInputSchema
>;
export type GeneratedPrompt = z.infer<typeof promptSchema>;
export type PromptBatch = z.infer<typeof promptBatchSchema>;
export type WorksheetPrompt = z.infer<typeof worksheetPromptSchema>;
export type ReadingSession = z.infer<typeof readingSessionSchema>;
