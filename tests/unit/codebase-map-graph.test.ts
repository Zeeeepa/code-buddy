import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KnowledgeGraph } from '@/knowledge/knowledge-graph.js';
import { populateCodeGraph } from '@/knowledge/code-graph-populator.js';
import { buildCodeGraphContext } from '@/knowledge/code-graph-context-provider.js';
import type { CartographyResult } from '@/agent/repo-profiling/cartography.js';

function makeCartography(): CartographyResult {
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
        { name: 'knowledge', directory: 'src/knowledge', fileCount: 2 },
      ],
      style: 'layered',
      maxDepth: 3,
    },
    importGraph: {
      hotModules: [
        { module: 'src/agent/codebuddy-agent', importedBy: 8 },
        { module: 'src/utils/logger', importedBy: 20 },
      ],
      circularRisks: [],
      orphanModules: [],
    },
    apiSurface: {
      restRoutes: [
        { method: 'GET', path: '/api/health', file: 'src/server/routes.ts' },
        { method: 'POST', path: '/api/chat', file: 'src/server/routes.ts' },
      ],
      wsEvents: [],
      endpointCount: 2,
    },
    patterns: {
      singletons: ['src/utils/logger'],
      registries: [],
      factories: [],
      facades: ['src/agent/facades/session-facade'],
      middlewares: [],
      observers: [],
    },
    components: {
      agents: [
        { name: 'SWEAgent', file: 'src/agent/specialized/swe-agent.ts' },
      ],
      tools: [
        { name: 'BashTool', file: 'src/tools/bash-tool.ts' },
        { name: 'ViewFileTool', file: 'src/tools/view-file-tool.ts' },
      ],
      channels: [],
      facades: [
        { name: 'SessionFacade', file: 'src/agent/facades/session-facade.ts' },
      ],
      middlewares: [],
      keyExports: [
        { module: 'src/agent/codebuddy-agent', exports: ['CodeBuddyAgent', 'getCodeBuddyAgent'] },
        { module: 'src/knowledge/knowledge-graph', exports: ['KnowledgeGraph', 'getKnowledgeGraph'] },
      ],
    },
    importEdges: [
      ['src/agent/codebuddy-agent', 'src/utils/logger'],
      ['src/agent/codebuddy-agent', 'src/agent/execution/agent-executor'],
      ['src/agent/execution/agent-executor', 'src/utils/logger'],
      ['src/agent/execution/agent-executor', 'src/agent/tool-handler'],
      ['src/knowledge/knowledge-graph', 'src/utils/logger'],
      ['src/tools/bash-tool', 'src/utils/logger'],
    ],
  };
}

describe('Code Graph Tool Operations', () => {
  let graph: KnowledgeGraph;

  beforeEach(() => {
    KnowledgeGraph.resetInstance();
    graph = KnowledgeGraph.getInstance();
    populateCodeGraph(graph, makeCartography());
  });

  describe('graph_query', () => {
    it('finds triples by entity', () => {
      const triples = graph.query({ subject: 'mod:src/agent/codebuddy-agent' });
      expect(triples.length).toBeGreaterThan(0);
    });

    it('finds triples by predicate', () => {
      const triples = graph.query({ predicate: 'imports' });
      expect(triples.length).toBe(6); // 6 import edges
    });

    it('finds triples by subject and predicate', () => {
      const triples = graph.query({
        subject: 'mod:src/agent/codebuddy-agent',
        predicate: 'imports',
      });
      expect(triples.length).toBe(2); // imports logger and agent-executor
    });

    it('finds as object too', () => {
      const triples = graph.query({ object: 'mod:src/utils/logger', predicate: 'imports' });
      expect(triples.length).toBeGreaterThan(0);
    });
  });

  describe('graph_neighbors via findEntity + formatEgoGraph', () => {
    it('finds neighbors of a module', () => {
      const entity = graph.findEntity('agent-executor');
      expect(entity).toBe('mod:src/agent/execution/agent-executor');

      const egoGraph = graph.formatEgoGraph(entity!, 1, 800);
      expect(egoGraph).toContain('agent-executor');
      expect(egoGraph).toContain('imports');
    });

    it('finds neighbors by class name', () => {
      const entity = graph.findEntity('CodeBuddyAgent');
      expect(entity).toBe('cls:CodeBuddyAgent');

      const egoGraph = graph.formatEgoGraph(entity!, 1, 800);
      expect(egoGraph).toContain('CodeBuddyAgent');
    });

    it('depth 2 includes transitive neighbors', () => {
      const entity = graph.findEntity('codebuddy-agent');
      const egoD1 = graph.subgraph(entity!, 1);
      const egoD2 = graph.subgraph(entity!, 2);
      expect(egoD2.entities.size).toBeGreaterThanOrEqual(egoD1.entities.size);
    });
  });

  describe('graph_path', () => {
    it('finds path between two modules', () => {
      const from = 'mod:src/agent/codebuddy-agent';
      const to = 'mod:src/utils/logger';
      const paths = graph.findPath(from, to, 5);
      expect(paths.length).toBeGreaterThan(0);
      expect(paths[0].length).toBeGreaterThanOrEqual(1);
    });

    it('finds path via transitive dependency', () => {
      const from = 'mod:src/agent/codebuddy-agent';
      const to = 'mod:src/agent/tool-handler';
      const paths = graph.findPath(from, to, 5);
      expect(paths.length).toBeGreaterThan(0);
    });

    it('returns empty for disconnected nodes', () => {
      graph.add('mod:isolated', 'patternOf', 'pat:none');
      const paths = graph.findPath('mod:isolated', 'mod:src/utils/logger', 5);
      expect(paths.length).toBe(0);
    });
  });

  describe('graph_stats', () => {
    it('returns correct statistics', () => {
      const stats = graph.getStats();
      expect(stats.tripleCount).toBeGreaterThan(0);
      expect(stats.subjectCount).toBeGreaterThan(0);
      expect(stats.predicateCount).toBeGreaterThan(0);
      expect(stats.objectCount).toBeGreaterThan(0);
    });
  });
});

describe('Code Graph Context Provider', () => {
  let graph: KnowledgeGraph;

  beforeEach(() => {
    KnowledgeGraph.resetInstance();
    graph = KnowledgeGraph.getInstance();
    populateCodeGraph(graph, makeCartography());
  });

  it('returns context for messages mentioning a file path', () => {
    const ctx = buildCodeGraphContext(graph, 'Can you look at src/agent/codebuddy-agent.ts?');
    expect(ctx).not.toBeNull();
    expect(ctx).toContain('codebuddy-agent');
  });

  it('returns context for messages mentioning a class name', () => {
    const ctx = buildCodeGraphContext(graph, 'What does CodeBuddyAgent do?');
    expect(ctx).not.toBeNull();
    expect(ctx).toContain('CodeBuddyAgent');
  });

  it('returns context for messages mentioning a kebab-case module', () => {
    const ctx = buildCodeGraphContext(graph, 'Who imports agent-executor?');
    expect(ctx).not.toBeNull();
    expect(ctx).toContain('agent-executor');
  });

  it('returns null for messages with no recognizable entities', () => {
    const ctx = buildCodeGraphContext(graph, 'Hello, how are you?');
    expect(ctx).toBeNull();
  });

  it('returns null for empty graph', () => {
    graph.clear();
    const ctx = buildCodeGraphContext(graph, 'Tell me about CodeBuddyAgent');
    expect(ctx).toBeNull();
  });

  it('respects max chars limit', () => {
    const ctx = buildCodeGraphContext(graph, 'Show me everything about src/agent/codebuddy-agent.ts');
    if (ctx) {
      expect(ctx.length).toBeLessThanOrEqual(500);
    }
  });
});

describe('Code Graph Persistence', () => {
  // Use vi.mock to avoid actual file I/O in unit tests
  it('saveCodeGraph and loadCodeGraph are importable', async () => {
    const { saveCodeGraph, loadCodeGraph, codeGraphExists } = await import('@/knowledge/code-graph-persistence.js');
    expect(typeof saveCodeGraph).toBe('function');
    expect(typeof loadCodeGraph).toBe('function');
    expect(typeof codeGraphExists).toBe('function');
  });
});
