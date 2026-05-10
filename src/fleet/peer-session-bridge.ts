/**
 * Peer chat-session bridge (Phase (d).20 / Fleet V1.2).
 *
 * Registers `peer.chat-session.start`, `peer.chat-session.continue`,
 * and `peer.chat-session.end` on the peer-rpc registry. Adds multi-turn
 * conversational state to what `peer.chat` (d.15) and `peer.chat-stream`
 * (d.19) already do as one-shot stateless RPCs.
 *
 * State lives in-memory on the peer that hosts the LLM client — there
 * is no cross-restart durability in V1.2. The caller owns the session
 * lifecycle: open with `start`, append turns with `continue`, close
 * with `end`. Sessions also self-purge after an idle TTL (default
 * 30 min, override via `CODEBUDDY_PEER_SESSION_IDLE_MS`).
 *
 * Concurrent `continue` calls on the same session are serialised
 * FIFO so assistant messages don't interleave. Each call reads
 * `cachedGetter()` fresh, so swapping the wired client between turns
 * works the same way it does for `peer.chat`.
 *
 * Idempotent (mirror of peer-chat-bridge): a second wire call is a no-op.
 */

import type { CodeBuddyClient, ChatOptions } from '../codebuddy/client.js';
import { registerPeerMethod, unregisterPeerMethod } from '../server/websocket/peer-rpc.js';
import { logger } from '../utils/logger.js';

/** Closure that returns the CodeBuddyClient to use, or null if none is wired. */
export type PeerChatClientGetter = () => CodeBuddyClient | null;

interface ChatSessionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatSession {
  sessionId: string;
  systemPrompt: string;
  model?: string;
  /** User/assistant turns only — system prompt is held separately and prepended on each call. */
  messages: ChatSessionMessage[];
  createdAt: number;
  lastUsedAt: number;
  /** Promise chain for FIFO serialisation of concurrent `continue` calls. */
  pending: Promise<unknown>;
}

const DEFAULT_SYSTEM_PROMPT =
  'You are a peer LLM in a multi-Claude fleet. Answer concisely. Do not use tools.';
const DEFAULT_IDLE_MS = 30 * 60 * 1000;

const sessions = new Map<string, ChatSession>();
let cachedGetter: PeerChatClientGetter | null = null;
let wired = false;

function getIdleMs(): number {
  const raw = process.env.CODEBUDDY_PEER_SESSION_IDLE_MS;
  if (raw) {
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return DEFAULT_IDLE_MS;
}

function newSessionId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.floor(Math.random() * 1e9).toString(36);
  return `sess_${ts}_${rand}`;
}

/**
 * Opportunistic GC — drop sessions whose `lastUsedAt` is older than
 * the configured idle window. Called at the top of each `start` and
 * `continue` so we don't leak across long-running peers without
 * relying on a setInterval timer.
 */
function purgeExpired(now: number, idleMs: number): void {
  for (const [id, session] of sessions) {
    if (now - session.lastUsedAt > idleMs) {
      sessions.delete(id);
    }
  }
}

/**
 * Register the `peer.chat-session.*` methods. The `getClient` closure
 * is captured and called fresh on each invocation so the caller can
 * swap clients dynamically (mirror of `wirePeerChatBridge`).
 *
 * Idempotent — a second call is a no-op (does NOT replace the cached
 * getter; un-wire first if you need to swap).
 */
export function wirePeerSessionBridge(getClient: PeerChatClientGetter): void {
  if (wired) {
    logger.debug('[peer-session-bridge] wire() called while already wired — no-op');
    return;
  }
  cachedGetter = getClient;

  registerPeerMethod('peer.chat-session.start', async (params, ctx) => {
    const idleMs = getIdleMs();
    const now = Date.now();
    purgeExpired(now, idleMs);

    const systemPrompt =
      typeof params.systemPrompt === 'string' && params.systemPrompt.length > 0
        ? params.systemPrompt
        : DEFAULT_SYSTEM_PROMPT;
    const model =
      typeof params.model === 'string' && params.model.length > 0 ? params.model : undefined;

    const sessionId = newSessionId();
    sessions.set(sessionId, {
      sessionId,
      systemPrompt,
      model,
      messages: [],
      createdAt: now,
      lastUsedAt: now,
      pending: Promise.resolve(),
    });

    return {
      sessionId,
      expiresAt: now + idleMs,
      traceId: ctx.traceId,
    };
  });

  registerPeerMethod('peer.chat-session.continue', async (params, ctx) => {
    const sessionId = typeof params.sessionId === 'string' ? params.sessionId : '';
    const prompt = typeof params.prompt === 'string' ? params.prompt : '';
    if (!sessionId) {
      throw new Error('peer.chat-session.continue: sessionId is required (string)');
    }
    if (!prompt) {
      throw new Error('peer.chat-session.continue: prompt is required (string)');
    }

    const idleMs = getIdleMs();
    const now = Date.now();
    purgeExpired(now, idleMs);

    const session = sessions.get(sessionId);
    if (!session) {
      throw new Error(`SESSION_NOT_FOUND: no session with id "${sessionId}"`);
    }
    if (now - session.lastUsedAt > idleMs) {
      // Defensive — purgeExpired should already have evicted, but a
      // race between two callers could leave us here.
      sessions.delete(sessionId);
      throw new Error(`SESSION_EXPIRED: session "${sessionId}" idled past ${idleMs}ms`);
    }

    // FIFO serialise: chain onto the session's pending promise so
    // concurrent continue() calls run one after the other rather than
    // racing on session.messages.
    const run = async (): Promise<{
      text: string;
      finishReason: string | null | undefined;
      usage: unknown;
      traceId: string;
    }> => {
      const client = cachedGetter?.() ?? null;
      if (!client) {
        throw new Error(
          'CLIENT_UNAVAILABLE: no LLM client wired on this peer (peer.chat-session.continue cannot answer)',
        );
      }

      session.messages.push({ role: 'user', content: prompt });
      const requestMessages = [
        { role: 'system' as const, content: session.systemPrompt },
        ...session.messages,
      ];
      const chatOptions: ChatOptions | undefined = session.model
        ? { model: session.model }
        : undefined;

      let response: Awaited<ReturnType<CodeBuddyClient['chat']>>;
      try {
        response = await client.chat(requestMessages, undefined, chatOptions);
      } catch (err) {
        // Roll back the user message we appended so a retry doesn't
        // double-count it. Keeps session state consistent with what the
        // model has actually seen.
        session.messages.pop();
        throw err;
      }

      const text = response?.choices?.[0]?.message?.content ?? '';
      session.messages.push({ role: 'assistant', content: text });
      session.lastUsedAt = Date.now();

      return {
        text,
        finishReason: response?.choices?.[0]?.finish_reason,
        usage: response?.usage,
        traceId: ctx.traceId,
      };
    };

    const next = session.pending.then(run, run);
    // Swallow rejections on the chain so a failed turn doesn't poison
    // every subsequent continue() with the same error.
    session.pending = next.catch(() => undefined);
    return next;
  });

  registerPeerMethod('peer.chat-session.end', async (params, ctx) => {
    const sessionId = typeof params.sessionId === 'string' ? params.sessionId : '';
    if (!sessionId) {
      throw new Error('peer.chat-session.end: sessionId is required (string)');
    }
    const closed = sessions.delete(sessionId);
    return { closed, traceId: ctx.traceId };
  });

  wired = true;
  logger.debug('[peer-session-bridge] wired');
}

/** Detach all three methods. Idempotent. Does NOT clear in-memory sessions. */
export function unwirePeerSessionBridge(): void {
  if (!wired) return;
  unregisterPeerMethod('peer.chat-session.start');
  unregisterPeerMethod('peer.chat-session.continue');
  unregisterPeerMethod('peer.chat-session.end');
  cachedGetter = null;
  wired = false;
  logger.debug('[peer-session-bridge] unwired');
}

/** Whether the bridge is currently registered on the peer-rpc registry. */
export function isPeerSessionBridgeWired(): boolean {
  return wired;
}

/**
 * Test-only — force-unwire even if state is desync'd, AND clear the
 * in-memory session map. Equivalent of `_unwireForTests` in
 * peer-chat-bridge.
 */
export function _unwireForTests(): void {
  try {
    unregisterPeerMethod('peer.chat-session.start');
    unregisterPeerMethod('peer.chat-session.continue');
    unregisterPeerMethod('peer.chat-session.end');
  } catch {
    /* peer-rpc may not be initialised in some test setups */
  }
  cachedGetter = null;
  wired = false;
  sessions.clear();
}

/** Test-only — read-only snapshot of live sessions (count + ids). */
export function _listSessionsForTests(): Array<{
  sessionId: string;
  messageCount: number;
  lastUsedAt: number;
}> {
  return Array.from(sessions.values()).map((s) => ({
    sessionId: s.sessionId,
    messageCount: s.messages.length,
    lastUsedAt: s.lastUsedAt,
  }));
}
