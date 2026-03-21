import { describe, it, expect, beforeEach } from 'vitest';
import { KnowledgeGraph } from '@/knowledge/knowledge-graph.js';
import { populateCodeGraph } from '@/knowledge/code-graph-populator.js';
import type { CartographyResult } from '@/agent/repo-profiling/cartography.js';

function makeCartography(overrides: Partial<CartographyResult> = {}): CartographyResult {
  return {
    fileStats: {
      byExtension: { '.ts': 10 },
      locEstimate: { TypeScript: 500 },
      totalSourceFiles: 10,
      totalTestFiles: 2,
      largestFiles: [],
    },
    architecture: {
      layers: [
        { name: 'agent', directory: 'src/agent', fileCount: 5 },
        { name: 'tools', directory: 'src/tools', fileCount: 3 },
      ],
      style: 'layered',
      maxDepth: 3,
    },
    importGraph: {
      hotModules: [
        { module: 'src/agent/codebuddy-agent', importedBy: 8 },
        { module: 'src/utils/logger', importedBy: 20 },
      ],
      circularRisks: [
        { a: 'src/agent/foo', b: 'src/agent/bar' },
      ],
      orphanModules: ['src/agent/orphan'],
    },
    apiSurface: {
      restRoutes: [
        { method: 'GET', path: '/api/health', file: 'src/server/routes.ts' },
      ],
      wsEvents: ['chat_stream'],
      endpointCount: 2,
    },
    patterns: {
      singletons: ['src/utils/logger'],
      registries: ['src/tools/registry'],
      factories: [],
      facades: ['src/agent/facades/session-facade'],
      middlewares: ['src/agent/middleware/cost-limit'],
      observers: [],
    },
    components: {
      agents: [
        { name: 'CodeGuardianAgent', file: 'src/agent/specialized/code-guardian/index.ts' },
      ],
      tools: [
        { name: 'BashTool', file: 'src/tools/bash-tool.ts' },
      ],
      channels: [
        { name: 'TelegramChannel', file: 'src/channels/telegram.ts' },
      ],
      facades: [
        { name: 'SessionFacade', file: 'src/agent/facades/session-facade.ts' },
      ],
      middlewares: [
        { name: 'CostLimitMiddleware', file: 'src/agent/middleware/cost-limit.ts', priority: 10 },
      ],
      keyExports: [
        { module: 'src/agent/codebuddy-agent', exports: ['CodeBuddyAgent', 'getCodeBuddyAgent'] },
        { module: 'src/utils/logger', exports: ['logger', 'createLogger'] },
      ],
    },
    importEdges: [
      ['src/agent/codebuddy-agent', 'src/utils/logger'],
      ['src/agent/codebuddy-agent', 'src/agent/tool-handler'],
      ['src/agent/tool-handler', 'src/utils/logger'],
      ['src/server/routes', 'src/agent/codebuddy-agent'],
    ],
    ...overrides,
  };
}

describe('CodeGraphPopulator', () => {
  let graph: KnowledgeGraph;

  beforeEach(() => {
    KnowledgeGraph.resetInstance();
    graph = KnowledgeGraph.getInstance();
  });

  it('populates import edges as triples', () => {
    const carto = makeCartography();
    populateCodeGraph(graph, carto);

    // Check imports
    expect(graph.has('mod:src/agent/codebuddy-agent', 'imports', 'mod:src/utils/logger')).toBe(true);
    expect(graph.has('mod:src/agent/codebuddy-agent', 'imports', 'mod:src/agent/tool-handler')).toBe(true);

    // Check inverse usedBy
    expect(graph.has('mod:src/utils/logger', 'usedBy', 'mod:src/agent/codebuddy-agent')).toBe(true);
    expect(graph.has('mod:src/utils/logger', 'usedBy', 'mod:src/agent/tool-handler')).toBe(true);
  });

  it('populates architecture layers', () => {
    const carto = makeCartography();
    populateCodeGraph(graph, carto);

    expect(graph.has('layer:agent', 'hasDirectory', 'src/agent')).toBe(true);
    expect(graph.has('layer:tools', 'hasDirectory', 'src/tools')).toBe(true);
  });

  it('populates component definedIn triples', () => {
    const carto = makeCartography();
    populateCodeGraph(graph, carto);

    expect(graph.has('cls:CodeGuardianAgent', 'definedIn', 'mod:src/agent/specialized/code-guardian/index')).toBe(true);
    expect(graph.has('cls:BashTool', 'definedIn', 'mod:src/tools/bash-tool')).toBe(true);
    expect(graph.has('cls:TelegramChannel', 'definedIn', 'mod:src/channels/telegram')).toBe(true);
    expect(graph.has('cls:SessionFacade', 'definedIn', 'mod:src/agent/facades/session-facade')).toBe(true);
  });

  it('populates middleware with priority metadata', () => {
    const carto = makeCartography();
    populateCodeGraph(graph, carto);

    const triples = graph.query({ subject: 'cls:CostLimitMiddleware', predicate: 'definedIn' });
    expect(triples.length).toBe(1);
    expect(triples[0].metadata?.priority).toBe('10');
    expect(triples[0].metadata?.nodeType).toBe('middleware');
  });

  it('populates key exports', () => {
    const carto = makeCartography();
    populateCodeGraph(graph, carto);

    expect(graph.has('mod:src/agent/codebuddy-agent', 'exports', 'cls:CodeBuddyAgent')).toBe(true);
    expect(graph.has('mod:src/utils/logger', 'exports', 'fn:logger')).toBe(true);
  });

  it('populates design patterns', () => {
    const carto = makeCartography();
    populateCodeGraph(graph, carto);

    expect(graph.has('mod:src/utils/logger', 'patternOf', 'pat:singleton')).toBe(true);
    expect(graph.has('mod:src/tools/registry', 'patternOf', 'pat:registry')).toBe(true);
    expect(graph.has('mod:src/agent/facades/session-facade', 'patternOf', 'pat:facade')).toBe(true);
  });

  it('populates layer contains module', () => {
    const carto = makeCartography();
    populateCodeGraph(graph, carto);

    expect(graph.has('layer:agent', 'contains', 'mod:src/agent/codebuddy-agent')).toBe(true);
    expect(graph.has('mod:src/agent/codebuddy-agent', 'belongsTo', 'layer:agent')).toBe(true);
  });

  it('populates API surface routes', () => {
    const carto = makeCartography();
    populateCodeGraph(graph, carto);

    expect(graph.has('mod:src/server/routes', 'exposes', 'GET /api/health')).toBe(true);
  });

  it('populates circular dependency warnings', () => {
    const carto = makeCartography();
    populateCodeGraph(graph, carto);

    expect(graph.has('mod:src/agent/foo', 'circularWith', 'mod:src/agent/bar')).toBe(true);
  });

  it('returns the number of triples added', () => {
    const carto = makeCartography();
    const count = populateCodeGraph(graph, carto);

    expect(count).toBeGreaterThan(0);
    expect(graph.getStats().tripleCount).toBe(count);
  });

  it('handles empty cartography gracefully', () => {
    const emptyCarto: CartographyResult = {
      fileStats: { byExtension: {}, locEstimate: {}, totalSourceFiles: 0, totalTestFiles: 0, largestFiles: [] },
      architecture: { layers: [], style: 'unknown', maxDepth: 0 },
      importGraph: { hotModules: [], circularRisks: [], orphanModules: [] },
      apiSurface: { restRoutes: [], wsEvents: [], endpointCount: 0 },
      patterns: { singletons: [], registries: [], factories: [], facades: [], middlewares: [], observers: [] },
    };

    const count = populateCodeGraph(graph, emptyCarto);
    expect(count).toBe(0);
  });

  it('handles missing importEdges gracefully', () => {
    const carto = makeCartography({ importEdges: undefined });
    const count = populateCodeGraph(graph, carto);

    // Should still populate other data (components, patterns, etc.)
    expect(count).toBeGreaterThan(0);
    // But no import/usedBy triples
    expect(graph.query({ predicate: 'imports' }).length).toBe(0);
  });

  it('deduplicates triples on re-population', () => {
    const carto = makeCartography();
    populateCodeGraph(graph, carto);
    const firstCount = graph.getStats().tripleCount;

    // Re-populating should add 0 new triples (all deduplicated)
    const added = populateCodeGraph(graph, carto);
    expect(added).toBe(0);
    expect(graph.getStats().tripleCount).toBe(firstCount);
  });
});

describe('KnowledgeGraph.findEntity', () => {
  let graph: KnowledgeGraph;

  beforeEach(() => {
    KnowledgeGraph.resetInstance();
    graph = KnowledgeGraph.getInstance();
    populateCodeGraph(graph, makeCartography());
  });

  it('finds entity by exact module name', () => {
    const entity = graph.findEntity('src/utils/logger');
    expect(entity).toBe('mod:src/utils/logger');
  });

  it('finds entity by suffix match', () => {
    const entity = graph.findEntity('agent-executor');
    // No exact match for agent-executor in our test data, but codebuddy-agent should not match
    // Since we don't have agent-executor in test data, it returns null or closest match
    // Let's test with something that exists
    const entity2 = graph.findEntity('codebuddy-agent');
    expect(entity2).toBe('mod:src/agent/codebuddy-agent');
  });

  it('finds entity by class name', () => {
    const entity = graph.findEntity('CodeBuddyAgent');
    expect(entity).toBe('cls:CodeBuddyAgent');
  });

  it('finds entity by partial match', () => {
    const entity = graph.findEntity('logger');
    // Should find mod:src/utils/logger (has many connections)
    expect(entity).toContain('logger');
  });

  it('returns null for unmatched entity', () => {
    const entity = graph.findEntity('nonexistent-xyz-abc');
    expect(entity).toBeNull();
  });

  it('strips .ts extension from search', () => {
    const entity = graph.findEntity('logger.ts');
    expect(entity).toContain('logger');
  });
});

describe('KnowledgeGraph.formatEgoGraph', () => {
  let graph: KnowledgeGraph;

  beforeEach(() => {
    KnowledgeGraph.resetInstance();
    graph = KnowledgeGraph.getInstance();
    populateCodeGraph(graph, makeCartography());
  });

  it('returns compact ego-graph string', () => {
    const output = graph.formatEgoGraph('mod:src/agent/codebuddy-agent', 1, 800);
    expect(output).toContain('mod:src/agent/codebuddy-agent');
    expect(output).toContain('imports');
  });

  it('respects maxChars limit', () => {
    const output = graph.formatEgoGraph('mod:src/agent/codebuddy-agent', 2, 200);
    expect(output.length).toBeLessThanOrEqual(200);
  });

  it('returns empty string for unknown entity', () => {
    const output = graph.formatEgoGraph('mod:nonexistent', 1, 800);
    expect(output).toBe('');
  });

  it('includes neighbor count summary', () => {
    const output = graph.formatEgoGraph('mod:src/agent/codebuddy-agent', 1, 2000);
    expect(output).toContain('Neighbors:');
  });
});
