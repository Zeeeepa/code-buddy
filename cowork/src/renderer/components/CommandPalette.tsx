/**
 * CommandPalette — Cmd+K command palette with fuzzy search
 */
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, MessageSquare, Settings, Download, Keyboard, Sun, Moon } from 'lucide-react';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  shortcut?: string;
}

interface CommandPaletteProps {
  onClose: () => void;
  onNewSession: () => void;
  onOpenSettings: () => void;
  onToggleTheme: () => void;
  onShowShortcuts: () => void;
  isDark: boolean;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  onClose,
  onNewSession,
  onOpenSettings,
  onToggleTheme,
  onShowShortcuts,
  isDark,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: CommandItem[] = useMemo(() => [
    { id: 'new-session', label: 'New Session', description: 'Start a new conversation', icon: <MessageSquare size={14} />, action: onNewSession, shortcut: 'Ctrl+N' },
    { id: 'settings', label: 'Settings', description: 'Open settings panel', icon: <Settings size={14} />, action: onOpenSettings, shortcut: 'Ctrl+,' },
    { id: 'theme', label: isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme', icon: isDark ? <Sun size={14} /> : <Moon size={14} />, action: onToggleTheme },
    { id: 'shortcuts', label: 'Keyboard Shortcuts', description: 'View all shortcuts', icon: <Keyboard size={14} />, action: onShowShortcuts, shortcut: 'Ctrl+/' },
    { id: 'export', label: 'Export Session', description: 'Export as Markdown or JSON', icon: <Download size={14} />, action: () => { /* handled by sidebar */ } },
  ], [onNewSession, onOpenSettings, onToggleTheme, onShowShortcuts, isDark]);

  const filtered = useMemo(() => {
    if (!query) return commands;
    const q = query.toLowerCase();
    return commands.filter((c) =>
      c.label.toLowerCase().includes(q) ||
      c.description?.toLowerCase().includes(q)
    );
  }, [query, commands]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      filtered[selectedIndex].action();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24" onClick={onClose}>
      <div
        className="w-[480px] bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
          <Search size={16} className="text-zinc-500" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command..."
            className="flex-1 bg-transparent text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
          />
        </div>

        {/* Results */}
        <div className="max-h-64 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-sm text-zinc-500">No matching commands</div>
          ) : (
            filtered.map((cmd, i) => (
              <button
                key={cmd.id}
                onClick={() => { cmd.action(); onClose(); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  i === selectedIndex ? 'bg-zinc-800' : 'hover:bg-zinc-800/50'
                }`}
              >
                <span className="text-zinc-400">{cmd.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-zinc-200">{cmd.label}</div>
                  {cmd.description && <div className="text-xs text-zinc-500">{cmd.description}</div>}
                </div>
                {cmd.shortcut && (
                  <span className="text-xs text-zinc-600 font-mono">{cmd.shortcut}</span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
