/**
 * CheckpointPanel — Timeline of snapshots with undo/redo
 */
import React from 'react';
import { Undo2, Redo2, Clock, RotateCcw } from 'lucide-react';
import type { CheckpointTimeline } from '../types';

interface CheckpointPanelProps {
  timeline: CheckpointTimeline | null;
  onUndo: () => void;
  onRedo: () => void;
  onRestore: (snapshotId: string) => void;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export const CheckpointPanel: React.FC<CheckpointPanelProps> = ({
  timeline,
  onUndo,
  onRedo,
  onRestore,
}) => {
  if (!timeline || timeline.snapshots.length === 0) {
    return (
      <div className="text-xs text-zinc-500 px-3 py-2">
        No checkpoints yet. Changes will be tracked automatically.
      </div>
    );
  }

  return (
    <div>
      {/* Undo/Redo buttons */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800">
        <button
          onClick={onUndo}
          disabled={!timeline.canUndo}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-zinc-300"
          title="Undo last change"
        >
          <Undo2 size={12} />
          Undo
        </button>
        <button
          onClick={onRedo}
          disabled={!timeline.canRedo}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-zinc-300"
          title="Redo"
        >
          <Redo2 size={12} />
          Redo
        </button>
        <span className="text-xs text-zinc-500 ml-auto">
          {timeline.snapshots.length} checkpoint{timeline.snapshots.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Timeline */}
      <div className="max-h-48 overflow-y-auto">
        {timeline.snapshots.map((snapshot, index) => (
          <button
            key={snapshot.id}
            onClick={() => onRestore(snapshot.id)}
            className={`w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-zinc-800 transition-colors ${
              index === timeline.currentIndex ? 'bg-zinc-800/50 border-l-2 border-blue-500' : ''
            }`}
            title={`Restore to: ${snapshot.description}`}
          >
            <div className="mt-0.5 flex-shrink-0">
              {index === timeline.currentIndex ? (
                <Clock size={12} className="text-blue-400" />
              ) : (
                <RotateCcw size={12} className="text-zinc-500" />
              )}
            </div>
            <div className="min-w-0">
              <div className="text-xs text-zinc-300 truncate">{snapshot.description}</div>
              <div className="text-xs text-zinc-500">
                Turn {snapshot.turn} &middot; {formatTime(snapshot.timestamp)}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
