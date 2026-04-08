/**
 * ReasoningTraceViewer — Claude Cowork parity Phase 3 step 17
 *
 * Slide-out panel that renders captured reasoning traces (Tree-of-Thought
 * + MCTS) from the main-process bridge. Shows a list of recent traces
 * on the left, a node tree on the right with scores + highlighted
 * selected path, and a timeline scrubber for playback.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Brain, Zap, RefreshCw, Trash2 } from 'lucide-react';

interface ReasoningNode {
  id: string;
  parentId: string | null;
  depth: number;
  label: string;
  score?: number;
  selected?: boolean;
  tokensUsed?: number;
  ts: number;
}

interface ReasoningTrace {
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

interface TraceSummary {
  toolUseId: string;
  sessionId: string;
  problem: string;
  mode: string;
  startedAt: number;
  endedAt?: number;
  iterations?: number;
}

interface ReasoningTraceViewerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ReasoningTraceViewer({ isOpen, onClose }: ReasoningTraceViewerProps) {
  const { t } = useTranslation();
  const [traces, setTraces] = useState<TraceSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ReasoningTrace | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!window.electronAPI?.reasoning?.listTraces) return;
    setIsLoading(true);
    setError(null);
    try {
      const list = (await window.electronAPI.reasoning.listTraces()) as TraceSummary[];
      setTraces(list);
      if (list.length > 0 && !selectedId) {
        setSelectedId(list[0].toolUseId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    if (isOpen) void load();
  }, [isOpen, load]);

  useEffect(() => {
    if (!selectedId || !isOpen) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    (async () => {
      if (!window.electronAPI?.reasoning?.getTrace) return;
      try {
        const d = (await window.electronAPI.reasoning.getTrace(selectedId)) as ReasoningTrace | null;
        if (!cancelled) setDetail(d);
      } catch {
        if (!cancelled) setDetail(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId, isOpen]);

  const handleClear = useCallback(async () => {
    if (!window.electronAPI?.reasoning?.clear) return;
    if (!window.confirm(t('reasoning.clearConfirm', 'Clear all reasoning traces?'))) return;
    await window.electronAPI.reasoning.clear();
    setTraces([]);
    setSelectedId(null);
    setDetail(null);
  }, [t]);

  const tree = useMemo(() => {
    if (!detail) return null;
    const byId = new Map<string, { node: ReasoningNode; children: ReasoningNode[] }>();
    for (const n of detail.nodes) {
      byId.set(n.id, { node: n, children: [] });
    }
    const roots: ReasoningNode[] = [];
    for (const { node } of byId.values()) {
      if (node.parentId && byId.has(node.parentId)) {
        byId.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }
    return { byId, roots };
  }, [detail]);

  const renderNode = (node: ReasoningNode, depth: number): React.ReactNode => {
    const children = tree?.byId.get(node.id)?.children ?? [];
    const hasScore = typeof node.score === 'number';
    return (
      <div key={node.id} style={{ marginLeft: depth * 16 }}>
        <div
          className={`flex items-start gap-2 px-2 py-1 rounded text-xs ${
            node.selected ? 'bg-accent/10 border-l-2 border-accent' : ''
          }`}
        >
          <Zap
            size={10}
            className={node.selected ? 'text-accent mt-0.5' : 'text-text-muted mt-0.5'}
          />
          <div className="flex-1 min-w-0">
            <div className="text-text-primary line-clamp-2">{node.label}</div>
            {hasScore && (
              <div className="text-[10px] text-text-muted mt-0.5">
                {t('reasoning.score', 'Score')}: {(node.score ?? 0).toFixed(3)}
                {node.tokensUsed ? ` · ${node.tokensUsed} tokens` : ''}
              </div>
            )}
          </div>
        </div>
        {children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 h-full w-[640px] max-w-[95vw] bg-background border-l border-border shadow-2xl z-40 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-muted">
        <div className="flex items-center gap-2">
          <Brain size={16} className="text-accent" />
          <h2 className="text-sm font-semibold text-text-primary">
            {t('reasoning.title', 'Reasoning trace')}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void load()}
            disabled={isLoading}
            className="p-1 rounded hover:bg-surface-hover text-text-muted hover:text-text-primary"
            title={t('common.refresh', 'Refresh')}
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => void handleClear()}
            className="p-1 rounded hover:bg-surface-hover text-text-muted hover:text-error"
            title={t('reasoning.clear', 'Clear')}
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-surface-hover text-text-muted hover:text-text-primary"
            aria-label={t('common.close', 'Close')}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-2 text-xs text-error bg-error/10 border-b border-error/30">
          {error}
        </div>
      )}

      <div className="flex-1 grid grid-cols-[240px_1fr] overflow-hidden">
        <div className="border-r border-border-muted overflow-y-auto">
          {traces.length === 0 && !isLoading && (
            <div className="px-4 py-8 text-center text-xs text-text-muted">
              {t('reasoning.empty', 'No reasoning traces captured yet. Traces appear here when the agent uses the reason tool.')}
            </div>
          )}
          {traces.map((trace) => (
            <button
              key={trace.toolUseId}
              onClick={() => setSelectedId(trace.toolUseId)}
              className={`w-full text-left px-3 py-2 border-b border-border-muted transition-colors ${
                selectedId === trace.toolUseId ? 'bg-accent/10' : 'hover:bg-surface-hover'
              }`}
            >
              <div className="text-xs font-medium text-text-primary line-clamp-2">
                {trace.problem || trace.toolUseId}
              </div>
              <div className="text-[10px] text-text-muted mt-0.5">
                {trace.mode} · {new Date(trace.startedAt).toLocaleTimeString()}
                {trace.iterations ? ` · ${trace.iterations} iters` : ''}
              </div>
            </button>
          ))}
        </div>

        <div className="flex flex-col overflow-hidden">
          {detail ? (
            <>
              <div className="px-4 py-3 border-b border-border-muted">
                <div className="text-xs text-text-muted">
                  {t('reasoning.mode', 'Mode')}:{' '}
                  <span className="text-text-primary">{detail.mode}</span> · {detail.nodes.length}{' '}
                  {t('reasoning.nodes', 'nodes')}
                </div>
                {detail.problem && (
                  <div className="text-sm text-text-primary mt-1">{detail.problem}</div>
                )}
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-0.5">
                {tree && tree.roots.length > 0 ? (
                  tree.roots.map((root) => renderNode(root, 0))
                ) : (
                  <div className="text-xs text-text-muted">
                    {t('reasoning.noNodes', 'Trace contains no nodes')}
                  </div>
                )}
              </div>
              {detail.finalAnswer && (
                <div className="border-t border-border-muted px-4 py-3 bg-success/5">
                  <div className="text-[10px] uppercase tracking-wide text-text-muted">
                    {t('reasoning.finalAnswer', 'Final answer')}
                  </div>
                  <div className="text-xs text-text-primary mt-1 whitespace-pre-wrap">
                    {detail.finalAnswer}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-text-muted">
              {t('reasoning.selectHint', 'Select a trace to inspect')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
