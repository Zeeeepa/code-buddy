/**
 * MemoryEditCard — Claude Cowork parity Phase 2 step 17
 *
 * Inline editor card that lists project memory entries and lets the user
 * add, edit, or delete them. Triggered by `/memory` slash command.
 *
 * @module renderer/components/MemoryEditCard
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Brain,
  X,
  Plus,
  Save,
  Trash2,
  Loader2,
  Edit3,
  Check,
} from 'lucide-react';

type MemoryCategory = 'preference' | 'pattern' | 'context' | 'decision';

interface MemoryEntry {
  category: MemoryCategory;
  content: string;
  sourceSessionId?: string;
  timestamp: number;
}

interface MemoryEditCardProps {
  onClose: () => void;
}

export const MemoryEditCard: React.FC<MemoryEditCardProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [editingCategory, setEditingCategory] = useState<MemoryCategory>('context');
  const [adding, setAdding] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState<MemoryCategory>('context');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const api = window.electronAPI;
      if (!api?.memory?.list) {
        setEntries([]);
        return;
      }
      const result = await api.memory.list();
      setEntries(result as MemoryEntry[]);
    } catch (err) {
      console.error('[MemoryEditCard] load failed:', err);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAdd = useCallback(async () => {
    if (!newContent.trim()) return;
    const api = window.electronAPI;
    if (!api?.memory?.add) return;
    const result = await api.memory.add(newCategory, newContent.trim());
    if (result.success) {
      setNewContent('');
      setAdding(false);
      setStatusMessage(t('memoryEdit.added'));
      await load();
    } else {
      setStatusMessage(result.error ?? t('memoryEdit.addFailed'));
    }
  }, [newContent, newCategory, load, t]);

  const handleStartEdit = (index: number, entry: MemoryEntry) => {
    setEditingIndex(index);
    setEditingContent(entry.content);
    setEditingCategory(entry.category);
  };

  const handleSaveEdit = useCallback(async () => {
    if (editingIndex === null) return;
    const api = window.electronAPI;
    if (!api?.memory?.update) return;
    const result = await api.memory.update(editingIndex, editingContent.trim(), editingCategory);
    if (result.success) {
      setEditingIndex(null);
      setStatusMessage(t('memoryEdit.updated'));
      await load();
    } else {
      setStatusMessage(result.error ?? t('memoryEdit.updateFailed'));
    }
  }, [editingIndex, editingContent, editingCategory, load, t]);

  const handleDelete = useCallback(
    async (index: number) => {
      const api = window.electronAPI;
      if (!api?.memory?.delete) return;
      if (!confirm(t('memoryEdit.deleteConfirm'))) return;
      const result = await api.memory.delete(index);
      if (result.success) {
        setStatusMessage(t('memoryEdit.deleted'));
        await load();
      } else {
        setStatusMessage(result.error ?? t('memoryEdit.deleteFailed'));
      }
    },
    [load, t]
  );

  return (
    <div className="border border-border rounded-xl bg-surface overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-muted bg-background/40">
        <div className="flex items-center gap-2">
          <Brain size={14} className="text-accent" />
          <span className="text-xs font-semibold text-text-primary">
            {t('memoryEdit.title')}
          </span>
          <span className="text-[10px] text-text-muted">
            {entries.length} {t('memoryEdit.entries')}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-text-muted hover:text-text-primary transition-colors"
          title={t('common.close')}
        >
          <X size={12} />
        </button>
      </div>

      <div className="p-3 space-y-2 max-h-[400px] overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-4 text-xs text-text-muted">
            <Loader2 size={12} className="animate-spin" />
            {t('common.loading')}
          </div>
        )}

        {!loading && entries.length === 0 && !adding && (
          <div className="text-xs text-text-muted text-center py-3">
            {t('memoryEdit.empty')}
          </div>
        )}

        {!loading &&
          entries.map((entry, index) => {
            const isEditing = index === editingIndex;
            return (
              <div
                key={`mem-${index}-${entry.timestamp}`}
                className="group flex items-start gap-2 p-2 bg-background border border-border rounded-lg"
              >
                {isEditing ? (
                  <div className="flex-1 min-w-0 space-y-2">
                    <select
                      value={editingCategory}
                      onChange={(e) => setEditingCategory(e.target.value as MemoryCategory)}
                      className="px-2 py-1 text-[10px] bg-surface border border-border rounded text-text-primary"
                    >
                      <option value="preference">preference</option>
                      <option value="pattern">pattern</option>
                      <option value="context">context</option>
                      <option value="decision">decision</option>
                    </select>
                    <textarea
                      value={editingContent}
                      onChange={(e) => setEditingContent(e.target.value)}
                      rows={2}
                      autoFocus
                      className="w-full px-2 py-1 text-xs bg-surface border border-border rounded text-text-primary resize-none focus:outline-none focus:border-accent"
                    />
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => setEditingIndex(null)}
                        className="px-2 py-1 text-[10px] text-text-muted hover:text-text-primary"
                      >
                        {t('common.cancel')}
                      </button>
                      <button
                        onClick={handleSaveEdit}
                        className="flex items-center gap-1 px-2 py-1 text-[10px] bg-accent hover:bg-accent-hover text-white rounded"
                      >
                        <Check size={10} />
                        {t('common.save')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <span
                      className={`px-1.5 py-0.5 text-[9px] uppercase font-semibold rounded shrink-0 mt-0.5 ${
                        entry.category === 'preference'
                          ? 'bg-accent/20 text-accent'
                          : entry.category === 'pattern'
                            ? 'bg-success/20 text-success'
                            : entry.category === 'decision'
                              ? 'bg-warning/20 text-warning'
                              : 'bg-surface-hover text-text-muted'
                      }`}
                    >
                      {entry.category}
                    </span>
                    <div className="flex-1 min-w-0 text-xs text-text-primary">
                      {entry.content}
                      {entry.sourceSessionId && (
                        <div className="text-[9px] text-text-muted opacity-60 mt-0.5">
                          {entry.sourceSessionId}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleStartEdit(index, entry)}
                        className="p-1 text-text-muted hover:text-text-primary"
                        title={t('common.edit')}
                      >
                        <Edit3 size={11} />
                      </button>
                      <button
                        onClick={() => handleDelete(index)}
                        className="p-1 text-text-muted hover:text-error"
                        title={t('common.delete')}
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}

        {adding && (
          <div className="p-2 bg-background border border-accent border-dashed rounded-lg space-y-2">
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as MemoryCategory)}
              className="px-2 py-1 text-[10px] bg-surface border border-border rounded text-text-primary"
            >
              <option value="preference">preference</option>
              <option value="pattern">pattern</option>
              <option value="context">context</option>
              <option value="decision">decision</option>
            </select>
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              rows={2}
              autoFocus
              placeholder={t('memoryEdit.newPlaceholder')}
              className="w-full px-2 py-1 text-xs bg-surface border border-border rounded text-text-primary resize-none focus:outline-none focus:border-accent"
            />
            <div className="flex justify-end gap-1">
              <button
                onClick={() => {
                  setAdding(false);
                  setNewContent('');
                }}
                className="px-2 py-1 text-[10px] text-text-muted hover:text-text-primary"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleAdd}
                disabled={!newContent.trim()}
                className="flex items-center gap-1 px-2 py-1 text-[10px] bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded"
              >
                <Save size={10} />
                {t('common.add')}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-3 py-2 border-t border-border-muted bg-background/40">
        {statusMessage ? (
          <span className="text-[10px] text-text-muted truncate">{statusMessage}</span>
        ) : (
          <span />
        )}
        <button
          onClick={() => setAdding(true)}
          disabled={adding}
          className="flex items-center gap-1 px-2 py-1 text-[10px] bg-surface hover:bg-surface-hover border border-border rounded disabled:opacity-50"
        >
          <Plus size={10} />
          {t('memoryEdit.addNew')}
        </button>
      </div>
    </div>
  );
};
