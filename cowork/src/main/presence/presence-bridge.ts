/**
 * Presence Bridge — Electron IPC + internal event bus.
 *
 * The renderer captures camera frames (it has the DOM/MediaDevices API),
 * runs detection in-browser (MediaPipe BlazeFace via web), and asks the
 * main process to encode the cropped face and match it against the store.
 * Why split this way:
 *   - WebGL acceleration for detection lives in the renderer (browser).
 *   - ONNX Runtime + identity store live in the main process (Node, fs access).
 *   - The split keeps the model files + JSON store off the renderer's
 *     sandboxed filesystem and centralises the agent-facing event bus.
 *
 * IPC channels (renderer → main):
 *   - `presence:enroll`   { name, aliases, embedding }  → PersonIdentity
 *   - `presence:add-sample` { personId, embedding }     → PersonIdentity
 *   - `presence:match`    { embedding, threshold? }     → PresenceMatch | null
 *   - `presence:list`     {}                            → PersonIdentity[]
 *   - `presence:remove`   { personId }                  → boolean
 *
 * Event bus (main → Code Buddy core consumer):
 *   - `presence:detected` { match, timestamp }   — periodic, throttled
 *   - `presence:left`     { previousMatch, timestamp }
 *   - `presence:enrolled` { person, timestamp }
 *
 * Consumers in Code Buddy core register via `getPresenceBridge().on(...)`.
 *
 * @module cowork/main/presence/presence-bridge
 */

import { EventEmitter } from 'events';
import { ipcMain } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { log, logError } from '../utils/logger';
import { getPresenceStore } from './presence-store';
import { getFaceRecognizer } from './face-recognizer';
import type {
  PersonIdentity,
  PresenceEvent,
  PresenceMatch,
} from '../../shared/presence/types';

/**
 * Stable cross-process location where the *current* presence state is
 * mirrored. Code Buddy core agent reads from here in its
 * `before_agent_execute` hook so it can adapt the system prompt to who
 * is in front of the camera. Path is OS-portable and Electron-independent
 * so the core lib stays free of Electron deps.
 */
const CURRENT_PRESENCE_FILE = path.join(
  os.homedir(),
  '.codebuddy',
  'presence',
  'current.json',
);

/** Format of the current-presence.json file. */
interface CurrentPresenceFile {
  /** ISO-ish timestamp of last write. */
  updatedAt: number;
  /** What's happening right now. `null` when nobody is detected. */
  match: PresenceMatch | null;
  /** Last event type — useful to know if we're in 'detected' or 'left' phase. */
  lastEventType: PresenceEvent['type'] | null;
}

/**
 * IPC payloads — kept narrow to make the renderer↔main contract obvious.
 * `embedding` traverses IPC as a regular `number[]` (Float32Array isn't
 * structured-clone-friendly across the IPC boundary in all Electron
 * versions).
 */
export interface EnrollPayload {
  name: string;
  aliases?: string[];
  embedding: number[];
  snapshotPath?: string;
}
export interface AddSamplePayload {
  personId: string;
  embedding: number[];
  snapshotPath?: string;
}
export interface MatchPayload {
  embedding: number[];
  threshold?: number;
}

/**
 * Renderer ships the cropped, resized 112×112 RGB face bytes; main runs
 * Buffalo_S to encode them. The byte length must be exactly
 * `112 * 112 * 3 = 37632`. Sent over IPC as a regular number[] so the
 * structured clone protocol doesn't choke.
 */
export interface EncodePayload {
  rgbBytes: number[];
}

/**
 * Throttle period between two `presence:detected` events for the *same*
 * person. Without this the bus would fire ~fps Hz forever — the agent loop
 * doesn't need that, just needs to know "Patrice is here" once per session
 * (and again when he comes back).
 */
const PRESENCE_DEDUP_WINDOW_MS = 30_000;

/**
 * After this much idle time without any detection, we emit `presence:left`.
 * Tuned so a brief turn of the head doesn't trigger a fake departure.
 */
const PRESENCE_TIMEOUT_MS = 15_000;

export class PresenceBridge extends EventEmitter {
  private lastEmittedDetection: Map<string, number> = new Map();
  private lastSeenMatch: PresenceMatch | null = null;
  private lastSeenAt = 0;
  private timeoutTimer: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.registerIpcHandlers();
  }

  private registerIpcHandlers(): void {
    ipcMain.handle('presence:enroll', async (_event, payload: EnrollPayload): Promise<PersonIdentity> => {
      const store = getPresenceStore();
      const embedding = Float32Array.from(payload.embedding);
      const person = await store.addPerson(
        payload.name,
        payload.aliases ?? [],
        embedding,
        payload.snapshotPath,
      );
      this.emitEvent({ type: 'enrolled', timestamp: Date.now() });
      log(`[PresenceBridge] Enrolled ${person.name} (id=${person.id})`);
      return person;
    });

    ipcMain.handle('presence:add-sample', async (_event, payload: AddSamplePayload): Promise<PersonIdentity> => {
      const store = getPresenceStore();
      const embedding = Float32Array.from(payload.embedding);
      return store.addFaceSample(payload.personId, embedding, payload.snapshotPath);
    });

    ipcMain.handle('presence:encode', async (_event, payload: EncodePayload): Promise<number[]> => {
      const recognizer = getFaceRecognizer();
      if (!recognizer.isReady()) {
        await recognizer.initialize();
      }
      const rgbBytes = Uint8Array.from(payload.rgbBytes);
      const embedding = await recognizer.encode(rgbBytes);
      return Array.from(embedding);
    });

    ipcMain.handle('presence:match', async (_event, payload: MatchPayload): Promise<PresenceMatch | null> => {
      const store = getPresenceStore();
      const embedding = Float32Array.from(payload.embedding);
      const match = await store.match(embedding, payload.threshold);
      if (match) {
        this.recordDetection(match);
      } else {
        // Detection happened but no match — forward as "unknown" so the UI
        // can decide to suggest enrollment. We don't dedup unknowns because
        // each one might be a different stranger.
        this.emitEvent({ type: 'unknown', timestamp: Date.now() });
      }
      return match;
    });

    ipcMain.handle('presence:list', async (): Promise<PersonIdentity[]> => {
      return getPresenceStore().listPersons();
    });

    ipcMain.handle('presence:remove', async (_event, payload: { personId: string }): Promise<boolean> => {
      return getPresenceStore().removePerson(payload.personId);
    });
  }

  /**
   * Process a fresh match. Emits `presence:detected` if it's been more
   * than PRESENCE_DEDUP_WINDOW_MS since we last emitted for the same
   * person, and (re-)arms the absence timer.
   */
  private recordDetection(match: PresenceMatch): void {
    const now = Date.now();
    const lastEmit = this.lastEmittedDetection.get(match.personId) ?? 0;

    this.lastSeenMatch = match;
    this.lastSeenAt = now;

    if (now - lastEmit >= PRESENCE_DEDUP_WINDOW_MS) {
      this.lastEmittedDetection.set(match.personId, now);
      this.emitEvent({ type: 'detected', match, timestamp: now });
    }
    this.armAbsenceTimer();
  }

  /** Reset/start the absence timer. Fires `presence:left` if no detection comes back in time. */
  private armAbsenceTimer(): void {
    if (this.timeoutTimer !== null) clearTimeout(this.timeoutTimer);
    this.timeoutTimer = setTimeout(() => {
      if (this.lastSeenMatch !== null) {
        this.emitEvent({
          type: 'left',
          match: this.lastSeenMatch,
          timestamp: Date.now(),
        });
        // Clear the dedup so the next detection emits a fresh `detected`.
        this.lastEmittedDetection.delete(this.lastSeenMatch.personId);
        this.lastSeenMatch = null;
      }
      this.timeoutTimer = null;
    }, PRESENCE_TIMEOUT_MS);
  }

  private emitEvent(event: PresenceEvent): void {
    try {
      this.emit('presence', event);
    } catch (err) {
      logError(`[PresenceBridge] event listener threw: ${(err as Error).message}`);
    }
    // Mirror to disk for the Code Buddy core agent (different process).
    // Fire-and-forget — we don't want to block the hot path on I/O errors.
    void this.writeCurrentPresence(event).catch((err) => {
      logError(`[PresenceBridge] writeCurrentPresence: ${(err as Error).message}`);
    });
  }

  /**
   * Atomically write the current presence state to a stable on-disk
   * location so the Code Buddy core agent (a different process) can read
   * it before each agent turn. Atomic via tmp+rename so the agent never
   * sees a partial JSON.
   */
  private async writeCurrentPresence(event: PresenceEvent): Promise<void> {
    const payload: CurrentPresenceFile = {
      updatedAt: Date.now(),
      match:
        event.type === 'detected'
          ? event.match ?? null
          : event.type === 'left'
            ? null
            : this.lastSeenMatch,
      lastEventType: event.type,
    };
    const json = JSON.stringify(payload, null, 2);
    const tmp = `${CURRENT_PRESENCE_FILE}.tmp`;
    await fs.mkdir(path.dirname(CURRENT_PRESENCE_FILE), { recursive: true });
    await fs.writeFile(tmp, json, 'utf-8');
    await fs.rename(tmp, CURRENT_PRESENCE_FILE);
  }

  /** Snapshot of the most recent match — useful for the agent's first system prompt at session start. */
  getLastSeen(): { match: PresenceMatch | null; sinceMs: number } {
    return {
      match: this.lastSeenMatch,
      sinceMs: this.lastSeenAt > 0 ? Date.now() - this.lastSeenAt : Infinity,
    };
  }

  /** Tear down — clear timers, drop listeners. Called on Electron shutdown. */
  dispose(): void {
    if (this.timeoutTimer !== null) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
    this.removeAllListeners();
    ipcMain.removeHandler('presence:enroll');
    ipcMain.removeHandler('presence:add-sample');
    ipcMain.removeHandler('presence:encode');
    ipcMain.removeHandler('presence:match');
    ipcMain.removeHandler('presence:list');
    ipcMain.removeHandler('presence:remove');
  }
}

let singleton: PresenceBridge | null = null;
export function getPresenceBridge(): PresenceBridge {
  if (singleton === null) singleton = new PresenceBridge();
  return singleton;
}
