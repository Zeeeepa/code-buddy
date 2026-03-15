import { getKnowledgeGraph } from '../src/knowledge/knowledge-graph.js';
import { populateDeepCodeGraph } from '../src/knowledge/code-graph-deep-populator.js';
import { generateDocs } from '../src/docs/docs-generator.js';
import * as fs from 'fs';
import * as path from 'path';

const cwd = path.resolve(import.meta.dirname!, '..');
const graph = getKnowledgeGraph();
populateDeepCodeGraph(graph, cwd);
await generateDocs(graph, { cwd });

const api = fs.readFileSync(path.join(cwd, '.codebuddy/docs/9-api-reference.md'), 'utf-8');
console.log('=== API REF (CLI commands) ===');
console.log(api.substring(0, 3000));

const cfg = fs.readFileSync(path.join(cwd, '.codebuddy/docs/8-configuration.md'), 'utf-8');
const envIdx = cfg.indexOf('Environment Variables');
if (envIdx >= 0) {
  console.log('\n=== ENV VARS ===');
  console.log(cfg.substring(envIdx, envIdx + 1000));
}
