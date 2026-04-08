/**
 * MemoryBrowser — Browse project-scoped memory entries
 * Claude Cowork parity: cross-session memory consolidated into MEMORY.md
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Brain, Search, Clock, Tag, RefreshCw, FileText } from 'lucide-react';
import { useActiveProjectId } from '../store/selectors';

interface MemoryEntry {
  category: 'preference' | 'pattern' | 'context' | 'decision' | string;
  content: string;
  sourceSessionId?: string;
  timestamp: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  preference: 'bg-accent-muted text-accent border-accent/30',
  pattern: 'bg-accent-muted text-accent border-accent/30',
  context: 'bg-surface-active text-text-secondary border-border',
  decision: 'bg-warning/20 text-warning border-warning/30',
};

export const MemoryBrowser: React.FC = () => {
  const { t } = useTranslation();
  const activeProjectId = useActiveProjectId();
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  const loadEntries = async () => {
    setLoading(true);
    try {
      const api = window.electronAPI;
      if (!api?.memory) {
        setEntries([]);
        return;
      }
      const result = await api.memory.list(activeProjectId ?? undefined);
      setEntries(result as MemoryEntry[]);
    } catch (err) {
      console.error('[MemoryBrowser] Failed to load memories:', err);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId]);

  const filteredEntries = useMemo(() => {
    let result = entries;
    if (filterCategory) {
      result = result.filter((e) => e.category === filterCategory);
    }
    if (query.trim()) {
      const lower = query.trim().toLowerCase();
      result = result.filter(
        (e) =>
          e.content.toLowerCase().includes(lower) ||
          e.category.toLowerCase().includes(lower)
      );
    }
    return result;
  }, [entries, query, filterCategory]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) set.add(e.category);
    return Array.from(set);
  }, [entries]);

  if (!activeProjectId) {
    return (
      <div className="p-6 text-center">
        <FileText size={24} className="text-text-muted mx-auto mb-2" />
        <p className="text-sm text-text-muted">{t('memoryBrowser.noMemories')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border-muted bg-background/40">
        <div className="flex items-center gap-2 mb-3">
          <Brain size={14} className="text-accent" />
          <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider">
            {t('memoryBrowser.title')}
          </h3>
          <button
            onClick={loadEntries}
            className="ml-auto p-1 text-text-muted hover:text-text-primary"
            title={t('common.loading')}
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-2">
          <Search
            size={12}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('memoryBrowser.search')}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-surface border border-border rounded text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
          />
        </div>

        {/* Category filter */}
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setFilterCategory(null)}
              className={`text-[10px] px-2 py-0.5 rounded border ${
                filterCategory === null
                  ? 'bg-accent-muted border-accent text-accent'
                  : 'bg-surface border-border text-text-secondary hover:text-text-primary'
              }`}
            >
              All ({entries.length})
            </button>
            {categories.map((cat) => {
              const count = entries.filter((e) => e.category === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(cat)}
                  className={`text-[10px] px-2 py-0.5 rounded border ${
                    filterCategory === cat
                      ? CATEGORY_COLORS[cat] ?? 'bg-accent-muted border-accent text-accent'
                      : 'bg-surface border-border text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {cat} ({count})
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Entries */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading && (
          <div className="text-xs text-text-muted text-center py-4">{t('common.loading')}</div>
        )}

        {!loading && filteredEntries.length === 0 && (
          <div className="text-xs text-text-muted text-center py-4">
            {entries.length === 0 ? t('memoryBrowser.noMemories') : t('memoryBrowser.noMatches')}
          </div>
        )}

        {!loading &&
          filteredEntries.map((entry, i) => (
            <div
              key={i}
              className="p-3 rounded-lg bg-surface/40 border border-border-muted hover:bg-surface-hover transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded border flex items-center gap-1 ${
                    CATEGORY_COLORS[entry.category] ??
                    'bg-surface-active text-text-secondary border-border'
                  }`}
                >
                  <Tag size={10} />
                  {entry.category}
                </span>
                {entry.sourceSessionId && (
                  <span className="text-[10px] text-text-muted font-mono truncate">
                    {entry.sourceSessionId.slice(0, 8)}
                  </span>
                )}
                <div className="ml-auto flex items-center gap-1 text-[10px] text-text-muted">
                  <Clock size={10} />
                  {new Date(entry.timestamp).toLocaleDateString()}
                </div>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">{entry.content}</p>
            </div>
          ))}
      </div>
    </div>
  );
};
