/**
 * SplitPaneLayout — Phase 3 step 8
 *
 * Two horizontally-arranged panes separated by a draggable
 * divider. Ratio is persisted in localStorage via the store. The
 * layout deliberately does not touch overflow semantics of its
 * children — they must be `min-w-0` and handle their own scroll.
 */
import React, { useCallback, useEffect, useRef } from 'react';
import { useAppStore } from '../store';

interface SplitPaneLayoutProps {
  left: React.ReactNode;
  right: React.ReactNode;
  minLeftPct?: number;
  minRightPct?: number;
}

export function SplitPaneLayout({
  left,
  right,
  minLeftPct = 0.2,
  minRightPct = 0.2,
}: SplitPaneLayoutProps) {
  const ratio = useAppStore((s) => s.splitPaneRatio);
  const setRatio = useAppStore((s) => s.setSplitPaneRatio);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const handleMouseDown = useCallback((ev: React.MouseEvent) => {
    ev.preventDefault();
    draggingRef.current = true;
  }, []);

  useEffect(() => {
    const onMove = (ev: MouseEvent) => {
      if (!draggingRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const raw = (ev.clientX - rect.left) / rect.width;
      const clamped = Math.max(minLeftPct, Math.min(1 - minRightPct, raw));
      setRatio(clamped);
    };
    const onUp = () => {
      draggingRef.current = false;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [minLeftPct, minRightPct, setRatio]);

  return (
    <div ref={containerRef} className="flex-1 min-h-0 flex overflow-hidden">
      <div
        className="min-w-0 flex flex-col overflow-hidden"
        style={{ width: `${ratio * 100}%` }}
      >
        {left}
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        onMouseDown={handleMouseDown}
        className="w-1 cursor-col-resize bg-border hover:bg-accent/50 transition-colors shrink-0"
      />
      <div
        className="min-w-0 flex flex-col overflow-hidden"
        style={{ width: `${(1 - ratio) * 100}%` }}
      >
        {right}
      </div>
    </div>
  );
}
