/**
 * AuditLogViewer — Claude Cowork parity Phase 3 step 10
 *
 * Table browser for runs persisted by the core RunStore. Supports filtering
 * by status/session/date, expanding a row to view its events.jsonl, and
 * CSV export of the currently filtered set. Data is fetched lazily via
 * `window.electronAPI.audit`; no polling by default.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  RefreshCw,
  Download,
  ChevronDown,
  ChevronRight,
  Clock,
  Activity,
  AlertCircle,
  Loader2,
} from 'lucide-react';

interface AuditRunSummary {
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

interface AuditRunEvent {
  ts: number;
  type: string;
  runId: string;
  data: Record<string, unknown>;
}

interface AuditRunDetail extends AuditRunSummary {
  events: AuditRunEvent[];
  metrics: Record<string, number>;
  artifacts: string[];
}

type StatusFilter = 'all' | 'running' | 'completed' | 'failed' | 'cancelled';

function fmtDuration(ms?: number): string {
  if (!ms || ms <= 0) return '—';
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s - m * 60);
  return `${m}m ${rem}s`;
}

function fmtCost(cost?: number): string {
  if (cost === undefined || cost === null) return '—';
  if (cost === 0) return '$0.00';
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

function fmtTs(ts: number): string {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}

function statusClass(status: string): string {
  switch (status) {
    case 'completed':
      return 'bg-success/20 text-success';
    case 'failed':
      return 'bg-error/20 text-error';
    case 'cancelled':
      return 'bg-warning/20 text-warning';
    case 'running':
    default:
      return 'bg-accent/20 text-accent';
  }
}

export function AuditLogViewer() {
  const { t } = useTranslation();
  const [runs, setRuns] = useState<AuditRunSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sessionFilter, setSessionFilter] = useState('');
  const [limit, setLimit] = useState(50);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detailCache, setDetailCache] = useState<Record<string, AuditRunDetail>>({});
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!window.electronAPI?.audit?.listRuns) {
      setError(t('audit.unavailable', 'Audit store unavailable'));
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const filter: Record<string, unknown> = { limit };
      if (statusFilter !== 'all') filter.status = statusFilter;
      if (sessionFilter.trim()) filter.sessionId = sessionFilter.trim();
      const list = (await window.electronAPI.audit.listRuns(filter)) as AuditRunSummary[];
      setRuns(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [limit, statusFilter, sessionFilter, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleToggleRow = useCallback(
    async (runId: string) => {
      if (expanded === runId) {
        setExpanded(null);
        return;
      }
      setExpanded(runId);
      if (detailCache[runId]) return;
      if (!window.electronAPI?.audit?.getRunDetail) return;
      setLoadingDetail(runId);
      try {
        const detail = (await window.electronAPI.audit.getRunDetail(runId)) as AuditRunDetail | null;
        if (detail) {
          setDetailCache((prev) => ({ ...prev, [runId]: detail }));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoadingDetail(null);
      }
    },
    [expanded, detailCache]
  );

  const handleExport = useCallback(async () => {
    if (!window.electronAPI?.audit?.exportCsv) return;
    try {
      const filter: Record<string, unknown> = { limit };
      if (statusFilter !== 'all') filter.status = statusFilter;
      if (sessionFilter.trim()) filter.sessionId = sessionFilter.trim();
      const csv = (await window.electronAPI.audit.exportCsv(filter)) as string;
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-runs-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [limit, statusFilter, sessionFilter]);

  const totals = useMemo(() => {
    return runs.reduce(
      (acc, r) => {
        acc.cost += r.totalCost ?? 0;
        acc.tokens += r.totalTokens ?? 0;
        acc.tools += r.toolCallCount ?? 0;
        return acc;
      },
      { cost: 0, tokens: 0, tools: 0 }
    );
  }, [runs]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">
            {t('audit.title', 'Audit log')}
          </h3>
          <p className="text-xs text-text-muted mt-0.5">
            {t('audit.hint', 'Recent agent runs with tools, cost and timing')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void load()}
            disabled={isLoading}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-surface border border-border text-text-primary hover:bg-surface-hover disabled:opacity-50 transition-colors"
          >
            {isLoading ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <RefreshCw size={12} />
            )}
            {t('common.refresh', 'Refresh')}
          </button>
          <button
            onClick={() => void handleExport()}
            disabled={runs.length === 0}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-accent text-white hover:bg-accent-hover disabled:opacity-50 transition-colors"
          >
            <Download size={12} />
            {t('audit.exportCsv', 'Export CSV')}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <select
          value={statusFilter}
          onChange={(ev) => setStatusFilter(ev.target.value as StatusFilter)}
          className="px-2 py-1.5 rounded-md bg-surface border border-border text-text-primary focus:outline-none focus:border-accent"
        >
          <option value="all">{t('audit.allStatuses', 'All statuses')}</option>
          <option value="running">{t('audit.running', 'Running')}</option>
          <option value="completed">{t('audit.completed', 'Completed')}</option>
          <option value="failed">{t('audit.failed', 'Failed')}</option>
          <option value="cancelled">{t('audit.cancelled', 'Cancelled')}</option>
        </select>
        <input
          value={sessionFilter}
          onChange={(ev) => setSessionFilter(ev.target.value)}
          placeholder={t('audit.sessionFilter', 'Session ID')}
          className="px-2 py-1.5 rounded-md bg-surface border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent font-mono"
        />
        <select
          value={limit}
          onChange={(ev) => setLimit(Number(ev.target.value))}
          className="px-2 py-1.5 rounded-md bg-surface border border-border text-text-primary focus:outline-none focus:border-accent"
        >
          <option value={20}>20</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
          <option value={200}>200</option>
        </select>
        <div className="ml-auto flex items-center gap-3 text-text-muted">
          <span>
            {t('audit.totals', 'Totals')}:{' '}
            <span className="text-text-primary">{runs.length}</span> {t('audit.runs', 'runs')}
          </span>
          <span>
            {fmtCost(totals.cost)} · {totals.tokens.toLocaleString()} tokens · {totals.tools}{' '}
            {t('audit.tools', 'tools')}
          </span>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-xs text-error bg-error/10 border border-error/30 rounded-md px-3 py-2">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="border border-border rounded-lg overflow-hidden">
        <div className="grid grid-cols-[28px_1fr_120px_100px_80px_80px_80px] items-center gap-2 px-3 py-2 bg-surface text-[11px] uppercase tracking-wide text-text-muted">
          <span></span>
          <span>{t('audit.objective', 'Objective')}</span>
          <span>{t('audit.status', 'Status')}</span>
          <span className="text-right">{t('audit.duration', 'Duration')}</span>
          <span className="text-right">{t('audit.events', 'Events')}</span>
          <span className="text-right">{t('audit.tools', 'Tools')}</span>
          <span className="text-right">{t('audit.cost', 'Cost')}</span>
        </div>

        {runs.length === 0 && !isLoading && (
          <div className="py-8 text-center text-xs text-text-muted">
            {t('audit.empty', 'No runs recorded yet')}
          </div>
        )}

        <div className="divide-y divide-border-muted">
          {runs.map((run) => {
            const isOpen = expanded === run.runId;
            const detail = detailCache[run.runId];
            return (
              <div key={run.runId}>
                <button
                  type="button"
                  onClick={() => void handleToggleRow(run.runId)}
                  className="w-full grid grid-cols-[28px_1fr_120px_100px_80px_80px_80px] items-center gap-2 px-3 py-2 text-left text-xs hover:bg-surface-hover transition-colors"
                >
                  <span className="text-text-muted">
                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-text-primary truncate">{run.objective}</span>
                    <span className="block text-[10px] text-text-muted mt-0.5 font-mono truncate">
                      {run.runId} · {fmtTs(run.startedAt)}
                      {run.sessionId ? ` · ${run.sessionId}` : ''}
                    </span>
                  </span>
                  <span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${statusClass(run.status)}`}>
                      {run.status}
                    </span>
                  </span>
                  <span className="text-right text-text-secondary tabular-nums">
                    {fmtDuration(run.durationMs)}
                  </span>
                  <span className="text-right text-text-secondary tabular-nums">
                    {run.eventCount}
                  </span>
                  <span className="text-right text-text-secondary tabular-nums">
                    {run.toolCallCount ?? 0}
                  </span>
                  <span className="text-right text-text-secondary tabular-nums">
                    {fmtCost(run.totalCost)}
                  </span>
                </button>

                {isOpen && (
                  <div className="bg-background px-4 py-3 border-t border-border-muted">
                    {loadingDetail === run.runId && (
                      <div className="flex items-center gap-2 text-xs text-text-muted">
                        <Loader2 size={12} className="animate-spin" />
                        {t('audit.loadingEvents', 'Loading events…')}
                      </div>
                    )}
                    {detail && (
                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-text-muted">
                          {detail.channel && (
                            <span>
                              {t('audit.channel', 'Channel')}: {' '}
                              <span className="text-text-primary">{detail.channel}</span>
                            </span>
                          )}
                          {detail.userId && (
                            <span>
                              {t('audit.user', 'User')}:{' '}
                              <span className="text-text-primary">{detail.userId}</span>
                            </span>
                          )}
                          {detail.artifactCount > 0 && (
                            <span>
                              {t('audit.artifacts', 'Artifacts')}:{' '}
                              <span className="text-text-primary">{detail.artifactCount}</span>
                            </span>
                          )}
                          {(detail.tags ?? []).length > 0 && (
                            <span>
                              {t('audit.tags', 'Tags')}:{' '}
                              <span className="text-text-primary">{(detail.tags ?? []).join(', ')}</span>
                            </span>
                          )}
                        </div>
                        <div className="max-h-60 overflow-y-auto border border-border-muted rounded-md">
                          {detail.events.length === 0 ? (
                            <div className="p-3 text-[11px] text-text-muted">
                              {t('audit.noEvents', 'No events recorded')}
                            </div>
                          ) : (
                            detail.events.map((ev, idx) => (
                              <div
                                key={`${ev.ts}-${idx}`}
                                className="px-3 py-1.5 border-b border-border-muted last:border-0 text-[11px] font-mono flex items-start gap-2"
                              >
                                <Clock size={10} className="mt-0.5 text-text-muted shrink-0" />
                                <span className="text-text-muted w-36 shrink-0">
                                  {new Date(ev.ts).toLocaleTimeString()}
                                </span>
                                <span className="text-accent w-28 shrink-0 flex items-center gap-1">
                                  <Activity size={10} />
                                  {ev.type}
                                </span>
                                <span className="text-text-secondary flex-1 truncate">
                                  {JSON.stringify(ev.data)}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
