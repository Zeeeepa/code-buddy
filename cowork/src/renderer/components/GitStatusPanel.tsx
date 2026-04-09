/**
 * GitStatusPanel — Phase 3 step 2
 *
 * Lives in the ContextPanel "Git" tab. Shows a porcelain summary
 * of the current working directory's git state: branch, ahead/
 * behind, and changed files grouped by staged / modified /
 * untracked. Supports per-file stage/unstage and opening the
 * CommitComposer.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  GitBranch,
  GitCommit,
  RefreshCw,
  FilePlus,
  FileEdit,
  FileMinus,
  FileQuestion,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Trash2,
  GitFork,
  Plus,
} from 'lucide-react';
import { useAppStore } from '../store';
import { CommitComposer } from './CommitComposer';

type GitFile = {
  path: string;
  oldPath?: string;
  indexStatus: string;
  workingStatus: string;
  staged: boolean;
};

type GitStatus = {
  isRepo: boolean;
  branch: string | null;
  upstream: string | null;
  ahead: number;
  behind: number;
  files: GitFile[];
  error?: string;
};

type GitWorktree = {
  path: string;
  branch: string;
  head: string;
  bare: boolean;
  detached: boolean;
  locked: boolean;
  prunable: boolean;
};

const EMPTY_STATUS: GitStatus = {
  isRepo: false,
  branch: null,
  upstream: null,
  ahead: 0,
  behind: 0,
  files: [],
};

function statusIcon(status: string) {
  if (status === 'added') return <FilePlus size={12} className="text-success" />;
  if (status === 'modified') return <FileEdit size={12} className="text-accent" />;
  if (status === 'deleted') return <FileMinus size={12} className="text-error" />;
  if (status === 'untracked') return <FileQuestion size={12} className="text-warning" />;
  return <FileEdit size={12} className="text-text-muted" />;
}

export function GitStatusPanel() {
  const { t } = useTranslation();
  const activeSessionId = useAppStore((s) => s.activeSessionId);
  const sessions = useAppStore((s) => s.sessions);
  const workingDir = useAppStore((s) => s.workingDir);
  const activeSession = activeSessionId ? sessions.find((s) => s.id === activeSessionId) : null;
  const cwd = activeSession?.cwd || workingDir || '';

  const [status, setStatus] = useState<GitStatus>(EMPTY_STATUS);
  const [loading, setLoading] = useState(false);
  const [expandStaged, setExpandStaged] = useState(true);
  const [expandUnstaged, setExpandUnstaged] = useState(true);
  const [expandUntracked, setExpandUntracked] = useState(true);
  const [expandWorktrees, setExpandWorktrees] = useState(true);
  const [showComposer, setShowComposer] = useState(false);
  const [worktrees, setWorktrees] = useState<GitWorktree[]>([]);
  const [worktreePathDraft, setWorktreePathDraft] = useState('');
  const [worktreeBranchDraft, setWorktreeBranchDraft] = useState('');
  const [worktreeBusy, setWorktreeBusy] = useState<string | null>(null);
  const [worktreeMessage, setWorktreeMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!cwd || !window.electronAPI?.git?.status) {
      setStatus(EMPTY_STATUS);
      setWorktrees([]);
      return;
    }
    setLoading(true);
    try {
      const [result, worktreeList] = await Promise.all([
        window.electronAPI.git.status(cwd),
        window.electronAPI.git.worktrees?.(cwd) ?? Promise.resolve([]),
      ]);
      setStatus(result as GitStatus);
      setWorktrees((worktreeList as GitWorktree[]) ?? []);
    } catch {
      setStatus(EMPTY_STATUS);
      setWorktrees([]);
    } finally {
      setLoading(false);
    }
  }, [cwd]);

  useEffect(() => {
    load();
  }, [load]);

  const staged = status.files.filter((f) => f.staged && f.indexStatus !== 'untracked');
  const unstaged = status.files.filter((f) => !f.staged && f.indexStatus !== 'untracked');
  const untracked = status.files.filter((f) => f.indexStatus === 'untracked');

  const handleStage = useCallback(
    async (paths: string[]) => {
      if (!cwd || paths.length === 0) return;
      await window.electronAPI?.git?.stage(cwd, paths);
      load();
    },
    [cwd, load]
  );

  const handleUnstage = useCallback(
    async (paths: string[]) => {
      if (!cwd || paths.length === 0) return;
      await window.electronAPI?.git?.unstage(cwd, paths);
      load();
    },
    [cwd, load]
  );

  const handleStageAll = () => handleStage(unstaged.concat(untracked).map((f) => f.path));
  const handleUnstageAll = () => handleUnstage(staged.map((f) => f.path));

  const normalizePath = (value: string) =>
    value.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();

  const isCurrentWorktree = useCallback(
    (worktreePath: string) => {
      if (!cwd) return false;
      const normalizedCwd = normalizePath(cwd);
      const normalizedWorktree = normalizePath(worktreePath);
      return (
        normalizedCwd === normalizedWorktree || normalizedCwd.startsWith(`${normalizedWorktree}/`)
      );
    },
    [cwd]
  );

  const handleCreateWorktree = useCallback(async () => {
    if (!cwd || !window.electronAPI?.git?.addWorktree || !worktreePathDraft.trim()) return;
    setWorktreeBusy('create');
    setWorktreeMessage(null);
    try {
      const result = await window.electronAPI.git.addWorktree(
        cwd,
        worktreePathDraft.trim(),
        worktreeBranchDraft.trim() || undefined
      );
      if (result.success) {
        setWorktreeMessage(
          t('git.worktreeCreated', {
            path: result.path ?? worktreePathDraft.trim(),
            branch: (result.branch ?? worktreeBranchDraft.trim()) || worktreePathDraft.trim(),
          })
        );
        setWorktreePathDraft('');
        setWorktreeBranchDraft('');
        await load();
      } else {
        setWorktreeMessage(result.error ?? t('git.worktreeActionFailed'));
      }
    } finally {
      setWorktreeBusy(null);
    }
  }, [cwd, load, t, worktreeBranchDraft, worktreePathDraft]);

  const handleRemoveWorktree = useCallback(
    async (worktreePath: string) => {
      if (!cwd || !window.electronAPI?.git?.removeWorktree) return;
      if (!window.confirm(t('git.removeWorktreeConfirm', { path: worktreePath }))) return;
      setWorktreeBusy(worktreePath);
      setWorktreeMessage(null);
      try {
        let result = await window.electronAPI.git.removeWorktree(cwd, worktreePath, false);
        if (
          !result.success &&
          result.error &&
          /modified|untracked/i.test(result.error) &&
          window.confirm(t('git.removeWorktreeForceConfirm', { path: worktreePath }))
        ) {
          result = await window.electronAPI.git.removeWorktree(cwd, worktreePath, true);
        }
        if (result.success) {
          setWorktreeMessage(t('git.worktreeRemoved', { path: worktreePath }));
          await load();
        } else {
          setWorktreeMessage(result.error ?? t('git.worktreeActionFailed'));
        }
      } finally {
        setWorktreeBusy(null);
      }
    },
    [cwd, load, t]
  );

  const handlePruneWorktrees = useCallback(async () => {
    if (!cwd || !window.electronAPI?.git?.pruneWorktrees) return;
    setWorktreeBusy('prune');
    setWorktreeMessage(null);
    try {
      const result = await window.electronAPI.git.pruneWorktrees(cwd);
      if (result.success) {
        setWorktreeMessage(
          result.output?.trim()
            ? `${t('git.worktreePruned')}\n${result.output}`
            : t('git.noPrunableWorktrees')
        );
        await load();
      } else {
        setWorktreeMessage(result.error ?? t('git.worktreeActionFailed'));
      }
    } finally {
      setWorktreeBusy(null);
    }
  }, [cwd, load, t]);

  const switchToWorktree = useCallback(
    (worktreePath: string) => {
      window.electronAPI?.send?.({
        type: 'workdir.set',
        payload: { path: worktreePath, sessionId: activeSessionId || undefined },
      });
      setWorktreeMessage(t('git.worktreeSwitched', { path: worktreePath }));
    },
    [activeSessionId, t]
  );

  if (!cwd) {
    return <div className="px-4 py-4 text-xs text-text-muted">{t('git.noWorkingDir')}</div>;
  }

  if (!status.isRepo) {
    return (
      <div className="px-4 py-4 text-xs text-text-muted space-y-2">
        <p>{t('git.notARepo')}</p>
        <button
          onClick={load}
          className="text-xs px-2 py-1 rounded bg-surface hover:bg-surface-hover text-text-primary transition-colors"
        >
          {t('git.refresh')}
        </button>
      </div>
    );
  }

  return (
    <div className="text-sm">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-border-muted flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <GitBranch size={14} className="text-text-muted shrink-0" />
          <span className="text-xs font-medium text-text-primary truncate">
            {status.branch ?? t('git.detached')}
          </span>
          {status.ahead > 0 && (
            <span className="text-xs text-accent" title={t('git.ahead')}>
              ↑{status.ahead}
            </span>
          )}
          {status.behind > 0 && (
            <span className="text-xs text-warning" title={t('git.behind')}>
              ↓{status.behind}
            </span>
          )}
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="p-1 rounded hover:bg-surface-hover text-text-muted hover:text-text-primary disabled:opacity-50 transition-colors"
          title={t('git.refresh')}
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {status.error && (
        <div className="px-4 py-2 text-xs text-error bg-error/5 border-b border-border-muted">
          {status.error}
        </div>
      )}

      {/* Commit button */}
      {staged.length > 0 && (
        <div className="px-4 py-2.5 border-b border-border-muted">
          <button
            onClick={() => setShowComposer(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-accent text-white text-xs font-medium hover:bg-accent-hover transition-colors"
          >
            <GitCommit size={12} />
            {t('git.commitCount', { count: staged.length })}
          </button>
        </div>
      )}

      {/* Staged */}
      <GitSection
        title={t('git.staged')}
        count={staged.length}
        expanded={expandStaged}
        onToggle={() => setExpandStaged(!expandStaged)}
        actionLabel={staged.length > 0 ? t('git.unstageAll') : undefined}
        onAction={handleUnstageAll}
      >
        {staged.map((f) => (
          <GitFileRow key={f.path} file={f} staged onClick={() => handleUnstage([f.path])} />
        ))}
      </GitSection>

      {/* Unstaged */}
      <GitSection
        title={t('git.changes')}
        count={unstaged.length}
        expanded={expandUnstaged}
        onToggle={() => setExpandUnstaged(!expandUnstaged)}
        actionLabel={unstaged.length + untracked.length > 0 ? t('git.stageAll') : undefined}
        onAction={handleStageAll}
      >
        {unstaged.map((f) => (
          <GitFileRow key={f.path} file={f} staged={false} onClick={() => handleStage([f.path])} />
        ))}
      </GitSection>

      {/* Untracked */}
      {untracked.length > 0 && (
        <GitSection
          title={t('git.untracked')}
          count={untracked.length}
          expanded={expandUntracked}
          onToggle={() => setExpandUntracked(!expandUntracked)}
        >
          {untracked.map((f) => (
            <GitFileRow
              key={f.path}
              file={f}
              staged={false}
              onClick={() => handleStage([f.path])}
            />
          ))}
        </GitSection>
      )}

      {status.files.length === 0 && (
        <div className="px-4 py-6 text-xs text-text-muted text-center">{t('git.clean')}</div>
      )}

      {showComposer && (
        <CommitComposer
          cwd={cwd}
          stagedCount={staged.length}
          onClose={() => setShowComposer(false)}
          onCommitted={() => {
            setShowComposer(false);
            load();
          }}
        />
      )}

      <GitSection
        title={t('git.worktrees')}
        count={worktrees.length}
        expanded={expandWorktrees}
        onToggle={() => setExpandWorktrees(!expandWorktrees)}
        actionLabel={
          worktrees.some((worktree) => worktree.prunable) ? t('git.pruneWorktrees') : undefined
        }
        onAction={
          worktrees.some((worktree) => worktree.prunable) ? handlePruneWorktrees : undefined
        }
      >
        <div className="px-4 py-2 space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={worktreePathDraft}
              onChange={(event) => setWorktreePathDraft(event.target.value)}
              placeholder={t('git.worktreePathPlaceholder')}
              className="flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
            />
            <input
              type="text"
              value={worktreeBranchDraft}
              onChange={(event) => setWorktreeBranchDraft(event.target.value)}
              placeholder={t('git.worktreeBranchPlaceholder')}
              className="w-32 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
            />
            <button
              onClick={handleCreateWorktree}
              disabled={worktreeBusy === 'create' || !worktreePathDraft.trim()}
              className="flex items-center gap-1 rounded-md bg-accent px-2.5 py-1.5 text-xs text-white hover:bg-accent-hover disabled:opacity-50 transition-colors"
            >
              <Plus size={11} />
              {worktreeBusy === 'create' ? t('git.creatingWorktree') : t('git.addWorktree')}
            </button>
          </div>

          {worktreeMessage && (
            <pre className="whitespace-pre-wrap rounded-md bg-surface px-2.5 py-2 text-[11px] text-text-muted">
              {worktreeMessage}
            </pre>
          )}

          {worktrees.length === 0 ? (
            <div className="text-xs text-text-muted">{t('git.noWorktrees')}</div>
          ) : (
            <div className="space-y-1.5">
              {worktrees.map((worktree) => {
                const current = isCurrentWorktree(worktree.path);
                const basename = worktree.path.split(/[/\\]/).pop() || worktree.path;
                return (
                  <div
                    key={worktree.path}
                    className={`rounded-md border px-2.5 py-2 ${
                      current ? 'border-accent/50 bg-accent/5' : 'border-border bg-background/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <GitFork size={12} className="text-text-muted shrink-0" />
                          <span className="text-xs font-medium text-text-primary truncate">
                            {basename}
                          </span>
                          {current && (
                            <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] text-accent">
                              {t('git.currentWorktree')}
                            </span>
                          )}
                          {worktree.locked && (
                            <span className="rounded bg-warning/15 px-1.5 py-0.5 text-[10px] text-warning">
                              {t('git.locked')}
                            </span>
                          )}
                          {worktree.prunable && (
                            <span className="rounded bg-error/15 px-1.5 py-0.5 text-[10px] text-error">
                              {t('git.prunable')}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-[11px] text-text-muted">
                          {worktree.branch || worktree.head.slice(0, 8)}
                        </div>
                        <div className="mt-0.5 text-[10px] text-text-muted break-all">
                          {worktree.path}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {!current && (
                          <button
                            onClick={() => switchToWorktree(worktree.path)}
                            className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
                            title={t('git.openWorktree')}
                          >
                            <FolderOpen size={12} />
                          </button>
                        )}
                        <button
                          onClick={() => void handleRemoveWorktree(worktree.path)}
                          disabled={current || worktreeBusy === worktree.path}
                          className="p-1 rounded text-text-muted hover:text-error hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          title={t('git.removeWorktree')}
                        >
                          {worktreeBusy === worktree.path ? (
                            <RefreshCw size={12} className="animate-spin" />
                          ) : (
                            <Trash2 size={12} />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </GitSection>
    </div>
  );
}

interface GitSectionProps {
  title: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

function GitSection({
  title,
  count,
  expanded,
  onToggle,
  children,
  actionLabel,
  onAction,
}: GitSectionProps) {
  if (count === 0) return null;
  return (
    <div className="border-b border-border-muted">
      <div className="flex items-center px-4 py-1.5 bg-background/40">
        <button
          onClick={onToggle}
          className="flex items-center gap-1 flex-1 text-left text-xs font-medium text-text-muted uppercase tracking-wider hover:text-text-primary transition-colors"
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          {title}
          <span className="text-text-muted normal-case">({count})</span>
        </button>
        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className="text-xs text-accent hover:text-accent-hover transition-colors"
          >
            {actionLabel}
          </button>
        )}
      </div>
      {expanded && <div className="pb-1">{children}</div>}
    </div>
  );
}

interface GitFileRowProps {
  file: GitFile;
  staged: boolean;
  onClick: () => void;
}

function GitFileRow({ file, staged, onClick }: GitFileRowProps) {
  const { t } = useTranslation();
  const setPreviewFilePath = useAppStore((s) => s.setPreviewFilePath);
  const activeSessionId = useAppStore((s) => s.activeSessionId);
  const sessions = useAppStore((s) => s.sessions);
  const workingDir = useAppStore((s) => s.workingDir);
  const activeSession = activeSessionId ? sessions.find((s) => s.id === activeSessionId) : null;
  const cwd = activeSession?.cwd || workingDir || '';
  const status = staged ? file.indexStatus : file.workingStatus;

  const handleRowClick = () => {
    if (cwd && file.path) {
      const fullPath =
        file.path.startsWith('/') || file.path.match(/^[A-Z]:/i)
          ? file.path
          : `${cwd}/${file.path}`.replace(/\\/g, '/');
      setPreviewFilePath(fullPath);
    }
  };

  return (
    <div className="flex items-center gap-2 px-4 py-1 hover:bg-surface-hover transition-colors group">
      <button
        onClick={onClick}
        className="shrink-0 text-text-muted hover:text-accent transition-colors"
        title={staged ? t('git.unstage') : t('git.stage')}
      >
        {staged ? '−' : '+'}
      </button>
      <span className="shrink-0">{statusIcon(status)}</span>
      <button
        onClick={handleRowClick}
        className="flex-1 text-left text-xs text-text-primary truncate hover:text-accent transition-colors"
        title={file.path}
      >
        {file.path}
      </button>
    </div>
  );
}
