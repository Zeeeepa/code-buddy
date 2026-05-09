/**
 * SettingsCoreEngine — toggle for the agentic loop (Phase 4 of the
 * Cowork-on-core migration). Persists `coreEngineMode` in configStore.
 *
 * The takes-effect-on-restart behavior is intentional: switching mid-app
 * would orphan in-flight sessions. We surface this in the UI so users
 * aren't surprised.
 */
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, AlertCircle, RotateCcw, Cpu } from 'lucide-react';

type CoreEngineMode = 'auto' | 'force-on' | 'force-off';

const MODE_LABELS: Record<CoreEngineMode, string> = {
  auto: 'Auto (recommended)',
  'force-on': 'Always on (force engine)',
  'force-off': 'Always off (force pi fallback)',
};

const MODE_DESCRIPTIONS: Record<CoreEngineMode, string> = {
  auto:
    'Default — uses the embedded Code Buddy core engine when its bundle is available, falls back to pi-coding-agent otherwise. Honours the `CODEBUDDY_EMBEDDED=0` env var for debug overrides.',
  'force-on':
    'Always boot the core engine. Cowork will refuse to start the agentic loop if the engine bundle is missing. Recommended once the engine is stable in your daily use.',
  'force-off':
    'Always use the legacy pi-coding-agent runner. Useful only as a temporary workaround if the core engine has a bug that blocks your work.',
};

interface RunnerStatus {
  runner: 'engine' | 'pi';
  engineReady: boolean;
  bootError: string | null;
}

export function SettingsCoreEngine() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<CoreEngineMode>('auto');
  const [savedMode, setSavedMode] = useState<CoreEngineMode>('auto');
  const [status, setStatus] = useState<RunnerStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadConfig = useCallback(async () => {
    if (!window.electronAPI?.config) return;
    try {
      const cfg = await window.electronAPI.config.get();
      const persisted = (cfg as { coreEngineMode?: CoreEngineMode }).coreEngineMode ?? 'auto';
      setMode(persisted);
      setSavedMode(persisted);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const refreshStatus = useCallback(async () => {
    if (!window.electronAPI?.runner) return;
    try {
      const s = await window.electronAPI.runner.status();
      setStatus(s);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void loadConfig();
    void refreshStatus();
    const id = setInterval(refreshStatus, 5000);
    return () => clearInterval(id);
  }, [loadConfig, refreshStatus]);

  const handleSave = async () => {
    if (!window.electronAPI?.config) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const result = await window.electronAPI.config.save({
        coreEngineMode: mode,
      } as Record<string, unknown>);
      if (!result.success) {
        setError('Save failed');
        return;
      }
      setSavedMode(mode);
      setNotice(
        t(
          'settingsCoreEngine.saved',
          'Saved. Restart Cowork to apply the new runner.',
        ),
      );
      setTimeout(() => setNotice(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const isDirty = mode !== savedMode;

  return (
    <div className="p-4 space-y-4 max-w-2xl">
      <div className="flex items-center gap-2">
        <Cpu size={16} className="text-text-muted" />
        <h3 className="text-sm font-semibold">
          {t('settingsCoreEngine.title', 'Code Buddy core engine')}
        </h3>
      </div>

      <p className="text-xs text-text-muted">
        {t(
          'settingsCoreEngine.intro',
          'Cowork can run on either the embedded Code Buddy core engine (the same agentic loop the CLI uses, with all middlewares + sanitizer + transcript repair) or the legacy pi-coding-agent runner. The engine path is the default since post-2026-05.',
        )}
      </p>

      {/* Live status box */}
      {status && (
        <div className="p-3 rounded border border-border-muted bg-surface/40 flex items-start gap-2 text-xs">
          <CheckCircle2
            size={14}
            className={
              status.bootError
                ? 'text-error mt-0.5'
                : status.runner === 'engine'
                  ? 'text-success mt-0.5'
                  : 'text-warning mt-0.5'
            }
          />
          <div className="flex-1">
            <div className="font-medium text-text-primary">
              {t('settingsCoreEngine.activeLabel', 'Active runner:')}{' '}
              <span className="font-mono">{status.runner}</span>
            </div>
            {status.bootError && (
              <div className="text-error mt-1">{status.bootError}</div>
            )}
            <div className="text-text-muted mt-0.5">
              {status.runner === 'engine'
                ? t('settingsCoreEngine.engineReady', 'Engine ready, middlewares loaded.')
                : t(
                    'settingsCoreEngine.piActive',
                    'Pi fallback active. Engine bundle either missing or opted out.',
                  )}
            </div>
          </div>
        </div>
      )}

      {/* Mode radio */}
      <div className="space-y-2">
        {(['auto', 'force-on', 'force-off'] as CoreEngineMode[]).map((m) => (
          <label
            key={m}
            className={`flex items-start gap-3 p-3 rounded border cursor-pointer transition-colors ${
              mode === m
                ? 'border-accent bg-accent/5'
                : 'border-border-muted hover:bg-surface/40'
            }`}
          >
            <input
              type="radio"
              name="core-engine-mode"
              value={m}
              checked={mode === m}
              onChange={() => setMode(m)}
              className="mt-0.5"
            />
            <div className="flex-1">
              <div className="text-sm font-medium text-text-primary">
                {MODE_LABELS[m]}
              </div>
              <div className="text-[11px] text-text-muted mt-0.5 leading-relaxed">
                {MODE_DESCRIPTIONS[m]}
              </div>
            </div>
          </label>
        ))}
      </div>

      {/* Hint about restart */}
      <div className="p-2 rounded bg-warning/10 border border-warning/30 text-warning text-[11px] flex gap-2 items-start">
        <RotateCcw size={11} className="mt-0.5 shrink-0" />
        <div>
          {t(
            'settingsCoreEngine.restartHint',
            'Switching takes effect after a Cowork restart. Active sessions keep their current runner.',
          )}
        </div>
      </div>

      {error && (
        <div className="p-2 rounded bg-error/10 border border-error/30 text-error text-xs flex gap-2 items-start">
          <AlertCircle size={12} className="mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {notice && (
        <div className="p-2 rounded bg-success/10 border border-success/30 text-success text-xs">
          {notice}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!isDirty || saving}
          className="px-3 py-1.5 text-xs rounded bg-accent text-background disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent-hover transition-colors"
        >
          {saving ? t('common.saving', 'Saving…') : t('common.save', 'Save')}
        </button>
      </div>
    </div>
  );
}
