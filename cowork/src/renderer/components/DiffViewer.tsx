/**
 * DiffViewer — Inline unified diff renderer
 *
 * Shows file changes with green/red line highlighting,
 * stats header, and accept/reject actions.
 */
import React, { useState, useMemo } from 'react';
import type { DiffEntry } from '../types';

interface DiffViewerProps {
  diff: DiffEntry;
  onAccept?: () => void;
  onReject?: () => void;
}

interface DiffLine {
  type: 'add' | 'remove' | 'context' | 'header';
  content: string;
  lineNumber?: number;
}

function parseDiffLines(excerpt: string): DiffLine[] {
  if (!excerpt) return [];
  const lines = excerpt.split('\n');
  const result: DiffLine[] = [];

  for (const line of lines) {
    if (line.startsWith('@@')) {
      result.push({ type: 'header', content: line });
    } else if (line.startsWith('+')) {
      result.push({ type: 'add', content: line.slice(1) });
    } else if (line.startsWith('-')) {
      result.push({ type: 'remove', content: line.slice(1) });
    } else {
      result.push({ type: 'context', content: line.startsWith(' ') ? line.slice(1) : line });
    }
  }

  return result;
}

const actionBadgeColors: Record<string, string> = {
  create: 'bg-green-500/20 text-green-400',
  modify: 'bg-blue-500/20 text-blue-400',
  delete: 'bg-red-500/20 text-red-400',
  rename: 'bg-yellow-500/20 text-yellow-400',
};

const actionLabels: Record<string, string> = {
  create: 'Created',
  modify: 'Modified',
  delete: 'Deleted',
  rename: 'Renamed',
};

export const DiffViewer: React.FC<DiffViewerProps> = React.memo(({ diff, onAccept, onReject }) => {
  const [collapsed, setCollapsed] = useState(false);
  const lines = useMemo(() => parseDiffLines(diff.excerpt), [diff.excerpt]);

  return (
    <div className="mt-2 rounded-lg border border-zinc-700 overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 bg-zinc-800 cursor-pointer select-none"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-mono text-zinc-300 truncate">{diff.path}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded ${actionBadgeColors[diff.action] || 'bg-zinc-600 text-zinc-300'}`}>
            {actionLabels[diff.action] || diff.action}
          </span>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {diff.linesAdded > 0 && (
            <span className="text-xs text-green-400">+{diff.linesAdded}</span>
          )}
          {diff.linesRemoved > 0 && (
            <span className="text-xs text-red-400">-{diff.linesRemoved}</span>
          )}
          <span className="text-xs text-zinc-500">{collapsed ? '\u25B6' : '\u25BC'}</span>
        </div>
      </div>

      {/* Diff content */}
      {!collapsed && lines.length > 0 && (
        <div className="overflow-x-auto max-h-80 overflow-y-auto bg-zinc-900">
          <pre className="text-xs font-mono leading-5">
            {lines.map((line, i) => (
              <div
                key={i}
                className={
                  line.type === 'add'
                    ? 'bg-green-500/10 text-green-300 px-3'
                    : line.type === 'remove'
                    ? 'bg-red-500/10 text-red-300 px-3'
                    : line.type === 'header'
                    ? 'bg-blue-500/10 text-blue-300 px-3'
                    : 'text-zinc-400 px-3'
                }
              >
                <span className="inline-block w-4 text-zinc-600 select-none mr-2">
                  {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : line.type === 'header' ? '@' : ' '}
                </span>
                {line.content}
              </div>
            ))}
          </pre>
        </div>
      )}

      {/* Actions */}
      {(onAccept || onReject) && !collapsed && (
        <div className="flex items-center justify-end gap-2 px-3 py-2 bg-zinc-800 border-t border-zinc-700">
          {onReject && (
            <button
              onClick={onReject}
              className="text-xs px-3 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
            >
              Reject
            </button>
          )}
          {onAccept && (
            <button
              onClick={onAccept}
              className="text-xs px-3 py-1 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
            >
              Accept
            </button>
          )}
        </div>
      )}
    </div>
  );
});

DiffViewer.displayName = 'DiffViewer';
