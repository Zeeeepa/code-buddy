/**
 * Impact Analyzer Tests
 *
 * Tests for blast radius analysis with direction control and risk scoring.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { KnowledgeGraph } from '../../src/knowledge/knowledge-graph.js';
import { analyzeImpact, type ImpactResult } from '../../src/knowledge/impact-analyzer.js';

describe('ImpactAnalyzer', () => {
  let graph: KnowledgeGraph;

  beforeEach(() => {
    KnowledgeGraph.resetInstance();
    graph = KnowledgeGraph.getInstance();
  });

  function buildCallGraph() {
    // A calls B, B calls C, C calls D
    graph.add('fn:A', 'calls', 'fn:B');
    graph.add('fn:B', 'calls', 'fn:C');
    graph.add('fn:C', 'calls', 'fn:D');

    // E also calls B (multiple callers)
    graph.add('fn:E', 'calls', 'fn:B');

    // Define files
    graph.add('fn:A', 'definedIn', 'mod:src/a');
    graph.add('fn:B', 'definedIn', 'mod:src/b');
    graph.add('fn:C', 'definedIn', 'mod:src/c');
    graph.add('fn:D', 'definedIn', 'mod:src/d');
    graph.add('fn:E', 'definedIn', 'mod:src/e');
  }

  // =========================================================================
  // Legacy API (backward-compatible)
  // =========================================================================

  describe('legacy API', () => {
    it('should find direct callers', () => {
      buildCallGraph();
      const result = analyzeImpact(graph, 'fn:B') as ImpactResult;

      expect(result.entity).toBe('fn:B');
      expect(result.directCallers).toContain('fn:A');
      expect(result.directCallers).toContain('fn:E');
    });

    it('should find indirect callers', () => {
      buildCallGraph();
      const result = analyzeImpact(graph, 'fn:C') as ImpactResult;

      expect(result.directCallers).toContain('fn:B');
      // A calls B which calls C → A is indirect
      expect(result.indirectCallers.length).toBeGreaterThanOrEqual(1);
    });

    it('should find affected files', () => {
      buildCallGraph();
      const result = analyzeImpact(graph, 'fn:B') as ImpactResult;

      expect(result.affectedFiles.length).toBeGreaterThanOrEqual(1);
    });

    it('should produce formatted output', () => {
      buildCallGraph();
      const result = analyzeImpact(graph, 'fn:B') as ImpactResult;

      expect(result.formatted).toContain('Impact Analysis');
      expect(result.formatted).toContain('fn:B');
    });

    it('should handle unknown entity', () => {
      buildCallGraph();
      const result = analyzeImpact(graph, 'fn:nonexistent') as ImpactResult;

      expect(result.directCallers).toHaveLength(0);
      expect(result.totalAffected).toBe(0);
    });
  });

  // =========================================================================
  // Additional legacy API tests
  // =========================================================================

  describe('additional legacy API', () => {
    it('should handle unknown entity gracefully', () => {
      graph.add('fn:alpha', 'calls', 'fn:beta');
      const result = analyzeImpact(graph, 'zzz_completely_unrelated_xyzzy_42') as ImpactResult;

      expect(result.directCallers).toHaveLength(0);
      expect(result.totalAffected).toBe(0);
    });

    it('should respect maxDepth', () => {
      // Long chain: A → B → C → D → E → F
      graph.add('fn:A', 'calls', 'fn:B');
      graph.add('fn:B', 'calls', 'fn:C');
      graph.add('fn:C', 'calls', 'fn:D');
      graph.add('fn:D', 'calls', 'fn:E');
      graph.add('fn:E', 'calls', 'fn:F');

      const result1 = analyzeImpact(graph, 'fn:A', 2) as ImpactResult;
      const result2 = analyzeImpact(graph, 'fn:A', 10) as ImpactResult;

      expect(result1.totalAffected).toBeLessThanOrEqual(result2.totalAffected);
    });
  });
});
