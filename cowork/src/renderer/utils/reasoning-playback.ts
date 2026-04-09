export interface ReasoningPlaybackNodeLike {
  ts: number;
}

export interface ReasoningPlaybackState<T extends ReasoningPlaybackNodeLike> {
  orderedNodes: T[];
  visibleNodes: T[];
  activeNode: T | null;
  clampedIndex: number;
  maxIndex: number;
  hasPlayback: boolean;
  progress: number;
}

export function buildReasoningPlaybackState<T extends ReasoningPlaybackNodeLike>(
  nodes: T[],
  playbackIndex: number
): ReasoningPlaybackState<T> {
  const orderedNodes = nodes
    .map((node, index) => ({ node, index }))
    .sort((a, b) => {
      if (a.node.ts === b.node.ts) {
        return a.index - b.index;
      }
      return a.node.ts - b.node.ts;
    })
    .map(({ node }) => node);

  if (orderedNodes.length === 0) {
    return {
      orderedNodes,
      visibleNodes: [],
      activeNode: null,
      clampedIndex: 0,
      maxIndex: 0,
      hasPlayback: false,
      progress: 0,
    };
  }

  const maxIndex = orderedNodes.length - 1;
  const clampedIndex = Math.max(0, Math.min(playbackIndex, maxIndex));
  const visibleNodes = orderedNodes.slice(0, clampedIndex + 1);
  const hasPlayback = orderedNodes.length > 1;

  return {
    orderedNodes,
    visibleNodes,
    activeNode: visibleNodes[visibleNodes.length - 1] ?? null,
    clampedIndex,
    maxIndex,
    hasPlayback,
    progress: hasPlayback ? (clampedIndex / maxIndex) * 100 : 100,
  };
}
