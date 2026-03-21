/**
 * Docs Pipeline — Generic DeepWiki-style documentation generator
 *
 * 4-phase pipeline:
 *   Phase 1: DISCOVER  → Analyze code graph for project profile
 *   Phase 2: PLAN      → Generate adaptive doc plan (LLM or deterministic)
 *   Phase 3: GENERATE  → Produce pages using type-specific templates
 *   Phase 4: LINK      → Create hyperlinks between concepts
 *
 * Works on any project — not hardcoded to Code Buddy.
 */

import * as fs from 'fs';
import * as path from 'path';
import { KnowledgeGraph } from '../knowledge/knowledge-graph.js';
import { logger } from '../utils/logger.js';
import { discoverProject } from './discovery/project-discovery.js';
import { generateDocPlan } from './planning/plan-generator.js';
import { generatePages } from './generation/page-generator.js';
import { buildConceptIndex, linkConcepts } from './linking/concept-linker.js';
import { validatePages } from './validation/page-validator.js';
import { loadDocsConfig } from './config.js';
import type { LLMCall } from './llm-enricher.js';
import type { DocsConfig } from './config.js';

// ============================================================================
// Types
// ============================================================================

export interface PipelineResult {
  files: string[];
  pagesGenerated: number;
  conceptsLinked: number;
  durationMs: number;
  errors: string[];
  stats?: {
    totalLines: number;
    mermaidDiagrams: number;
    seeAlsoFooters: number;
    crossSubsystemDeps: number;
  };
}

export interface PipelineOptions {
  /** Project root */
  cwd?: string;
  /** LLM function for enrichment (optional — works without it) */
  llmCall?: LLMCall;
  /** Config overrides */
  config?: Partial<DocsConfig>;
  /** Force deterministic plan (30 pages) even when LLM is available */
  forceDeterministicPlan?: boolean;
  /** Incremental mode: only regenerate pages whose source files changed */
  incremental?: boolean;
  /** Progress callback */
  onProgress?: (phase: string, detail: string) => void;
}

// ============================================================================
// Pipeline
// ============================================================================

export async function runDocsPipeline(
  graph: KnowledgeGraph,
  options: PipelineOptions = {},
): Promise<PipelineResult> {
  const startTime = Date.now();
  const cwd = options.cwd ?? process.cwd();
  const config = { ...loadDocsConfig(cwd), ...options.config };
  const errors: string[] = [];

  // Phase 1: DISCOVER
  options.onProgress?.('discover', 'Analyzing project...');
  logger.info('Docs pipeline: Phase 1 — Discovery');
  const profile = await discoverProject(graph, cwd, config.repoUrl, config.commit);
  logger.info(`  → ${profile.name} v${profile.version}: ${profile.metrics.totalModules} modules, ${profile.architecture.type} architecture`);

  // Phase 2: PLAN
  options.onProgress?.('plan', 'Generating documentation plan...');
  logger.info('Docs pipeline: Phase 2 — Planning');
  const planLlm = options.forceDeterministicPlan ? undefined : options.llmCall;
  const plan = await generateDocPlan(profile, planLlm);
  logger.info(`  → ${plan.pages.length} pages planned`);

  // Phase 3: GENERATE
  options.onProgress?.('generate', `Generating ${plan.pages.length} pages...`);
  logger.info('Docs pipeline: Phase 3 — Generation');
  const genResult = await generatePages(plan, graph, config, options.llmCall, (page, current, total) => {
    options.onProgress?.('generate', `[${current}/${total}] ${page}`);
    logger.info(`  Generating [${current}/${total}] ${page}`);
  }, options.incremental);
  errors.push(...genResult.errors);
  logger.info(`  → ${genResult.pages.length} pages generated in ${genResult.durationMs}ms`);

  const outputDir = path.join(cwd, config.outputDir);

  // Phase 3.5: VALIDATE
  options.onProgress?.('validate', 'Validating pages...');
  logger.info('Docs pipeline: Phase 3.5 — Validation');
  const validation = validatePages(outputDir, genResult.pages);
  logger.info(`  → ${validation.brokenLinksFixed} broken links, ${validation.placeholdersRemoved} placeholders, ${validation.fakeCitationsRemoved} fake citations fixed`);

  // Phase 4: LINK
  options.onProgress?.('link', 'Linking concepts...');
  logger.info('Docs pipeline: Phase 4 — Linking');
  const concepts = buildConceptIndex(plan, genResult.pages);
  const linked = linkConcepts(outputDir, genResult.pages, concepts);
  logger.info(`  → ${linked} concept links created from ${concepts.length} concepts`);

  const files = genResult.pages.map(p => `${p.page.slug}.md`);
  files.push('index.md');

  // Collect quality stats
  let totalLines = 0;
  let mermaidDiagrams = 0;
  let seeAlsoFooters = 0;
  let crossSubsystemDeps = 0;
  for (const page of genResult.pages) {
    const filePath = path.join(outputDir, `${page.page.slug}.md`);
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      totalLines += content.split('\n').length;
      mermaidDiagrams += (content.match(/```mermaid/g) ?? []).length;
      if (content.includes('**See also:**')) seeAlsoFooters++;
      if (content.includes('Cross-Subsystem')) crossSubsystemDeps++;
    } catch { /* skip */ }
  }
  logger.info(`  Stats: ${totalLines} lines, ${mermaidDiagrams} mermaid, ${seeAlsoFooters} see-also, ${crossSubsystemDeps} cross-deps`);

  // Save generation manifest for incremental mode
  try {
    const manifest: Record<string, { generatedAt: number; sourceFiles: string[] }> = {};
    for (const page of genResult.pages) {
      manifest[page.page.slug] = {
        generatedAt: Date.now(),
        sourceFiles: page.page.sourceFiles,
      };
    }
    fs.writeFileSync(
      path.join(outputDir, '.manifest.json'),
      JSON.stringify(manifest, null, 2),
    );
  } catch { /* manifest save non-critical */ }

  // Reload docs context provider if it was loaded
  try {
    const { getDocsContextProvider } = await import('./docs-context-provider.js');
    const dp = getDocsContextProvider();
    if (dp.isLoaded) {
      await dp.loadDocsIndex(cwd);
      logger.debug('DocsContextProvider reloaded after doc generation');
    }
  } catch { /* optional */ }

  // Generate combined single-file export
  try {
    const indexContent = fs.readFileSync(path.join(outputDir, 'index.md'), 'utf-8');
    const combined: string[] = [indexContent, '\n\n---\n\n'];
    for (const page of genResult.pages) {
      const filePath = path.join(outputDir, `${page.page.slug}.md`);
      if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf-8');
        // Strip nav footers for combined view
        content = content.replace(/\n---\n\[← Previous.*$/s, '');
        combined.push(content, '\n\n---\n\n');
      }
    }
    fs.writeFileSync(path.join(outputDir, 'docs-combined.md'), combined.join(''));
    files.push('docs-combined.md');
  } catch { /* combined export non-critical */ }

  const totalMs = Date.now() - startTime;
  logger.info(`Docs pipeline: Done in ${(totalMs / 1000).toFixed(1)}s — ${files.length} files, ${linked} links`);

  return {
    files,
    pagesGenerated: genResult.pages.length,
    conceptsLinked: linked,
    durationMs: totalMs,
    errors,
    stats: { totalLines, mermaidDiagrams, seeAlsoFooters, crossSubsystemDeps },
  };
}
