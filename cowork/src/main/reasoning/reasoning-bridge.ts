/**
 * ReasoningBridge — Claude Cowork parity Phase 3 step 17
 *
 * Captures reasoning traces from the agent runtime. When the engine
 * emits reasoning events (from the `reason` tool or the extended
 * thinking middleware), the bridge accumulates them into a tree keyed
 * by `toolUseId`, so the Cowork renderer can render a slide-out
 * ReasoningTraceViewer on-demand.
 *
 * The bridge is storage-agnostic: traces live in memory with a bounded
 * LRU (last 20 traces) so long-running sessions don't leak. A trace
 * can also be seeded programmatically from the engine runner by
 * calling `pushEvent()` as events stream in.
 *
 * @module main/reasoning/reasoning-bridge
 */

import { EventEmitter } from 'events';

export interface ReasoningNode {
  id: string;
  parentId: string | null;
  depth: number;
  label: string;
  score?: number;
  selected?: boolean;
  tokensUsed?: number;
  ts: number;
}

export interface ReasoningTrace {
  toolUseId: string;
  sessionId: string;
  problem: string;
  mode: string;
  startedAt: number;
  endedAt?: number;
  nodes: ReasoningNode[];
  finalAnswer?: string;
  iterations?: number;
}

export interface ReasoningEventInput {
  toolUseId: string;
  sessionId: string;
  type: 'start' | 'node' | 'select' | 'complete';
  node?: Omit<ReasoningNode, 'ts'>;
  problem?: string;
  mode?: string;
  finalAnswer?: string;
  iterations?: number;
}

const MAX_TRACES = 20;

export class ReasoningBridge extends EventEmitter {
  private traces: Map<string, ReasoningTrace> = new Map();

  pushEvent(input: ReasoningEventInput): void {
    const existing = this.traces.get(input.toolUseId);
    if (input.type === 'start') {
      const trace: ReasoningTrace = {
        toolUseId: input.toolUseId,
        sessionId: input.sessionId,
        problem: input.problem ?? '',
        mode: input.mode ?? 'medium',
        startedAt: Date.now(),
        nodes: [],
      };
      this.traces.set(input.toolUseId, trace);
      this.evictOld();
      this.emit('reasoning.trace', trace);
      return;
    }
    if (!existing) return;
    if (input.type === 'node' && input.node) {
      existing.nodes.push({ ...input.node, ts: Date.now() });
      this.emit('reasoning.node', {
        toolUseId: input.toolUseId,
        node: existing.nodes[existing.nodes.length - 1],
      });
      return;
    }
    if (input.type === 'select' && input.node) {
      const idx = existing.nodes.findIndex((n) => n.id === input.node!.id);
      if (idx >= 0) {
        existing.nodes[idx] = { ...existing.nodes[idx], selected: true };
      }
      return;
    }
    if (input.type === 'complete') {
      existing.endedAt = Date.now();
      existing.finalAnswer = input.finalAnswer;
      existing.iterations = input.iterations;
      this.emit('reasoning.complete', existing);
    }
  }

  getTrace(toolUseId: string): ReasoningTrace | null {
    return this.traces.get(toolUseId) ?? null;
  }

  listTraces(): Array<
    Pick<ReasoningTrace, 'toolUseId' | 'sessionId' | 'problem' | 'mode' | 'startedAt' | 'endedAt' | 'iterations'>
  > {
    return Array.from(this.traces.values())
      .sort((a, b) => b.startedAt - a.startedAt)
      .map(({ toolUseId, sessionId, problem, mode, startedAt, endedAt, iterations }) => ({
        toolUseId,
        sessionId,
        problem,
        mode,
        startedAt,
        endedAt,
        iterations,
      }));
  }

  clear(): void {
    this.traces.clear();
  }

  private evictOld(): void {
    if (this.traces.size <= MAX_TRACES) return;
    const sorted = Array.from(this.traces.entries()).sort(
      (a, b) => a[1].startedAt - b[1].startedAt
    );
    const toRemove = sorted.slice(0, sorted.length - MAX_TRACES);
    for (const [id] of toRemove) {
      this.traces.delete(id);
    }
  }
}

let singleton: ReasoningBridge | null = null;

export function getReasoningBridge(): ReasoningBridge {
  if (!singleton) {
    singleton = new ReasoningBridge();
  }
  return singleton;
}
