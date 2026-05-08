/**
 * list_peers tool — Phase (d).17.
 *
 * Read-only projection of FleetRegistry state. No extra RPCs are made:
 * the LLM gets a snapshot of what's already known locally, which is
 * enough to pick a peer for `peer_delegate`.
 *
 * For richer per-peer metadata (provider, model, role…), `/fleet send
 * <peer> peer.describe` remains the power-user path — we don't
 * round-trip every peer on every list_peers call.
 *
 * @module src/tools/list-peers-tool
 */

import { getFleetRegistry } from '../fleet/fleet-registry.js';
import type { ToolResult } from '../types/index.js';

export interface ListedPeer {
  id: string;
  url: string;
  connectedSince: string;
  eventCount: number;
  lastSeenAgeMs: number | null;
  lastSeenReason: string | null;
  compacting: boolean;
  stale: boolean;
  /** Conservative hint — peer has been seen recently and isn't compacting. */
  peerChatLikelyAvailable: boolean;
}

export async function executeListPeers(): Promise<ToolResult> {
  const reg = getFleetRegistry();
  const entries = reg.list();

  if (entries.length === 0) {
    return {
      success: true,
      output:
        'No fleet peers connected. The user must run /fleet listen <ws-url> --name <id> first to add a peer.',
      data: { peers: [] as ListedPeer[] },
    };
  }

  const peers: ListedPeer[] = entries.map((entry) => {
    const seen = entry.listener.getLastSeen();
    const compaction = entry.listener.getPeerCompactionState();
    return {
      id: entry.id,
      url: entry.url,
      connectedSince: entry.startedAt.toISOString(),
      eventCount: entry.eventCount,
      lastSeenAgeMs: seen.ageMs,
      lastSeenReason: seen.reason,
      compacting: compaction.active,
      stale: entry.listener.isStale(),
      peerChatLikelyAvailable: seen.ageMs !== null && !compaction.active,
    };
  });

  return {
    success: true,
    output: JSON.stringify(peers, null, 2),
    data: { peers },
  };
}
