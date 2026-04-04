/**
 * Document Generator Tool — Pure TypeScript
 *
 * Generates professional documents (PPTX, DOCX, XLSX, PDF)
 * using native JS libraries — no Python dependency.
 *
 * - PPTX: pptxgenjs
 * - DOCX: docx (npm)
 * - XLSX: xlsx (SheetJS) — already a project dependency
 * - PDF:  pdfkit
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger.js';
import type { ToolResult } from '../types/index.js';

// ============================================================================
// Types
// ============================================================================

export type DocumentType = 'pptx' | 'docx' | 'xlsx' | 'pdf';

export interface DocumentGeneratorInput {
  type: DocumentType;
  title: string;
  content: string;
  outputPath: string;
  theme?: 'professional' | 'minimal' | 'dark';
}

export interface DocumentResult {
  success: boolean;
  outputPath?: string;
  error?: string;
}

export interface MarkdownSection {
  heading: string;
  level: number;
  body: string[];
}

// ============================================================================
// Markdown Parser
// ============================================================================

export function parseMarkdownSections(content: string): MarkdownSection[] {
  const sections: MarkdownSection[] = [];
  let current: MarkdownSection | null = null;

  for (const line of content.split('\n')) {
    const h1 = line.match(/^# (.+)/);
    const h2 = line.match(/^## (.+)/);
    const h3 = line.match(/^### (.+)/);

    if (h1 || h2 || h3) {
      if (current) sections.push(current);
      const match = (h1 || h2 || h3)!;
      current = { heading: match[1].trim(), level: h1 ? 1 : h2 ? 2 : 3, body: [] };
    } else if (current) {
      current.body.push(line);
    } else {
      current = { heading: '', level: 0, body: [line] };
    }
  }
  if (current) sections.push(current);
  return sections;
}

function parseTableRows(content: string): string[][] {
  const rows: string[][] = [];
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || /^\|?-+[\s|:-]*$/.test(trimmed)) continue;
    if (trimmed.startsWith('|')) {
      rows.push(trimmed.split('|').filter(c => c.trim()).map(c => c.trim()));
    } else if (trimmed.includes(',')) {
      rows.push(trimmed.split(',').map(c => c.trim()));
    }
  }
  return rows;
}

// ============================================================================
// PPTX Generator (pptxgenjs)
// ============================================================================

async function generatePptx(title: string, sections: MarkdownSection[], outputPath: string, theme?: string): Promise<void> {
  const PptxGenJS = (await import('pptxgenjs')).default;
  const pptx = new PptxGenJS();

  const colors = theme === 'dark'
    ? { bg: '1a1a2e', text: 'ffffff', accent: '4cc9f0' }
    : theme === 'minimal'
      ? { bg: 'ffffff', text: '333333', accent: '666666' }
      : { bg: 'ffffff', text: '2d3436', accent: '0984e3' };

  // Title slide
  const titleSlide = pptx.addSlide();
  titleSlide.background = { fill: colors.bg };
  titleSlide.addText(title, {
    x: 0.5, y: 1.5, w: 9, h: 2,
    fontSize: 36, bold: true, color: colors.accent, align: 'center',
  });

  // Content slides
  for (const section of sections) {
    if (!section.heading && section.body.every(l => !l.trim())) continue;

    const slide = pptx.addSlide();
    slide.background = { fill: colors.bg };

    if (section.heading) {
      slide.addText(section.heading, {
        x: 0.5, y: 0.3, w: 9, h: 0.8,
        fontSize: 24, bold: true, color: colors.accent,
      });
    }

    const bullets = section.body.filter(l => l.trim()).map(l => {
      const trimmed = l.trim();
      const isBullet = trimmed.startsWith('- ') || trimmed.startsWith('* ');
      return { text: isBullet ? trimmed.slice(2) : trimmed, options: { bullet: isBullet, fontSize: 16, color: colors.text } };
    });

    if (bullets.length > 0) {
      slide.addText(bullets, { x: 0.5, y: 1.3, w: 9, h: 4, valign: 'top' });
    }
  }

  await pptx.writeFile({ fileName: outputPath });
}

// ============================================================================
// DOCX Generator (docx npm package)
// ============================================================================

async function generateDocx(title: string, sections: MarkdownSection[], outputPath: string): Promise<void> {
  const docx = await import('docx');
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = docx;

  const children: InstanceType<typeof Paragraph>[] = [];

  // Title
  children.push(new Paragraph({
    children: [new TextRun({ text: title, bold: true, size: 48 })],
    heading: HeadingLevel.TITLE,
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
  }));

  for (const section of sections) {
    if (section.heading) {
      const heading = section.level <= 1 ? HeadingLevel.HEADING_1
        : section.level === 2 ? HeadingLevel.HEADING_2
          : HeadingLevel.HEADING_3;
      children.push(new Paragraph({
        children: [new TextRun({ text: section.heading, bold: true })],
        heading,
        spacing: { before: 200, after: 100 },
      }));
    }

    for (const line of section.body) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        children.push(new Paragraph({
          children: [new TextRun({ text: trimmed.slice(2) })],
          bullet: { level: 0 },
        }));
      } else {
        children.push(new Paragraph({
          children: [new TextRun({ text: trimmed })],
        }));
      }
    }
  }

  const doc = new Document({ sections: [{ children }] });
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputPath, buffer);
}

// ============================================================================
// XLSX Generator (SheetJS — already installed)
// ============================================================================

async function generateXlsx(title: string, content: string, outputPath: string): Promise<number> {
  const XLSX = await import('xlsx');
  const rows = parseTableRows(content);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows.slice(1).map(row => {
    const obj: Record<string, string> = {};
    const headers = rows[0] || [];
    row.forEach((cell, i) => { obj[headers[i] || `Col${i + 1}`] = cell; });
    return obj;
  }));

  // Auto-width columns
  if (rows.length > 0) {
    ws['!cols'] = rows[0].map((_, i) => ({
      wch: Math.min(50, Math.max(10, ...rows.map(r => (r[i] || '').length + 2))),
    }));
  }

  XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 31)); // Sheet name max 31 chars
  XLSX.writeFile(wb, outputPath);
  return rows.length;
}

// ============================================================================
// PDF Generator (pdfkit)
// ============================================================================

async function generatePdf(title: string, sections: MarkdownSection[], outputPath: string): Promise<void> {
  const PDFDocument = (await import('pdfkit')).default;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    // Title
    doc.fontSize(28).font('Helvetica-Bold').text(title, { align: 'center' });
    doc.moveDown(2);

    for (const section of sections) {
      if (section.heading) {
        const size = section.level <= 1 ? 20 : section.level === 2 ? 16 : 13;
        doc.fontSize(size).font('Helvetica-Bold').text(section.heading);
        doc.moveDown(0.5);
      }

      for (const line of section.body) {
        const trimmed = line.trim();
        if (!trimmed) { doc.moveDown(0.3); continue; }

        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          doc.fontSize(11).font('Helvetica').text(`  •  ${trimmed.slice(2)}`, { indent: 15 });
        } else if (trimmed.startsWith('```')) {
          doc.fontSize(9).font('Courier');
        } else {
          doc.fontSize(11).font('Helvetica').text(trimmed);
        }
      }
      doc.moveDown(0.5);
    }

    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

// ============================================================================
// Main Entry Point
// ============================================================================

export async function generateDocument(input: DocumentGeneratorInput): Promise<DocumentResult> {
  const { type, title, content, outputPath, theme } = input;

  try {
    // Ensure output directory exists
    const outDir = path.dirname(path.resolve(outputPath));
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const sections = parseMarkdownSections(content);

    switch (type) {
      case 'pptx':
        await generatePptx(title, sections, outputPath, theme);
        break;
      case 'docx':
        await generateDocx(title, sections, outputPath);
        break;
      case 'xlsx': {
        const rowCount = await generateXlsx(title, content, outputPath);
        logger.info(`Document generated: ${outputPath} (xlsx, ${rowCount} rows)`);
        return { success: true, outputPath };
      }
      case 'pdf':
        await generatePdf(title, sections, outputPath);
        break;
      default:
        return { success: false, error: `Unknown document type: ${type}` };
    }

    logger.info(`Document generated: ${outputPath} (${type})`);
    return { success: true, outputPath };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('Document generation failed', { error: msg });
    return { success: false, error: `Document generation failed: ${msg}` };
  }
}

/**
 * Tool execution adapter — called by tool-handler.
 */
export async function executeGenerateDocument(args: {
  type: string;
  title: string;
  content: string;
  outputPath: string;
  theme?: string;
}): Promise<ToolResult> {
  const result = await generateDocument({
    type: args.type as DocumentType,
    title: args.title,
    content: args.content,
    outputPath: args.outputPath,
    theme: args.theme as DocumentGeneratorInput['theme'],
  });

  return result.success
    ? { success: true, output: `Created ${args.type.toUpperCase()}: ${result.outputPath}` }
    : { success: false, error: result.error };
}
