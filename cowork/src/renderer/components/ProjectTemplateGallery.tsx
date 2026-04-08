/**
 * ProjectTemplateGallery — Claude Cowork parity Phase 2 step 12
 *
 * Grid of project starter pack templates pulled from the SKILL.md
 * registry. Used by the New Project flow to scaffold a workspace.
 *
 * @module renderer/components/ProjectTemplateGallery
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Search,
  Loader2,
  Package,
  Check,
  ChevronRight,
  X,
} from 'lucide-react';

interface ProjectTemplate {
  name: string;
  description: string;
  tier: string;
  tags: string[];
  language?: string;
  filePath?: string;
}

interface ProjectTemplateGalleryProps {
  /** Optional initial filter (e.g. "react") */
  initialQuery?: string;
  onSelect: (template: ProjectTemplate) => void;
  onCancel?: () => void;
}

export const ProjectTemplateGallery: React.FC<ProjectTemplateGalleryProps> = ({
  initialQuery = '',
  onSelect,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState(initialQuery);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    (async () => {
      try {
        const api = window.electronAPI;
        if (!api?.template?.list) {
          setTemplates([]);
          return;
        }
        const result = await api.template.list();
        setTemplates(result);
      } catch (err) {
        console.error('[ProjectTemplateGallery] list failed:', err);
        setTemplates([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Load preview when a template is selected
  useEffect(() => {
    if (!selectedName) {
      setPreviewContent(null);
      return;
    }
    setPreviewLoading(true);
    (async () => {
      try {
        const api = window.electronAPI;
        if (!api?.template?.preview) {
          setPreviewContent(null);
          return;
        }
        const result = await api.template.preview(selectedName);
        setPreviewContent(result?.content ?? null);
      } catch (err) {
        console.error('[ProjectTemplateGallery] preview failed:', err);
        setPreviewContent(null);
      } finally {
        setPreviewLoading(false);
      }
    })();
  }, [selectedName]);

  const filtered = useMemo(() => {
    if (!query.trim()) return templates;
    const q = query.toLowerCase();
    return templates.filter((tpl) => {
      return (
        tpl.name.toLowerCase().includes(q) ||
        tpl.description.toLowerCase().includes(q) ||
        (tpl.language ?? '').toLowerCase().includes(q) ||
        tpl.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    });
  }, [templates, query]);

  // Group by language
  const grouped = useMemo(() => {
    const groups: Record<string, ProjectTemplate[]> = {};
    for (const tpl of filtered) {
      const key = tpl.language ?? 'Other';
      if (!groups[key]) groups[key] = [];
      groups[key].push(tpl);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const selected = templates.find((t) => t.name === selectedName);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-muted shrink-0">
        <div className="flex items-center gap-2">
          <Package size={16} className="text-accent" />
          <span className="text-sm font-semibold text-text-primary">
            {t('templates.title')}
          </span>
          <span className="text-xs text-text-muted">
            {t('templates.count', { count: templates.length })}
          </span>
        </div>
        {onCancel && (
          <button
            onClick={onCancel}
            className="p-1 text-text-muted hover:text-text-primary transition-colors"
            title={t('common.close')}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Search */}
      <div className="px-4 py-3 border-b border-border-muted shrink-0">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('templates.searchPlaceholder')}
            className="w-full pl-9 pr-3 py-2 text-sm bg-surface border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
          />
        </div>
      </div>

      {/* Body: split layout with grid + preview */}
      <div className="flex-1 min-h-0 flex">
        {/* Template grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-xs text-text-muted">
              <Loader2 size={14} className="animate-spin" />
              {t('common.loading')}
            </div>
          ) : grouped.length === 0 ? (
            <div className="text-center text-xs text-text-muted py-12">
              {t('templates.empty')}
            </div>
          ) : (
            <div className="space-y-5">
              {grouped.map(([language, items]) => (
                <div key={language}>
                  <h3 className="text-[11px] uppercase tracking-wide font-semibold text-text-muted mb-2">
                    {language}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {items.map((tpl) => {
                      const isSelected = tpl.name === selectedName;
                      return (
                        <button
                          key={tpl.name}
                          onClick={() => setSelectedName(tpl.name)}
                          className={`text-left p-3 rounded-lg border transition-all ${
                            isSelected
                              ? 'border-accent bg-accent/10'
                              : 'border-border bg-surface hover:border-border-strong hover:bg-surface-hover'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Package
                              size={12}
                              className={isSelected ? 'text-accent' : 'text-text-muted'}
                            />
                            <span className="text-xs font-semibold text-text-primary truncate">
                              {tpl.name}
                            </span>
                            {isSelected && <Check size={11} className="text-accent ml-auto" />}
                          </div>
                          <p className="text-[11px] text-text-muted line-clamp-2">
                            {tpl.description}
                          </p>
                          {tpl.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {tpl.tags.slice(0, 4).map((tag) => (
                                <span
                                  key={tag}
                                  className="px-1.5 py-0.5 text-[9px] bg-surface-hover text-text-muted rounded"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Preview pane */}
        {selected && (
          <div className="w-[360px] border-l border-border-muted bg-surface/30 flex flex-col">
            <div className="px-4 py-3 border-b border-border-muted shrink-0">
              <div className="text-xs font-semibold text-text-primary truncate">
                {selected.name}
              </div>
              <div className="text-[10px] text-text-muted mt-0.5">
                {selected.tier}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {previewLoading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-xs text-text-muted">
                  <Loader2 size={12} className="animate-spin" />
                  {t('common.loading')}
                </div>
              ) : previewContent ? (
                <pre className="text-[10px] font-mono text-text-primary whitespace-pre-wrap break-words">
                  {previewContent.slice(0, 4000)}
                  {previewContent.length > 4000 && '\n…'}
                </pre>
              ) : (
                <div className="text-xs text-text-muted text-center py-6">
                  {t('templates.noPreview')}
                </div>
              )}
            </div>
            <div className="px-4 py-3 border-t border-border-muted shrink-0">
              <button
                onClick={() => onSelect(selected)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors"
              >
                {t('templates.useTemplate')}
                <ChevronRight size={12} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
