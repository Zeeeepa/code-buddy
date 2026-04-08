/**
 * ComputerUseOverlay — Claude Cowork parity Phase 2 step 13
 *
 * Floating rectractable panel that shows the latest gui_operate actions
 * (Computer Use) executed by the agent. Displays the screenshot, click
 * marker, and step-by-step playback of the action sequence.
 *
 * Auto-opens when a new `gui.action` event arrives; can be minimized
 * via the store `setShowComputerUseOverlay(false)`.
 *
 * @module renderer/components/ComputerUseOverlay
 */

import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Monitor,
  X,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Minimize2,
  Maximize2,
} from 'lucide-react';
import { useAppStore } from '../store';

export const ComputerUseOverlay: React.FC = () => {
  const { t } = useTranslation();
  const guiActions = useAppStore((s) => s.guiActions);
  const show = useAppStore((s) => s.showComputerUseOverlay);
  const setShow = useAppStore((s) => s.setShowComputerUseOverlay);
  const activeSessionId = useAppStore((s) => s.activeSessionId);

  const [stepIndex, setStepIndex] = useState<number>(-1);
  const [playing, setPlaying] = useState(false);
  const [minimized, setMinimized] = useState(false);

  // Filter to the active session
  const sessionActions = useMemo(() => {
    if (!activeSessionId) return guiActions;
    return guiActions.filter((a) => a.sessionId === activeSessionId);
  }, [guiActions, activeSessionId]);

  // When new actions come in, auto-jump to the latest one.
  React.useEffect(() => {
    if (sessionActions.length > 0) {
      setStepIndex(sessionActions.length - 1);
    } else {
      setStepIndex(-1);
    }
  }, [sessionActions.length]);

  // Playback
  React.useEffect(() => {
    if (!playing) return;
    if (stepIndex >= sessionActions.length - 1) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => {
      setStepIndex((idx) => Math.min(idx + 1, sessionActions.length - 1));
    }, 1200);
    return () => clearTimeout(timer);
  }, [playing, stepIndex, sessionActions.length]);

  if (!show || sessionActions.length === 0) return null;

  const current = sessionActions[stepIndex] ?? sessionActions[sessionActions.length - 1];
  const screenshotSrc = current?.screenshot?.startsWith('data:')
    ? current.screenshot
    : current?.screenshot
      ? `file://${current.screenshot.replace(/\\/g, '/')}`
      : undefined;

  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        className="fixed bottom-4 right-4 z-40 flex items-center gap-2 px-3 py-2 bg-background border border-border rounded-lg shadow-elevated hover:bg-surface-hover transition-colors"
        title={t('computerUse.expand')}
      >
        <Monitor size={14} className="text-accent" />
        <span className="text-xs text-text-primary">
          {t('computerUse.minimized', { count: sessionActions.length })}
        </span>
        <Maximize2 size={12} className="text-text-muted" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 w-[420px] max-w-[90vw] bg-background border border-border rounded-xl shadow-elevated flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-muted shrink-0">
        <div className="flex items-center gap-2">
          <Monitor size={14} className="text-accent" />
          <span className="text-xs font-semibold text-text-primary">
            {t('computerUse.title')}
          </span>
          <span className="text-[10px] text-text-muted">
            {t('computerUse.stepOf', {
              current: stepIndex + 1,
              total: sessionActions.length,
            })}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMinimized(true)}
            className="p-1 text-text-muted hover:text-text-primary transition-colors"
            title={t('computerUse.minimize')}
          >
            <Minimize2 size={12} />
          </button>
          <button
            onClick={() => setShow(false)}
            className="p-1 text-text-muted hover:text-text-primary transition-colors"
            title={t('common.close')}
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Screenshot + click marker */}
      <div className="relative bg-surface/50 border-b border-border-muted min-h-[180px] max-h-[300px] overflow-auto flex items-center justify-center">
        {screenshotSrc ? (
          <div className="relative inline-block">
            <img
              src={screenshotSrc}
              alt="gui-screenshot"
              className="max-w-full max-h-[300px] block"
            />
            {current?.click && (
              <div
                className="absolute pointer-events-none"
                style={{
                  left: `${current.click.x}px`,
                  top: `${current.click.y}px`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <div className="w-6 h-6 rounded-full border-2 border-error bg-error/20 animate-ping" />
                <div className="absolute inset-0 w-6 h-6 rounded-full border-2 border-error" />
              </div>
            )}
          </div>
        ) : (
          <div className="text-xs text-text-muted py-8">
            {t('computerUse.noScreenshot')}
          </div>
        )}
      </div>

      {/* Action metadata */}
      <div className="px-3 py-2 bg-surface/30 border-b border-border-muted">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wide font-semibold text-accent">
            {current?.action ?? '—'}
          </span>
          <span className="text-[10px] text-text-muted truncate">
            {current?.toolName}
          </span>
        </div>
        {current?.click && (
          <div className="text-[10px] text-text-muted mt-0.5">
            {t('computerUse.clickAt', { x: current.click.x, y: current.click.y })}
          </div>
        )}
      </div>

      {/* Playback controls */}
      <div className="flex items-center justify-between px-3 py-2 shrink-0">
        <button
          onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
          disabled={stepIndex <= 0}
          className="p-1.5 text-text-muted hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title={t('computerUse.previous')}
        >
          <ChevronLeft size={14} />
        </button>
        <button
          onClick={() => setPlaying(!playing)}
          className="flex items-center gap-1 px-3 py-1 text-xs bg-accent hover:bg-accent-hover text-white rounded-md transition-colors"
          title={playing ? t('computerUse.pause') : t('computerUse.play')}
        >
          {playing ? <Pause size={11} /> : <Play size={11} />}
          {playing ? t('computerUse.pause') : t('computerUse.play')}
        </button>
        <button
          onClick={() =>
            setStepIndex((i) => Math.min(sessionActions.length - 1, i + 1))
          }
          disabled={stepIndex >= sessionActions.length - 1}
          className="p-1.5 text-text-muted hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title={t('computerUse.next')}
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
};
