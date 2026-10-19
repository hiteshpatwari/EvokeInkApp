import { describe, expect, it } from "vitest";
import { planWorksheetPages } from "../layout";
import { jsPDF } from "jspdf";
import { measurePdfWorksheetLayout, pdfSafeText } from "../downloadWorksheet";
import type { ReadingSession } from "@/domain/schemas";
import type { WorksheetPrompt } from "@/domain/schemas";

const prompts: WorksheetPrompt[] = Array.from({ length: 4 }, (_, index) => ({
  id: `prompt-${index}`,
  text: "Choose one important idea. Support it with a detail and explain your reasoning.",
  skill: "evidence_and_explanation",
  explanation: "Practices evidence-based reasoning.",
  required: index < 3,
  suggestedResponseLength: index === 0 ? "2-3 sentences" : "4-6 sentences",
  grounding: "generic",
  difficultyLevel: "challenging",
}));

describe("print layout planning", () => {
  it("keeps every prompt block wholly on one Letter-sized page", () => {
    const pages = planWorksheetPages(prompts);
    expect(pages.length).toBeGreaterThan(0);
    for (const page of pages) {
      for (const block of page.blocks) {
        expect(block.y + block.height).toBeLessThanOrEqual(page.contentBottom);
      }
    }
    expect(pages.flatMap((page) => page.blocks)).toHaveLength(4);
  });

  it("uses jsPDF font metrics for long titles and maximum-length prompts", () => {
    const longPrompts = prompts.map((prompt, index) => ({
      ...prompt,
      text: `${"Analyze the relationship between the evidence and the claim, then explain any uncertainty. ".repeat(8)} ${index}`,
    }));
    const profile = {
      id: "child-1",
      name: "Alexandria ".repeat(7).trim(),
      gradeOrAge: "Adult",
      difficulty: "advanced" as const,
      responseLength: "long" as const,
      createdAt: "2026-10-12T00:00:00.000Z",
      updatedAt: "2026-10-12T00:00:00.000Z",
    };
    const session: ReadingSession = {
      id: "session-1",
      childId: profile.id,
      childSnapshot: profile,
      book: {
        title:
          "A Very Long and Deliberately Detailed Book Title That Wraps Across Several Lines Without Colliding With the Author or Reader Metadata",
        author: "Alexandria ".repeat(14).trim(),
        genre: "nonfiction",
        progress: "Completed chapters ".repeat(5).trim(),
      },
      specificity: "general",
      skills: ["inference"],
      parentNotes: "",
      parentSummary: "",
      detailNotes: "",
      generatedPrompts: longPrompts.map((prompt) => ({ ...prompt })),
      prompts: longPrompts,
      createdAt: "2026-10-12T00:00:00.000Z",
      updatedAt: "2026-10-12T00:00:00.000Z",
      status: "ready",
    };
    const layout = measurePdfWorksheetLayout(
      new jsPDF({ unit: "in", format: "letter" }),
      session,
    );
    expect(layout.titleLines.length).toBeGreaterThan(1);
    expect(layout.authorY).toBeGreaterThan(
      layout.titleY + (layout.titleLines.length - 1) * 0.18,
    );
    expect(layout.authorLines.length).toBeGreaterThan(1);
    expect(layout.progressLines.length).toBeGreaterThan(1);
    expect(layout.readerY).toBeGreaterThan(layout.authorY);
    expect(layout.progressY).toBeGreaterThan(layout.readerY);
    expect(layout.pages.flatMap((page) => page.blocks)).toHaveLength(4);
    for (const page of layout.pages) {
      expect(
        page.blocks.every(
          (block) => block.y + block.height <= page.contentBottom,
        ),
      ).toBe(true);
    }
  });

  it("normalizes unsupported punctuation before rendering with core PDF fonts", () => {
    expect(pdfSafeText("‘Read’ — reflect… · explain")).toBe(
      "'Read' - reflect... - explain",
    );
  });
});
