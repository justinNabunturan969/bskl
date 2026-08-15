import { jsPDF } from "jspdf";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from "docx";
import { saveAs } from "file-saver";
import type { SummaryFormat } from "./summarize/types";

export interface ExportPayload {
  title: string;
  context: string;
  createdAt: string;
  transcriptText: string | null;
  summaryContent: string | null;
  summaryFormat: SummaryFormat | null;
}

const FILENAME_DATE = (d: string) =>
  new Date(d).toISOString().slice(0, 10); // 2026-08-14

function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "bskl-note"
  );
}

// ───────────────────────────────────────────────────────────
// Markdown
// ───────────────────────────────────────────────────────────

export function buildMarkdown(p: ExportPayload): string {
  const lines: string[] = [];
  lines.push(`# ${p.title || "Untitled recording"}`);
  lines.push("");
  lines.push(`- **Context:** ${p.context}`);
  lines.push(`- **Date:** ${new Date(p.createdAt).toLocaleString()}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  if (p.summaryContent) {
    lines.push(`## Summary`);
    lines.push("");
    if (p.summaryFormat) {
      lines.push(`*Format: ${p.summaryFormat}*`);
      lines.push("");
    }
    lines.push(p.summaryContent.trim());
    lines.push("");
  }

  if (p.transcriptText) {
    lines.push(`## Transcript`);
    lines.push("");
    lines.push(p.transcriptText.trim());
    lines.push("");
  }

  lines.push("---");
  lines.push(`*Exported from BSKL — BrainScribe Knowledge Lab*`);

  return lines.join("\n");
}

export function exportToMarkdown(p: ExportPayload): void {
  const md = buildMarkdown(p);
  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  const name = `${slug(p.title)}-${FILENAME_DATE(p.createdAt)}.md`;
  saveAs(blob, name);
}

// ───────────────────────────────────────────────────────────
// PDF
// ───────────────────────────────────────────────────────────

export function exportToPdf(p: ExportPayload): void {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 54; // 0.75"
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  function ensureRoom(needed: number) {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  }

  function writeWrapped(text: string, size: number, bold = false) {
    doc.setFontSize(size);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setTextColor(20);
    const lines = doc.splitTextToSize(text || "", maxWidth);
    const lineH = size * 1.25;
    for (const line of lines) {
      ensureRoom(lineH);
      doc.text(line, margin, y);
      y += lineH;
    }
  }

  function spacer(h: number) {
    ensureRoom(h);
    y += h;
  }

  // Title
  writeWrapped(p.title || "Untitled recording", 20, true);
  spacer(4);
  doc.setDrawColor(180);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  spacer(10);

  // Meta
  writeWrapped(`Context: ${p.context}    Date: ${new Date(p.createdAt).toLocaleString()}`, 10);
  spacer(18);

  // Summary
  if (p.summaryContent) {
    writeWrapped("Summary", 14, true);
    spacer(2);
    if (p.summaryFormat) {
      doc.setTextColor(120);
      writeWrapped(`Format: ${p.summaryFormat}`, 9);
      doc.setTextColor(20);
      spacer(2);
    }
    writeWrapped(p.summaryContent.trim(), 11);
    spacer(16);
  }

  // Transcript
  if (p.transcriptText) {
    writeWrapped("Transcript", 14, true);
    spacer(4);
    writeWrapped(p.transcriptText.trim(), 11);
  }

  // Footer on every page
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `BSKL — BrainScribe Knowledge Lab — Page ${i} of ${total}`,
      pageWidth / 2,
      pageHeight - 24,
      { align: "center" }
    );
  }

  const name = `${slug(p.title)}-${FILENAME_DATE(p.createdAt)}.pdf`;
  doc.save(name);
}

// ───────────────────────────────────────────────────────────
// DOCX
// ───────────────────────────────────────────────────────────

function buildSummaryParagraphs(content: string): Paragraph[] {
  const paras: Paragraph[] = [];
  for (const raw of content.split("\n")) {
    const line = raw.trim();
    if (!line) {
      paras.push(new Paragraph({ text: "" }));
      continue;
    }
    if (line.startsWith("## ")) {
      paras.push(
        new Paragraph({
          text: line.slice(3),
          heading: HeadingLevel.HEADING_2,
        })
      );
      continue;
    }
    if (line.startsWith("# ")) {
      paras.push(
        new Paragraph({
          text: line.slice(2),
          heading: HeadingLevel.HEADING_1,
        })
      );
      continue;
    }
    if (line.startsWith("- ")) {
      paras.push(
        new Paragraph({
          text: line.slice(2),
          bullet: { level: 0 },
        })
      );
      continue;
    }
    paras.push(new Paragraph({ children: parseInline(line) }));
  }
  return paras;
}

function parseInline(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const re = /\*\*([^*]+)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) runs.push(new TextRun({ text: text.slice(last, m.index) }));
    runs.push(new TextRun({ text: m[1], bold: true }));
    last = re.lastIndex;
  }
  if (last < text.length) runs.push(new TextRun({ text: text.slice(last) }));
  return runs.length ? runs : [new TextRun({ text })];
}

export async function exportToDocx(p: ExportPayload): Promise<void> {
  const children: Paragraph[] = [];

  // Title
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: p.title || "Untitled recording", bold: true, size: 40 }),
      ],
      heading: HeadingLevel.TITLE,
    })
  );

  // Meta
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: `Context: ${p.context}    `, size: 20 }),
        new TextRun({
          text: `Date: ${new Date(p.createdAt).toLocaleString()}`,
          size: 20,
        }),
      ],
    }),
    new Paragraph({ text: "" })
  );

  if (p.summaryContent) {
    children.push(
      new Paragraph({ text: "Summary", heading: HeadingLevel.HEADING_1 })
    );
    if (p.summaryFormat) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `Format: ${p.summaryFormat}`, italics: true, size: 18 }),
          ],
        })
      );
    }
    children.push(...buildSummaryParagraphs(p.summaryContent));
    children.push(new Paragraph({ text: "" }));
  }

  if (p.transcriptText) {
    children.push(
      new Paragraph({ text: "Transcript", heading: HeadingLevel.HEADING_1 })
    );
    for (const para of p.transcriptText.split(/\n{2,}/)) {
      const trimmed = para.trim();
      if (!trimmed) continue;
      children.push(
        new Paragraph({
          children: [new TextRun({ text: trimmed, size: 22 })],
        })
      );
    }
  }

  children.push(
    new Paragraph({ text: "" }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: "Exported from BSKL — BrainScribe Knowledge Lab",
          italics: true,
          size: 18,
          color: "888888",
        }),
      ],
    })
  );

  const doc = new Document({ sections: [{ properties: {}, children }] });
  const blob = await Packer.toBlob(doc);
  const name = `${slug(p.title)}-${FILENAME_DATE(p.createdAt)}.docx`;
  saveAs(blob, name);
}