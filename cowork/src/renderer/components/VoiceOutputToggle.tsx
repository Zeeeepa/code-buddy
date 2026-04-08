/**
 * VoiceOutputToggle — Claude Cowork parity Phase 2 step 11
 *
 * Toggles text-to-speech output for assistant responses. Uses the
 * browser SpeechSynthesis API; no main-side bridge required.
 *
 * State persisted to localStorage so the preference survives reloads.
 *
 * @module renderer/components/VoiceOutputToggle
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Volume2, VolumeX } from 'lucide-react';

const STORAGE_KEY = 'cowork.voice.tts.enabled';

export function isTtsEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function speakText(text: string): void {
  if (!isTtsEnabled()) return;
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  const trimmed = text.trim();
  if (!trimmed) return;
  // Strip markdown / code fences for nicer audio.
  const clean = trimmed
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[*_~#>]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  if (!clean.trim()) return;
  try {
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('[VoiceOutputToggle] speak failed:', err);
  }
}

export const VoiceOutputToggle: React.FC = () => {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState<boolean>(false);
  const [supported, setSupported] = useState<boolean>(true);

  useEffect(() => {
    setSupported(typeof window !== 'undefined' && Boolean(window.speechSynthesis));
    setEnabled(isTtsEnabled());
  }, []);

  const handleToggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {
        /* ignore quota errors */
      }
      if (!next && typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      return next;
    });
  }, []);

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
        enabled
          ? 'bg-accent/15 text-accent'
          : 'text-text-muted hover:text-text-primary hover:bg-surface-hover'
      }`}
      title={enabled ? t('voice.ttsOn') : t('voice.ttsOff')}
    >
      {enabled ? <Volume2 size={12} /> : <VolumeX size={12} />}
      <span className="text-[10px] font-medium">
        {enabled ? t('voice.ttsLabelOn') : t('voice.ttsLabelOff')}
      </span>
    </button>
  );
};
