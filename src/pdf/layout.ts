import type { WorksheetPrompt } from "@/domain/schemas";

export interface PromptBlockLayout {
  prompt: WorksheetPrompt;
  y: number;
  height: number;
  lineCount: number;
}

export interface WorksheetPageLayout {
  pageNumber: number;
  contentBottom: number;
  blocks: PromptBlockLayout[];
}

const PAGE_BOTTOM = 10.25;
const FIRST_PAGE_TOP = 2.05;
const NEXT_PAGE_TOP = 0.75;

function answerLines(suggestedLength: string): number {
  const match = suggestedLength.match(/(\d+)\s*[-–]/);
  const sentences = match?.[1] ? Number.parseInt(match[1], 10) : 3;
  return Math.max(4, Math.min(8, sentences + 2));
}

function blockHeight(prompt: WorksheetPrompt, textLines: number): number {
  return (
    0.76 + textLines * 0.18 + answerLines(prompt.suggestedResponseLength) * 0.32
  );
}

export function planWorksheetPages(
  prompts: WorksheetPrompt[],
  options: {
    firstPageTop?: number;
    measurePromptLines?: (text: string) => number;
  } = {},
): WorksheetPageLayout[] {
  const pages: WorksheetPageLayout[] = [
    { pageNumber: 1, contentBottom: PAGE_BOTTOM, blocks: [] },
  ];
  let y = options.firstPageTop ?? FIRST_PAGE_TOP;
  for (const prompt of prompts) {
    const textLines = Math.max(
      1,
      options.measurePromptLines?.(prompt.text) ??
        Math.ceil(prompt.text.length / 88),
    );
    const height = blockHeight(prompt, textLines);
    let page = pages[pages.length - 1];
    if (!page) throw new Error("Worksheet page initialization failed");
    if (y + height > PAGE_BOTTOM) {
      page = {
        pageNumber: pages.length + 1,
        contentBottom: PAGE_BOTTOM,
        blocks: [],
      };
      pages.push(page);
      y = NEXT_PAGE_TOP;
    }
    page.blocks.push({
      prompt,
      y,
      height,
      lineCount: answerLines(prompt.suggestedResponseLength),
    });
    y += height + 0.22;
  }
  return pages;
}
