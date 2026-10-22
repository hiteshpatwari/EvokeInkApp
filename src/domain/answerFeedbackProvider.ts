import type {
  AnswerFeedback,
  AnswerFeedbackInput,
} from "./answerFeedbackSchemas";

export interface AnswerFeedbackProvider {
  generate(input: AnswerFeedbackInput): Promise<AnswerFeedback>;
}
