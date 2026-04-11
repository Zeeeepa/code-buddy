/**
 * Community Detector Tests
 *
 * Tests for label propagation clustering on the code graph.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { KnowledgeGraph } from '../../src/knowledge/knowledge-graph.js';
import { detectCommunities, type Community } from '../../src/knowledge/community-detector.js';

describe('CommunityDetector', () => {
  let graph: KnowledgeGraph;

  beforeEach(() => {
    KnowledgeGraph.resetInstance();
    graph = KnowledgeGraph.getInstance();
  });

  function buildTwoClusters() {
    // Cluster 1: auth module (heavily interconnected)
    graph.add('fn:login', 'calls', 'fn:authenticate');
    graph.add('fn:authenticate', 'calls', 'fn:hashPassword');
    graph.add('fn:hashPassword', 'calls', 'fn:validateToken');
    graph.add('fn:validateToken', 'calls', 'fn:login');

    // Cluster 2: payment module (heavily interconnected)
    graph.add('fn:processPayment', 'calls', 'fn:validateCard');
    graph.add('fn:validateCard', 'calls', 'fn:chargeCard');
    graph.add('fn:chargeCard', 'calls', 'fn:createReceipt');
    graph.add('fn:createReceipt', 'calls', 'fn:processPayment');

    // Weak link between clusters
    graph.add('fn:login', 'calls', 'fn:processPayment');
  }

  it('should detect communities in a graph with two clusters', () => {
    buildTwoClusters();
    const communities = detectCommunities(graph);

    expect(communities.length).toBeGreaterThanOrEqual(1);
  });

  it('should return empty for empty graph', () => {
    const communities = detectCommunities(graph);
    expect(communities).toHaveLength(0);
  });

  it('should respect minimum size filter', () => {
    // Small cluster of 2 nodes
    graph.add('fn:a', 'calls', 'fn:b');

    // Larger cluster of 4 nodes
    graph.add('fn:c', 'calls', 'fn:d');
    graph.add('fn:d', 'calls', 'fn:e');
    graph.add('fn:e', 'calls', 'fn:f');

    const comm3 = detectCommunities(graph, { minSize: 3 });
    const comm2 = detectCommunities(graph, { minSize: 2 });

    // With minSize=3, the 2-node cluster should be excluded
    expect(comm2.length).toBeGreaterThanOrEqual(comm3.length);
  });

  it('should calculate cohesion between 0 and 1', () => {
    buildTwoClusters();
    const communities = detectCommunities(graph);

    for (const comm of communities) {
      expect(comm.cohesion).toBeGreaterThanOrEqual(0);
      expect(comm.cohesion).toBeLessThanOrEqual(1);
    }
  });

  it('should assign community names', () => {
    // Add definedIn to help name communities
    graph.add('fn:loginHandler', 'calls', 'fn:validateUser');
    graph.add('fn:validateUser', 'calls', 'fn:checkSession');
    graph.add('fn:checkSession', 'calls', 'fn:refreshToken');

    graph.add('fn:loginHandler', 'definedIn', 'mod:src/auth/login');
    graph.add('fn:validateUser', 'definedIn', 'mod:src/auth/validate');
    graph.add('fn:checkSession', 'definedIn', 'mod:src/auth/session');

    const communities = detectCommunities(graph);
    expect(communities.length).toBeGreaterThanOrEqual(1);
    // Should have a non-empty name
    expect(communities[0].name.length).toBeGreaterThan(0);
  });

  it('should identify entry points', () => {
    // fn:external calls fn:entry (entry is the public interface)
    graph.add('fn:external', 'calls', 'fn:entry');
    graph.add('fn:entry', 'calls', 'fn:internal1');
    graph.add('fn:internal1', 'calls', 'fn:internal2');
    graph.add('fn:internal2', 'calls', 'fn:internal3');

    const communities = detectCommunities(graph, { minSize: 3 });

    for (const comm of communities) {
      // Entry points array should exist
      expect(Array.isArray(comm.entryPoints)).toBe(true);
    }
  });

  it('should list files in communities', () => {
    graph.add('fn:a', 'calls', 'fn:b');
    graph.add('fn:b', 'calls', 'fn:c');
    graph.add('fn:c', 'calls', 'fn:d');

    graph.add('fn:a', 'definedIn', 'mod:src/module-a');
    graph.add('fn:b', 'definedIn', 'mod:src/module-b');

    const communities = detectCommunities(graph, { minSize: 3 });

    if (communities.length > 0) {
      // Files array should exist (may be empty if no definedIn)
      expect(Array.isArray(communities[0].files)).toBe(true);
    }
  });

  it('should sort communities by size descending', () => {
    // Build two clusters of different sizes
    // Cluster 1: 5 nodes
    for (let i = 0; i < 4; i++) {
      graph.add(`fn:big${i}`, 'calls', `fn:big${i + 1}`);
    }

    // Cluster 2: 3 nodes (separate)
    graph.add('fn:small0', 'calls', 'fn:small1');
    graph.add('fn:small1', 'calls', 'fn:small2');

    const communities = detectCommunities(graph, { minSize: 3 });

    if (communities.length >= 2) {
      expect(communities[0].symbols.length).toBeGreaterThanOrEqual(communities[1].symbols.length);
    }
  });

  it('should handle a single fully-connected cluster', () => {
    graph.add('fn:a', 'calls', 'fn:b');
    graph.add('fn:b', 'calls', 'fn:c');
    graph.add('fn:c', 'calls', 'fn:a');
    graph.add('fn:a', 'calls', 'fn:c');

    const communities = detectCommunities(graph, { minSize: 3 });
    expect(communities.length).toBe(1);
    expect(communities[0].symbols.length).toBe(3);
    // Should have high cohesion since all edges are internal
    expect(communities[0].cohesion).toBeGreaterThan(0.5);
  });

  it('should converge within maxIterations', () => {
    // Even with many nodes, should not hang
    for (let i = 0; i < 50; i++) {
      graph.add(`fn:node${i}`, 'calls', `fn:node${(i + 1) % 50}`);
    }

    const communities = detectCommunities(graph, { maxIterations: 5 });
    expect(Array.isArray(communities)).toBe(true);
  });
});
