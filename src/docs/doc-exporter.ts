/**
 * Doc Exporter — orchestrates rendering and writing all formats to disk.
 *
 * Takes an array of RenderInput pages and writes them to the output directory
 * in the requested formats (markdown, html, json, wiki).
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger.js';
import type { RenderInput, RenderOutput, OutputFormat } from './renderers/multi-format-renderer.js';
import { MultiFormatRenderer } from './renderers/multi-format-renderer.js';

// ============================================================================
// Types
// ============================================================================

export interface ExportOptions {
  /** Output directory path */
  outputDir: string;
  /** Formats to generate */
  formats: OutputFormat[];
  /** Repository name (used in index) */
  repoName: string;
}

export interface ExportResult {
  /** Total number of files written */
  totalFiles: number;
  /** Total bytes written */
  totalBytes: number;
  /** Breakdown by format */
  byFormat: Record<string, { files: number; bytes: number }>;
  /** Wall clock duration in ms */
  duration: number;
}

// ============================================================================
// Exporter
// ============================================================================

export class DocExporter {
  /**
   * Export all pages in all requested formats and write to disk.
   */
  static async export(pages: RenderInput[], options: ExportOptions): Promise<ExportResult> {
    const startTime = Date.now();
    const { outputDir, formats, repoName } = options;

    const byFormat: Record<string, { files: number; bytes: number }> = {};
    let totalFiles = 0;
    let totalBytes = 0;

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Ensure wiki subdirectory if needed
    if (formats.includes('wiki')) {
      const wikiDir = path.join(outputDir, 'wiki');
      if (!fs.existsSync(wikiDir)) {
        fs.mkdirSync(wikiDir, { recursive: true });
      }
    }

    // Render and write each page in each format
    for (const page of pages) {
      for (const format of formats) {
        const outputs = DocExporter.renderPage(page, pages, format);
        for (const output of outputs) {
          const filePath = path.join(outputDir, output.filename);

          // Ensure parent directory exists (for wiki/ subdirectory)
          const dir = path.dirname(filePath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }

          fs.writeFileSync(filePath, output.content, 'utf-8');
          totalFiles++;
          totalBytes += output.sizeBytes;

          if (!byFormat[format]) {
            byFormat[format] = { files: 0, bytes: 0 };
          }
          byFormat[format].files++;
          byFormat[format].bytes += output.sizeBytes;
        }
      }
    }

    // Write README.md index
    const indexContent = MultiFormatRenderer.buildIndex(pages, formats, repoName);
    const indexPath = path.join(outputDir, 'README.md');
    fs.writeFileSync(indexPath, indexContent, 'utf-8');
    totalFiles++;
    totalBytes += Buffer.byteLength(indexContent, 'utf-8');

    const duration = Date.now() - startTime;

    logger.info(`DocExporter: wrote ${totalFiles} files (${(totalBytes / 1024).toFixed(1)} KB) in ${duration}ms`);

    return {
      totalFiles,
      totalBytes,
      byFormat,
      duration,
    };
  }

  /**
   * Render a single page in a given format. Returns array because wiki yields multiple files.
   */
  private static renderPage(page: RenderInput, allPages: RenderInput[], format: OutputFormat): RenderOutput[] {
    switch (format) {
      case 'markdown':
        return [MultiFormatRenderer.toMarkdown(page)];
      case 'html':
        return [MultiFormatRenderer.toHtml(page, allPages)];
      case 'json':
        return [MultiFormatRenderer.toJson(page)];
      case 'wiki':
        return MultiFormatRenderer.toWiki(page, allPages);
      default:
        logger.warn(`DocExporter: unknown format "${format}", skipping`);
        return [];
    }
  }
}
