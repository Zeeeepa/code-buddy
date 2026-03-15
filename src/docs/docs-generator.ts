/**
 * Documentation Generator — DeepWiki-style
 *
 * Generates a full markdown documentation site from the codebase,
 * using the code graph, mermaid diagrams, community detection,
 * impact analysis, and static analysis.
 *
 * Output: .codebuddy/docs/ with structured markdown files.
 *
 * Sections:
 *   1-overview.md       — Project overview, tech stack, entry points
 *   2-architecture.md   — Architecture diagram, layers, core components
 *   3-tools.md          — Tool registry, categories, metadata
 *   4-security.md       — Security layers, policies, validation
 *   5-context.md        — Context management, compression, memory
 *   6-subsystems.md     — Per-subsystem pages with call graphs
 *   7-api.md            — API endpoints, WebSocket, CLI commands
 *   8-metrics.md        — Code quality metrics, coupling, dead code
 *   index.md            — Table of contents with links
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger.js';
import { KnowledgeGraph } from '../knowledge/knowledge-graph.js';

// ============================================================================
// Types
// ============================================================================

export interface DocsGeneratorOptions {
  /** Project root directory */
  cwd?: string;
  /** Output directory (default: .codebuddy/docs/) */
  outputDir?: string;
  /** Include mermaid diagrams */
  includeDiagrams?: boolean;
  /** Include code metrics (dead code, coupling) */
  includeMetrics?: boolean;
  /** Maximum files to scan */
  maxFiles?: number;
}

export interface DocsGeneratorResult {
  /** Files generated */
  files: string[];
  /** Total generation time (ms) */
  durationMs: number;
  /** Number of entities documented */
  entityCount: number;
  /** Errors encountered */
  errors: string[];
}

// ============================================================================
// Documentation Generator
// ============================================================================

export async function generateDocs(
  graph: KnowledgeGraph,
  options: DocsGeneratorOptions = {},
): Promise<DocsGeneratorResult> {
  const startTime = Date.now();
  const cwd = options.cwd ?? process.cwd();
  const outputDir = options.outputDir ?? path.join(cwd, '.codebuddy', 'docs');
  const includeDiagrams = options.includeDiagrams ?? true;
  const includeMetrics = options.includeMetrics ?? true;

  const files: string[] = [];
  const errors: string[] = [];

  // Ensure output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const stats = graph.getStats();
  logger.info(`Docs generator: ${stats.tripleCount} triples, ${stats.subjectCount} entities`);

  // Collect graph data
  const allTriples = graph.toJSON();
  const modules = new Set<string>();
  const classes = new Set<string>();
  const functions = new Set<string>();

  for (const t of allTriples) {
    if (t.subject.startsWith('mod:')) modules.add(t.subject);
    if (t.object.startsWith('mod:')) modules.add(t.object);
    if (t.subject.startsWith('cls:')) classes.add(t.subject);
    if (t.subject.startsWith('fn:')) functions.add(t.subject);
    if (t.object.startsWith('fn:')) functions.add(t.object);
  }

  // ========================================================================
  // 1. Overview
  // ========================================================================
  try {
    const overview = generateOverview(graph, cwd, modules, classes, functions);
    const overviewPath = path.join(outputDir, '1-overview.md');
    fs.writeFileSync(overviewPath, overview);
    files.push('1-overview.md');
  } catch (e) { errors.push(`overview: ${e}`); }

  // ========================================================================
  // 2. Architecture
  // ========================================================================
  try {
    const arch = await generateArchitecture(graph, modules, includeDiagrams);
    const archPath = path.join(outputDir, '2-architecture.md');
    fs.writeFileSync(archPath, arch);
    files.push('2-architecture.md');
  } catch (e) { errors.push(`architecture: ${e}`); }

  // ========================================================================
  // 3. Subsystems (per-community)
  // ========================================================================
  try {
    const subsystems = await generateSubsystems(graph, modules, includeDiagrams);
    const subPath = path.join(outputDir, '3-subsystems.md');
    fs.writeFileSync(subPath, subsystems);
    files.push('3-subsystems.md');
  } catch (e) { errors.push(`subsystems: ${e}`); }

  // ========================================================================
  // 4. Metrics
  // ========================================================================
  if (includeMetrics) {
    try {
      const metrics = await generateMetrics(graph);
      const metricsPath = path.join(outputDir, '4-metrics.md');
      fs.writeFileSync(metricsPath, metrics);
      files.push('4-metrics.md');
    } catch (e) { errors.push(`metrics: ${e}`); }
  }

  // ========================================================================
  // 5. Tool System
  // ========================================================================
  try {
    const tools = generateToolSystem(graph, cwd, modules);
    fs.writeFileSync(path.join(outputDir, '5-tools.md'), tools);
    files.push('5-tools.md');
  } catch (e) { errors.push(`tools: ${e}`); }

  // ========================================================================
  // 6. Security Architecture
  // ========================================================================
  try {
    const security = generateSecurity(cwd);
    fs.writeFileSync(path.join(outputDir, '6-security.md'), security);
    files.push('6-security.md');
  } catch (e) { errors.push(`security: ${e}`); }

  // ========================================================================
  // 7. Context & Memory
  // ========================================================================
  try {
    const context = generateContextMemory(cwd);
    fs.writeFileSync(path.join(outputDir, '7-context-memory.md'), context);
    files.push('7-context-memory.md');
  } catch (e) { errors.push(`context: ${e}`); }

  // ========================================================================
  // 8. Configuration
  // ========================================================================
  try {
    const config = generateConfiguration(cwd);
    fs.writeFileSync(path.join(outputDir, '8-configuration.md'), config);
    files.push('8-configuration.md');
  } catch (e) { errors.push(`config: ${e}`); }

  // ========================================================================
  // 9. CLI & API Reference
  // ========================================================================
  try {
    const api = generateApiReference(cwd);
    fs.writeFileSync(path.join(outputDir, '9-api-reference.md'), api);
    files.push('9-api-reference.md');
  } catch (e) { errors.push(`api: ${e}`); }

  // ========================================================================
  // 10. Development Guide
  // ========================================================================
  try {
    const dev = generateDevGuide(cwd);
    fs.writeFileSync(path.join(outputDir, '10-development.md'), dev);
    files.push('10-development.md');
  } catch (e) { errors.push(`dev: ${e}`); }

  // ========================================================================
  // 11. Changelog (from git)
  // ========================================================================
  try {
    const changelog = generateChangelog(cwd);
    fs.writeFileSync(path.join(outputDir, '11-changelog.md'), changelog);
    files.push('11-changelog.md');
  } catch (e) { errors.push(`changelog: ${e}`); }

  // ========================================================================
  // Index (table of contents)
  // ========================================================================
  try {
    const index = generateIndex(files, stats, modules.size, classes.size, functions.size);
    const indexPath = path.join(outputDir, 'index.md');
    fs.writeFileSync(indexPath, index);
    files.push('index.md');
  } catch (e) { errors.push(`index: ${e}`); }

  const result: DocsGeneratorResult = {
    files,
    durationMs: Date.now() - startTime,
    entityCount: modules.size + classes.size + functions.size,
    errors,
  };

  logger.info(`Docs generated: ${files.length} files in ${result.durationMs}ms, ${result.entityCount} entities`);
  return result;
}

// ============================================================================
// Section Generators
// ============================================================================

/** Read a file safely, returning empty string on failure. Exported for llm-docs-generator. */
export function readFileSafe(filePath: string, maxChars: number = 5000): string {
  try {
    if (!fs.existsSync(filePath)) return '';
    return fs.readFileSync(filePath, 'utf-8').substring(0, maxChars);
  } catch { return ''; }
}

function readPkg(cwd: string): Record<string, unknown> {
  try {
    return JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf-8'));
  } catch { return {}; }
}

function generateOverview(
  graph: KnowledgeGraph,
  cwd: string,
  modules: Set<string>,
  classes: Set<string>,
  functions: Set<string>,
): string {
  const pkg = readPkg(cwd);
  const projectName = (pkg.name as string) ?? path.basename(cwd);
  const version = (pkg.version as string) ?? '0.0.0';
  const description = (pkg.description as string) ?? '';
  const stats = graph.getStats();
  const deps = Object.keys((pkg.dependencies ?? {}) as Record<string, string>);
  const devDeps = Object.keys((pkg.devDependencies ?? {}) as Record<string, string>);

  // Find top-ranked entities
  const topEntities: Array<{ entity: string; rank: number; importers: number; callers: number }> = [];
  for (const mod of modules) {
    topEntities.push({
      entity: mod,
      rank: graph.getEntityRank(mod),
      importers: graph.query({ predicate: 'imports', object: mod }).length,
      callers: graph.query({ predicate: 'calls', object: mod }).length,
    });
  }
  topEntities.sort((a, b) => b.rank - a.rank);

  // Classify entry points (real ones, not all index files)
  const mainEntries = ['src/index', 'src/server/index', 'src/daemon/index'];
  const entryPoints = topEntities.filter(e => {
    const name = e.entity.replace(/^mod:/, '');
    return mainEntries.some(m => name === m) || (name.endsWith('index') && e.importers >= 3);
  }).slice(0, 10);

  // Detect key capabilities from module names
  const capabilities: string[] = [];
  const modNames = [...modules].map(m => m.replace(/^mod:/, ''));
  if (modNames.some(m => m.includes('channel'))) capabilities.push('Multi-channel messaging (Telegram, Discord, Slack, WhatsApp, etc.)');
  if (modNames.some(m => m.includes('daemon'))) capabilities.push('Background daemon with health monitoring');
  if (modNames.some(m => m.includes('voice') || m.includes('tts'))) capabilities.push('Voice interaction with wake-word activation');
  if (modNames.some(m => m.includes('sandbox') || m.includes('docker'))) capabilities.push('Sandboxed execution (Docker, OS-level)');
  if (modNames.some(m => m.includes('reasoning') || m.includes('mcts'))) capabilities.push('Advanced reasoning (Tree-of-Thought, MCTS)');
  if (modNames.some(m => m.includes('knowledge-graph'))) capabilities.push(`Code graph analysis (${stats.tripleCount} relationships)`);
  if (modNames.some(m => m.includes('repair'))) capabilities.push('Automated program repair (fault localization + LLM)');
  if (modNames.some(m => m.includes('a2a'))) capabilities.push('Agent-to-Agent protocol (Google A2A spec)');
  if (modNames.some(m => m.includes('workflow'))) capabilities.push('Workflow engine with DAG execution');
  if (modNames.some(m => m.includes('deploy'))) capabilities.push('Cloud deployment (Fly.io, Railway, Render, GCP)');

  const lines = [
    `# ${projectName} v${version}`,
    '',
    description ? `> ${description}` : `> Auto-generated documentation from ${stats.tripleCount} code relationships`,
    '',
    `${projectName} is a terminal-based AI coding agent built in TypeScript/Node.js. It supports multiple LLM providers with automatic failover and provides ${functions.size.toLocaleString()} functions across ${modules.size} modules.`,
    '',
    '## Key Capabilities',
    '',
    ...capabilities.map(c => `- ${c}`),
    '',
    '## Project Statistics',
    '',
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Version | ${version} |`,
    `| Modules | ${modules.size} |`,
    `| Classes | ${classes.size} |`,
    `| Functions | ${functions.size.toLocaleString()} |`,
    `| Code Relationships | ${stats.tripleCount.toLocaleString()} |`,
    `| Dependencies | ${deps.length} |`,
    `| Dev Dependencies | ${devDeps.length} |`,
    '',
    '## Core Modules (by architectural importance)',
    '',
    'Ranked by PageRank — higher rank means more modules depend on this one:',
    '',
    `| Module | PageRank | Importers | Description |`,
    `|--------|----------|-----------|-------------|`,
  ];

  for (const { entity, rank, importers } of topEntities.slice(0, 20)) {
    const name = entity.replace(/^mod:/, '');
    const desc = inferModuleDescription(name);
    lines.push(`| \`${name}\` | ${rank.toFixed(3)} | ${importers} | ${desc} |`);
  }

  lines.push('', '## Entry Points', '');
  for (const entry of entryPoints) {
    const name = entry.entity.replace(/^mod:/, '');
    lines.push(`- **\`${name}\`** — ${inferModuleDescription(name)} (${entry.importers} dependents)`);
  }

  // Technology stack
  const coreDeps = deps.filter(d => ['commander', 'openai', 'express', 'ink', 'react', 'better-sqlite3', 'zod'].includes(d));
  if (coreDeps.length > 0) {
    lines.push('', '## Technology Stack', '');
    lines.push('| Category | Technologies |', '|----------|-------------|');
    lines.push(`| CLI Framework | commander |`);
    if (deps.includes('ink')) lines.push(`| Terminal UI | ink, react |`);
    const llmSdks = deps.filter(d => ['openai', '@anthropic-ai/sdk', '@google/generative-ai'].includes(d));
    if (llmSdks.length > 0) lines.push(`| LLM SDKs | ${llmSdks.join(', ')} |`);
    if (deps.includes('express')) lines.push(`| HTTP Server | express, ws, cors |`);
    if (deps.includes('better-sqlite3')) lines.push(`| Database | better-sqlite3 |`);
    if (deps.includes('zod')) lines.push(`| Validation | zod |`);
    if (deps.includes('playwright')) lines.push(`| Browser Automation | playwright |`);
  }

  return lines.join('\n');
}

/** Infer a human-readable description from a module path */
function inferModuleDescription(modulePath: string): string {
  const parts = modulePath.split('/');
  const descMap: Record<string, string> = {
    'agent': 'Core agent system',
    'codebuddy': 'LLM client and tool definitions',
    'tools': 'Tool implementations',
    'security': 'Security and validation',
    'context': 'Context window management',
    'channels': 'Messaging channel integrations',
    'knowledge': 'Code analysis and knowledge graph',
    'server': 'HTTP/WebSocket server',
    'daemon': 'Background daemon service',
    'config': 'Configuration management',
    'memory': 'Memory and persistence',
    'middleware': 'Middleware pipeline',
    'deploy': 'Cloud deployment',
    'skills': 'Skill registry and marketplace',
    'workflows': 'Workflow DAG engine',
    'observability': 'Logging, metrics, tracing',
    'sandbox': 'Execution sandboxing',
    'voice': 'Voice and TTS',
    'reasoning': 'Advanced reasoning (ToT, MCTS)',
    'repair': 'Automated program repair',
    'protocols': 'Agent protocols (A2A)',
    'search': 'Search and indexing',
    'ui': 'Terminal UI components',
    'commands': 'CLI and slash commands',
    'checkpoints': 'Undo and snapshots',
  };
  for (const part of parts) {
    if (descMap[part]) return descMap[part];
  }
  // Derive from last segment
  const last = parts[parts.length - 1];
  return last.replace(/-/g, ' ').replace(/([A-Z])/g, ' $1').trim();
}

async function generateArchitecture(
  graph: KnowledgeGraph,
  modules: Set<string>,
  includeDiagrams: boolean,
): Promise<string> {
  const lines = [
    '# Architecture',
    '',
    'The project follows a layered architecture with a central agent orchestrator coordinating all interactions between user interfaces, LLM providers, tools, and infrastructure services.',
    '',
  ];

  // Generate high-level layer diagram
  lines.push('## System Layers', '', '```mermaid', 'graph TD');
  lines.push('  UI["User Interfaces<br/>CLI, Chat UI, WebSocket, Voice, Channels"]');
  lines.push('  AGENT["Core Agent<br/>CodeBuddyAgent → AgentExecutor"]');
  lines.push('  TOOLS["Tool Ecosystem<br/>110+ tools, RAG selection"]');
  lines.push('  CTX["Context & Memory<br/>Compression, Lessons, Knowledge Graph"]');
  lines.push('  INFRA["Infrastructure<br/>Daemon, Sandbox, Config, MCP"]');
  lines.push('  SEC["Security<br/>Path validation, SSRF guard, Confirmation"]');
  lines.push('  UI --> AGENT');
  lines.push('  AGENT --> TOOLS');
  lines.push('  AGENT --> CTX');
  lines.push('  TOOLS --> INFRA');
  lines.push('  TOOLS --> SEC');
  lines.push('  CTX --> INFRA');
  lines.push('```', '');

  if (includeDiagrams) {
    try {
      const { generateModuleDependencies } = await import('../knowledge/mermaid-generator.js');
      let bestMod = '';
      let bestConns = 0;
      for (const mod of modules) {
        const conns = graph.query({ subject: mod }).length + graph.query({ object: mod }).length;
        if (conns > bestConns) { bestConns = conns; bestMod = mod; }
      }
      if (bestMod) {
        lines.push('## Core Module Dependencies', '');
        const diagram = generateModuleDependencies(graph, bestMod, 2, 30);
        lines.push('```mermaid', diagram, '```', '');
      }
    } catch { /* mermaid optional */ }
  }

  // Layer analysis with descriptions
  const layerDescriptions: Record<string, string> = {
    'src/agent': 'Core agent system — orchestrator, executor, middleware, reasoning, multi-agent coordination',
    'src/tools': 'Tool implementations — file editing, bash, search, web, planning, media',
    'src/codebuddy': 'LLM client abstraction — multi-provider support, tool definitions, streaming',
    'src/context': 'Context management — compression, sliding window, JIT discovery, tool masking',
    'src/security': 'Security layer — path validation, SSRF guard, shell policy, guardian agent',
    'src/channels': 'Messaging channels — Telegram, Discord, Slack, WhatsApp, 15+ platforms',
    'src/server': 'HTTP/WebSocket server — REST API, real-time streaming, authentication',
    'src/knowledge': 'Knowledge graph — code analysis, PageRank, community detection, impact analysis',
    'src/commands': 'Command system — CLI commands, slash commands, dev workflows',
    'src/config': 'Configuration — TOML config, model settings, hot-reload',
    'src/memory': 'Memory — persistent memory, ICM bridge, decision memory, consolidation',
    'src/daemon': 'Background daemon — health monitoring, cron, heartbeat',
    'src/ui': 'Terminal UI — Ink/React components, themes, chat interface',
    'src/skills': 'Skills — registry, marketplace, SKILL.md loading',
    'src/workflows': 'Workflows — DAG engine, approval gates, variable resolution',
    'src/observability': 'Observability — run store, OpenTelemetry, Sentry, tool metrics',
    'src/deploy': 'Deployment — Fly.io, Railway, Render, Hetzner, GCP, Nix',
    'src/sandbox': 'Sandboxing — Docker containers, OS-level isolation',
  };

  const layers = new Map<string, string[]>();
  for (const mod of modules) {
    const name = mod.replace(/^mod:/, '');
    const parts = name.split('/');
    const layer = parts.length >= 2 ? `${parts[0]}/${parts[1]}` : parts[0];
    const list = layers.get(layer) ?? [];
    list.push(name);
    layers.set(layer, list);
  }

  lines.push('## Layer Breakdown', '');
  lines.push('| Layer | Modules | Description |', '|-------|---------|-------------|');
  const sortedLayers = [...layers.entries()].sort((a, b) => b[1].length - a[1].length);
  for (const [layer, mods] of sortedLayers.slice(0, 25)) {
    const desc = layerDescriptions[layer] ?? inferModuleDescription(layer);
    lines.push(`| \`${layer}/\` | ${mods.length} | ${desc} |`);
  }
  lines.push('');

  // Core flow
  lines.push('## Core Agent Flow', '');
  lines.push('```');
  lines.push('User Input → CLI/Chat/Voice/Channel');
  lines.push('  → CodeBuddyAgent.processUserMessage()');
  lines.push('    → AgentExecutor (ReAct loop)');
  lines.push('      1. RAG Tool Selection (~15 from 110+)');
  lines.push('      2. Context Injection (lessons, decisions, graph)');
  lines.push('      3. Middleware Before-Turn (cost, turn limit, reasoning)');
  lines.push('      4. LLM Call (multi-provider)');
  lines.push('      5. Tool Execution (parallel read / serial write)');
  lines.push('      6. Result Processing (masking, TTL, compaction)');
  lines.push('      7. Middleware After-Turn (auto-repair, metrics)');
  lines.push('      8. Loop or Return');
  lines.push('```');
  lines.push('');

  return lines.join('\n');
}

async function generateSubsystems(
  graph: KnowledgeGraph,
  modules: Set<string>,
  includeDiagrams: boolean,
): Promise<string> {
  const lines = [
    '# Subsystems',
    '',
  ];

  // Detect communities
  try {
    const { detectCommunities } = await import('../knowledge/community-detection.js');
    const communities = detectCommunities(graph);

    lines.push(`Detected **${communities.communitySizes.size}** architectural subsystems (modularity: ${communities.modularity.toFixed(3)})`, '');

    // Document each community
    for (const [communityId, members] of communities.communityMembers) {
      if (members.length < 2) continue;

      const shortNames = members.map(m => m.replace(/^mod:/, ''));
      const commonPrefix = findCommonPrefix(shortNames);
      const label = commonPrefix || `Cluster ${communityId}`;

      lines.push(`## ${label} (${members.length} modules)`, '');

      // List members with PageRank
      const ranked = members
        .map(m => ({ name: m.replace(/^mod:/, ''), rank: graph.getEntityRank(m) }))
        .sort((a, b) => b.rank - a.rank);

      for (const { name, rank } of ranked.slice(0, 10)) {
        const fns = graph.query({ subject: `mod:${name}`, predicate: 'containsFunction' });
        lines.push(`- **${name}** (rank: ${rank.toFixed(3)}, ${fns.length} functions)`);
      }
      if (ranked.length > 10) lines.push(`- ... and ${ranked.length - 10} more`);

      // Class hierarchy for this community
      if (includeDiagrams && ranked.length > 0) {
        try {
          const { generateCallFlowchart } = await import('../knowledge/mermaid-generator.js');
          const topEntity = `mod:${ranked[0].name}`;
          const fns = graph.query({ subject: topEntity, predicate: 'containsFunction' });
          if (fns.length > 0) {
            const chart = generateCallFlowchart(graph, fns[0].object, 1, 15);
            if (chart.includes('-->')) {
              lines.push('', '```mermaid', chart, '```');
            }
          }
        } catch { /* diagram optional */ }
      }

      lines.push('');
    }

    // Community interaction diagram
    if (includeDiagrams) {
      try {
        const { generateCommunityDiagram } = await import('../knowledge/mermaid-generator.js');
        const communityChart = generateCommunityDiagram(graph, communities, 8);
        if (communityChart.includes('-->')) {
          lines.push('## Community Interactions', '', '```mermaid', communityChart, '```', '');
        }
      } catch { /* optional */ }
    }
  } catch {
    lines.push('*Community detection not available.*', '');
  }

  return lines.join('\n');
}

async function generateMetrics(graph: KnowledgeGraph): Promise<string> {
  const lines = [
    '# Code Quality Metrics',
    '',
  ];

  // Dead code detection
  try {
    const { detectDeadCode } = await import('../knowledge/graph-analytics.js');
    const deadCode = detectDeadCode(graph);

    lines.push('## Dead Code Analysis', '');
    lines.push(`| Confidence | Count |`, `|---|---|`);
    lines.push(`| High | ${deadCode.byConfidence.high.length} |`);
    lines.push(`| Medium | ${deadCode.byConfidence.medium.length} |`);
    lines.push(`| Low | ${deadCode.byConfidence.low.length} |`);
    lines.push(`| **Total** | **${deadCode.totalDead}** |`);
    lines.push('');

    if (deadCode.uncalledFunctions.length > 0) {
      lines.push('### Top Dead Code Candidates', '');
      for (const fn of deadCode.byConfidence.high.slice(0, 15)) {
        lines.push(`- \`${fn}\` (high confidence)`);
      }
      for (const fn of deadCode.byConfidence.medium.slice(0, 5)) {
        lines.push(`- \`${fn}\` (medium confidence)`);
      }
      lines.push('');
    }
  } catch { lines.push('*Dead code analysis not available.*', ''); }

  // Coupling analysis
  try {
    const { computeCoupling } = await import('../knowledge/graph-analytics.js');
    const coupling = computeCoupling(graph, 15);

    lines.push('## Module Coupling', '');
    lines.push(`| Module A | Module B | Calls | Imports | Total |`, `|---|---|---|---|---|`);
    for (const pair of coupling.hotspots.slice(0, 15)) {
      const a = pair.moduleA.replace(/^mod:/, '');
      const b = pair.moduleB.replace(/^mod:/, '');
      lines.push(`| ${a} | ${b} | ${pair.calls} | ${pair.imports} | ${pair.total} |`);
    }
    if (coupling.mostDependentModule) {
      lines.push('', `Most dependent module: \`${coupling.mostDependentModule.replace(/^mod:/, '')}\``);
    }
    if (coupling.mostDependendUponModule) {
      lines.push(`Most depended-upon: \`${coupling.mostDependendUponModule.replace(/^mod:/, '')}\``);
    }
    lines.push('');
  } catch { lines.push('*Coupling analysis not available.*', ''); }

  // Refactoring suggestions
  try {
    const { suggestRefactoring } = await import('../knowledge/graph-analytics.js');
    const suggestions = suggestRefactoring(graph);

    if (suggestions.length > 0) {
      lines.push('## Refactoring Suggestions', '');
      for (const s of suggestions.slice(0, 10)) {
        lines.push(`- **${s.entity.replace(/^(mod|fn|cls):/, '')}**: ${s.reason} (rank: ${s.pageRank.toFixed(3)}, ${s.totalCallers} callers, ${s.crossCommunityCallers} cross-community)`);
      }
      lines.push('');
    }
  } catch { /* optional */ }

  return lines.join('\n');
}

// ============================================================================
// Section 5: Tool System
// ============================================================================

function generateToolSystem(graph: KnowledgeGraph, cwd: string, modules: Set<string>): string {
  const lines = [
    '# Tool System',
    '',
    'The project uses a dual-registry tool architecture with RAG-based selection. Tools are organized by category and selected per-query based on semantic relevance.',
    '',
  ];

  // Detect tool-related modules
  const toolModules = [...modules]
    .filter(m => m.includes('/tools/'))
    .map(m => m.replace(/^mod:/, ''));

  lines.push('## Tool Registry', '');
  lines.push(`The tool ecosystem contains **${toolModules.length}** tool modules organized in \`src/tools/\` and \`src/tools/registry/\`.`, '');

  // Categorize tools by subdirectory
  const categories = new Map<string, string[]>();
  for (const mod of toolModules) {
    const parts = mod.split('/');
    const cat = parts.length >= 3 ? parts[2] : 'core';
    const list = categories.get(cat) ?? [];
    list.push(mod);
    categories.set(cat, list);
  }

  lines.push('## Tool Categories', '');
  lines.push('| Category | Tools | Key Modules |', '|----------|-------|-------------|');
  const categoryDescriptions: Record<string, string> = {
    'registry': 'Tool registration and factory',
    'browser': 'Browser automation (Playwright)',
    'vision': 'Image processing and OCR',
    'hooks': 'Pre/post execution hooks',
  };

  for (const [cat, mods] of [...categories.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 15)) {
    const desc = categoryDescriptions[cat] ?? cat.replace(/-/g, ' ');
    const keyMods = mods.slice(0, 3).map(m => `\`${m.split('/').pop()}\``).join(', ');
    lines.push(`| ${desc} | ${mods.length} | ${keyMods} |`);
  }

  // Tool selection process
  lines.push('', '## RAG-Based Tool Selection', '');
  lines.push('Each user query triggers a semantic similarity search over tool metadata:');
  lines.push('');
  lines.push('1. **Query embedding** — User message converted to vector');
  lines.push('2. **Similarity scoring** — Each tool scored against query (0-1)');
  lines.push('3. **Top-K selection** — ~15-20 most relevant tools selected');
  lines.push('4. **Token savings** — Reduces prompt from 110+ tools to ~15-20');
  lines.push('');
  lines.push('Tools have priority (3-10), keywords, and category metadata used for matching.');

  // Read metadata file for tool names
  const metadataContent = readFileSafe(path.join(cwd, 'src', 'tools', 'metadata.ts'), 8000);
  if (metadataContent) {
    const toolNames = [...metadataContent.matchAll(/name:\s*['"]([^'"]+)['"]/g)].map(m => m[1]);
    if (toolNames.length > 0) {
      lines.push('', '## Registered Tools', '');
      lines.push(`${toolNames.length} tools registered in metadata:`, '');
      // Group by prefix
      const grouped = new Map<string, string[]>();
      for (const name of toolNames) {
        const prefix = name.split('_')[0] ?? 'other';
        const list = grouped.get(prefix) ?? [];
        list.push(name);
        grouped.set(prefix, list);
      }
      for (const [prefix, names] of [...grouped.entries()].sort()) {
        lines.push(`- **${prefix}**: ${names.join(', ')}`);
      }
    }
  }

  return lines.join('\n');
}

// ============================================================================
// Section 6: Security Architecture
// ============================================================================

function generateSecurity(_cwd: string): string {
  const lines = [
    '# Security Architecture',
    '',
    'The project implements a seven-layer defense-in-depth security model. Each layer catches different attack vectors, ensuring that a bypass in one layer is caught by another.',
    '',
    '## Security Layers',
    '',
    '| Layer | Component | Purpose |',
    '|-------|-----------|---------|',
    '| 1. Input Validation | Schema checking, sanitization | Prevents malformed data |',
    '| 2. Authentication | JWT, API keys, DM pairing | Prevents unauthorized access |',
    '| 3. Path Validation | Traversal detection, symlink escape | Prevents filesystem attacks |',
    '| 4. Command Validation | Tree-sitter bash parsing | Prevents command injection |',
    '| 5. Network Protection | SSRF guard, IP filtering | Prevents server-side request forgery |',
    '| 6. Execution Control | Confirmation, sandbox, policies | User approval gate |',
    '| 7. Post-Execution | Result sanitization, audit logging | Prevents data leakage |',
    '',
  ];

  // Guardian agent
  lines.push('## Guardian Sub-Agent', '');
  lines.push('An AI-powered automatic approval reviewer (`src/security/guardian-agent.ts`) evaluates tool calls with structured risk scoring:');
  lines.push('');
  lines.push('| Risk Score | Decision | Examples |');
  lines.push('|-----------|----------|----------|');
  lines.push('| 0-20 | Auto-approve | Read operations, standard builds |');
  lines.push('| 20-60 | Auto-approve | File edits, package installs |');
  lines.push('| 60-80 | Approve with warning | System modifications, network ops |');
  lines.push('| 80-90 | Prompt user | Credential access, unknown scripts |');
  lines.push('| 90-100 | Deny | `rm -rf /`, fork bombs, `drop database` |');
  lines.push('');

  // Environment variable filtering
  lines.push('## Environment Variable Filtering', '');
  lines.push('Shell commands run in a filtered environment (`src/security/shell-env-policy.ts`):');
  lines.push('');
  lines.push('- Variables matching `*KEY*`, `*SECRET*`, `*TOKEN*`, `*PASSWORD*` are stripped');
  lines.push('- Three inheritance modes: `core` (minimal), `all` (filtered), `none` (empty)');
  lines.push('- Provider-specific patterns: `AWS_*`, `OPENAI_*`, `STRIPE_*`, etc.');
  lines.push('');

  // Policy amendments
  lines.push('## Policy Amendments', '');
  lines.push('When a command is blocked, the system suggests an allow rule (`src/security/policy-amendments.ts`):');
  lines.push('');
  lines.push('- Rules stored in `.codebuddy/rules/allow-rules.json`');
  lines.push('- Shell operators (`&&`, `||`, `;`, `|`) after the matched prefix are blocked');
  lines.push('- Banned prefixes: interpreters (python, node), shells (bash, sh), `sudo`, `curl`');

  return lines.join('\n');
}

// ============================================================================
// Section 7: Context & Memory
// ============================================================================

function generateContextMemory(_cwd: string): string {
  const lines = [
    '# Context & Memory Management',
    '',
    'The context management system ensures conversations stay within the LLM\'s token limit while preserving the most important information.',
    '',
    '## Context Manager V2', '',
    'Four-stage compression pipeline (`src/context/context-manager-v2.ts`):', '',
    '| Stage | Strategy | Token Reduction |',
    '|-------|----------|----------------|',
    '| 1 | Sliding window with importance scoring | 30-50% |',
    '| 2 | Tool result truncation | 10-30% |',
    '| 3 | LLM-based summarization | 40-70% |',
    '| 4 | Hard truncation (last resort) | 70-90% |',
    '',
    'Importance scores by content type:', '',
    '| Content Type | Score | Preservation |',
    '|-------------|-------|-------------|',
    '| Error messages | 0.95 | Nearly always preserved |',
    '| Architectural decisions | 0.90 | High priority |',
    '| Code blocks | 0.70 | Medium-high |',
    '| General conversation | 0.25 | First to compress |',
    '',
    '## Attention Bias Patterns', '',
    '- **Todo.md**: Appended at END of context (transformer recency bias)',
    '- **Lessons.md**: Injected BEFORE messages (high priority)',
    '- **Decision memory**: Injected with architectural rationale',
    '- **Code graph**: Per-turn ego-graph of mentioned entities',
    '',
    '## Tool Output Management', '',
    '**Adaptive compaction**: Threshold scales to 30% of model context window (not hardcoded).', '',
    '**TTL-based expiry** (`src/context/tool-output-masking.ts`):', '',
    '| Age (% of max) | Treatment |',
    '|----------------|-----------|',
    '| 0-50% | Full content preserved |',
    '| 50-75% | Head/tail preview (10+10 lines) |',
    '| 75-100% | One-line stub |',
    '| >100% | Removed entirely |',
    '',
    '**Backward-scanned FIFO masking**: Newest ~50K tokens protected, older outputs replaced with previews.', '',
    '## JIT Context Discovery', '',
    'When tools access files, the system dynamically loads context files (`CODEBUDDY.md`, `CONTEXT.md`) from the accessed subdirectory. Context grows organically as the agent explores.', '',
    '## Memory Consolidation', '',
    'Two-phase pipeline (`src/memory/memory-consolidation.ts`):', '',
    '1. **Extraction**: Detect preferences, patterns, corrections from user messages',
    '2. **Consolidation**: Merge into `.codebuddy/memory/` folder with dedup',
    '',
    'Output structure:', '',
    '- `memory_summary.md` — Always loaded into system prompt',
    '- `MEMORY.md` — Full handbook entries',
    '- `rollout_summaries/` — Per-session distilled summaries',
  ];

  return lines.join('\n');
}

// ============================================================================
// Section 8: Configuration
// ============================================================================

function generateConfiguration(cwd: string): string {
  const claudeMd = readFileSafe(path.join(cwd, 'CLAUDE.md'), 2000);
  // Extract env vars from CLAUDE.md
  const envVars: Array<{ name: string; desc: string }> = [];
  if (claudeMd) {
    const envMatch = claudeMd.matchAll(/\|\s*`(\w+)`\s*\|\s*([^|]+)\|/g);
    for (const m of envMatch) {
      envVars.push({ name: m[1], desc: m[2].trim() });
    }
  }

  const lines = [
    '# Configuration System',
    '',
    'Three-tier configuration hierarchy with environment variable overrides:',
    '',
    '## Configuration Hierarchy',
    '',
    '```',
    '1. Default (in-code)     — Base behavior',
    '2. User (~/.codebuddy/)  — Personal preferences',
    '3. Project (.codebuddy/) — Project-specific settings',
    '4. Environment variables — Runtime overrides',
    '5. CLI flags             — Highest priority',
    '```',
    '',
    '## Key Configuration Files',
    '',
    '| File | Location | Purpose |',
    '|------|----------|---------|',
    '| `config.toml` | `~/.codebuddy/` or `.codebuddy/` | Main configuration |',
    '| `settings.json` | `.codebuddy/` | Model, theme, max rounds |',
    '| `mcp.json` | `.codebuddy/` | MCP server configuration |',
    '| `hooks.json` | `.codebuddy/` | Tool execution hooks |',
    '| `CODEBUDDY.md` | `.codebuddy/` | Project instructions |',
    '| `CONTEXT.md` | `.codebuddy/` | Additional context |',
    '| `PROJECT_KNOWLEDGE.md` | `.codebuddy/` | Auto-generated project knowledge |',
    '',
  ];

  if (envVars.length > 0) {
    lines.push('## Environment Variables', '');
    lines.push('| Variable | Description |', '|----------|-------------|');
    for (const { name, desc } of envVars.slice(0, 20)) {
      lines.push(`| \`${name}\` | ${desc} |`);
    }
    lines.push('');
  }

  lines.push('## Model Configuration', '');
  lines.push('Models configured via `src/config/model-tools.ts` with glob matching:');
  lines.push('');
  lines.push('- Per-model: `contextWindow`, `maxOutputTokens`, `patchFormat`');
  lines.push('- Provider auto-detection from model name or base URL');
  lines.push('- Supports: Grok, Claude, GPT, Gemini, Ollama, LM Studio');

  return lines.join('\n');
}

// ============================================================================
// Section 9: API Reference
// ============================================================================

function generateApiReference(_cwd: string): string {
  const lines = [
    '# CLI & API Reference',
    '',
    '## CLI Commands',
    '',
    '| Command | Description |',
    '|---------|-------------|',
    '| `buddy` | Start interactive chat |',
    '| `buddy [message]` | Process message and enter chat |',
    '| `buddy --prompt <text>` | Headless mode — process and exit |',
    '| `buddy --model <name>` | Override model |',
    '| `buddy --continue` | Resume last session |',
    '| `buddy onboard` | Interactive setup wizard |',
    '| `buddy doctor` | Environment diagnostics |',
    '| `buddy dev plan\\|run\\|pr\\|fix-ci` | Dev workflows |',
    '| `buddy research "<topic>"` | Wide research mode |',
    '| `buddy flow "<goal>"` | Planning flow |',
    '| `buddy daemon start\\|stop\\|status` | Background daemon |',
    '| `buddy server --port N` | HTTP/WS server |',
    '| `buddy hub search\\|install` | Skills marketplace |',
    '| `buddy nodes list\\|pair` | Device management |',
    '| `buddy secrets list\\|set\\|get` | Encrypted vault |',
    '| `buddy deploy platforms\\|init` | Cloud deployment |',
    '',
    '## Slash Commands (Interactive)', '',
    '| Command | Purpose |',
    '|---------|---------|',
    '| `/help` | Show available commands |',
    '| `/clear` | Clear conversation history |',
    '| `/models` | Switch AI model |',
    '| `/yolo on\\|off\\|safe` | Toggle autonomy mode |',
    '| `/think off\\|shallow\\|medium\\|deep` | Set reasoning depth |',
    '| `/persona list\\|use\\|info` | Manage AI personas |',
    '| `/compact [level]` | Compress conversation context |',
    '| `/docs generate [--with-llm]` | Generate documentation |',
    '| `/plan` | Enter read-only research mode |',
    '',
    '## HTTP API Endpoints', '',
    '| Method | Endpoint | Purpose |',
    '|--------|----------|---------|',
    '| GET | `/api/health` | Health check |',
    '| GET | `/api/metrics` | Usage metrics |',
    '| POST | `/api/chat` | Send message |',
    '| POST | `/api/chat/completions` | OpenAI-compatible |',
    '| GET/POST | `/api/sessions` | Session management |',
    '| GET/POST | `/api/memory` | Memory CRUD |',
    '| GET | `/api/daemon/status` | Daemon health |',
    '| GET | `/api/hub/search` | Skills search |',
    '',
    '## WebSocket Protocol', '',
    '| Event | Direction | Purpose |',
    '|-------|-----------|---------|',
    '| `authenticate` | Client → Server | JWT authentication |',
    '| `chat_stream` | Bidirectional | Streaming conversation |',
    '| `tool_execute` | Server → Client | Tool execution notifications |',
    '| `ping/pong` | Bidirectional | Keep-alive |',
    '',
    'Default ports: HTTP 3000, Gateway WS 3001.',
  ];

  return lines.join('\n');
}

// ============================================================================
// Section 10: Development Guide
// ============================================================================

function generateDevGuide(cwd: string): string {
  const pkg = readPkg(cwd);
  const scripts = (pkg.scripts ?? {}) as Record<string, string>;

  const lines = [
    '# Development Guide',
    '',
    '## Getting Started', '',
    '```bash',
    'git clone <repo-url>',
    'cd ' + path.basename(cwd),
    'npm install',
    'npm run dev          # Development mode (Bun)',
    'npm run dev:node     # Development mode (tsx/Node.js)',
    '```', '',
    '## Build & Development Commands', '',
    '| Command | Description |',
    '|---------|-------------|',
  ];

  for (const [name, cmd] of Object.entries(scripts).slice(0, 20)) {
    lines.push(`| \`npm run ${name}\` | \`${cmd}\` |`);
  }

  lines.push('', '## Project Structure', '');
  lines.push('```');
  lines.push('src/');
  lines.push('├── agent/           # Core agent system (orchestrator, executor, middleware)');
  lines.push('├── codebuddy/       # LLM client, tool definitions');
  lines.push('├── tools/           # 110+ tool implementations');
  lines.push('├── context/         # Context window management');
  lines.push('├── security/        # Security layers, validation');
  lines.push('├── knowledge/       # Code graph, analysis');
  lines.push('├── channels/        # Messaging platforms');
  lines.push('├── server/          # HTTP/WebSocket server');
  lines.push('├── commands/        # CLI and slash commands');
  lines.push('├── config/          # Configuration management');
  lines.push('├── memory/          # Persistence and memory');
  lines.push('├── ui/              # Terminal UI (Ink/React)');
  lines.push('├── daemon/          # Background daemon');
  lines.push('├── docs/            # Documentation generator');
  lines.push('└── index.ts         # CLI entry point');
  lines.push('```', '');

  lines.push('## Coding Conventions', '');
  lines.push('- TypeScript strict mode, avoid `any`');
  lines.push('- Single quotes, semicolons, 2-space indent');
  lines.push('- Files: kebab-case (`text-editor.ts`), components: PascalCase');
  lines.push('- ESM imports with `.js` extension');
  lines.push('- Conventional Commits (`feat(scope): description`)');
  lines.push('');

  lines.push('## Testing', '');
  lines.push('- Framework: **Vitest** with happy-dom');
  lines.push('- Tests in `tests/` and co-located `src/**/*.test.ts`');
  lines.push('- Run: `npm test` (all), `npm run test:watch` (dev)');
  lines.push('- Coverage: `npm run test:coverage`');
  lines.push('- Validate: `npm run validate` (lint + typecheck + test)');
  lines.push('');

  lines.push('## Adding a New Tool', '');
  lines.push('1. Create class in `src/tools/`');
  lines.push('2. Add definition in `src/codebuddy/tools.ts`');
  lines.push('3. Add execution case in `CodeBuddyAgent.executeTool()`');
  lines.push('4. Register in `src/tools/registry/`');
  lines.push('5. Add metadata in `src/tools/metadata.ts`');

  return lines.join('\n');
}

// ============================================================================
// Section 11: Changelog (from git)
// ============================================================================

function generateChangelog(cwd: string): string {
  const lines = [
    '# Recent Changes',
    '',
  ];

  try {
    const { execFileSync } = require('child_process');
    const log = execFileSync('git', ['log', '--oneline', '-30', '--no-decorate'], {
      cwd,
      timeout: 5000,
      encoding: 'utf-8',
    });
    lines.push('Last 30 commits:', '');
    lines.push('```');
    lines.push(log.trim());
    lines.push('```');
  } catch {
    lines.push('*Git log not available.*');
  }

  return lines.join('\n');
}

// ============================================================================
// Index Generator
// ============================================================================

function generateIndex(
  files: string[],
  stats: { tripleCount: number; subjectCount: number },
  moduleCount: number,
  classCount: number,
  functionCount: number,
): string {
  const lines = [
    '# Documentation Index',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Modules | ${moduleCount} |`,
    `| Classes | ${classCount} |`,
    `| Functions | ${functionCount} |`,
    `| Relationships | ${stats.tripleCount} |`,
    '',
    '## Sections',
    '',
  ];

  for (const file of files.filter(f => f !== 'index.md')) {
    const name = file.replace(/^\d+-/, '').replace(/\.md$/, '');
    const title = name.charAt(0).toUpperCase() + name.slice(1);
    lines.push(`- [${title}](./${file})`);
  }

  return lines.join('\n');
}

// ============================================================================
// Helpers
// ============================================================================

function findCommonPrefix(strings: string[]): string {
  if (strings.length === 0) return '';
  const parts = strings[0].split('/');
  let prefix = '';
  for (let i = 0; i < parts.length; i++) {
    const candidate = parts.slice(0, i + 1).join('/');
    if (strings.every(s => s.startsWith(candidate))) {
      prefix = candidate;
    } else {
      break;
    }
  }
  return prefix;
}
