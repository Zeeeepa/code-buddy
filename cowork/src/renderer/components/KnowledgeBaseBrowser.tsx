/**
 * KnowledgeBaseBrowser — Browse and manage project knowledge entries
 * Claude Cowork parity: project-scoped markdown knowledge base.
 */
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BookOpen,
  Search,
  Plus,
  Trash2,
  Edit2,
  X,
  Save,
  Tag,
  RefreshCw,
} from 'lucide-react';
import { useActiveProjectId } from '../store/selectors';

interface KnowledgeEntry {
  id: string;
  title: string;
  tags: string[];
  scope: string[];
  priority: number;
  content: string;
  source: string;
  path: string;
  updatedAt: number;
}

export const KnowledgeBaseBrowser: React.FC = () => {
  const { t } = useTranslation();
  const activeProjectId = useActiveProjectId();
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [showNewDialog, setShowNewDialog] = useState(false);

  // Edit/new form state
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formTags, setFormTags] = useState('');

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const api = window.electronAPI;
      if (!api?.knowledge) {
        setEntries([]);
        return;
      }
      const result = await api.knowledge.list(activeProjectId ?? undefined);
      setEntries(result as unknown as KnowledgeEntry[]);
    } catch (err) {
      console.error('[KnowledgeBaseBrowser] Failed to load:', err);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [activeProjectId]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const filteredEntries = useMemo(() => {
    if (!query.trim()) return entries;
    const lower = query.trim().toLowerCase();
    return entries.filter(
      (e) =>
        e.title.toLowerCase().includes(lower) ||
        e.content.toLowerCase().includes(lower) ||
        e.tags.some((t) => t.toLowerCase().includes(lower))
    );
  }, [entries, query]);

  const selected = entries.find((e) => e.id === selectedId);

  const handleCreate = useCallback(async () => {
    if (!formTitle.trim() || !formContent.trim()) return;
    const api = window.electronAPI;
    if (!api?.knowledge) return;

    try {
      await api.knowledge.create(
        {
          title: formTitle.trim(),
          content: formContent,
          tags: formTags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
        },
        activeProjectId ?? undefined
      );

      setFormTitle('');
      setFormContent('');
      setFormTags('');
      setShowNewDialog(false);
      await loadEntries();
    } catch (err) {
      console.error('[KnowledgeBaseBrowser] Create failed:', err);
    }
  }, [formTitle, formContent, formTags, activeProjectId, loadEntries]);

  const handleUpdate = useCallback(async () => {
    if (!selected) return;
    const api = window.electronAPI;
    if (!api?.knowledge) return;

    try {
      await api.knowledge.update(
        selected.id,
        {
          title: formTitle.trim(),
          content: formContent,
          tags: formTags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
        },
        activeProjectId ?? undefined
      );

      setEditing(false);
      await loadEntries();
    } catch (err) {
      console.error('[KnowledgeBaseBrowser] Update failed:', err);
    }
  }, [selected, formTitle, formContent, formTags, activeProjectId, loadEntries]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm(t('knowledgeBrowser.deleteConfirm'))) return;
      const api = window.electronAPI;
      if (!api?.knowledge) return;

      try {
        await api.knowledge.delete(id, activeProjectId ?? undefined);
        if (selectedId === id) setSelectedId(null);
        await loadEntries();
      } catch (err) {
        console.error('[KnowledgeBaseBrowser] Delete failed:', err);
      }
    },
    [activeProjectId, selectedId, loadEntries, t]
  );

  const startEditing = useCallback(() => {
    if (!selected) return;
    setFormTitle(selected.title);
    setFormContent(selected.content);
    setFormTags(selected.tags.join(', '));
    setEditing(true);
  }, [selected]);

  if (!activeProjectId) {
    return (
      <div className="p-6 text-center">
        <BookOpen size={24} className="text-text-muted mx-auto mb-2" />
        <p className="text-sm text-text-muted">
          {t('knowledgeBrowser.noEntries')}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border-muted bg-background/40">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen size={14} className="text-accent" />
            <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider">
              {t('knowledgeBrowser.title')}
            </h3>
            <button
              onClick={loadEntries}
              className="ml-auto p-1 text-text-muted hover:text-text-primary"
              title={t('common.loading')}
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={() => {
                setFormTitle('');
                setFormContent('');
                setFormTags('');
                setShowNewDialog(true);
              }}
              className="p-1 text-accent hover:text-accent-hover"
              title={t('knowledgeBrowser.addEntry')}
            >
              <Plus size={14} />
            </button>
          </div>

          <div className="relative">
            <Search
              size={12}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('knowledgeBrowser.search')}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-surface border border-border rounded text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        {/* Entries list + detail */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {!selected ? (
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {loading && (
                <div className="text-xs text-text-muted text-center py-4">{t('common.loading')}</div>
              )}
              {!loading && filteredEntries.length === 0 && (
                <div className="text-xs text-text-muted text-center py-6">
                  {entries.length === 0 ? t('knowledgeBrowser.noEntries') : t('memoryBrowser.noMatches')}
                </div>
              )}
              {!loading &&
                filteredEntries.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => setSelectedId(entry.id)}
                    className="w-full text-left p-2 rounded hover:bg-surface-hover transition-colors"
                  >
                    <div className="text-xs font-medium text-text-primary truncate">
                      {entry.title}
                    </div>
                    {entry.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {entry.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="text-[9px] px-1.5 py-0.5 rounded bg-surface text-text-secondary flex items-center gap-0.5"
                          >
                            <Tag size={8} />
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="text-[10px] text-text-muted mt-1 line-clamp-2">
                      {entry.content.slice(0, 120)}
                    </div>
                  </button>
                ))}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-3">
              <div className="flex items-center gap-2 mb-3">
                <button
                  onClick={() => {
                    setSelectedId(null);
                    setEditing(false);
                  }}
                  className="text-xs text-text-muted hover:text-text-primary"
                >
                  ← {t('common.cancel')}
                </button>
                <div className="ml-auto flex items-center gap-1">
                  {!editing && (
                    <>
                      <button
                        onClick={startEditing}
                        className="p-1 text-text-muted hover:text-text-primary"
                        title={t('knowledgeBrowser.editEntry')}
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={() => handleDelete(selected.id)}
                        className="p-1 text-text-muted hover:text-error"
                        title={t('knowledgeBrowser.deleteEntry')}
                      >
                        <Trash2 size={12} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {editing ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder={t('knowledgeBrowser.title_field')}
                    className="w-full px-3 py-2 text-sm bg-surface border border-border rounded text-text-primary"
                  />
                  <input
                    type="text"
                    value={formTags}
                    onChange={(e) => setFormTags(e.target.value)}
                    placeholder={t('knowledgeBrowser.tags')}
                    className="w-full px-3 py-2 text-xs bg-surface border border-border rounded text-text-secondary"
                  />
                  <textarea
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    rows={12}
                    className="w-full px-3 py-2 text-xs bg-surface border border-border rounded text-text-primary font-mono resize-none focus:outline-none focus:border-accent"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setEditing(false)}
                      className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary"
                    >
                      {t('knowledgeBrowser.cancel')}
                    </button>
                    <button
                      onClick={handleUpdate}
                      className="px-3 py-1.5 text-xs bg-accent hover:bg-accent-hover text-white rounded flex items-center gap-1"
                    >
                      <Save size={12} />
                      {t('knowledgeBrowser.save')}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <h4 className="text-sm font-semibold text-text-primary mb-2">
                    {selected.title}
                  </h4>
                  {selected.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {selected.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-surface text-text-secondary flex items-center gap-0.5"
                        >
                          <Tag size={10} />
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <pre className="text-xs text-text-secondary whitespace-pre-wrap font-mono">
                    {selected.content}
                  </pre>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* New entry dialog */}
      {showNewDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-background border border-border rounded-xl shadow-elevated w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                <BookOpen size={20} className="text-accent" />
                {t('knowledgeBrowser.addEntry')}
              </h2>
              <button
                onClick={() => setShowNewDialog(false)}
                className="text-text-muted hover:text-text-primary"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder={t('knowledgeBrowser.title_field')}
                autoFocus
                className="w-full px-3 py-2 text-sm bg-surface border border-border rounded text-text-primary focus:outline-none focus:border-accent"
              />
              <input
                type="text"
                value={formTags}
                onChange={(e) => setFormTags(e.target.value)}
                placeholder={t('knowledgeBrowser.tags')}
                className="w-full px-3 py-2 text-xs bg-surface border border-border rounded text-text-secondary focus:outline-none focus:border-accent"
              />
              <textarea
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                placeholder={t('knowledgeBrowser.content')}
                rows={14}
                className="w-full px-3 py-2 text-xs bg-surface border border-border rounded text-text-primary font-mono resize-none focus:outline-none focus:border-accent"
              />
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowNewDialog(false)}
                className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary"
              >
                {t('knowledgeBrowser.cancel')}
              </button>
              <button
                onClick={handleCreate}
                disabled={!formTitle.trim() || !formContent.trim()}
                className="px-4 py-2 text-sm bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg flex items-center gap-1"
              >
                <Save size={14} />
                {t('knowledgeBrowser.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
