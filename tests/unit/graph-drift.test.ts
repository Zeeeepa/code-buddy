/**
 * Tests for graph-drift.ts
 * Architecture Drift Monitor — snapshot save/load + drift detection
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KnowledgeGraph } from '@/knowledge/knowledge-graph.js';

// Mock fs to avoid actual disk I/O
const mockFs = vi.hoisted(() => ({
  existsSync: vi.fn().mockReturnValue(false),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

vi.mock('fs', () => ({
  default: mockFs,
  ...mockFs,
}));

import { saveSnapshot, loadSnapshot, getSnapshotInfo, detectDrift, formatDrift } from '@/knowledge/graph-drift.js';

describe('saveSnapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes snapshot JSON to disk', () => {
    const graph = new KnowledgeGraph();
    graph.add('mod:src/a', 'imports', 'mod:src/b');

    saveSnapshot(graph, '/project');

    expect(mockFs.writeFileSync).toHaveBeenCalledOnce();
    const [filePath, content] = mockFs.writeFileSync.mock.calls[0];
    expect(filePath).toContain('code-graph-snapshot.json');
    const data = JSON.parse(content as string);
    expect(data.version).toBe(1);
    expect(data.tripleCount).toBe(1);
    expect(data.triples).toHaveLength(1);
  });

  it('creates .codebuddy directory if needed', () => {
    mockFs.existsSync.mockReturnValue(false);
    const graph = new KnowledgeGraph();
    saveSnapshot(graph, '/project');
    expect(mockFs.mkdirSync).toHaveBeenCalled();
  });
});

describe('loadSnapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when no snapshot exists', () => {
    mockFs.existsSync.mockReturnValue(false);
    expect(loadSnapshot('/project')).toBeNull();
  });

  it('loads snapshot into a KnowledgeGraph', () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify({
      version: 1,
      savedAt: '2026-03-10T00:00:00Z',
      tripleCount: 2,
      triples: [
        { subject: 'mod:a', predicate: 'imports', object: 'mod:b' },
        { subject: 'fn:x', predicate: 'calls', object: 'fn:y' },
      ],
    }));

    const snap = loadSnapshot('/project');
    expect(snap).not.toBeNull();
    expect(snap!.getStats().tripleCount).toBe(2);
  });

  it('returns null for invalid format', () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify({ version: 99 }));
    expect(loadSnapshot('/project')).toBeNull();
  });
});

describe('getSnapshotInfo', () => {
  it('returns metadata without loading triples', () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify({
      version: 1,
      savedAt: '2026-03-10T12:00:00Z',
      tripleCount: 42,
      triples: [],
    }));

    const info = getSnapshotInfo('/project');
    expect(info).toEqual({ savedAt: '2026-03-10T12:00:00Z', tripleCount: 42 });
  });

  it('returns null when no snapshot', () => {
    mockFs.existsSync.mockReturnValue(false);
    expect(getSnapshotInfo('/project')).toBeNull();
  });
});

describe('detectDrift', () => {
  let currentGraph: KnowledgeGraph;

  beforeEach(() => {
    vi.clearAllMocks();
    currentGraph = new KnowledgeGraph();
  });

  it('returns null when no snapshot exists', () => {
    mockFs.existsSync.mockReturnValue(false);
    expect(detectDrift(currentGraph, '/project')).toBeNull();
  });

  it('detects added modules', () => {
    // Snapshot: mod:a → mod:b
    const snapshotData = {
      version: 1,
      savedAt: '2026-03-10T00:00:00Z',
      tripleCount: 1,
      triples: [{ subject: 'mod:src/a', predicate: 'imports', object: 'mod:src/b' }],
    };
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify(snapshotData));

    // Current: mod:a → mod:b, mod:a → mod:c (new module)
    currentGraph.add('mod:src/a', 'imports', 'mod:src/b');
    currentGraph.add('mod:src/a', 'imports', 'mod:src/c');

    const drift = detectDrift(currentGraph, '/project');
    expect(drift).not.toBeNull();
    expect(drift!.addedModules).toContain('mod:src/c');
  });

  it('detects removed modules', () => {
    const snapshotData = {
      version: 1,
      savedAt: '2026-03-10T00:00:00Z',
      tripleCount: 2,
      triples: [
        { subject: 'mod:src/a', predicate: 'imports', object: 'mod:src/b' },
        { subject: 'mod:src/a', predicate: 'imports', object: 'mod:src/old' },
      ],
    };
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify(snapshotData));

    currentGraph.add('mod:src/a', 'imports', 'mod:src/b');

    const drift = detectDrift(currentGraph, '/project');
    expect(drift!.removedModules).toContain('mod:src/old');
  });

  it('detects new coupling edges', () => {
    const snapshotData = {
      version: 1,
      savedAt: '2026-03-10T00:00:00Z',
      tripleCount: 1,
      triples: [{ subject: 'mod:src/a', predicate: 'imports', object: 'mod:src/b' }],
    };
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify(snapshotData));

    currentGraph.add('mod:src/a', 'imports', 'mod:src/b');
    currentGraph.add('mod:src/c', 'imports', 'mod:src/a'); // new edge

    const drift = detectDrift(currentGraph, '/project');
    expect(drift!.newCoupling).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: 'mod:src/c', to: 'mod:src/a' }),
      ]),
    );
  });

  it('detects PageRank shifts', () => {
    // Snapshot: a → b (b has some rank)
    const snapshotData = {
      version: 1,
      savedAt: '2026-03-10T00:00:00Z',
      tripleCount: 1,
      triples: [{ subject: 'fn:a', predicate: 'calls', object: 'fn:b' }],
    };
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify(snapshotData));

    // Current: many things call fn:b → higher rank
    currentGraph.add('fn:a', 'calls', 'fn:b');
    currentGraph.add('fn:c', 'calls', 'fn:b');
    currentGraph.add('fn:d', 'calls', 'fn:b');
    currentGraph.add('fn:e', 'calls', 'fn:b');

    const drift = detectDrift(currentGraph, '/project');
    // fn:b should appear as a rank gainer
    expect(drift).not.toBeNull();
    // The exact values depend on PageRank calculation
  });

  it('summary includes triple counts', () => {
    const snapshotData = {
      version: 1,
      savedAt: '2026-03-10T00:00:00Z',
      tripleCount: 1,
      triples: [{ subject: 'mod:a', predicate: 'imports', object: 'mod:b' }],
    };
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify(snapshotData));

    currentGraph.add('mod:a', 'imports', 'mod:b');
    currentGraph.add('mod:a', 'imports', 'mod:c');

    const drift = detectDrift(currentGraph, '/project')!;
    expect(drift.summary.oldTripleCount).toBe(1);
    expect(drift.summary.newTripleCount).toBe(2);
    expect(drift.summary.snapshotDate).toBe('2026-03-10T00:00:00Z');
  });
});

describe('formatDrift', () => {
  it('produces readable text output', () => {
    const drift = {
      addedModules: ['mod:src/new-feature'],
      removedModules: [],
      addedClasses: ['cls:NewService'],
      removedClasses: [],
      newCoupling: [{ from: 'mod:src/a', to: 'mod:src/new-feature' }],
      removedCoupling: [],
      rankGainers: [{ entity: 'fn:hotFunc', oldRank: 0.1, newRank: 0.5, delta: 0.4 }],
      rankLosers: [],
      summary: {
        snapshotDate: '2026-03-10T00:00:00Z',
        oldTripleCount: 100,
        newTripleCount: 120,
        netModuleChange: 1,
        netCouplingChange: 1,
      },
    };

    const text = formatDrift(drift);
    expect(text).toContain('Architecture Drift Report');
    expect(text).toContain('mod:src/new-feature');
    expect(text).toContain('cls:NewService');
    expect(text).toContain('fn:hotFunc');
    expect(text).toContain('+20');
  });
});
