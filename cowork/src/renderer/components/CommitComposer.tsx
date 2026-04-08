/**
 * CommitComposer — Phase 3 step 2
 *
 * Modal-ish overlay for authoring a commit message. Supports a
 * heuristic suggestion from git (count of staged files) and a
 * future hook for AI-generated messages.
 */
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Sparkles, GitCommit, Loader2 } from 'lucide-react';

interface CommitComposerProps {
  cwd: string;
  stagedCount: number;
  onClose: () => void;
  onCommitted: () => void;
}

export function CommitComposer({ cwd, stagedCount, onClose, onCommitted }: CommitComposerProps) {
  const { t } = useTranslation();
  const [message, setMessage] = useState('');
  const [amend, setAmend] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);

  const suggest = useCallback(async () => {
    if (!window.electronAPI?.git?.suggestMessage) return;
    setSuggesting(true);
    try {
      const result = await window.electronAPI.git.suggestMessage(cwd);
      if (result.message && !message.trim()) {
        setMessage(result.message);
      }
    } finally {
      setSuggesting(false);
    }
  }, [cwd, message]);

  useEffect(() => {
    // Auto-suggest an initial message when the composer opens.
    suggest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCommit = async () => {
    if (!window.electronAPI?.git?.commit) return;
    if (!message.trim()) {
      setError(t('git.emptyMessage'));
      return;
    }
    setCommitting(true);
    setError(null);
    try {
      const result = await window.electronAPI.git.commit(cwd, message.trim(), amend);
      if (result.success) {
        onCommitted();
      } else {
        setError(result.error || 'Commit failed');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-xl mx-4 overflow-hidden"
        onClick={(ev) => ev.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <GitCommit size={16} className="text-accent" />
            <h2 className="text-sm font-semibold text-text-primary">
              {t('git.composerTitle')}
            </h2>
            <span className="text-xs text-text-muted">
              {t('git.stagedFileCount', { count: stagedCount })}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors"
            aria-label={t('common.close')}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-text-secondary">
              {t('git.messageLabel')}
            </label>
            <textarea
              value={message}
              onChange={(ev) => setMessage(ev.target.value)}
              placeholder={t('git.messagePlaceholder')}
              className="w-full min-h-[100px] px-3 py-2 rounded-md bg-surface border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent font-mono"
              autoFocus
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-text-secondary">
              <input
                type="checkbox"
                checked={amend}
                onChange={(ev) => setAmend(ev.target.checked)}
                className="accent-accent"
              />
              {t('git.amendPrevious')}
            </label>
            <button
              onClick={suggest}
              disabled={suggesting}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-surface hover:bg-surface-hover text-text-secondary hover:text-text-primary disabled:opacity-50 transition-colors"
              title={t('git.suggestMessage')}
            >
              {suggesting ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {t('git.suggest')}
            </button>
          </div>

          {error && (
            <div className="text-xs text-error bg-error/10 px-3 py-2 rounded-md">{error}</div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border bg-surface/50">
          <button
            onClick={onClose}
            className="text-xs px-3 py-1.5 rounded bg-surface hover:bg-surface-hover text-text-secondary transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleCommit}
            disabled={committing || !message.trim()}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded bg-accent text-white hover:bg-accent-hover disabled:opacity-50 transition-colors"
          >
            {committing ? <Loader2 size={12} className="animate-spin" /> : <GitCommit size={12} />}
            {committing ? t('git.committing') : t('git.commit')}
          </button>
        </div>
      </div>
    </div>
  );
}
