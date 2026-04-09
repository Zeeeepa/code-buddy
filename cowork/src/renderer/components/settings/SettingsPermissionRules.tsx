/**
 * SettingsPermissionRules — Claude Cowork parity Phase 2
 *
 * Visual editor for declarative permission rules stored in
 * `.codebuddy/settings.json` under `permissions.allow` / `permissions.deny`.
 *
 * Users can add/edit/remove rules in both buckets and run a dry-run test
 * of a tool call against the current rule set.
 *
 * @module renderer/components/settings/SettingsPermissionRules
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Shield,
  ShieldCheck,
  ShieldX,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  FlaskConical,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Monitor,
} from 'lucide-react';
import { useActiveProjectId } from '../../store/selectors';
import { useAppStore } from '../../store';
import { deriveScopedPermissionRule } from '../../utils/permission-target-rule';

type Bucket = 'allow' | 'deny';

const EXAMPLE_RULES: Array<{ rule: string; bucket: Bucket; hint: string }> = [
  { rule: 'Read', bucket: 'allow', hint: 'Allow all Read operations' },
  { rule: 'Bash(npm *)', bucket: 'allow', hint: 'Allow any npm command' },
  { rule: 'Bash(git *)', bucket: 'allow', hint: 'Allow any git command' },
  { rule: 'Edit(src/**)', bucket: 'allow', hint: 'Allow edits inside src/' },
  { rule: 'Bash(rm -rf *)', bucket: 'deny', hint: 'Never allow recursive delete' },
  { rule: 'Edit(.env*)', bucket: 'deny', hint: 'Block edits to env files' },
];

export const SettingsPermissionRules: React.FC = () => {
  const { t } = useTranslation();
  const activeProjectId = useActiveProjectId();
  const guiActions = useAppStore((s) => s.guiActions);
  const [allow, setAllow] = useState<string[]>([]);
  const [deny, setDeny] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [newAllow, setNewAllow] = useState('');
  const [newDeny, setNewDeny] = useState('');
  const [editing, setEditing] = useState<{ bucket: Bucket; rule: string; value: string } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [testTool, setTestTool] = useState('Bash');
  const [testArg, setTestArg] = useState('npm install');
  const [testResult, setTestResult] = useState<{
    decision: 'allow' | 'ask' | 'deny';
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const api = window.electronAPI;
      if (!api?.rules) return;
      const result = await api.rules.list(activeProjectId ?? undefined);
      setAllow(result.allow);
      setDeny(result.deny);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [activeProjectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAdd = useCallback(
    async (bucket: Bucket, rule: string) => {
      const api = window.electronAPI;
      if (!api?.rules || !rule.trim()) return;
      const result = await api.rules.add(bucket, rule.trim(), activeProjectId ?? undefined);
      if (result.success) {
        if (bucket === 'allow') setNewAllow('');
        else setNewDeny('');
        setError(null);
        await load();
      } else {
        setError(result.error ?? 'Failed to add rule');
      }
    },
    [activeProjectId, load]
  );

  const handleRemove = useCallback(
    async (bucket: Bucket, rule: string) => {
      const api = window.electronAPI;
      if (!api?.rules) return;
      if (!confirm(t('rules.removeConfirm', { rule }))) return;
      const result = await api.rules.remove(bucket, rule, activeProjectId ?? undefined);
      if (result.success) {
        await load();
      } else {
        setError(result.error ?? 'Failed to remove rule');
      }
    },
    [activeProjectId, load, t]
  );

  const handleSaveEdit = useCallback(async () => {
    if (!editing) return;
    const api = window.electronAPI;
    if (!api?.rules) return;
    const result = await api.rules.update(
      editing.bucket,
      editing.rule,
      editing.value.trim(),
      activeProjectId ?? undefined
    );
    if (result.success) {
      setEditing(null);
      await load();
    } else {
      setError(result.error ?? 'Failed to update rule');
    }
  }, [editing, activeProjectId, load]);

  const handleTest = useCallback(async () => {
    const api = window.electronAPI;
    if (!api?.rules) return;
    const args: Record<string, unknown> = {};
    // Map common tool arg shapes
    const normalizedTool = testTool.toLowerCase();
    if (normalizedTool === 'bash') args.command = testArg;
    else if (['edit', 'write', 'read'].includes(normalizedTool)) args.path = testArg;
    else args.input = testArg;

    const result = await api.rules.test(testTool, args, activeProjectId ?? undefined);
    setTestResult(result);
  }, [testTool, testArg, activeProjectId]);

  const recentComputerUseSuggestions = React.useMemo(() => {
    const seen = new Set<string>();
    const suggestions: Array<{ rule: string; summary: string }> = [];

    for (const action of [...guiActions].reverse()) {
      const rule = deriveScopedPermissionRule(action.toolName, action.details || {});
      if (!rule || seen.has(rule)) {
        continue;
      }
      seen.add(rule);
      const details = action.details || {};
      const summary = [
        typeof details.app === 'string' ? details.app : '',
        typeof details.target === 'string' ? details.target : '',
        typeof details.url === 'string' ? details.url : '',
      ]
        .filter(Boolean)
        .join(' • ');
      suggestions.push({ rule, summary });
      if (suggestions.length >= 6) {
        break;
      }
    }

    return suggestions;
  }, [guiActions]);

  const renderRuleRow = (bucket: Bucket, rule: string) => {
    const isEditing = editing?.bucket === bucket && editing.rule === rule;
    return (
      <div
        key={`${bucket}-${rule}`}
        className="flex items-center gap-2 p-2 rounded bg-surface/40 border border-border-muted group"
      >
        {isEditing ? (
          <>
            <input
              type="text"
              value={editing.value}
              onChange={(e) => setEditing({ ...editing, value: e.target.value })}
              className="flex-1 px-2 py-0.5 text-xs font-mono bg-surface border border-border rounded text-text-primary focus:outline-none focus:border-accent"
              autoFocus
            />
            <button
              onClick={() => void handleSaveEdit()}
              className="p-1 text-success hover:bg-surface-hover rounded"
              title={t('common.save')}
            >
              <Check size={12} />
            </button>
            <button
              onClick={() => setEditing(null)}
              className="p-1 text-text-muted hover:text-text-primary hover:bg-surface-hover rounded"
              title={t('common.cancel')}
            >
              <X size={12} />
            </button>
          </>
        ) : (
          <>
            <code className="flex-1 text-xs font-mono text-text-primary truncate">{rule}</code>
            <button
              onClick={() => setEditing({ bucket, rule, value: rule })}
              className="p-1 text-text-muted hover:text-text-primary hover:bg-surface-hover rounded opacity-0 group-hover:opacity-100 transition-opacity"
              title={t('common.edit')}
            >
              <Edit2 size={12} />
            </button>
            <button
              onClick={() => void handleRemove(bucket, rule)}
              className="p-1 text-text-muted hover:text-error hover:bg-surface-hover rounded opacity-0 group-hover:opacity-100 transition-opacity"
              title={t('common.delete')}
            >
              <Trash2 size={12} />
            </button>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-4 py-3 border-b border-border-muted">
        <div className="flex items-center gap-2">
          <Shield size={14} className="text-accent" />
          <h2 className="text-sm font-semibold text-text-primary">{t('rules.title')}</h2>
        </div>
        <p className="text-[11px] text-text-muted mt-1">{t('rules.description')}</p>
      </div>

      {error && (
        <div className="mx-4 mt-3 p-2 rounded bg-error/10 border border-error/30 text-xs text-error flex items-start gap-2">
          <XCircle size={14} className="shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
        </div>
      )}

      <div className="p-4 space-y-6">
        {/* Allow list */}
        <section>
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck size={12} className="text-success" />
            <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider">
              {t('rules.allow')}
            </h3>
            <span className="text-[10px] text-text-muted ml-auto">{allow.length}</span>
          </div>
          <div className="space-y-1 mb-2">
            {loading && (
              <div className="text-[11px] text-text-muted">{t('common.loading')}</div>
            )}
            {!loading && allow.length === 0 && (
              <div className="text-[11px] text-text-muted italic">{t('rules.empty')}</div>
            )}
            {!loading && allow.map((rule) => renderRuleRow('allow', rule))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newAllow}
              onChange={(e) => setNewAllow(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd('allow', newAllow)}
              placeholder={t('rules.addPlaceholder')}
              className="flex-1 px-2 py-1 text-xs font-mono bg-surface border border-border rounded text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
            />
            <button
              onClick={() => void handleAdd('allow', newAllow)}
              disabled={!newAllow.trim()}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-success hover:opacity-90 disabled:opacity-50 text-white rounded"
            >
              <Plus size={12} />
              {t('rules.add')}
            </button>
          </div>
        </section>

        {/* Deny list */}
        <section>
          <div className="flex items-center gap-2 mb-2">
            <ShieldX size={12} className="text-error" />
            <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider">
              {t('rules.deny')}
            </h3>
            <span className="text-[10px] text-text-muted ml-auto">{deny.length}</span>
          </div>
          <div className="space-y-1 mb-2">
            {loading && (
              <div className="text-[11px] text-text-muted">{t('common.loading')}</div>
            )}
            {!loading && deny.length === 0 && (
              <div className="text-[11px] text-text-muted italic">{t('rules.empty')}</div>
            )}
            {!loading && deny.map((rule) => renderRuleRow('deny', rule))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newDeny}
              onChange={(e) => setNewDeny(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd('deny', newDeny)}
              placeholder={t('rules.addPlaceholder')}
              className="flex-1 px-2 py-1 text-xs font-mono bg-surface border border-border rounded text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
            />
            <button
              onClick={() => void handleAdd('deny', newDeny)}
              disabled={!newDeny.trim()}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-error hover:opacity-90 disabled:opacity-50 text-white rounded"
            >
              <Plus size={12} />
              {t('rules.add')}
            </button>
          </div>
        </section>

        {/* Examples */}
        <section className="p-3 rounded-lg border border-border-muted bg-surface/40">
          <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider mb-2">
            {t('rules.examples')}
          </h3>
          <div className="space-y-1">
            {EXAMPLE_RULES.map((example) => (
              <div
                key={example.rule}
                className="flex items-center gap-2 p-1.5 rounded hover:bg-surface-hover text-[11px]"
              >
                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] uppercase ${
                    example.bucket === 'allow'
                      ? 'bg-success/20 text-success border border-success/30'
                      : 'bg-error/20 text-error border border-error/30'
                  }`}
                >
                  {example.bucket}
                </span>
                <code className="flex-1 font-mono text-text-primary">{example.rule}</code>
                <span className="text-text-muted">{example.hint}</span>
                <button
                  onClick={() => void handleAdd(example.bucket, example.rule)}
                  className="p-1 text-text-muted hover:text-accent"
                  title={t('rules.addThis')}
                >
                  <Plus size={10} />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Computer use quick rules */}
        <section className="p-3 rounded-lg border border-border-muted bg-surface/40">
          <div className="flex items-center gap-2 mb-2">
            <Monitor size={12} className="text-accent" />
            <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider">
              {t('rules.computerUseTargets', 'Computer-use targets')}
            </h3>
          </div>
          <p className="text-[10px] text-text-muted mb-2">
            {t(
              'rules.computerUseHint',
              'Quick-add scoped allow rules from recent GUI and browser automation targets.'
            )}
          </p>
          {recentComputerUseSuggestions.length === 0 ? (
            <div className="text-[11px] text-text-muted italic">
              {t('rules.computerUseEmpty', 'No recent computer-use targets yet')}
            </div>
          ) : (
            <div className="space-y-1">
              {recentComputerUseSuggestions.map((suggestion) => (
                <div
                  key={suggestion.rule}
                  className="flex items-center gap-2 p-1.5 rounded hover:bg-surface-hover text-[11px]"
                >
                  <code className="flex-1 font-mono text-text-primary truncate">{suggestion.rule}</code>
                  {suggestion.summary && (
                    <span className="text-text-muted truncate max-w-[220px]">{suggestion.summary}</span>
                  )}
                  <button
                    onClick={() => void handleAdd('allow', suggestion.rule)}
                    className="p-1 text-text-muted hover:text-accent"
                    title={t('rules.addThis')}
                  >
                    <Plus size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Dry-run tester */}
        <section className="p-3 rounded-lg border border-border-muted bg-surface/40">
          <div className="flex items-center gap-2 mb-2">
            <FlaskConical size={12} className="text-accent" />
            <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider">
              {t('rules.dryRun')}
            </h3>
          </div>
          <p className="text-[10px] text-text-muted mb-2">{t('rules.dryRunHint')}</p>
          <div className="flex items-center gap-2 mb-2">
            <input
              type="text"
              value={testTool}
              onChange={(e) => setTestTool(e.target.value)}
              placeholder="Tool name"
              className="w-32 px-2 py-1 text-xs font-mono bg-surface border border-border rounded text-text-primary focus:outline-none focus:border-accent"
            />
            <input
              type="text"
              value={testArg}
              onChange={(e) => setTestArg(e.target.value)}
              placeholder="Primary arg (command / path)"
              className="flex-1 px-2 py-1 text-xs font-mono bg-surface border border-border rounded text-text-primary focus:outline-none focus:border-accent"
            />
            <button
              onClick={() => void handleTest()}
              className="px-3 py-1 text-xs bg-accent hover:bg-accent-hover text-white rounded"
            >
              {t('rules.test')}
            </button>
          </div>
          {testResult && (
            <div
              className={`flex items-center gap-2 p-2 rounded text-xs ${
                testResult.decision === 'allow'
                  ? 'bg-success/10 border border-success/30 text-success'
                  : testResult.decision === 'deny'
                    ? 'bg-error/10 border border-error/30 text-error'
                    : 'bg-warning/10 border border-warning/30 text-warning'
              }`}
            >
              {testResult.decision === 'allow' && <CheckCircle2 size={14} />}
              {testResult.decision === 'deny' && <XCircle size={14} />}
              {testResult.decision === 'ask' && <AlertTriangle size={14} />}
              <span className="font-semibold uppercase">{testResult.decision}</span>
              <span className="text-text-muted">
                — {t(`rules.decision.${testResult.decision}`)}
              </span>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
