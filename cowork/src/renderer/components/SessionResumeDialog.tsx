import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock3, FolderTree, Loader2, Search, X, ArrowRight } from 'lucide-react';
import { useAppStore } from '../store';
import type { Message, TraceStep } from '../types';

interface SessionResumeSummary {
  sessionId: string;
  title: string;
  status: 'idle' | 'running' | 'completed' | 'error';
  model?: string;
  cwd?: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  userMessageCount: number;
  assistantMessageCount: number;
  toolCallCount: number;
  tokenInput: number;
  tokenOutput: number;
  totalTokens: number;
  totalExecutionTimeMs: number;
  transcriptPreview: string;
}

interface SessionResumeDetail {
  summary: SessionResumeSummary;
  messages: Message[];
  traceSteps: TraceStep[];
}

interface SessionResumeDialogProps {
  open: boolean;
  onClose: () => void;
}

function formatRelativeTime(timestamp: number): string {
  const delta = Date.now() - timestamp;
  if (delta < 60_000) return 'just now';
  if (delta < 3_600_000) return `${Math.round(delta / 60_000)}m ago`;
  if (delta < 86_400_000) return `${Math.round(delta / 3_600_000)}h ago`;
  return `${Math.round(delta / 86_400_000)}d ago`;
}

function groupByWorkspace(items: SessionResumeSummary[]): Array<[string, SessionResumeSummary[]]> {
  const groups = new Map<string, SessionResumeSummary[]>();
  for (const item of items) {
    const key = item.cwd || 'No workspace';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  return Array.from(groups.entries());
}

export const SessionResumeDialog: React.FC<SessionResumeDialogProps> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const setActiveSession = useAppStore((s) => s.setActiveSession);
  const setMessages = useAppStore((s) => s.setMessages);
  const setTraceSteps = useAppStore((s) => s.setTraceSteps);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<SessionResumeSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SessionResumeDetail | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [resuming, setResuming] = useState(false);

  const loadList = useCallback(async () => {
    if (!window.electronAPI?.sessionInsights) return;
    setLoadingList(true);
    try {
      const result = query.trim()
        ? await window.electronAPI.sessionInsights.search(query.trim(), 100)
        : await window.electronAPI.sessionInsights.list(100);
      const nextItems = result as SessionResumeSummary[];
      setItems(nextItems);
      setSelectedId((current) =>
        current && nextItems.some((item) => item.sessionId === current)
          ? current
          : (nextItems[0]?.sessionId ?? null)
      );
    } finally {
      setLoadingList(false);
    }
  }, [query]);

  useEffect(() => {
    if (open) void loadList();
  }, [open, loadList]);

  useEffect(() => {
    if (!open || !selectedId || !window.electronAPI?.sessionInsights?.detail) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoadingDetail(true);
    void window.electronAPI.sessionInsights.detail(selectedId).then((result) => {
      if (!cancelled) {
        setDetail(result as SessionResumeDetail | null);
        setLoadingDetail(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, selectedId]);

  const grouped = useMemo(() => groupByWorkspace(items), [items]);

  const handleResume = useCallback(async () => {
    if (!detail) return;
    setResuming(true);
    try {
      setMessages(detail.summary.sessionId, detail.messages);
      setTraceSteps(detail.summary.sessionId, detail.traceSteps);
      setActiveSession(detail.summary.sessionId);
      onClose();
    } finally {
      setResuming(false);
    }
  }, [detail, onClose, setActiveSession, setMessages, setTraceSteps]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
      data-testid="session-resume-dialog"
    >
      <div
        className="w-[760px] max-w-[96vw] max-h-[82vh] bg-background border border-border rounded-2xl shadow-elevated overflow-hidden flex flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-muted">
          <div>
            <div className="text-sm font-semibold text-text-primary">
              {t('sessionResume.title', 'Resume session')}
            </div>
            <div className="text-xs text-text-muted mt-0.5">
              {t(
                'sessionResume.subtitle',
                'Pick a previous session and continue from its workspace'
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-text-muted hover:text-text-primary transition-colors"
            title={t('common.close')}
          >
            <X size={14} />
          </button>
        </div>

        <div className="px-4 py-3 border-b border-border-muted">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t(
                'sessionResume.searchPlaceholder',
                'Search by title, model, workspace, or transcript…'
              )}
              className="w-full rounded-xl border border-transparent bg-surface pl-9 pr-3 py-2 text-[13px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border"
              data-testid="session-resume-search"
            />
          </div>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-[320px_1fr]">
          <div className="border-r border-border-muted overflow-y-auto">
            {loadingList && (
              <div className="flex items-center justify-center gap-2 py-12 text-xs text-text-muted">
                <Loader2 size={14} className="animate-spin" />
                {t('common.loading')}
              </div>
            )}

            {!loadingList && items.length === 0 && (
              <div
                className="px-4 py-12 text-center text-xs text-text-muted"
                data-testid="session-resume-empty"
              >
                {t('sessionResume.empty', 'No resumable sessions found')}
              </div>
            )}

            {!loadingList &&
              grouped.map(([workspace, sessions]) => (
                <div key={workspace} className="border-b border-border-muted last:border-b-0">
                  <div className="px-4 py-1.5 bg-surface/40 text-[10px] uppercase tracking-wide text-text-muted">
                    {workspace}
                  </div>
                  {sessions.map((item) => (
                    <button
                      key={item.sessionId}
                      onClick={() => setSelectedId(item.sessionId)}
                      className={`w-full px-4 py-3 text-left transition-colors ${
                        selectedId === item.sessionId ? 'bg-accent/10' : 'hover:bg-surface-hover'
                      }`}
                    >
                      <div className="text-xs font-medium text-text-primary truncate">
                        {item.title}
                      </div>
                      <div className="text-[11px] text-text-muted mt-0.5 truncate">
                        {item.model || t('sessionResume.unknownModel', 'Unknown model')}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-text-muted">
                        <span className="inline-flex items-center gap-1">
                          <Clock3 size={10} />
                          {formatRelativeTime(item.updatedAt)}
                        </span>
                        <span>{item.messageCount} msg</span>
                      </div>
                    </button>
                  ))}
                </div>
              ))}
          </div>

          <div className="flex flex-col min-h-0">
            {!selectedId && (
              <div className="flex-1 flex items-center justify-center text-xs text-text-muted">
                {t('sessionResume.selectHint', 'Select a session to resume')}
              </div>
            )}

            {selectedId && (
              <>
                <div className="px-4 py-3 border-b border-border-muted space-y-2">
                  <div className="text-sm font-semibold text-text-primary">
                    {detail?.summary.title ??
                      items.find((item) => item.sessionId === selectedId)?.title}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-text-muted">
                    <div>
                      {t('sessionResume.messages', 'Messages')}: {detail?.summary.messageCount ?? 0}
                    </div>
                    <div>
                      {t('sessionResume.tools', 'Tool calls')}: {detail?.summary.toolCallCount ?? 0}
                    </div>
                    <div>
                      {t('sessionResume.tokens', 'Tokens')}:{' '}
                      {detail ? detail.summary.totalTokens : 0}
                    </div>
                    <div>
                      {t('sessionResume.updated', 'Updated')}:{' '}
                      {detail ? formatRelativeTime(detail.summary.updatedAt) : '-'}
                    </div>
                  </div>
                  {detail?.summary.cwd && (
                    <div className="inline-flex items-center gap-1 text-[11px] text-text-muted break-all">
                      <FolderTree size={11} />
                      {detail.summary.cwd}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
                  {loadingDetail && (
                    <div className="flex items-center justify-center gap-2 py-12 text-xs text-text-muted">
                      <Loader2 size={14} className="animate-spin" />
                      {t('common.loading')}
                    </div>
                  )}

                  {!loadingDetail && (
                    <div className="rounded-xl border border-border-muted bg-surface/30 p-3">
                      <div className="text-[11px] font-medium text-text-muted uppercase tracking-wide mb-2">
                        {t('sessionResume.preview', 'Transcript preview')}
                      </div>
                      <div className="text-xs text-text-secondary whitespace-pre-wrap break-words">
                        {detail?.summary.transcriptPreview ||
                          t('sessionResume.noPreview', 'No transcript preview available')}
                      </div>
                    </div>
                  )}
                </div>

                <div className="px-4 py-3 border-t border-border-muted flex items-center justify-end">
                  <button
                    onClick={handleResume}
                    disabled={!detail || resuming}
                    className="inline-flex items-center gap-1 rounded-md bg-accent px-3 py-1.5 text-xs text-white hover:bg-accent-hover disabled:opacity-50 transition-colors"
                    data-testid="session-resume-open"
                  >
                    <ArrowRight size={12} />
                    {resuming
                      ? t('sessionResume.resuming', 'Resuming…')
                      : t('sessionResume.resume', 'Resume')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
