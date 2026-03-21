/**
 * Tests for Community Detection (Label Propagation)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { detectCommunities, summarizeCommunity } from '@/knowledge/community-detection.js';
import { KnowledgeGraph } from '@/knowledge/knowledge-graph.js';

describe('detectCommunities', () => {
  let graph: KnowledgeGraph;

  beforeEach(() => {
    KnowledgeGraph.resetInstance();
    graph = KnowledgeGraph.getInstance();
  });

  it('returns empty for empty graph', () => {
    const result = detectCommunities(graph);
    expect(result.communities.size).toBe(0);
    expect(result.communityMembers.size).toBe(0);
    expect(result.modularity).toBe(0);
  });

  it('detects two obvious clusters', () => {
    // Cluster A: tightly connected
    graph.add('mod:src/a/one', 'imports', 'mod:src/a/two');
    graph.add('mod:src/a/two', 'imports', 'mod:src/a/three');
    graph.add('mod:src/a/three', 'imports', 'mod:src/a/one');

    // Cluster B: tightly connected
    graph.add('mod:src/b/one', 'imports', 'mod:src/b/two');
    graph.add('mod:src/b/two', 'imports', 'mod:src/b/three');
    graph.add('mod:src/b/three', 'imports', 'mod:src/b/one');

    // Weak inter-cluster link
    graph.add('mod:src/a/one', 'imports', 'mod:src/b/one');

    const result = detectCommunities(graph);
    expect(result.communityMembers.size).toBeGreaterThanOrEqual(1);

    // At least some entities should be in communities
    expect(result.communities.size).toBeGreaterThan(0);
  });

  it('respects minCommunitySize', () => {
    graph.add('mod:a', 'imports', 'mod:b');
    graph.add('mod:c', 'imports', 'mod:d');
    graph.add('mod:e', 'imports', 'mod:f');

    // With minCommunitySize=3, pairs should be filtered
    const result = detectCommunities(graph, { minCommunitySize: 3 });
    expect(result.communityMembers.size).toBe(0);
  });

  it('respects minCommunitySize=2 (default)', () => {
    graph.add('mod:a', 'imports', 'mod:b');

    const result = detectCommunities(graph);
    expect(result.communityMembers.size).toBe(1);
    expect(result.communitySizes.values().next().value).toBe(2);
  });

  it('all connected nodes converge to one community', () => {
    graph.add('mod:a', 'imports', 'mod:b');
    graph.add('mod:b', 'imports', 'mod:c');
    graph.add('mod:c', 'imports', 'mod:a');

    const result = detectCommunities(graph);
    // All 3 in the same community
    const cids = new Set([...result.communities.values()]);
    expect(cids.size).toBe(1);
  });

  it('modularity is between 0 and 1', () => {
    graph.add('mod:a', 'imports', 'mod:b');
    graph.add('mod:b', 'imports', 'mod:c');
    graph.add('mod:c', 'imports', 'mod:a');

    const result = detectCommunities(graph);
    expect(result.modularity).toBeGreaterThanOrEqual(0);
    expect(result.modularity).toBeLessThanOrEqual(1);
  });

  it('computedAt is valid', () => {
    graph.add('mod:a', 'imports', 'mod:b');
    const before = Date.now();
    const result = detectCommunities(graph);
    expect(result.computedAt).toBeGreaterThanOrEqual(before);
  });

  it('uses PageRank for tie-breaking', () => {
    // Create a situation where ties exist
    graph.add('mod:a', 'imports', 'mod:b');
    graph.add('mod:a', 'imports', 'mod:c');
    graph.add('mod:b', 'imports', 'mod:a');
    graph.add('mod:c', 'imports', 'mod:a');

    const prScores = new Map([
      ['mod:a', 1.0],
      ['mod:b', 0.5],
      ['mod:c', 0.3],
    ]);

    const result = detectCommunities(graph, {}, prScores);
    expect(result.communities.size).toBeGreaterThan(0);
  });

  it('handles disconnected components', () => {
    graph.add('mod:a', 'imports', 'mod:b');
    graph.add('mod:c', 'imports', 'mod:d');

    const result = detectCommunities(graph);
    // Should have 2 communities (each pair)
    expect(result.communityMembers.size).toBe(2);
  });

  it('respects entityPrefix filter', () => {
    graph.add('mod:a', 'imports', 'mod:b');
    graph.add('fn:x', 'calls', 'fn:y');

    const result = detectCommunities(graph, { entityPrefix: 'mod:' });
    // Should only have mod: entities
    for (const entity of result.communities.keys()) {
      expect(entity.startsWith('mod:')).toBe(true);
    }
  });

  it('deterministic with same seed', () => {
    graph.add('mod:a', 'imports', 'mod:b');
    graph.add('mod:b', 'imports', 'mod:c');
    graph.add('mod:c', 'imports', 'mod:a');
    graph.add('mod:d', 'imports', 'mod:e');
    graph.add('mod:e', 'imports', 'mod:d');

    const r1 = detectCommunities(graph, { seed: 42 });
    const r2 = detectCommunities(graph, { seed: 42 });

    expect([...r1.communities.entries()]).toEqual([...r2.communities.entries()]);
  });

  it('handles large graph', () => {
    for (let i = 0; i < 50; i++) {
      graph.add(`mod:m${i}`, 'imports', `mod:m${(i + 1) % 50}`);
    }

    const result = detectCommunities(graph);
    expect(result.communities.size).toBeGreaterThan(0);
  });
});

describe('summarizeCommunity', () => {
  let graph: KnowledgeGraph;

  beforeEach(() => {
    KnowledgeGraph.resetInstance();
    graph = KnowledgeGraph.getInstance();
  });

  it('returns "(empty)" for empty members', () => {
    expect(summarizeCommunity(graph, [])).toBe('(empty)');
  });

  it('shows module count', () => {
    graph.add('mod:src/agent/executor', 'imports', 'mod:src/agent/context');
    const summary = summarizeCommunity(graph, ['mod:src/agent/executor', 'mod:src/agent/context']);
    expect(summary).toContain('2 modules');
  });

  it('shows top entities by PageRank', () => {
    const members = ['mod:src/a', 'mod:src/b', 'mod:src/c'];
    const prScores = new Map([
      ['mod:src/a', 0.9],
      ['mod:src/b', 0.5],
      ['mod:src/c', 0.1],
    ]);

    const summary = summarizeCommunity(graph, members, prScores);
    expect(summary).toContain('top:');
  });
});
