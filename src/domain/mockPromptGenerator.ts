import type { PromptGenerator } from "./promptGenerator";
import {
  promptBatchSchema,
  type GeneratedPrompt,
  type GenerationInput,
  type PromptBatch,
} from "./schemas";

const LENGTHS = {
  short: ["2-3 sentences", "3-4 sentences", "2-3 sentences", "2-4 sentences"],
  medium: ["3-4 sentences", "4-6 sentences", "4-6 sentences", "3-5 sentences"],
  long: ["5-7 sentences", "6-8 sentences", "6-8 sentences", "4-6 sentences"],
} as const;

type LanguageBand = "accessible" | "standard" | "advanced";
interface PromptTemplate {
  skill: string;
  explanation: string;
  text: Record<LanguageBand, string>;
}

const TEMPLATES: Record<string, PromptTemplate> = {
  concise_summary: {
    skill: "concise_summary",
    explanation:
      "Practices selecting key information and writing a focused summary.",
    text: {
      accessible:
        "Tell the most important thing that happened or was explained in this section. Add why it was important.",
      standard:
        "Choose the most important idea or event in this section. Summarize what happened or was explained, why it mattered, and what changed or became clearer.",
      advanced:
        "Synthesize the most consequential development or idea in this section. Explain its significance and how it changes the reader’s understanding.",
    },
  },
  evidence_and_explanation: {
    skill: "evidence_and_explanation",
    explanation:
      "Practices making a claim and connecting it to textual evidence.",
    text: {
      accessible:
        "Say one thing you learned or noticed. Give one detail from the reading that shows it, then tell how the detail helps prove your answer.",
      standard:
        "Make one claim about a person, idea, or problem in this reading. Give a specific detail from the text, then explain how that detail supports your claim.",
      advanced:
        "Develop a defensible claim about a person, idea, or problem in this section. Cite a precise textual detail and analyze how it supports your interpretation.",
    },
  },
  inference: {
    skill: "inference",
    explanation: "Practices inference, evidence, and clear reasoning.",
    text: {
      accessible:
        "What is one idea the author helps you understand without saying it directly? Give one clue and explain your thinking.",
      standard:
        "What is one reasonable conclusion you can draw that the author does not state directly? Use a clue from the reading and explain your reasoning.",
      advanced:
        "Form an inference the author implies rather than states. Analyze a textual clue and explain the reasoning that makes your inference credible.",
    },
  },
  cause_and_effect: {
    skill: "cause_and_effect",
    explanation: "Practices tracing consequences and explaining significance.",
    text: {
      accessible:
        "Choose one cause and its result in this section. Tell what happened first, what happened because of it, and why it matters.",
      standard:
        "Identify one meaningful cause-and-effect relationship in this section. Describe the cause, the result, and why the connection matters.",
      advanced:
        "Analyze a consequential cause-and-effect relationship in this section. Explain the mechanism connecting cause to outcome and evaluate its significance.",
    },
  },
  character_motivation: {
    skill: "character_motivation",
    explanation: "Practices explaining motivation with evidence.",
    text: {
      accessible:
        "What does one person want, need, or worry about? Give one detail that helps you know.",
      standard:
        "What does one person want or worry about in this section? Use one detail to explain what may be motivating that person.",
      advanced:
        "Analyze a person’s likely motivation in this section. Use a precise detail to distinguish what the person says from what the evidence suggests.",
    },
  },
  conflict_and_problem_solving: {
    skill: "conflict_and_problem_solving",
    explanation:
      "Practices analyzing a problem, responses, and possible solutions.",
    text: {
      accessible:
        "Choose one problem in this section. Tell how someone responds and what might help solve the problem. Give one detail from the reading.",
      standard:
        "Identify an important conflict or problem in this section. Explain how someone responds, evaluate that response, and support your thinking with a detail.",
      advanced:
        "Analyze a central conflict or problem in this section. Evaluate one response to it and use textual evidence to propose or assess a more effective solution.",
    },
  },
  theme: {
    skill: "theme_or_message",
    explanation:
      "Practices identifying a message and supporting it with evidence.",
    text: {
      accessible:
        "What lesson or big idea might this section show? Give one detail that helped you think of it.",
      standard:
        "What theme or message may be developing in this section? Support your idea with a detail and explain the connection.",
      advanced:
        "Propose a nuanced theme or message emerging in this section. Analyze how one textual detail develops or complicates that idea.",
    },
  },
  authors_purpose: {
    skill: "authors_purpose",
    explanation:
      "Practices inferring why the author included or presented information.",
    text: {
      accessible:
        "Why do you think the author included one part of this section? Give a detail and tell what the author may want readers to think or understand.",
      standard:
        "Choose one detail or section and explain the author’s likely purpose for including it. Use evidence to show how it affects the reader’s understanding.",
      advanced:
        "Analyze the author’s purpose in presenting one detail, idea, or event in this way. Explain how the choice shapes meaning or influences the reader.",
    },
  },
  comparison: {
    skill: "comparison",
    explanation:
      "Practices comparing ideas and explaining meaningful differences.",
    text: {
      accessible:
        "Choose two people, ideas, or parts of this section. Tell one way they are alike and one way they are different. Give a detail for each.",
      standard:
        "Compare two people, ideas, events, or explanations from this reading. Use details to explain one meaningful similarity or difference.",
      advanced:
        "Develop a purposeful comparison between two people, ideas, events, or explanations. Analyze how a key similarity or difference changes their significance.",
    },
  },
  prediction: {
    skill: "prediction",
    explanation: "Practices prediction based on textual evidence.",
    text: {
      accessible:
        "What do you think may happen or be explained next? Give one clue that supports your prediction.",
      standard:
        "Make a careful prediction about what may happen or be explained next. Give one clue from this section and explain why it supports your prediction.",
      advanced:
        "Make a plausible prediction about what may follow. Weigh one strong clue and explain both what it suggests and what remains uncertain.",
    },
  },
  personal_response: {
    skill: "personal_response",
    explanation: "Practices thoughtful personal response grounded in the text.",
    text: {
      accessible:
        "What question or connection did this section give you? Tell which part of the reading made you think of it.",
      standard:
        "What question, connection, or prediction did this section leave you with? Explain what in the reading led you to it.",
      advanced:
        "What question, connection, or tension does this section leave unresolved for you? Explain which textual detail prompted that response.",
    },
  },
};

function scoreGrade(gradeOrAge: string): number {
  if (/adult/i.test(gradeOrAge)) return 3;
  const value = Number.parseInt(gradeOrAge.match(/\d+/)?.[0] ?? "5", 10);
  if (/\bage|\bages/i.test(gradeOrAge)) {
    if (value <= 7) return 0;
    if (value <= 10) return 1;
    if (value <= 13) return 2;
    return 3;
  }
  const grade = value;
  if (grade <= 2) return 0;
  if (grade <= 5) return 1;
  if (grade <= 8) return 2;
  return 3;
}

function scoreReading(input: GenerationInput): number | undefined {
  const level = `${input.child.readingLevel ?? ""} ${input.child.lexile ?? ""}`;
  if (!level.trim()) return undefined;
  if (/beginner|early|emergent|accessible/i.test(level)) return 0;
  if (/advanced|high school|college|adult/i.test(level)) return 3;
  const lexile = Number.parseInt(level.match(/\d{3,4}/)?.[0] ?? "", 10);
  if (Number.isFinite(lexile)) {
    if (lexile < 500) return 0;
    if (lexile < 900) return 1;
    if (lexile < 1200) return 2;
    return 3;
  }
  return 1;
}

export function languageBand(input: GenerationInput): LanguageBand {
  const difficultyScore = {
    accessible: 0,
    grade_level: 1,
    challenging: 2,
    advanced: 3,
  }[input.child.difficulty];
  const readingScore = scoreReading(input);
  const score =
    (scoreGrade(input.child.gradeOrAge) +
      difficultyScore * 2 +
      (readingScore ?? 0)) /
    (readingScore === undefined ? 3 : 4);
  if (score < 0.8) return "accessible";
  if (score >= 2) return "advanced";
  return "standard";
}

function promptGrounding(
  input: GenerationInput,
  index: number,
): GeneratedPrompt["grounding"] {
  if (input.specificity !== "notes") return "generic";
  if (index === 1 && input.parentSummary) return "parent_summary";
  if (index === 2 && (input.parentNotes || input.detailNotes))
    return "parent_notes";
  return "generic";
}

function boundedSource(value: string): string {
  return `“${value.slice(0, 180)}${value.length > 180 ? "…" : ""}”`;
}

function boundedNotes(parentNotes: string, detailNotes: string): string {
  const sources = [
    parentNotes ? `parent observation: ${parentNotes}` : "",
    detailNotes ? `reading detail: ${detailNotes}` : "",
  ].filter(Boolean);
  const perSourceLimit = sources.length > 1 ? 105 : 180;
  return sources
    .map(
      (source) =>
        `“${source.slice(0, perSourceLimit)}${source.length > perSourceLimit ? "…" : ""}”`,
    )
    .join(" and ");
}

function requestedTemplates(input: GenerationInput): PromptTemplate[] {
  const normalized = input.skills.map((skill) =>
    skill === "summary" ? "concise_summary" : skill,
  );
  const keys = [
    ...normalized.filter(
      (skill) => skill !== "concise_summary" && skill !== "prediction",
    ),
    "evidence_and_explanation",
    "inference",
  ];
  const required = [...new Set(keys)]
    .filter((skill) => TEMPLATES[skill])
    .slice(0, 2);
  const optionalKey = normalized.includes("prediction")
    ? "prediction"
    : "personal_response";
  const templates = [
    TEMPLATES["concise_summary"],
    ...required.map((skill) => TEMPLATES[skill]),
    TEMPLATES[optionalKey],
  ];
  if (templates.some((template) => !template) || templates.length !== 4)
    throw new Error("Mock prompt template selection failed");
  return templates as PromptTemplate[];
}

function contextualText(
  input: GenerationInput,
  template: PromptTemplate,
  index: number,
  band: LanguageBand,
): string {
  const grounding = promptGrounding(input, index);
  if (grounding === "parent_summary" && index === 1) {
    const summary = boundedSource(input.parentSummary);
    if (band === "accessible") {
      return `The parent’s summary says ${summary}. Choose one important part. Find a detail in the book that shows it, then tell why it matters.`;
    }
    if (band === "advanced") {
      return `Using the parent-provided summary ${summary}, develop a claim about the significance of this moment or idea. Analyze evidence from the book that supports your interpretation.`;
    }
    return `Using the parent-provided summary ${summary}, make one claim about why this moment or idea matters. Support your answer with evidence you find in the book.`;
  }
  if (grounding === "parent_notes" && index === 2) {
    const note = boundedNotes(input.parentNotes, input.detailNotes);
    if (band === "accessible") {
      return `A parent note says ${note}. Tell what you think it shows, then find one clue in the book that supports your answer.`;
    }
    if (band === "advanced") {
      return `Using the parent-provided note ${note}, develop an inference, then analyze evidence in the book that supports or complicates your reasoning.`;
    }
    return `A parent note says ${note}. Explain what you can infer from it, then check the book for evidence that supports your reasoning.`;
  }
  return template.text[band];
}

export class MockPromptGenerator implements PromptGenerator {
  async generate(input: GenerationInput): Promise<PromptBatch> {
    const band = languageBand(input);
    const lengths = LENGTHS[input.child.responseLength];
    let templates = requestedTemplates(input);
    if ((input.variant ?? 0) % 2 === 1) {
      templates = [
        templates[0]!,
        TEMPLATES["cause_and_effect"]!,
        TEMPLATES["prediction"]!,
        templates[3]!,
      ];
    }
    const prompts = templates.map((template, index) => ({
      text: contextualText(input, template, index, band),
      skill: template.skill,
      explanation: template.explanation,
      required: index < 3,
      suggestedResponseLength: lengths[index] ?? "3-5 sentences",
      grounding: promptGrounding(input, index),
      difficultyLevel: input.child.difficulty,
    }));
    return promptBatchSchema.parse({ prompts });
  }
}
