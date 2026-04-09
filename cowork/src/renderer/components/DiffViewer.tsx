/**
 * DiffViewer — inline unified diff viewer with per-hunk controls.
 *
 * Phase 3 step 1: parses the excerpt into hunks client-side, lets
 * the user mark each hunk pending/accepted/rejected, and invokes
 * the main-process revert helper to roll back the rejected hunks
 * from disk.
 */
import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, X, ChevronDown, ChevronRight, Undo2 } from 'lucide-react';
import type { DiffEntry } from '../types';

interface DiffViewerProps {
  diff: DiffEntry;
  onAccept?: () => void;
  onReject?: () => void;
  readOnly?: boolean;
}

interface DiffLine {
  type: 'add' | 'remove' | 'context' | 'header';
  content: string;
}

interface ParsedHunk {
  index: number;
  header: string;
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: string[];
  body: string;
}

type HunkState = 'pending' | 'accepted' | 'rejected';

const actionBadgeColors: Record<string, string> = {
  create: 'bg-success/20 text-success',
  modify: 'bg-accent/20 text-accent',
  delete: 'bg-error/20 text-error',
  rename: 'bg-warning/20 text-warning',
};

function parseDiffLines(body: string): DiffLine[] {
  if (!body) return [];
  const result: DiffLine[] = [];
  for (const line of body.split('\n')) {
    if (!line) continue;
    if (line.startsWith('@@')) result.push({ type: 'header', content: line });
    else if (line.startsWith('+')) result.push({ type: 'add', content: line.slice(1) });
    else if (line.startsWith('-')) result.push({ type: 'remove', content: line.slice(1) });
    else result.push({ type: 'context', content: line.startsWith(' ') ? line.slice(1) : line });
  }
  return result;
}

function parseHunksLocal(excerpt: string): ParsedHunk[] {
  if (!excerpt) return [];
  const lines = excerpt.split('\n');
  const hunks: ParsedHunk[] = [];
  let current: ParsedHunk | null = null;
  const headerRe = /^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/;

  for (const line of lines) {
    const match = headerRe.exec(line);
    if (match) {
      if (current) hunks.push(current);
      current = {
        index: hunks.length,
        header: line,
        oldStart: parseInt(match[1], 10),
        oldCount: match[2] ? parseInt(match[2], 10) : 1,
        newStart: parseInt(match[3], 10),
        newCount: match[4] ? parseInt(match[4], 10) : 1,
        lines: [],
        body: line + '\n',
      };
      continue;
    }
    if (!current) continue;
    current.lines.push(line);
    current.body += line + '\n';
  }
  if (current) hunks.push(current);
  return hunks;
}

interface HunkBlockProps {
  hunk: ParsedHunk;
  state: HunkState;
  onAccept: () => void;
  onReject: () => void;
  readOnly?: boolean;
}

const HunkBlock: React.FC<HunkBlockProps> = ({ hunk, state, onAccept, onReject, readOnly }) => {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const lines = useMemo(() => parseDiffLines(hunk.body), [hunk.body]);
  const adds = lines.filter((l) => l.type === 'add').length;
  const removes = lines.filter((l) => l.type === 'remove').length;

  const stateClasses: Record<HunkState, string> = {
    pending: 'border-border',
    accepted: 'border-success/60 bg-success/5',
    rejected: 'border-error/60 bg-error/5',
  };

  return (
    <div className={`rounded-md border overflow-hidden transition-colors ${stateClasses[state]}`}>
      <div
        className="flex items-center justify-between gap-2 px-3 py-1.5 bg-surface cursor-pointer select-none hover:bg-surface-hover"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-2 min-w-0">
          {collapsed ? (
            <ChevronRight size={12} className="text-text-muted" />
          ) : (
            <ChevronDown size={12} className="text-text-muted" />
          )}
          <span className="text-xs font-mono text-text-secondary truncate">
            {t('diff.hunkLabel', { index: hunk.index + 1 })}
          </span>
          {adds > 0 && <span className="text-xs text-success">+{adds}</span>}
          {removes > 0 && <span className="text-xs text-error">-{removes}</span>}
          {state === 'accepted' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-success/20 text-success">
              {t('diff.accepted')}
            </span>
          )}
          {state === 'rejected' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-error/20 text-error">
              {t('diff.rejected')}
            </span>
          )}
        </div>
        {!readOnly && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={(ev) => {
                ev.stopPropagation();
                onAccept();
              }}
              className={`p-1 rounded transition-colors ${
                state === 'accepted'
                  ? 'bg-success/30 text-success'
                  : 'text-text-muted hover:bg-success/20 hover:text-success'
              }`}
              aria-label={t('diff.accept')}
              title={t('diff.accept')}
            >
              <Check size={12} />
            </button>
            <button
              onClick={(ev) => {
                ev.stopPropagation();
                onReject();
              }}
              className={`p-1 rounded transition-colors ${
                state === 'rejected'
                  ? 'bg-error/30 text-error'
                  : 'text-text-muted hover:bg-error/20 hover:text-error'
              }`}
              aria-label={t('diff.reject')}
              title={t('diff.reject')}
            >
              <X size={12} />
            </button>
          </div>
        )}
      </div>
      {!collapsed && lines.length > 1 && (
        <div className="overflow-x-auto bg-background max-h-64 overflow-y-auto">
          <pre className="text-xs font-mono leading-5">
            {lines.slice(1).map((line, i) => (
              <div
                key={i}
                className={
                  line.type === 'add'
                    ? 'bg-success/10 text-success px-3'
                    : line.type === 'remove'
                      ? 'bg-error/10 text-error px-3'
                      : 'text-text-muted px-3'
                }
              >
                <span className="inline-block w-4 text-text-muted select-none mr-2">
                  {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
                </span>
                {line.content}
              </div>
            ))}
          </pre>
        </div>
      )}
    </div>
  );
};

export const DiffViewer: React.FC<DiffViewerProps> = React.memo(
  ({ diff, onAccept, onReject, readOnly = false }) => {
    const { t } = useTranslation();
    const [collapsed, setCollapsed] = useState(false);
    const hunks = useMemo(() => parseHunksLocal(diff.excerpt), [diff.excerpt]);
    const [hunkStates, setHunkStates] = useState<Record<number, HunkState>>({});
    const [reverting, setReverting] = useState(false);
    const [revertStatus, setRevertStatus] = useState<string | null>(null);

    const acceptedCount = Object.values(hunkStates).filter((s) => s === 'accepted').length;
    const rejectedCount = Object.values(hunkStates).filter((s) => s === 'rejected').length;
    const pendingCount = hunks.length - acceptedCount - rejectedCount;

    const setHunkState = useCallback((index: number, st: HunkState) => {
      setHunkStates((prev) => ({ ...prev, [index]: st }));
    }, []);

    const handleRevertRejected = useCallback(async () => {
      if (!window.electronAPI?.diff?.revertHunks) return;
      const rejected = hunks.filter((h) => hunkStates[h.index] === 'rejected');
      if (rejected.length === 0) return;
      setReverting(true);
      setRevertStatus(null);
      try {
        const result = await window.electronAPI.diff.revertHunks(diff.path, rejected);
        if (result.success) {
          setRevertStatus(
            t('diff.revertSuccess', { count: rejected.length, method: result.method })
          );
        } else {
          setRevertStatus(t('diff.revertFailed', { error: result.error ?? '' }));
        }
      } catch (err) {
        setRevertStatus(t('diff.revertFailed', { error: (err as Error).message }));
      } finally {
        setReverting(false);
      }
    }, [diff.path, hunks, hunkStates, t]);

    const actionLabels: Record<string, string> = {
      create: t('diff.actionCreated'),
      modify: t('diff.actionModified'),
      delete: t('diff.actionDeleted'),
      rename: t('diff.actionRenamed'),
    };

    return (
      <div className="mt-2 rounded-lg border border-border overflow-hidden">
        <div
          className="flex items-center justify-between px-3 py-2 bg-surface cursor-pointer select-none"
          onClick={() => setCollapsed(!collapsed)}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-mono text-text-primary truncate">{diff.path}</span>
            <span
              className={`text-xs px-1.5 py-0.5 rounded ${
                actionBadgeColors[diff.action] || 'bg-surface-hover text-text-secondary'
              }`}
            >
              {actionLabels[diff.action] || diff.action}
            </span>
            {hunks.length > 0 && (
              <span className="text-xs text-text-muted">
                {t('diff.hunkCountSummary', {
                  accepted: acceptedCount,
                  rejected: rejectedCount,
                  total: hunks.length,
                })}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {diff.linesAdded > 0 && (
              <span className="text-xs text-success">+{diff.linesAdded}</span>
            )}
            {diff.linesRemoved > 0 && (
              <span className="text-xs text-error">-{diff.linesRemoved}</span>
            )}
            <span className="text-xs text-text-muted">{collapsed ? '\u25B6' : '\u25BC'}</span>
          </div>
        </div>

        {!collapsed && hunks.length > 0 && (
          <div className="p-2 bg-background space-y-2">
            {hunks.map((hunk) => (
              <HunkBlock
                key={hunk.index}
                hunk={hunk}
                state={hunkStates[hunk.index] ?? 'pending'}
                onAccept={() => setHunkState(hunk.index, 'accepted')}
                onReject={() => setHunkState(hunk.index, 'rejected')}
                readOnly={readOnly}
              />
            ))}
          </div>
        )}

        {!collapsed && hunks.length === 0 && diff.excerpt && (
          <div className="px-3 py-2 bg-background text-xs text-text-muted font-mono whitespace-pre-wrap">
            {diff.excerpt}
          </div>
        )}

        {!readOnly && !collapsed && (onAccept || onReject || hunks.length > 0) && (
          <div className="flex items-center justify-between gap-2 px-3 py-2 bg-surface border-t border-border">
            <div className="text-xs text-text-muted">
              {revertStatus}
              {!revertStatus && pendingCount > 0 && hunks.length > 0 && (
                <span>{t('diff.hunkPending', { count: pendingCount })}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {rejectedCount > 0 && (
                <button
                  onClick={handleRevertRejected}
                  disabled={reverting}
                  className="flex items-center gap-1 text-xs px-3 py-1 rounded bg-error/20 text-error hover:bg-error/30 disabled:opacity-50 transition-colors"
                >
                  <Undo2 size={12} />
                  {reverting
                    ? t('diff.reverting')
                    : t('diff.revertRejected', { count: rejectedCount })}
                </button>
              )}
              {onReject && (
                <button
                  onClick={onReject}
                  className="text-xs px-3 py-1 rounded bg-error/20 text-error hover:bg-error/30 transition-colors"
                >
                  {t('diff.reject')}
                </button>
              )}
              {onAccept && (
                <button
                  onClick={onAccept}
                  className="text-xs px-3 py-1 rounded bg-success/20 text-success hover:bg-success/30 transition-colors"
                >
                  {t('diff.accept')}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }
);

DiffViewer.displayName = 'DiffViewer';
