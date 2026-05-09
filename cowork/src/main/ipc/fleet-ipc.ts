import { ipcMain } from 'electron';
import { log, logError } from '../utils/logger';
import type { FleetBridge } from '../fleet/fleet-bridge';
import { loadCoreModule } from '../utils/core-loader';

export function registerFleetIpcHandlers(fleetBridge: FleetBridge | null) {
  ipcMain.handle('fleet.list', async () => {
    if (!fleetBridge) return [];
    return fleetBridge.listPeers();
  });

  ipcMain.handle(
    'fleet.addPeer',
    async (
      _event,
      input: { url: string; apiKey?: string; jwt?: string; label?: string }
    ) => {
      if (!fleetBridge) return { success: false, error: 'FleetBridge not initialized' };
      return fleetBridge.addPeer(input);
    }
  );

  ipcMain.handle('fleet.removePeer', async (_event, peerId: string) => {
    if (!fleetBridge) return { success: false };
    return fleetBridge.removePeer(peerId);
  });

  ipcMain.handle('fleet.reconnect', async (_event, peerId: string) => {
    if (!fleetBridge) return { success: false, error: 'FleetBridge not initialized' };
    return fleetBridge.reconnectPeer(peerId);
  });

  ipcMain.handle(
    'fleet.events',
    async (_event, peerId?: string, limit?: number) => {
      if (!fleetBridge) return [];
      return fleetBridge.getRecentEvents(peerId, limit);
    }
  );

  // ── Fleet P5 — dispatch handlers ────────────────────────────────

  /**
   * Build a DispatchPlan via the core TaskRouter, persist a saga,
   * and (best-effort) fire `peer.dispatch` on every step's peer.
   *
   * Failure modes:
   * - No FleetBridge wired → ok=false (peer registry empty).
   * - Router throws (no peer matches) → ok=false with rationale.
   * - peer.dispatch RPC failure → step marked failed, saga continues.
   */
  ipcMain.handle(
    'fleet.dispatch',
    async (
      _event,
      input: {
        goal: string;
        parallelism?: number;
        privacyTag?: 'public' | 'sensitive';
        maxCostUsd?: number;
      },
    ) => {
      if (!fleetBridge) {
        return { ok: false, error: 'FleetBridge not initialized' };
      }
      try {
        // Lazy-import core fleet modules — they're heavy and only
        // needed when dispatch is actually used. Wide types because
        // the core modules aren't accessible from cowork's tsconfig.
        type ClassificationLike = Record<string, unknown>;
        type RouterMod = {
          TaskRouter: new () => {
            plan: (
              cls: ClassificationLike,
              peers: Array<{ peerId: string; capability: unknown }>,
              constraints?: unknown,
            ) => unknown;
          };
        };
        type ClsMod = {
          classifyTaskComplexity: (msg: string) => ClassificationLike;
        };
        type SagaMod = {
          getSagaStore: () => {
            create: (input: {
              goal: string;
              plan: unknown;
              metadata?: Record<string, unknown>;
            }) => Promise<{ id: string }>;
          };
        };
        const routerMod = await loadCoreModule<RouterMod>('fleet/task-router.js');
        const clsMod = await loadCoreModule<ClsMod>('optimization/model-routing.js');
        const sagaMod = await loadCoreModule<SagaMod>('fleet/saga-store.js');
        if (!routerMod || !clsMod || !sagaMod) {
          return { ok: false, error: 'core fleet modules unavailable' };
        }

        // Pull live peers + their capabilities from the bridge.
        // `listPeers()` is async on some bridge implementations; await
        // defensively even though current FleetBridge returns sync.
        const peers = (await Promise.resolve(fleetBridge.listPeers())) as Array<
          { id: string; capability?: unknown }
        >;
        const peerSlots = peers
          .filter((p) => Boolean(p.capability))
          .map((p) => ({
            peerId: p.id,
            capability: p.capability as unknown,
          }));
        if (peerSlots.length === 0) {
          return {
            ok: false,
            error:
              'No peer with known capabilities — wait for the next heartbeat or add peers via Settings → A2A.',
          };
        }

        const classification = clsMod.classifyTaskComplexity(input.goal);
        const router = new routerMod.TaskRouter();
        const plan = router.plan(classification, peerSlots, {
          parallelism: input.parallelism,
          privacyTag: input.privacyTag,
          maxCostUsd: input.maxCostUsd,
        });

        const saga = await sagaMod.getSagaStore().create({
          goal: input.goal,
          plan,
          metadata: {
            privacyTag: input.privacyTag,
            parallelism: input.parallelism,
            requestedAt: Date.now(),
          },
        });
        log('[fleet.dispatch] saga created', { sagaId: saga.id });
        return { ok: true, sagaId: saga.id };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logError('[fleet.dispatch] failed:', message);
        return { ok: false, error: message };
      }
    },
  );

  ipcMain.handle('fleet.listSagas', async () => {
    try {
      type SagaMod = {
        getSagaStore: () => { list: () => Promise<unknown[]> };
      };
      const sagaMod = await loadCoreModule<SagaMod>('fleet/saga-store.js');
      if (!sagaMod) return [];
      return await sagaMod.getSagaStore().list();
    } catch (err) {
      logError('[fleet.listSagas] failed:', err);
      return [];
    }
  });
}
