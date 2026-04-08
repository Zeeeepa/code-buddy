/**
 * MentionAutocomplete — Floating dropdown for @ mentions
 * Claude Cowork parity: triggered when typing @ in the chat textarea.
 */
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { File, GitBranch, Globe, Terminal, Loader2 } from 'lucide-react';

export interface MentionItem {
  label: string;
  value: string;
  description?: string;
  category: 'file' | 'git' | 'web' | 'terminal';
}

interface MentionAutocompleteProps {
  prefix: string;
  cwd?: string;
  anchorPosition: { top: number; left: number } | null;
  onSelect: (item: MentionItem) => void;
  onClose: () => void;
}

const CATEGORY_ICONS = {
  file: File,
  git: GitBranch,
  web: Globe,
  terminal: Terminal,
} as const;

const CATEGORY_LABEL_KEYS = {
  file: 'mention.files',
  git: 'mention.git',
  web: 'mention.web',
  terminal: 'mention.terminal',
} as const;

export const MentionAutocomplete: React.FC<MentionAutocompleteProps> = ({
  prefix,
  cwd,
  anchorPosition,
  onSelect,
  onClose,
}) => {
  const { t } = useTranslation();
  const [items, setItems] = useState<MentionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlightedIdx, setHighlightedIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Debounced fetch
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      const api = window.electronAPI;
      if (!api?.mention) {
        setItems([]);
        return;
      }
      setLoading(true);
      try {
        const results = await api.mention.autocomplete(prefix, cwd, 30);
        if (cancelled) return;
        setItems(results as MentionItem[]);
        setHighlightedIdx(0);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 80);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [prefix, cwd]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (items.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIdx((idx) => (idx + 1) % items.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIdx((idx) => (idx - 1 + items.length) % items.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        onSelect(items[highlightedIdx]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [items, highlightedIdx, onSelect, onClose]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!listRef.current) return;
    const highlighted = listRef.current.querySelector(`[data-idx="${highlightedIdx}"]`);
    if (highlighted) {
      (highlighted as HTMLElement).scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIdx]);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  // Group items by category
  const groupedItems = useMemo(() => {
    const groups: Record<string, MentionItem[]> = {};
    for (const item of items) {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    }
    return groups;
  }, [items]);

  const handleClickItem = useCallback(
    (item: MentionItem) => {
      onSelect(item);
    },
    [onSelect]
  );

  if (!anchorPosition) return null;

  return (
    <div
      ref={containerRef}
      className="fixed z-50 w-80 max-h-72 overflow-hidden bg-background border border-border rounded-lg shadow-elevated"
      style={{
        top: anchorPosition.top,
        left: anchorPosition.left,
      }}
    >
      {loading && (
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-text-muted">
          <Loader2 size={12} className="animate-spin" />
          {t('common.loading')}
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="px-3 py-3 text-xs text-text-muted text-center">{t('mention.noMatches')}</div>
      )}

      {!loading && items.length > 0 && (
        <div ref={listRef} className="overflow-y-auto max-h-72">
          {Object.entries(groupedItems).map(([category, catItems]) => {
            const Icon = CATEGORY_ICONS[category as keyof typeof CATEGORY_ICONS] ?? File;
            const labelKey = CATEGORY_LABEL_KEYS[category as keyof typeof CATEGORY_LABEL_KEYS];
            const label = labelKey ? t(labelKey) : category;
            return (
              <div key={category}>
                <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted bg-surface/40 flex items-center gap-1.5">
                  <Icon size={10} />
                  {label}
                </div>
                {catItems.map((item) => {
                  const globalIdx = items.indexOf(item);
                  const isHighlighted = globalIdx === highlightedIdx;
                  return (
                    <button
                      key={item.value}
                      data-idx={globalIdx}
                      onClick={() => handleClickItem(item)}
                      onMouseEnter={() => setHighlightedIdx(globalIdx)}
                      className={`w-full flex items-start gap-2 px-3 py-1.5 text-left transition-colors ${
                        isHighlighted ? 'bg-accent-muted' : 'hover:bg-surface-hover'
                      }`}
                    >
                      <Icon size={12} className="text-text-muted shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-mono text-text-primary truncate">
                          {item.label}
                        </div>
                        {item.description && (
                          <div className="text-[10px] text-text-muted truncate">
                            {item.description}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
