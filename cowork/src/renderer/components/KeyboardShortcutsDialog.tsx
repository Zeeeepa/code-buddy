/**
 * KeyboardShortcutsDialog — Modal showing all keyboard shortcuts
 */
import React from 'react';
import { X } from 'lucide-react';

interface KeyboardShortcutsDialogProps {
  onClose: () => void;
}

interface ShortcutEntry {
  keys: string;
  description: string;
}

interface ShortcutSection {
  title: string;
  shortcuts: ShortcutEntry[];
}

const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.userAgent);
const mod = isMac ? '\u2318' : 'Ctrl';

const sections: ShortcutSection[] = [
  {
    title: 'General',
    shortcuts: [
      { keys: `${mod}+K`, description: 'Open command palette' },
      { keys: `${mod}+/`, description: 'Show keyboard shortcuts' },
      { keys: `${mod}+N`, description: 'New session' },
      { keys: `${mod}+,`, description: 'Open settings' },
      { keys: `${mod}+F`, description: 'Search in messages' },
    ],
  },
  {
    title: 'Chat',
    shortcuts: [
      { keys: 'Enter', description: 'Send message' },
      { keys: 'Shift+Enter', description: 'New line' },
      { keys: 'Escape', description: 'Stop generation' },
    ],
  },
  {
    title: 'Navigation',
    shortcuts: [
      { keys: `${mod}+B`, description: 'Toggle sidebar' },
      { keys: `${mod}+.`, description: 'Toggle context panel' },
    ],
  },
  {
    title: 'Checkpoints',
    shortcuts: [
      { keys: `${mod}+Z`, description: 'Undo last change' },
      { keys: `${mod}+Shift+Z`, description: 'Redo' },
    ],
  },
];

export const KeyboardShortcutsDialog: React.FC<KeyboardShortcutsDialogProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-[520px] max-h-[80vh] bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h2 className="text-sm font-medium text-zinc-200">Keyboard Shortcuts</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-5 space-y-5">
          {sections.map((section) => (
            <div key={section.title}>
              <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
                {section.title}
              </h3>
              <div className="space-y-1">
                {section.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.keys}
                    className="flex items-center justify-between py-1.5"
                  >
                    <span className="text-sm text-zinc-300">{shortcut.description}</span>
                    <kbd className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400">
                      {shortcut.keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
