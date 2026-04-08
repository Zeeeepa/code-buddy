/**
 * AuditBridge — Claude Cowork parity Phase 3 step 10
 *
 * Wraps the core RunStore (`src/observability/run-store.ts`) so the Cowork
 * renderer can list recent runs, inspect individual event streams, and
 * export a flat CSV of the currently filtered runs. Reading is lazy:
 * the core module is only loaded when the renderer requests data.
 *
 * @module main/observability/audit-bridge
 */

import { log, logWarn } from '../utils/logger';
import { loadCoreModule } from '../utils/core-loader';

export interface AuditRunFilter {
  limit?: number;
  status?: 'running' | 'completed' | 'failed' | 'cancelled';
  sessionId?: string;
  sinceTs?: number;
  untilTs?: number;
}

export interface AuditRunSummary {
  runId: string;
  objective: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: number;
  endedAt?: number;
  durationMs?: number;
  eventCount: number;
  artifactCount: number;
  channel?: string;
  sessionId?: string;
  userId?: string;
  tags?: string[];
  totalCost?: number;
  totalTokens?: number;
  toolCallCount?: number;
}

export interface AuditRunEvent {
  ts: number;
  type: string;
  runId: string;
  data: Record<string, unknown>;
}

export interface AuditRunDetail extends AuditRunSummary {
  events: AuditRunEvent[];
  metrics: Record<string, number>;
  artifacts: string[];
}

interface CoreRunSummaryLike {
  runId: string;
  objective: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: number;
  endedAt?: number;
  eventCount: number;
  artifactCount: number;
  metadata?: {
    channel?: string;
    sessionId?: string;
    userId?: string;
    tags?: string[];
  };
}

interface CoreRunMetricsLike {
  totalTokens?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalCost?: number;
  durationMs?: number;
  toolCallCount?: number;
  failoverCount?: number;
}

interface CoreRunRecordLike {
  summary: CoreRunSummaryLike;
  metrics: CoreRunMetricsLike;
  artifacts: string[];
}

interface CoreRunEventLike {
  ts: number;
  type: string;
  runId: string;
  data: Record<string, unknown>;
}

interface CoreRunStoreInstance {
  listRuns(limit?: number): CoreRunSummaryLike[];
  getRun(runId: string): CoreRunRecordLike | null;
  getEvents(runId: string): CoreRunEventLike[];
}

interface CoreRunStoreModule {
  RunStore: {
    getInstance: () => CoreRunStoreInstance;
  };
}

let cachedModule: CoreRunStoreModule | null = null;

async function loadModule(): Promise<CoreRunStoreModule | null> {
  if (cachedModule) return cachedModule;
  const mod = await loadCoreModule<CoreRunStoreModule>('observability/run-store.js');
  if (mod) {
    cachedModule = mod;
    log('[AuditBridge] Core RunStore loaded');
  } else {
    logWarn('[AuditBridge] Core RunStore unavailable');
  }
  return mod;
}

function mergeSummary(
  summary: CoreRunSummaryLike,
  metrics: CoreRunMetricsLike
): AuditRunSummary {
  return {
    runId: summary.runId,
    objective: summary.objective,
    status: summary.status,
    startedAt: summary.startedAt,
    endedAt: summary.endedAt,
    durationMs: metrics.durationMs,
    eventCount: summary.eventCount ?? 0,
    artifactCount: summary.artifactCount ?? 0,
    channel: summary.metadata?.channel,
    sessionId: summary.metadata?.sessionId,
    userId: summary.metadata?.userId,
    tags: summary.metadata?.tags,
    totalCost: metrics.totalCost,
    totalTokens: metrics.totalTokens,
    toolCallCount: metrics.toolCallCount,
  };
}

function passesFilter(summary: AuditRunSummary, filter?: AuditRunFilter): boolean {
  if (!filter) return true;
  if (filter.status && summary.status !== filter.status) return false;
  if (filter.sessionId && summary.sessionId !== filter.sessionId) return false;
  if (filter.sinceTs && summary.startedAt < filter.sinceTs) return false;
  if (filter.untilTs && summary.startedAt > filter.untilTs) return false;
  return true;
}

/**
 * List recent runs with optional filtering. Returns an empty list when
 * the core module isn't available (e.g. dev mode without bundled src).
 */
export async function listRuns(filter?: AuditRunFilter): Promise<AuditRunSummary[]> {
  const mod = await loadModule();
  if (!mod) return [];
  try {
    const store = mod.RunStore.getInstance();
    const limit = filter?.limit ?? 100;
    const coreRuns = store.listRuns(limit);
    const out: AuditRunSummary[] = [];
    for (const summary of coreRuns) {
      const record = store.getRun(summary.runId);
      const metrics = record?.metrics ?? {};
      const merged = mergeSummary(summary, metrics);
      if (passesFilter(merged, filter)) out.push(merged);
    }
    return out;
  } catch (err) {
    logWarn('[AuditBridge] listRuns failed:', err);
    return [];
  }
}

export async function getRunDetail(runId: string): Promise<AuditRunDetail | null> {
  const mod = await loadModule();
  if (!mod) return null;
  try {
    const store = mod.RunStore.getInstance();
    const record = store.getRun(runId);
    if (!record) return null;
    const summary = mergeSummary(record.summary, record.metrics);
    const events = store.getEvents(runId).map((ev) => ({
      ts: ev.ts,
      type: ev.type,
      runId: ev.runId,
      data: ev.data ?? {},
    }));
    const metricsPlain: Record<string, number> = {};
    for (const [k, v] of Object.entries(record.metrics)) {
      if (typeof v === 'number') metricsPlain[k] = v;
    }
    return {
      ...summary,
      events,
      metrics: metricsPlain,
      artifacts: record.artifacts ?? [],
    };
  } catch (err) {
    logWarn('[AuditBridge] getRunDetail failed:', err);
    return null;
  }
}

function csvEscape(value: unknown): string {
  if (value === undefined || value === null) return '';
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  if (/[,"\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Build a CSV export for the given filter. Header columns match the
 * `AuditRunSummary` shape plus a couple of derived columns.
 */
export async function exportCsv(filter?: AuditRunFilter): Promise<string> {
  const runs = await listRuns(filter);
  const header = [
    'runId',
    'objective',
    'status',
    'startedAt',
    'endedAt',
    'durationMs',
    'eventCount',
    'artifactCount',
    'channel',
    'sessionId',
    'userId',
    'totalCost',
    'totalTokens',
    'toolCallCount',
    'tags',
  ];
  const lines: string[] = [header.join(',')];
  for (const run of runs) {
    lines.push(
      [
        csvEscape(run.runId),
        csvEscape(run.objective),
        csvEscape(run.status),
        csvEscape(new Date(run.startedAt).toISOString()),
        csvEscape(run.endedAt ? new Date(run.endedAt).toISOString() : ''),
        csvEscape(run.durationMs ?? ''),
        csvEscape(run.eventCount),
        csvEscape(run.artifactCount),
        csvEscape(run.channel ?? ''),
        csvEscape(run.sessionId ?? ''),
        csvEscape(run.userId ?? ''),
        csvEscape(run.totalCost ?? ''),
        csvEscape(run.totalTokens ?? ''),
        csvEscape(run.toolCallCount ?? ''),
        csvEscape((run.tags ?? []).join('|')),
      ].join(',')
    );
  }
  return lines.join('\n');
}
