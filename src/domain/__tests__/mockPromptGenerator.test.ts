import { describe, expect, it } from "vitest";
import { languageBand, MockPromptGenerator } from "../mockPromptGenerator";
import type { GenerationInput } from "../schemas";

const baseInput: GenerationInput = {
  child: {
    name: "Maya",
    gradeOrAge: "Adult",
    difficulty: "challenging",
    responseLength: "long",
  },
  book: {
    title: "Unknown Book",
    author: "Unknown Author",
    genre: "fiction",
    progress: "Chapters 1-3",
  },
  specificity: "general",
  skills: ["summary", "inference", "evidence_and_explanation"],
  parentNotes: "",
  parentSummary: "",
  detailNotes: "",
};

describe("MockPromptGenerator", () => {
  it("returns three required prompts and one optional prompt deterministically", async () => {
    const generator = new MockPromptGenerator();
    const first = await generator.generate(baseInput);
    const second = await generator.generate(baseInput);
    expect(first).toEqual(second);
    expect(first.prompts.filter((prompt) => prompt.required)).toHaveLength(3);
    expect(first.prompts.filter((prompt) => !prompt.required)).toHaveLength(1);
  });

  it("does not invent unsupported book-specific details in general mode", async () => {
    const result = await new MockPromptGenerator().generate(baseInput);
    const combined = result.prompts.map((prompt) => prompt.text).join(" ");
    expect(combined).not.toMatch(/Edmund|castle|battle|magic/i);
    expect(
      result.prompts.every((prompt) => prompt.grounding === "generic"),
    ).toBe(true);
  });

  it("may ground prompts in parent summary only when supplied and requested", async () => {
    const result = await new MockPromptGenerator().generate({
      ...baseInput,
      specificity: "notes",
      parentSummary:
        "The main character chooses to tell the truth after making a mistake.",
    });
    expect(result.prompts.map((prompt) => prompt.grounding)).toEqual([
      "generic",
      "parent_summary",
      "generic",
      "generic",
    ]);
    expect(result.prompts[1]?.text).toContain(
      "The main character chooses to tell the truth",
    );
  });

  it("includes a bounded visible note only on the note-grounded prompt", async () => {
    const parentNotes = "The reader noticed a repeated image of an open door.";
    const result = await new MockPromptGenerator().generate({
      ...baseInput,
      specificity: "notes",
      parentNotes,
    });
    expect(result.prompts.map((prompt) => prompt.grounding)).toEqual([
      "generic",
      "generic",
      "parent_notes",
      "generic",
    ]);
    expect(result.prompts[2]?.text).toContain(parentNotes);
  });

  it("uses detail notes when no general parent note was supplied", async () => {
    const detailNotes =
      "A silver key appears twice in the supplied reading notes.";
    const result = await new MockPromptGenerator().generate({
      ...baseInput,
      specificity: "notes",
      detailNotes,
    });

    expect(result.prompts[2]).toMatchObject({ grounding: "parent_notes" });
    expect(result.prompts[2]?.text).toContain(detailNotes);
  });

  it("combines both note fields within a bounded note-grounded prompt", async () => {
    const parentNotes = `Reader observation ${"a".repeat(220)}`;
    const detailNotes = `Reading detail ${"b".repeat(220)}`;
    const result = await new MockPromptGenerator().generate({
      ...baseInput,
      specificity: "notes",
      parentNotes,
      detailNotes,
    });
    const prompt = result.prompts[2];

    expect(prompt).toMatchObject({ grounding: "parent_notes" });
    expect(prompt?.text).toContain("Reader observation");
    expect(prompt?.text).toContain("Reading detail");
    expect(prompt?.text.length).toBeLessThan(650);
    expect(prompt?.text).not.toContain("a".repeat(180));
    expect(prompt?.text).not.toContain("b".repeat(180));
  });

  it("adapts language using grade, reading level, and preferred difficulty", async () => {
    const generator = new MockPromptGenerator();
    const early = await generator.generate({
      ...baseInput,
      child: {
        name: "Sam",
        gradeOrAge: "Grade 1",
        readingLevel: "Emergent reader",
        difficulty: "accessible",
        responseLength: "short",
      },
    });
    const advanced = await generator.generate({
      ...baseInput,
      child: {
        name: "Sam",
        gradeOrAge: "Grade 3",
        readingLevel: "Advanced high school-level reader",
        difficulty: "advanced",
        responseLength: "long",
      },
    });
    expect(early.prompts[0]?.text).toMatch(/Tell the most important thing/);
    expect(advanced.prompts[0]?.text).toMatch(
      /Synthesize the most consequential/,
    );
    expect(early.prompts[0]?.suggestedResponseLength).not.toBe(
      advanced.prompts[0]?.suggestedResponseLength,
    );
  });

  it("selects requested skills while retaining a concise summary", async () => {
    const result = await new MockPromptGenerator().generate({
      ...baseInput,
      skills: ["character_motivation", "theme"],
    });
    expect(result.prompts.map((prompt) => prompt.skill)).toEqual(
      expect.arrayContaining([
        "concise_summary",
        "character_motivation",
        "theme_or_message",
      ]),
    );
  });

  it("supports conflict, author purpose, and comparison categories", async () => {
    const generator = new MockPromptGenerator();
    const conflictAndPurpose = await generator.generate({
      ...baseInput,
      skills: ["conflict_and_problem_solving", "authors_purpose"],
    });
    expect(conflictAndPurpose.prompts.map((prompt) => prompt.skill)).toEqual(
      expect.arrayContaining([
        "conflict_and_problem_solving",
        "authors_purpose",
      ]),
    );
    const comparison = await generator.generate({
      ...baseInput,
      skills: ["comparison"],
    });
    expect(comparison.prompts.map((prompt) => prompt.skill)).toContain(
      "comparison",
    );
  });

  it("interprets age ranges separately from school grades", () => {
    expect(
      languageBand({
        ...baseInput,
        child: {
          name: "Kai",
          gradeOrAge: "Ages 6-8",
          difficulty: "grade_level",
          responseLength: "short",
        },
      }),
    ).toBe("accessible");
  });

  it("adapts parent-summary wording to the reader band", async () => {
    const generator = new MockPromptGenerator();
    const withSummary = {
      ...baseInput,
      specificity: "notes" as const,
      parentSummary: "A person makes a difficult choice.",
    };
    const early = await generator.generate({
      ...withSummary,
      child: {
        name: "Kai",
        gradeOrAge: "Ages 6-8",
        readingLevel: "Emergent reader",
        difficulty: "accessible",
        responseLength: "short",
      },
    });
    const adult = await generator.generate({
      ...withSummary,
      child: {
        name: "Rae",
        gradeOrAge: "Adult",
        readingLevel: "Advanced reader",
        difficulty: "advanced",
        responseLength: "long",
      },
    });
    expect(early.prompts[1]?.text).toMatch(/Choose one important part/);
    expect(adult.prompts[1]?.text).toMatch(/develop a claim|Analyze evidence/);
  });
});
