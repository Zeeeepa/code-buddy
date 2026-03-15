/**
 * Standalone docs generation + LLM enrichment runner.
 * Usage: npx tsx scripts/run-docs-gen.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

// Load .env
dotenv.config({ path: path.join(projectRoot, '.env') });

async function main() {
  const startTime = Date.now();
  console.log('=== Docs Generator V2 — DeepWiki Quality ===\n');

  // Step 1: Populate the code graph
  console.log('[1/4] Populating code graph...');
  const { getKnowledgeGraph } = await import('../src/knowledge/knowledge-graph.js');
  const graph = getKnowledgeGraph();

  if (graph.getStats().tripleCount === 0) {
    const { populateDeepCodeGraph } = await import('../src/knowledge/code-graph-deep-populator.js');
    const added = populateDeepCodeGraph(graph, projectRoot);
    console.log(`  → ${added} triples added`);
  } else {
    console.log(`  → Graph already populated: ${graph.getStats().tripleCount} triples`);
  }

  // Step 2: Generate raw docs
  console.log('\n[2/4] Generating raw documentation...');
  const { generateDocs } = await import('../src/docs/docs-generator.js');
  const rawResult = await generateDocs(graph, {
    cwd: projectRoot,
    includeDiagrams: true,
    includeMetrics: true,
  });
  console.log(`  → ${rawResult.files.length} files in ${rawResult.durationMs}ms`);
  console.log(`  → Files: ${rawResult.files.join(', ')}`);
  if (rawResult.errors.length > 0) {
    console.log(`  → Errors: ${rawResult.errors.join('; ')}`);
  }

  // Step 3: Build blueprint
  console.log('\n[3/4] Building project blueprint...');
  const { buildProjectBlueprint, serializeBlueprintForLLM } = await import('../src/docs/blueprint-builder.js');
  const blueprint = buildProjectBlueprint(graph);
  const blueprintContext = serializeBlueprintForLLM(blueprint);
  console.log(`  → ${blueprint.moduleCount} modules, ${blueprint.functionCount} functions, ${blueprint.classCount} classes`);

  // Step 4: LLM enrichment
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.log('\n[4/4] LLM enrichment SKIPPED — no GOOGLE_API_KEY');
    return;
  }

  console.log('\n[4/4] LLM enrichment with Gemini...');
  const model = 'gemini-3.1-flash-lite-preview';
  const geminiBaseURL = 'https://generativelanguage.googleapis.com/v1beta';

  console.log(`  Model: ${model} (thinking: high)`);

  const llmCall = async (systemPrompt: string, userPrompt: string, _thinkingLevel?: string): Promise<string> => {
    const generationConfig: Record<string, unknown> = {
      temperature: 0.2,
      maxOutputTokens: 8000,
      thinkingConfig: { thinkingLevel: 'high' },
    };

    const res = await fetch(
      `${geminiBaseURL}/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig,
        }),
      },
    );
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini ${res.status}: ${errText.substring(0, 300)}`);
    }
    const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    return data.candidates?.[0]?.content?.parts
      ?.filter((p: { text?: string }) => p.text)
      .map((p: { text?: string }) => p.text)
      .join('') ?? '';
  };

  const { enrichDocs } = await import('../src/docs/llm-enricher.js');
  const docsDir = path.join(projectRoot, '.codebuddy', 'docs');

  const enrichResult = await enrichDocs({
    docsDir,
    llmCall,
    cwd: projectRoot,
    blueprintContext,
    verifiedEntities: blueprint.allEntities,
    onProgress: (file, current, total) => {
      console.log(`  Enriching [${current}/${total}] ${file}`);
    },
  });

  const totalMs = Date.now() - startTime;
  console.log(`\n=== Done in ${(totalMs / 1000).toFixed(1)}s ===`);
  console.log(`  Files enriched: ${enrichResult.filesEnriched}`);
  console.log(`  Tokens used: ~${enrichResult.tokensUsed}`);
  console.log(`  Hallucinations fixed: ${enrichResult.hallucinationsFixed}`);
  if (enrichResult.errors.length > 0) {
    console.log(`  Errors: ${enrichResult.errors.join('; ')}`);
  }
  console.log(`  Output: .codebuddy/docs/`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
