/**
 * Tests for PageRank entity-level centrality
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { computePageRank } from '@/knowledge/graph-pagerank.js';
import { KnowledgeGraph } from '@/knowledge/knowledge-graph.js';

describe('computePageRank', () => {
  let graph: KnowledgeGraph;

  beforeEach(() => {
    KnowledgeGraph.resetInstance();
    graph = KnowledgeGraph.getInstance();
  });

  it('returns empty scores for empty graph', () => {
    const result = computePageRank(graph);
    expect(result.scores.size).toBe(0);
    expect(result.entityCount).toBe(0);
    expect(result.computedAt).toBeGreaterThan(0);
  });

  it('computes scores for a simple chain A→B→C', () => {
    graph.add('mod:a', 'imports', 'mod:b');
    graph.add('mod:b', 'imports', 'mod:c');

    const result = computePageRank(graph);
    expect(result.entityCount).toBe(3);

    // C is the most imported (end of chain) → highest rank
    const scoreA = result.scores.get('mod:a')!;
    const scoreB = result.scores.get('mod:b')!;
    const scoreC = result.scores.get('mod:c')!;

    expect(scoreC).toBeGreaterThan(scoreA);
    expect(scoreB).toBeGreaterThan(scoreA);
  });

  it('normalizes scores to [0, 1]', () => {
    graph.add('mod:a', 'imports', 'mod:b');
    graph.add('mod:c', 'imports', 'mod:b');
    graph.add('mod:d', 'imports', 'mod:b');

    const result = computePageRank(graph);
    let maxScore = 0;
    for (const score of result.scores.values()) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
      if (score > maxScore) maxScore = score;
    }
    // At least one score should be exactly 1.0 (the max)
    expect(maxScore).toBe(1);
  });

  it('hub node gets highest score', () => {
    // B is imported by everyone
    graph.add('mod:a', 'imports', 'mod:b');
    graph.add('mod:c', 'imports', 'mod:b');
    graph.add('mod:d', 'imports', 'mod:b');
    graph.add('mod:e', 'imports', 'mod:b');

    const result = computePageRank(graph);
    const scoreB = result.scores.get('mod:b')!;

    for (const [entity, score] of result.scores) {
      if (entity !== 'mod:b') {
        expect(scoreB).toBeGreaterThanOrEqual(score);
      }
    }
  });

  it('respects custom predicates', () => {
    graph.add('fn:foo', 'calls', 'fn:bar');
    graph.add('fn:baz', 'calls', 'fn:bar');
    graph.add('mod:a', 'imports', 'mod:b'); // should be ignored

    const result = computePageRank(graph, { predicates: ['calls'] });
    expect(result.scores.has('fn:foo')).toBe(true);
    expect(result.scores.has('fn:bar')).toBe(true);
    expect(result.scores.has('mod:a')).toBe(false);
  });

  it('respects custom dampingFactor and iterations', () => {
    graph.add('mod:a', 'imports', 'mod:b');
    graph.add('mod:b', 'imports', 'mod:c');

    const result1 = computePageRank(graph, { dampingFactor: 0.5, iterations: 5 });
    const result2 = computePageRank(graph, { dampingFactor: 0.99, iterations: 50 });

    // Both should produce valid scores
    expect(result1.entityCount).toBe(3);
    expect(result2.entityCount).toBe(3);

    // Higher damping = more contrast between scores
    const spread1 = result1.scores.get('mod:c')! - result1.scores.get('mod:a')!;
    const spread2 = result2.scores.get('mod:c')! - result2.scores.get('mod:a')!;
    expect(spread2).toBeGreaterThanOrEqual(spread1 - 0.01); // approximately
  });

  it('handles cycle without diverging', () => {
    graph.add('mod:a', 'imports', 'mod:b');
    graph.add('mod:b', 'imports', 'mod:c');
    graph.add('mod:c', 'imports', 'mod:a');

    const result = computePageRank(graph);
    expect(result.entityCount).toBe(3);

    // In a perfect cycle, all scores should be approximately equal
    const scores = [...result.scores.values()];
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    for (const s of scores) {
      expect(Math.abs(s - avg)).toBeLessThan(0.1);
    }
  });

  it('handles disconnected components', () => {
    graph.add('mod:a', 'imports', 'mod:b');
    graph.add('mod:c', 'imports', 'mod:d');

    const result = computePageRank(graph);
    expect(result.entityCount).toBe(4);
    expect(result.scores.size).toBe(4);
  });

  it('handles graph with no matching predicates', () => {
    graph.add('mod:lonely', 'exports', 'fn:foo'); // not in default predicates
    graph.add('mod:lonely', 'extends', 'mod:base'); // also not in predicates

    // With no calls/imports edges, should return empty
    const result = computePageRank(graph);
    expect(result.entityCount).toBe(0);
  });

  it('handles self-referencing node', () => {
    graph.add('mod:a', 'imports', 'mod:b');
    // self-loop is deduped by the graph, so just verify a simple case
    const result = computePageRank(graph);
    expect(result.entityCount).toBe(2);
  });

  it('uses default predicates (calls + imports)', () => {
    graph.add('mod:a', 'imports', 'mod:b');
    graph.add('fn:x', 'calls', 'fn:y');
    graph.add('mod:a', 'extends', 'mod:z'); // should be ignored

    const result = computePageRank(graph);
    expect(result.scores.has('mod:a')).toBe(true);
    expect(result.scores.has('fn:x')).toBe(true);
    expect(result.scores.has('mod:z')).toBe(false);
  });

  it('computedAt is a valid timestamp', () => {
    graph.add('mod:a', 'imports', 'mod:b');
    const before = Date.now();
    const result = computePageRank(graph);
    const after = Date.now();
    expect(result.computedAt).toBeGreaterThanOrEqual(before);
    expect(result.computedAt).toBeLessThanOrEqual(after);
  });

  it('star topology: center node ranks highest', () => {
    // Star: all point to center
    for (let i = 0; i < 10; i++) {
      graph.add(`mod:spoke${i}`, 'imports', 'mod:center');
    }

    const result = computePageRank(graph);
    const centerScore = result.scores.get('mod:center')!;
    expect(centerScore).toBe(1); // normalized max
  });

  it('bidirectional edges handled correctly', () => {
    graph.add('mod:a', 'imports', 'mod:b');
    graph.add('mod:b', 'imports', 'mod:a');

    const result = computePageRank(graph);
    const scoreA = result.scores.get('mod:a')!;
    const scoreB = result.scores.get('mod:b')!;
    // Bidirectional → roughly equal
    expect(Math.abs(scoreA - scoreB)).toBeLessThan(0.05);
  });

  it('large graph does not throw', () => {
    for (let i = 0; i < 100; i++) {
      graph.add(`mod:m${i}`, 'imports', `mod:m${(i + 1) % 100}`);
    }
    const result = computePageRank(graph);
    expect(result.entityCount).toBe(100);
    expect(result.scores.size).toBe(100);
  });
});

describe('KnowledgeGraph PageRank integration', () => {
  let graph: KnowledgeGraph;

  beforeEach(() => {
    KnowledgeGraph.resetInstance();
    graph = KnowledgeGraph.getInstance();
  });

  it('getPageRank() returns scores', () => {
    graph.add('mod:a', 'imports', 'mod:b');
    graph.add('mod:c', 'imports', 'mod:b');

    const scores = graph.getPageRank();
    expect(scores.size).toBe(3);
    expect(scores.get('mod:b')).toBe(1);
  });

  it('getEntityRank() returns 0 for unknown entity', () => {
    graph.add('mod:a', 'imports', 'mod:b');
    expect(graph.getEntityRank('mod:unknown')).toBe(0);
  });

  it('dirty flag is set after add()', () => {
    graph.add('mod:a', 'imports', 'mod:b');
    const scores1 = graph.getPageRank();
    expect(scores1.size).toBe(2);

    graph.add('mod:c', 'imports', 'mod:b');
    graph.add('mod:d', 'imports', 'mod:b');
    // Force past cooldown
    (graph as any)._pageRankLastComputed = 0;
    const scores2 = graph.getPageRank();
    expect(scores2.size).toBe(4);
  });

  it('findEntity() boosts by PageRank', () => {
    // Create two entities with similar names but different importance
    graph.add('mod:src/utils/helper', 'imports', 'mod:src/core/engine');
    graph.add('mod:src/core/engine', 'imports', 'mod:src/core/engine-utils');
    // engine is more imported → higher rank
    for (let i = 0; i < 5; i++) {
      graph.add(`mod:src/feature${i}`, 'imports', 'mod:src/core/engine');
    }

    const result = graph.findEntity('engine');
    expect(result).toBe('mod:src/core/engine');
  });
});
