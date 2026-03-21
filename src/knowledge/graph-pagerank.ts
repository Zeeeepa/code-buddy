/**
 * PageRank — Entity-Level Centrality for the Knowledge Graph
 *
 * Computes importance scores for every entity in the graph based on
 * incoming link structure (who calls / imports whom).
 * Adapted from repository-map.ts PageRank with per-entity granularity.
 */

import type { KnowledgeGraph } from './knowledge-graph.js';

// ============================================================================
// Types
// ============================================================================

export interface PageRankConfig {
  /** Damping factor (probability of following a link). Default 0.85 */
  dampingFactor: number;
  /** Number of iterations. Default 10 */
  iterations: number;
  /** Which predicates count as links. Default ['calls', 'imports'] */
  predicates: string[];
}

export interface PageRankResult {
  /** Entity ID → normalized score [0, 1] */
  scores: Map<string, number>;
  /** Timestamp of computation */
  computedAt: number;
  /** Number of entities scored */
  entityCount: number;
}

const DEFAULT_CONFIG: PageRankConfig = {
  dampingFactor: 0.85,
  iterations: 10,
  predicates: ['calls', 'imports'],
};

// ============================================================================
// Algorithm
// ============================================================================

/**
 * Compute PageRank scores for all entities reachable via the given predicates.
 *
 * Algorithm:
 *   rank[n] = (1 - d) / N + d × Σ(rank[m] / outDegree[m]) for each m → n
 *
 * Scores are normalized to [0, 1] by dividing by the maximum.
 */
export function computePageRank(
  graph: KnowledgeGraph,
  config?: Partial<PageRankConfig>,
): PageRankResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const { dampingFactor: d, iterations, predicates } = cfg;

  // Build adjacency lists from triples filtered by predicates
  const outLinks = new Map<string, Set<string>>(); // entity → set of targets
  const inLinks = new Map<string, Set<string>>();   // entity → set of sources
  const allEntities = new Set<string>();

  for (const pred of predicates) {
    const triples = graph.query({ predicate: pred });
    for (const t of triples) {
      allEntities.add(t.subject);
      allEntities.add(t.object);

      let out = outLinks.get(t.subject);
      if (!out) { out = new Set(); outLinks.set(t.subject, out); }
      out.add(t.object);

      let inp = inLinks.get(t.object);
      if (!inp) { inp = new Set(); inLinks.set(t.object, inp); }
      inp.add(t.subject);
    }
  }

  const N = allEntities.size;
  if (N === 0) {
    return { scores: new Map(), computedAt: Date.now(), entityCount: 0 };
  }

  // Initialize: uniform distribution
  const rank = new Map<string, number>();
  const initial = 1 / N;
  for (const e of allEntities) {
    rank.set(e, initial);
  }

  // Iterate
  const base = (1 - d) / N;
  for (let iter = 0; iter < iterations; iter++) {
    const newRank = new Map<string, number>();

    for (const entity of allEntities) {
      let sum = 0;
      const sources = inLinks.get(entity);
      if (sources) {
        for (const src of sources) {
          const outDeg = outLinks.get(src)?.size ?? 1;
          sum += (rank.get(src) ?? 0) / outDeg;
        }
      }
      newRank.set(entity, base + d * sum);
    }

    // Copy new ranks
    for (const [k, v] of newRank) {
      rank.set(k, v);
    }
  }

  // Normalize to [0, 1]
  let maxRank = 0;
  for (const v of rank.values()) {
    if (v > maxRank) maxRank = v;
  }

  const scores = new Map<string, number>();
  if (maxRank > 0) {
    for (const [k, v] of rank) {
      scores.set(k, v / maxRank);
    }
  }

  return {
    scores,
    computedAt: Date.now(),
    entityCount: N,
  };
}
