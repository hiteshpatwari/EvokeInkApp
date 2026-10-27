import { jsPDF } from "jspdf";
import type { ReadingSession } from "@/domain/schemas";
import { planWorksheetPages } from "./layout";

const skillLabel = (skill: string) =>
  skill.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export const pdfSafeText = (value: string) =>
  value
    .replaceAll(/[\u2018\u2019]/g, "'")
    .replaceAll(/[\u201C\u201D]/g, '"')
    .replaceAll(/[\u2013\u2014]/g, "-")
    .replaceAll("\u2026", "...")
    .replaceAll("\u00B7", "-");

export function measurePdfWorksheetLayout(
  document: jsPDF,
  session: ReadingSession,
) {
  document.setFont("helvetica", "bold");
  document.setFontSize(13);
  const titleLines = document.splitTextToSize(
    pdfSafeText(session.book.title),
    7.1,
  ) as string[];
  const titleY = 1.02;
  document.setFont("helvetica", "normal");
  document.setFontSize(9.5);
  const authorLines = document.splitTextToSize(
    pdfSafeText(`Author: ${session.book.author}`),
    7.1,
  ) as string[];
  const authorY = titleY + titleLines.length * 0.18 + 0.13;
  const readerLines = document.splitTextToSize(
    pdfSafeText(
      `Reader: ${session.childSnapshot.name}    Date: __________________`,
    ),
    7.1,
  ) as string[];
  const readerY = authorY + authorLines.length * 0.17 + 0.08;
  const progressLines = document.splitTextToSize(
    pdfSafeText(`${session.book.progress}    Genre: ${session.book.genre}`),
    7.1,
  ) as string[];
  const progressY = readerY + readerLines.length * 0.17 + 0.08;
  const firstPageTop = Math.max(
    2.05,
    progressY + progressLines.length * 0.17 + 0.16,
  );
  document.setFontSize(10.5);
  const pages = planWorksheetPages(session.prompts, {
    firstPageTop,
    measurePromptLines: (text) =>
      (document.splitTextToSize(pdfSafeText(text), 6.82) as string[]).length,
  });
  return {
    titleLines,
    titleY,
    authorLines,
    authorY,
    readerLines,
    readerY,
    progressLines,
    progressY,
    pages,
  };
}

export function buildWorksheetPdf(session: ReadingSession): jsPDF {
  const document = new jsPDF({
    orientation: "portrait",
    unit: "in",
    format: "letter",
  });
  const {
    titleLines,
    titleY,
    authorLines,
    authorY,
    readerLines,
    readerY,
    progressLines,
    progressY,
    pages,
  } = measurePdfWorksheetLayout(document, session);

  pages.forEach((page, pageIndex) => {
    if (pageIndex > 0) document.addPage("letter", "portrait");
    document.setTextColor(34, 48, 45);
    if (pageIndex === 0) {
      document.setFont("helvetica", "bold");
      document.setFontSize(18);
      document.text("Evoke Ink", 0.7, 0.65);
      document.setFontSize(13);
      document.text(titleLines, 0.7, titleY);
      document.setFont("helvetica", "normal");
      document.setFontSize(9.5);
      document.text(authorLines, 0.7, authorY);
      document.text(readerLines, 0.7, readerY);
      document.text(progressLines, 0.7, progressY);
    } else {
      document.setFont("helvetica", "bold");
      document.setFontSize(10);
      const continuation = document.splitTextToSize(
        pdfSafeText(`${session.book.title} - ${session.childSnapshot.name}`),
        7.1,
      ) as string[];
      document.text(
        continuation[0] ?? pdfSafeText(session.book.title),
        0.7,
        0.48,
      );
    }

    page.blocks.forEach((block) => {
      const { prompt } = block;
      document.setFillColor(238, 244, 240);
      document.roundedRect(0.7, block.y, 7.1, 0.32, 0.06, 0.06, "F");
      document.setFont("helvetica", "bold");
      document.setFontSize(8.5);
      document.text(
        `${prompt.required ? "REQUIRED" : "OPTIONAL"} - ${skillLabel(prompt.skill)}`,
        0.82,
        block.y + 0.21,
      );
      document.setFont("helvetica", "normal");
      document.setFontSize(10.5);
      const promptLines = document.splitTextToSize(
        pdfSafeText(prompt.text),
        6.82,
      ) as string[];
      document.text(promptLines, 0.82, block.y + 0.55);
      const lineStart = block.y + 0.55 + promptLines.length * 0.18 + 0.12;
      document.setDrawColor(166, 179, 173);
      document.setLineWidth(0.008);
      for (let index = 0; index < block.lineCount; index += 1) {
        const y = lineStart + index * 0.32;
        document.line(0.82, y, 7.68, y);
      }
    });

    document.setFontSize(8);
    document.setTextColor(95, 108, 103);
    document.text("You may look back at the book while answering.", 0.7, 10.62);
    document.text(`${page.pageNumber} / ${pages.length}`, 7.35, 10.62);
  });

  return document;
}

export function downloadWorksheet(session: ReadingSession): void {
  const document = buildWorksheetPdf(session);

  const safeTitle = session.book.title
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  document.save(`${safeTitle || "reading"}-reflection.pdf`);
}
