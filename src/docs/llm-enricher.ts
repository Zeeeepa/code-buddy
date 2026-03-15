/**
 * LLM Documentation Enricher
 *
 * Post-processes raw generated markdown docs by passing each section
 * through the LLM for narrative enrichment. The raw data stays as-is
 * but prose paragraphs, explanations, and cross-links are added.
 *
 * This is the "hybrid" approach:
 * 1. Raw generator produces data (fast, 300ms, no LLM needed)
 * 2. Enricher adds narrative quality (slower, needs LLM, much better docs)
 *
 * Also generates PROJECT_KNOWLEDGE.md for context injection.
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger.js';

// ============================================================================
// Types
// ============================================================================

export type LLMCall = (systemPrompt: string, userPrompt: string) => Promise<string>;

export interface EnrichOptions {
  /** Directory containing raw .md files */
  docsDir: string;
  /** LLM call function */
  llmCall: LLMCall;
  /** Project root */
  cwd?: string;
  /** Progress callback */
  onProgress?: (file: string, current: number, total: number) => void;
}

export interface EnrichResult {
  filesEnriched: number;
  tokensUsed: number;
  durationMs: number;
  knowledgePath: string;
  errors: string[];
}

// ============================================================================
// System Prompt
// ============================================================================

const ENRICHER_SYSTEM_PROMPT = `You are a technical documentation writer. You receive a raw auto-generated markdown document containing tables, lists, and data extracted from a codebase.

Your job is to ENRICH this document by adding:

1. **Introductory paragraphs** — Before each section, add 1-2 sentences explaining what this section covers and WHY it matters. Use purpose-first framing ("This module handles X, which is critical because Y").

2. **Source citations** — When you mention a module or file, format as \`src/path/file.ts\` in backticks. If you know specific methods, mention them: \`AgentExecutor.processUserMessage()\`.

3. **Cross-links** — Add "See also: [Section Name](./other-file.md)" links between related sections.

4. **Mermaid diagrams** — Where a visual would help (data flows, component relationships), add a fenced mermaid block.

5. **Key methods table** — For core component sections, add a table: | Method | Purpose | with the most important public methods.

Rules:
- KEEP all existing content (tables, lists, data). Don't remove anything.
- ADD prose BEFORE and BETWEEN existing sections, not instead of them.
- Write in a technical but accessible style (like MDN Web Docs, not marketing)
- Be precise: use exact class/method names, not vague references
- Keep additions concise — 2-3 paragraphs per section maximum
- Output valid markdown. Start with the existing title (# ...).`;

// ============================================================================
// Enricher
// ============================================================================

export async function enrichDocs(options: EnrichOptions): Promise<EnrichResult> {
  const startTime = Date.now();
  const cwd = options.cwd ?? process.cwd();
  const errors: string[] = [];
  let tokensUsed = 0;
  let filesEnriched = 0;
  const knowledgeChunks: string[] = [];

  // Find all .md files in the docs directory
  const mdFiles = fs.readdirSync(options.docsDir)
    .filter(f => f.endsWith('.md') && f !== 'index.md')
    .sort();

  for (let i = 0; i < mdFiles.length; i++) {
    const file = mdFiles[i];
    options.onProgress?.(file, i + 1, mdFiles.length);
    logger.info(`Enriching [${i + 1}/${mdFiles.length}] ${file}`);

    const filePath = path.join(options.docsDir, file);
    const rawContent = fs.readFileSync(filePath, 'utf-8');

    // Skip very small files (changelog, etc.)
    if (rawContent.length < 200) continue;

    try {
      const prompt = [
        `Enrich this auto-generated documentation section. KEEP all existing content and ADD narrative prose.`,
        ``,
        `--- START OF RAW DOCUMENT ---`,
        rawContent.substring(0, 8000), // Cap to ~2K tokens of context
        `--- END OF RAW DOCUMENT ---`,
        ``,
        `Enrich this document following the instructions. Output the complete improved markdown.`,
      ].join('\n');

      const enriched = await options.llmCall(ENRICHER_SYSTEM_PROMPT, prompt);
      tokensUsed += Math.ceil((prompt.length + enriched.length) / 4);

      // Validate: enriched should be at least 50% of raw (LLM may compress large tables)
      if (enriched.length >= rawContent.length * 0.5 && enriched.length > 200) {
        fs.writeFileSync(filePath, enriched);
        filesEnriched++;

        // Extract summary for knowledge file
        const firstParagraphs = enriched.split('\n\n').slice(0, 3).join('\n\n');
        knowledgeChunks.push(firstParagraphs.substring(0, 500));
      } else {
        logger.debug(`Enriched ${file} was shorter than raw — keeping original`);
        errors.push(`${file}: enriched output too short, kept original`);
      }
    } catch (err) {
      errors.push(`${file}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Generate PROJECT_KNOWLEDGE.md from enriched content
  const knowledgePath = path.join(cwd, '.codebuddy', 'PROJECT_KNOWLEDGE.md');
  const knowledgeContent = [
    '# Project Knowledge',
    '',
    `> Auto-generated project understanding from ${filesEnriched} documentation sections.`,
    `> Last updated: ${new Date().toISOString()}`,
    '',
    ...knowledgeChunks,
  ].join('\n');
  fs.writeFileSync(knowledgePath, knowledgeContent.substring(0, 15000));

  return {
    filesEnriched,
    tokensUsed,
    durationMs: Date.now() - startTime,
    knowledgePath,
    errors,
  };
}
