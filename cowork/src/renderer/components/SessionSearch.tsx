/**
 * SessionSearch — In-message search with highlighting (Cmd+F)
 */
import React, { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, ChevronUp, ChevronDown } from 'lucide-react';

interface SessionSearchProps {
  query: string;
  onQueryChange: (query: string) => void;
  onClose: () => void;
  matchCount: number;
  currentMatch: number;
  onNext: () => void;
  onPrev: () => void;
}

export const SessionSearch: React.FC<SessionSearchProps> = ({
  query,
  onQueryChange,
  onClose,
  matchCount,
  currentMatch,
  onNext,
  onPrev,
}) => {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter') {
      if (e.shiftKey) {
        onPrev();
      } else {
        onNext();
      }
    }
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-zinc-800 border-b border-zinc-700">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t('sessionSearch.placeholder', 'Search in messages…')}
        className="flex-1 text-xs bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
      />
      {query && (
        <span className="text-xs text-zinc-500 flex-shrink-0">
          {matchCount > 0
            ? `${currentMatch + 1}/${matchCount}`
            : t('sessionSearch.noResults', 'No results')}
        </span>
      )}
      <button
        onClick={onPrev}
        disabled={matchCount === 0}
        className="p-1 text-zinc-500 hover:text-zinc-300 disabled:opacity-30 transition-colors"
        title={t('sessionSearch.previous', 'Previous (Shift+Enter)')}
      >
        <ChevronUp size={14} />
      </button>
      <button
        onClick={onNext}
        disabled={matchCount === 0}
        className="p-1 text-zinc-500 hover:text-zinc-300 disabled:opacity-30 transition-colors"
        title={t('sessionSearch.next', 'Next (Enter)')}
      >
        <ChevronDown size={14} />
      </button>
      <button
        onClick={onClose}
        className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
        title={t('sessionSearch.close', 'Close (Esc)')}
      >
        <X size={14} />
      </button>
    </div>
  );
};
