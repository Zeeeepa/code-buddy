/**
 * /docs slash command — Generate DeepWiki-style documentation
 *
 * Usage:
 *   /docs generate           — Generate full documentation
 *   /docs generate --no-diagrams  — Skip mermaid diagrams
 *   /docs generate --no-metrics   — Skip code quality metrics
 *   /docs status             — Show generation status
 */

import { logger } from '../../utils/logger.js';

export interface DocsCommandResult {
  output: string;
  success: boolean;
}

/**
 * Handle /docs command
 */
export async function handleDocsCommand(args: string): Promise<DocsCommandResult> {
  const parts = args.trim().split(/\s+/);
  const subcommand = parts[0] || 'generate';

  if (subcommand === 'status') {
    return handleStatus();
  }

  if (subcommand === 'generate') {
    const noDiagrams = parts.includes('--no-diagrams');
    const noMetrics = parts.includes('--no-metrics');
    const withLLM = parts.includes('--with-llm');

    if (withLLM) {
      return handleGenerateWithLLM();
    }
    return handleGenerate(noDiagrams, noMetrics);
  }

  return {
    output: 'Usage: /docs generate [--with-llm] [--no-diagrams] [--no-metrics] | /docs status',
    success: false,
  };
}

async function handleGenerate(noDiagrams: boolean, noMetrics: boolean): Promise<DocsCommandResult> {
  try {
    // Load and populate the graph
    const { getKnowledgeGraph } = await import('../../knowledge/knowledge-graph.js');
    const graph = getKnowledgeGraph();

    if (graph.getStats().tripleCount === 0) {
      // Try to populate the graph first
      try {
        const { populateDeepCodeGraph } = await import('../../knowledge/code-graph-deep-populator.js');
        const added = populateDeepCodeGraph(graph, process.cwd());
        logger.info(`Docs: populated code graph with ${added} triples`);
      } catch (e) {
        return {
          output: `Code graph is empty and could not be populated: ${e instanceof Error ? e.message : String(e)}. Run the code_graph tool first.`,
          success: false,
        };
      }
    }

    const { generateDocs } = await import('../../docs/docs-generator.js');
    const result = await generateDocs(graph, {
      includeDiagrams: !noDiagrams,
      includeMetrics: !noMetrics,
    });

    const output = [
      `Documentation generated in ${result.durationMs}ms:`,
      `  Files: ${result.files.join(', ')}`,
      `  Entities documented: ${result.entityCount}`,
      `  Output: .codebuddy/docs/`,
      result.errors.length > 0 ? `  Errors: ${result.errors.join('; ')}` : '',
    ].filter(Boolean).join('\n');

    return { output, success: true };
  } catch (err) {
    return {
      output: `Documentation generation failed: ${err instanceof Error ? err.message : String(err)}`,
      success: false,
    };
  }
}

async function handleGenerateWithLLM(): Promise<DocsCommandResult> {
  try {
    // Step 1: Generate raw docs first (fast, no LLM needed)
    const rawResult = await handleGenerate(false, false);
    if (!rawResult.success) return rawResult;

    // Step 2: Set up LLM client for enrichment (use OpenAI SDK directly for reliability)
    const apiKey = process.env.GROK_API_KEY || process.env.GOOGLE_API_KEY || process.env.OPENAI_API_KEY || '';
    if (!apiKey) {
      return {
        output: rawResult.output + '\n\n(LLM enrichment skipped — no API key. Set GROK_API_KEY, GOOGLE_API_KEY, or OPENAI_API_KEY.)',
        success: true,
      };
    }

    // Determine model and base URL
    let model = process.env.GROK_MODEL || 'grok-3-latest';
    let baseURL = process.env.GROK_BASE_URL || 'https://api.x.ai/v1';
    if (process.env.GOOGLE_API_KEY && !process.env.GROK_API_KEY) {
      model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
      baseURL = 'https://generativelanguage.googleapis.com/v1beta/openai/';
    }
    if (process.env.OPENAI_API_KEY && !process.env.GROK_API_KEY && !process.env.GOOGLE_API_KEY) {
      model = 'gpt-4o-mini';
      baseURL = 'https://api.openai.com/v1';
    }

    // Use OpenAI SDK directly (avoids CodeBuddyClient's native Gemini routing issue)
    const OpenAI = (await import('openai')).default;
    const openaiClient = new OpenAI({ apiKey, baseURL });

    const llmCall = async (systemPrompt: string, userPrompt: string): Promise<string> => {
      const response = await openaiClient.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 3000,
        temperature: 0.3,
      });
      return response.choices[0]?.message?.content ?? '';
    };

    // Step 3: Enrich raw docs with LLM prose
    const docsDir = require('path').join(process.cwd(), '.codebuddy', 'docs');
    const { enrichDocs } = await import('../../docs/llm-enricher.js');
    const result = await enrichDocs({
      docsDir,
      llmCall,
      onProgress: (file, current, total) => {
        logger.info(`Enriching [${current}/${total}] ${file}`);
      },
    });

    const output = [
      `Documentation generated and enriched with LLM:`,
      `  LLM enrichment: ${result.filesEnriched} files enriched in ${(result.durationMs / 1000).toFixed(1)}s`,
      `  Tokens used: ~${result.tokensUsed}`,
      `  Knowledge file: ${result.knowledgePath}`,
      `  Output: .codebuddy/docs/`,
      result.errors.length > 0 ? `  Errors: ${result.errors.join('; ')}` : '',
    ].filter(Boolean).join('\n');

    return { output, success: true };
  } catch (err) {
    return { output: `LLM docs generation failed: ${err instanceof Error ? err.message : String(err)}`, success: false };
  }
}

async function handleStatus(): Promise<DocsCommandResult> {
  const fs = await import('fs');
  const path = await import('path');
  const docsDir = path.join(process.cwd(), '.codebuddy', 'docs');

  if (!fs.existsSync(docsDir)) {
    return {
      output: 'No documentation generated yet. Run /docs generate first.',
      success: true,
    };
  }

  const files = fs.readdirSync(docsDir).filter((f: string) => f.endsWith('.md'));
  const totalSize = files.reduce((sum: number, f: string) => {
    return sum + fs.statSync(path.join(docsDir, f)).size;
  }, 0);

  return {
    output: [
      `Documentation directory: .codebuddy/docs/`,
      `Files: ${files.length}`,
      `Total size: ${(totalSize / 1024).toFixed(1)} KB`,
      `Files: ${files.join(', ')}`,
    ].join('\n'),
    success: true,
  };
}
