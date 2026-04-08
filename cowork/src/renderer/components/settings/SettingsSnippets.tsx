/**
 * SettingsSnippets — Phase 3 step 5
 *
 * CRUD UI for reusable prompt snippets (the backing file store is
 * `<userData>/snippets/*.md` managed by SnippetsService).
 */
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Save, Trash2, FileText } from 'lucide-react';

interface Snippet {
  id: string;
  name: string;
  description?: string;
  tags: string[];
  body: string;
  updatedAt: number;
}

interface Draft {
  id?: string;
  name: string;
  description: string;
  tags: string;
  body: string;
}

const EMPTY_DRAFT: Draft = { name: '', description: '', tags: '', body: '' };

export function SettingsSnippets() {
  const { t } = useTranslation();
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!window.electronAPI?.snippets?.list) return;
    const list = (await window.electronAPI.snippets.list()) as Snippet[];
    setSnippets(list);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selectSnippet = (snippet: Snippet) => {
    setSelectedId(snippet.id);
    setDraft({
      id: snippet.id,
      name: snippet.name,
      description: snippet.description ?? '',
      tags: snippet.tags.join(', '),
      body: snippet.body,
    });
    setDirty(false);
  };

  const newSnippet = () => {
    setSelectedId(null);
    setDraft(EMPTY_DRAFT);
    setDirty(true);
  };

  const handleSave = async () => {
    if (!draft.name.trim() || !draft.body.trim()) return;
    setSaving(true);
    try {
      const result = await window.electronAPI?.snippets?.save({
        id: draft.id,
        name: draft.name.trim(),
        description: draft.description.trim(),
        tags: draft.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        body: draft.body,
      });
      if (result?.success) {
        await load();
        if (result.id) setSelectedId(result.id);
        setDirty(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    if (!window.confirm(t('snippets.deleteConfirm'))) return;
    await window.electronAPI?.snippets?.delete(selectedId);
    await load();
    setSelectedId(null);
    setDraft(EMPTY_DRAFT);
    setDirty(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">{t('snippets.title')}</h3>
          <p className="text-xs text-text-muted mt-1">{t('snippets.settingsHint')}</p>
        </div>
        <button
          onClick={newSnippet}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-accent text-white hover:bg-accent-hover transition-colors"
        >
          <Plus size={12} />
          {t('snippets.newSnippet')}
        </button>
      </div>

      <div className="grid grid-cols-[260px_1fr] gap-3 min-h-[360px]">
        {/* List */}
        <div className="border border-border rounded-lg overflow-hidden flex flex-col">
          {snippets.length === 0 && (
            <div className="px-4 py-6 text-xs text-text-muted text-center">
              {t('snippets.empty')}
            </div>
          )}
          <div className="flex-1 overflow-y-auto">
            {snippets.map((s) => (
              <button
                key={s.id}
                onClick={() => selectSnippet(s)}
                className={`w-full text-left px-3 py-2 border-b border-border-muted transition-colors ${
                  selectedId === s.id ? 'bg-accent/10' : 'hover:bg-surface-hover'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <FileText size={12} className="text-text-muted shrink-0" />
                  <span className="text-xs font-medium text-text-primary truncate">{s.name}</span>
                </div>
                {s.description && (
                  <p className="text-[11px] text-text-muted mt-0.5 truncate">{s.description}</p>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Editor */}
        <div className="border border-border rounded-lg p-4 space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-text-secondary">
              {t('snippets.name')}
            </label>
            <input
              value={draft.name}
              onChange={(ev) => {
                setDraft({ ...draft, name: ev.target.value });
                setDirty(true);
              }}
              className="w-full px-3 py-1.5 rounded-md bg-surface border border-border text-sm text-text-primary focus:outline-none focus:border-accent"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-text-secondary">
              {t('snippets.description')}
            </label>
            <input
              value={draft.description}
              onChange={(ev) => {
                setDraft({ ...draft, description: ev.target.value });
                setDirty(true);
              }}
              className="w-full px-3 py-1.5 rounded-md bg-surface border border-border text-sm text-text-primary focus:outline-none focus:border-accent"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-text-secondary">
              {t('snippets.tags')}
            </label>
            <input
              value={draft.tags}
              onChange={(ev) => {
                setDraft({ ...draft, tags: ev.target.value });
                setDirty(true);
              }}
              placeholder={t('snippets.tagsPlaceholder')}
              className="w-full px-3 py-1.5 rounded-md bg-surface border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-text-secondary">
              {t('snippets.body')}
            </label>
            <textarea
              value={draft.body}
              onChange={(ev) => {
                setDraft({ ...draft, body: ev.target.value });
                setDirty(true);
              }}
              placeholder={t('snippets.bodyPlaceholder')}
              rows={10}
              className="w-full px-3 py-2 rounded-md bg-surface border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent font-mono"
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            {selectedId && (
              <button
                onClick={handleDelete}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-error/10 text-error hover:bg-error/20 transition-colors"
              >
                <Trash2 size={12} />
                {t('common.delete')}
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={!dirty || saving || !draft.name.trim() || !draft.body.trim()}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-accent text-white hover:bg-accent-hover disabled:opacity-50 transition-colors"
            >
              <Save size={12} />
              {t('snippets.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
