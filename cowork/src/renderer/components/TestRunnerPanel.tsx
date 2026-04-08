/**
 * TestRunnerPanel — Claude Cowork parity Phase 3 step 12
 *
 * Slide-out panel that detects the project test framework, runs the
 * suite, streams stdout/stderr output live, and renders pass/fail
 * counts once a run completes. Drives the `test.*` IPC namespace
 * exposed by `TestRunnerBridge`.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  Play,
  RotateCcw,
  Square,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Loader2,
} from 'lucide-react';

interface TestCase {
  name: string;
  suite: string;
  file?: string;
  status: 'passed' | 'failed' | 'skipped' | 'pending';
  duration: number;
  error?: string;
  stack?: string;
}

interface TestResult {
  success: boolean;
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  duration: number;
  framework: string;
  tests: TestCase[];
}

interface TestRunnerPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TestRunnerPanel({ isOpen, onClose }: TestRunnerPanelProps) {
  const { t } = useTranslation();
  const [framework, setFramework] = useState<string | null>(null);
  const [result, setResult] = useState<TestResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const outputRef = useRef<HTMLPreElement>(null);

  const refreshState = useCallback(async () => {
    if (!window.electronAPI?.test?.getState) return;
    try {
      const state = await window.electronAPI.test.getState();
      if (state) {
        setFramework(state.framework);
        setResult((state.lastResult as TestResult) ?? null);
        setIsRunning(state.isRunning);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      void refreshState();
      if (!framework && window.electronAPI?.test?.detect) {
        void window.electronAPI.test.detect().then((f) => {
          if (f) setFramework(f);
        });
      }
    }
  }, [isOpen, refreshState, framework]);

  // Listen for streaming test events
  useEffect(() => {
    const api = window.electronAPI as unknown as {
      onEvent?: (cb: (event: { type: string; payload?: unknown }) => void) => () => void;
    };
    if (!api?.onEvent) return;
    const unsubscribe = api.onEvent((event) => {
      switch (event.type) {
        case 'test.framework':
          setFramework((event.payload as { framework: string }).framework);
          break;
        case 'test.start':
          setIsRunning(true);
          setOutput('');
          setResult(null);
          setError(null);
          break;
        case 'test.output': {
          const payload = event.payload as { stream: string; text: string };
          setOutput((prev) => prev + payload.text);
          break;
        }
        case 'test.complete':
          setIsRunning(false);
          setResult(event.payload as TestResult);
          break;
        case 'test.cancelled':
          setIsRunning(false);
          setError(t('testRunner.cancelled', 'Test run cancelled'));
          break;
      }
    });
    return unsubscribe;
  }, [t]);

  // Auto-scroll output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  const handleRun = useCallback(async () => {
    if (!window.electronAPI?.test?.run) return;
    setError(null);
    setIsRunning(true);
    try {
      const r = await window.electronAPI.test.run();
      if (r) setResult(r as TestResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRunning(false);
    }
  }, []);

  const handleRunFailing = useCallback(async () => {
    if (!window.electronAPI?.test?.runFailing) return;
    setError(null);
    setIsRunning(true);
    try {
      const r = await window.electronAPI.test.runFailing();
      if (r) setResult(r as TestResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRunning(false);
    }
  }, []);

  const handleCancel = useCallback(async () => {
    if (!window.electronAPI?.test?.cancel) return;
    await window.electronAPI.test.cancel();
    setIsRunning(false);
  }, []);

  if (!isOpen) return null;

  const hasFailing = result ? result.failed > 0 : false;

  return (
    <div className="fixed right-0 top-0 h-full w-[500px] max-w-[90vw] bg-background border-l border-border shadow-2xl z-40 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-muted">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">
            {t('testRunner.title', 'Test runner')}
          </h2>
          <p className="text-[11px] text-text-muted mt-0.5">
            {framework
              ? t('testRunner.framework', { framework })
              : t('testRunner.noFramework', 'No framework detected')}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-surface-hover text-text-muted hover:text-text-primary"
          aria-label={t('common.close', 'Close')}
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex items-center gap-2 px-4 py-3 border-b border-border-muted">
        {isRunning ? (
          <button
            onClick={() => void handleCancel()}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-error text-white hover:bg-error/90 transition-colors"
          >
            <Square size={12} />
            {t('testRunner.cancel', 'Cancel')}
          </button>
        ) : (
          <>
            <button
              onClick={() => void handleRun()}
              disabled={!framework}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-accent text-white hover:bg-accent-hover disabled:opacity-50 transition-colors"
            >
              <Play size={12} />
              {t('testRunner.runAll', 'Run all')}
            </button>
            <button
              onClick={() => void handleRunFailing()}
              disabled={!framework || !hasFailing}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-warning text-white hover:bg-warning/90 disabled:opacity-50 transition-colors"
            >
              <RotateCcw size={12} />
              {t('testRunner.runFailing', 'Re-run failing')}
            </button>
          </>
        )}
      </div>

      {error && (
        <div className="px-4 py-2 text-xs text-error bg-error/10 border-b border-error/30">
          {error}
        </div>
      )}

      {result && (
        <div className="px-4 py-3 border-b border-border-muted">
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-success">
              <CheckCircle2 size={12} /> {result.passed}
            </span>
            <span className="flex items-center gap-1 text-error">
              <XCircle size={12} /> {result.failed}
            </span>
            <span className="flex items-center gap-1 text-text-muted">
              <MinusCircle size={12} /> {result.skipped}
            </span>
            <span className="ml-auto text-text-muted tabular-nums">
              {(result.duration / 1000).toFixed(2)}s
            </span>
          </div>
          <div className="mt-1 h-1 bg-surface rounded-full overflow-hidden">
            {result.total > 0 && (
              <div className="flex h-full">
                <div
                  className="bg-success"
                  style={{ width: `${(result.passed / result.total) * 100}%` }}
                />
                <div
                  className="bg-error"
                  style={{ width: `${(result.failed / result.total) * 100}%` }}
                />
                <div
                  className="bg-text-muted"
                  style={{ width: `${(result.skipped / result.total) * 100}%` }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="px-4 py-1 text-[11px] uppercase tracking-wide text-text-muted border-b border-border-muted">
          {t('testRunner.output', 'Output')}
        </div>
        <pre
          ref={outputRef}
          className="flex-1 overflow-y-auto px-4 py-3 text-[11px] font-mono text-text-secondary whitespace-pre-wrap leading-relaxed"
        >
          {output || t('testRunner.noOutput', 'No output yet. Click Run all to start.')}
          {isRunning && (
            <span className="inline-flex items-center gap-1 text-accent mt-2">
              <Loader2 size={10} className="animate-spin" />
              {t('testRunner.running', 'Running…')}
            </span>
          )}
        </pre>
      </div>

      {result && result.tests.length > 0 && (
        <div className="border-t border-border-muted max-h-60 overflow-y-auto">
          {result.tests.map((tc, idx) => (
            <div
              key={`${tc.suite}-${tc.name}-${idx}`}
              className="px-4 py-2 border-b border-border-muted text-xs"
            >
              <div className="flex items-start gap-2">
                {tc.status === 'passed' && (
                  <CheckCircle2 size={12} className="text-success mt-0.5 shrink-0" />
                )}
                {tc.status === 'failed' && (
                  <XCircle size={12} className="text-error mt-0.5 shrink-0" />
                )}
                {tc.status === 'skipped' && (
                  <MinusCircle size={12} className="text-text-muted mt-0.5 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-text-primary truncate">{tc.name}</div>
                  {tc.suite && (
                    <div className="text-[10px] text-text-muted truncate">{tc.suite}</div>
                  )}
                  {tc.error && (
                    <pre className="text-[10px] text-error font-mono mt-1 whitespace-pre-wrap">
                      {tc.error}
                    </pre>
                  )}
                </div>
                <span className="text-[10px] text-text-muted tabular-nums">
                  {tc.duration}ms
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
