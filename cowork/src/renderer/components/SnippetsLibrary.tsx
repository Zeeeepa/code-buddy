/**
 * SnippetsLibrary — Phase 3 step 5
 *
 * Command-palette style dialog for picking a reusable prompt
 * snippet. Fires `snippets:insert` via a custom DOM event that
 * ChatView listens for — keeps coupling with ChatView low.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X, FilePlus, Hash } from 'lucide-react';
import { useAppStore } from '../store';

interface Snippet {
  id: string;
  name: string;
  description?: string;
  tags: string[];
  body: string;
  updatedAt: number;
}

export function SnippetsLibrary() {
  const { t } = useTranslation();
  const open = useAppStore((s) => s.showSnippetsLibrary);
  const setOpen = useAppStore((s) => s.setShowSnippetsLibrary);

  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [query, setQuery] = useState('');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);

  const load = useCallback(async () => {
    if (!window.electronAPI?.snippets?.list) return;
    const result = await window.electronAPI.snippets.list();
    setSnippets(result as Snippet[]);
  }, []);

  useEffect(() => {
    if (open) {
      load();
      setQuery('');
      setTagFilter(null);
      setSelectedIdx(0);
    }
  }, [open, load]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const s of snippets) for (const t of s.tags) set.add(t);
    return Array.from(set).sort();
  }, [snippets]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return snippets.filter((s) => {
      if (tagFilter && !s.tags.includes(tagFilter)) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        (s.description ?? '').toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [snippets, query, tagFilter]);

  const handleInsert = useCallback(
    (snippet: Snippet) => {
      window.dispatchEvent(new CustomEvent('snippets:insert', { detail: snippet }));
      setOpen(false);
    },
    [setOpen]
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && filtered[selectedIdx]) {
        e.preventDefault();
        handleInsert(filtered[selectedIdx]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, filtered, selectedIdx, handleInsert, setOpen]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] bg-black/50 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-2xl mx-4 bg-background border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[70vh]"
        onClick={(ev) => ev.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Search size={16} className="text-text-muted" />
          <input
            autoFocus
            value={query}
            onChange={(ev) => {
              setQuery(ev.target.value);
              setSelectedIdx(0);
            }}
            placeholder={t('snippets.searchPlaceholder')}
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
          />
          <button
            onClick={() => setOpen(false)}
            className="p-1 rounded hover:bg-surface-hover text-text-muted"
            aria-label={t('common.close')}
          >
            <X size={16} />
          </button>
        </div>

        {/* Tag filter */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-1 px-4 py-2 border-b border-border overflow-x-auto">
            <button
              onClick={() => setTagFilter(null)}
              className={`text-xs px-2 py-0.5 rounded transition-colors ${
                tagFilter === null
                  ? 'bg-accent/20 text-accent'
                  : 'bg-surface text-text-muted hover:text-text-primary'
              }`}
            >
              {t('snippets.allTags')}
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setTagFilter(tag === tagFilter ? null : tag)}
                className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded transition-colors whitespace-nowrap ${
                  tagFilter === tag
                    ? 'bg-accent/20 text-accent'
                    : 'bg-surface text-text-muted hover:text-text-primary'
                }`}
              >
                <Hash size={10} />
                {tag}
              </button>
            ))}
          </div>
        )}

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && (
            <div className="px-4 py-8 text-center text-xs text-text-muted">
              <FilePlus size={20} className="mx-auto mb-2 opacity-50" />
              {t('snippets.empty')}
            </div>
          )}
          {filtered.map((snippet, idx) => (
            <button
              key={snippet.id}
              onClick={() => handleInsert(snippet)}
              onMouseEnter={() => setSelectedIdx(idx)}
              className={`w-full text-left px-4 py-3 border-b border-border-muted transition-colors ${
                idx === selectedIdx ? 'bg-accent/10' : 'hover:bg-surface-hover'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{snippet.name}</p>
                  {snippet.description && (
                    <p className="text-xs text-text-muted mt-0.5">{snippet.description}</p>
                  )}
                  <p className="text-xs text-text-muted mt-1 line-clamp-2 font-mono">
                    {snippet.body.slice(0, 160)}
                  </p>
                </div>
                {snippet.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 shrink-0">
                    {snippet.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-surface text-text-muted"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border text-xs text-text-muted flex items-center justify-between bg-surface/50">
          <span>{t('snippets.footerHint')}</span>
          <span>{filtered.length}</span>
        </div>
      </div>
    </div>
  );
}
