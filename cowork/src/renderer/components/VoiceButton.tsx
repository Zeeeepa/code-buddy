/**
 * VoiceButton — Claude Cowork parity Phase 2 step 11
 *
 * Microphone button for the ChatView footer. Uses the Web Speech API
 * (SpeechRecognition) to transcribe speech and pipe the result back to
 * the chat input via a callback. Click-toggle activation; while listening
 * it shows a small waveform visualizer powered by the Web Audio API.
 *
 * Falls back gracefully if SpeechRecognition is unavailable.
 *
 * @module renderer/components/VoiceButton
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Mic, MicOff } from 'lucide-react';

interface SpeechRecognitionEventLike {
  results: {
    length: number;
    [index: number]: {
      length: number;
      isFinal: boolean;
      [index: number]: { transcript: string };
    };
  };
  resultIndex: number;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

interface VoiceButtonProps {
  onTranscript: (text: string) => void;
  language?: string;
}

export const VoiceButton: React.FC<VoiceButtonProps> = ({
  onTranscript,
  language = 'en-US',
}) => {
  const { t } = useTranslation();
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState<boolean>(true);
  const [waveform, setWaveform] = useState<number[]>([]);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    const ctor = getSpeechRecognition();
    setSupported(Boolean(ctor));
  }, []);

  const stopAudio = useCallback(() => {
    if (animRef.current !== null) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    setWaveform([]);
  }, []);

  const startAudio = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const AudioCtx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      const buffer = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(buffer);
        const bins: number[] = [];
        const step = Math.floor(buffer.length / 16);
        for (let i = 0; i < 16; i++) {
          bins.push(buffer[i * step] / 255);
        }
        setWaveform(bins);
        animRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (err) {
      console.warn('[VoiceButton] microphone access denied:', err);
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        /* already stopped */
      }
      recognitionRef.current = null;
    }
    stopAudio();
    setListening(false);
  }, [stopAudio]);

  const startListening = useCallback(() => {
    const ctor = getSpeechRecognition();
    if (!ctor) {
      setSupported(false);
      return;
    }
    const recognition = new ctor();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = language;
    let finalText = '';

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result) continue;
        const transcript = result[0]?.transcript ?? '';
        if (result.isFinal) {
          finalText += transcript;
        } else {
          interim += transcript;
        }
      }
      if (finalText || interim) {
        onTranscript((finalText + interim).trim());
      }
    };
    recognition.onerror = (event) => {
      console.warn('[VoiceButton] recognition error:', event.error);
      stopListening();
    };
    recognition.onend = () => {
      stopListening();
    };
    recognitionRef.current = recognition;

    try {
      recognition.start();
      setListening(true);
      void startAudio();
    } catch (err) {
      console.warn('[VoiceButton] failed to start recognition:', err);
      stopListening();
    }
  }, [language, onTranscript, startAudio, stopListening]);

  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  const handleToggle = () => {
    if (listening) {
      stopListening();
    } else {
      startListening();
    }
  };

  if (!supported) {
    return (
      <button
        type="button"
        disabled
        className="p-2 rounded-md text-text-muted opacity-40 cursor-not-allowed"
        title={t('voice.unsupported')}
      >
        <MicOff size={14} />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleToggle}
        className={`p-2 rounded-md transition-colors ${
          listening
            ? 'bg-error/20 text-error animate-pulse'
            : 'text-text-muted hover:text-text-primary hover:bg-surface-hover'
        }`}
        title={listening ? t('voice.stop') : t('voice.start')}
      >
        {listening ? <MicOff size={14} /> : <Mic size={14} />}
      </button>
      {listening && waveform.length > 0 && (
        <svg
          width={48}
          height={16}
          viewBox="0 0 48 16"
          className="text-accent"
          aria-hidden="true"
        >
          {waveform.map((value, idx) => {
            const h = Math.max(2, value * 16);
            const x = idx * 3;
            const y = (16 - h) / 2;
            return (
              <rect
                key={idx}
                x={x}
                y={y}
                width={2}
                height={h}
                fill="currentColor"
                rx={1}
              />
            );
          })}
        </svg>
      )}
    </div>
  );
};
