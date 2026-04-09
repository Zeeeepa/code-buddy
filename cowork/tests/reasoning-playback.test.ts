import { describe, expect, it } from 'vitest';
import { buildReasoningPlaybackState } from '../src/renderer/utils/reasoning-playback';

interface FakeNode {
  id: string;
  ts: number;
}

describe('buildReasoningPlaybackState', () => {
  it('orders nodes by timestamp and reveals nodes through the selected playback index', () => {
    const nodes: FakeNode[] = [
      { id: 'late', ts: 300 },
      { id: 'early', ts: 100 },
      { id: 'mid', ts: 200 },
    ];

    const playback = buildReasoningPlaybackState(nodes, 1);

    expect(playback.orderedNodes.map((node) => node.id)).toEqual(['early', 'mid', 'late']);
    expect(playback.visibleNodes.map((node) => node.id)).toEqual(['early', 'mid']);
    expect(playback.activeNode?.id).toBe('mid');
    expect(playback.maxIndex).toBe(2);
    expect(playback.progress).toBe(50);
  });

  it('clamps playback index to the available node range', () => {
    const nodes: FakeNode[] = [
      { id: 'one', ts: 10 },
      { id: 'two', ts: 20 },
    ];

    const playback = buildReasoningPlaybackState(nodes, 99);

    expect(playback.clampedIndex).toBe(1);
    expect(playback.visibleNodes.map((node) => node.id)).toEqual(['one', 'two']);
    expect(playback.progress).toBe(100);
  });

  it('disables playback for empty and single-node traces', () => {
    expect(buildReasoningPlaybackState<FakeNode>([], 0)).toEqual({
      orderedNodes: [],
      visibleNodes: [],
      activeNode: null,
      clampedIndex: 0,
      maxIndex: 0,
      hasPlayback: false,
      progress: 0,
    });

    const single = buildReasoningPlaybackState([{ id: 'solo', ts: 42 }], 0);
    expect(single.hasPlayback).toBe(false);
    expect(single.progress).toBe(100);
    expect(single.visibleNodes).toHaveLength(1);
    expect(single.activeNode?.id).toBe('solo');
  });
});
