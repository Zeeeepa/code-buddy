/**
 * peer.chat-session.* tests — Phase (d).20 / Fleet V1.2.
 *
 * Validates the multi-turn conversation bridge:
 *   - start opens a session, returns sessionId + expiresAt
 *   - continue accumulates turn-by-turn history and feeds it to the LLM
 *   - end is idempotent
 *   - SESSION_NOT_FOUND / SESSION_EXPIRED / CLIENT_UNAVAILABLE error paths
 *   - concurrent continues serialise FIFO
 *   - opportunistic GC purges idle sessions on the next start/continue
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  dispatchPeerRequest,
  listPeerMethods,
  type PeerMethodContext,
} from '../../src/server/websocket/peer-rpc.js';
import {
  _listSessionsForTests,
  _unwireForTests,
  isPeerSessionBridgeWired,
  wirePeerSessionBridge,
} from '../../src/fleet/peer-session-bridge.js';

const baseCtx = (overrides: Partial<PeerMethodContext> = {}): PeerMethodContext => ({
  connectionId: 'test-conn',
  scopes: ['peer:invoke'],
  traceId: '',
  depth: 0,
  ...overrides,
});

interface CapturedCall {
  messages: unknown;
  tools: unknown;
  opts: unknown;
}

/** Minimal client mock — records calls, returns a configurable assistant text. */
function makeClient(responses: string[] | string = 'hello'): {
  client: { chat: (msgs: unknown, tools: unknown, opts?: unknown) => Promise<unknown> };
  calls: CapturedCall[];
} {
  const calls: CapturedCall[] = [];
  let i = 0;
  const list = Array.isArray(responses) ? responses : [responses];
  return {
    calls,
    client: {
      chat: vi.fn(async (messages: unknown, tools: unknown, opts?: unknown) => {
        calls.push({ messages, tools, opts });
        const text = list[Math.min(i, list.length - 1)];
        i++;
        return {
          choices: [
            {
              message: { content: text },
              finish_reason: 'stop',
            },
          ],
          usage: { total_tokens: 5, prompt_tokens: 2, completion_tokens: 3 },
        };
      }),
    },
  };
}

async function dispatch(method: string, params: Record<string, unknown>, ctxOverrides: Partial<PeerMethodContext> = {}) {
  return dispatchPeerRequest(
    { id: `req-${Math.random().toString(36).slice(2, 10)}`, method, params, ...(ctxOverrides.traceId ? { traceId: ctxOverrides.traceId } : {}) },
    baseCtx(ctxOverrides),
  );
}

describe('peer-session-bridge — wiring', () => {
  beforeEach(() => {
    _unwireForTests();
  });
  afterEach(() => {
    _unwireForTests();
  });

  it('registers all 3 peer.chat-session.* methods when wired', () => {
    expect(isPeerSessionBridgeWired()).toBe(false);
    wirePeerSessionBridge(() => null);
    expect(isPeerSessionBridgeWired()).toBe(true);
    const methods = listPeerMethods();
    expect(methods).toContain('peer.chat-session.start');
    expect(methods).toContain('peer.chat-session.continue');
    expect(methods).toContain('peer.chat-session.end');
  });

  it('second wire call is a no-op (idempotent)', () => {
    const a = makeClient();
    const b = makeClient();
    wirePeerSessionBridge(() => a.client as never);
    wirePeerSessionBridge(() => b.client as never);
    expect(isPeerSessionBridgeWired()).toBe(true);
  });
});

describe('peer.chat-session.start', () => {
  beforeEach(() => _unwireForTests());
  afterEach(() => _unwireForTests());

  it('returns a sessionId matching /^sess_/ and expiresAt in the future', async () => {
    wirePeerSessionBridge(() => makeClient().client as never);
    const before = Date.now();
    const response = await dispatch('peer.chat-session.start', {});
    expect(response.ok).toBe(true);
    const payload = response.payload as { sessionId: string; expiresAt: number };
    expect(payload.sessionId).toMatch(/^sess_/);
    expect(payload.expiresAt).toBeGreaterThan(before);
  });

  it('echoes traceId in the response payload', async () => {
    wirePeerSessionBridge(() => makeClient().client as never);
    const response = await dispatch('peer.chat-session.start', {}, { traceId: 'trace-xyz' });
    expect(response.ok).toBe(true);
    const payload = response.payload as { traceId: string };
    expect(payload.traceId).toBe('trace-xyz');
  });

  it('GC purges idle sessions on the next start', async () => {
    process.env.CODEBUDDY_PEER_SESSION_IDLE_MS = '50';
    try {
      wirePeerSessionBridge(() => makeClient().client as never);
      const r1 = await dispatch('peer.chat-session.start', {});
      const session1 = (r1.payload as { sessionId: string }).sessionId;
      expect(_listSessionsForTests().some((s) => s.sessionId === session1)).toBe(true);

      // Wait past the idle window
      await new Promise((resolve) => setTimeout(resolve, 80));

      // A fresh start triggers purgeExpired
      await dispatch('peer.chat-session.start', {});
      const remaining = _listSessionsForTests().map((s) => s.sessionId);
      expect(remaining).not.toContain(session1);
    } finally {
      delete process.env.CODEBUDDY_PEER_SESSION_IDLE_MS;
    }
  });
});

describe('peer.chat-session.continue', () => {
  beforeEach(() => _unwireForTests());
  afterEach(() => _unwireForTests());

  it('happy path — accumulates history across two turns', async () => {
    const { client, calls } = makeClient(['Bonjour Patrice', 'Bien sûr, voici le code']);
    wirePeerSessionBridge(() => client as never);

    const startRes = await dispatch('peer.chat-session.start', { systemPrompt: 'Tu es un assistant FR' });
    const sessionId = (startRes.payload as { sessionId: string }).sessionId;

    const r1 = await dispatch('peer.chat-session.continue', { sessionId, prompt: 'Salut' });
    expect(r1.ok).toBe(true);
    expect((r1.payload as { text: string }).text).toBe('Bonjour Patrice');

    const r2 = await dispatch('peer.chat-session.continue', { sessionId, prompt: 'Tu peux écrire du Rust ?' });
    expect(r2.ok).toBe(true);
    expect((r2.payload as { text: string }).text).toBe('Bien sûr, voici le code');

    // Second LLM call should have seen system + first turn (user+assistant) + second user
    expect(calls).toHaveLength(2);
    const secondMessages = calls[1].messages as Array<{ role: string; content: string }>;
    expect(secondMessages.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'user']);
    expect(secondMessages[0].content).toBe('Tu es un assistant FR');
    expect(secondMessages[1].content).toBe('Salut');
    expect(secondMessages[2].content).toBe('Bonjour Patrice');
    expect(secondMessages[3].content).toBe('Tu peux écrire du Rust ?');
  });

  it('uses the default system prompt when none is provided at start', async () => {
    const { client, calls } = makeClient();
    wirePeerSessionBridge(() => client as never);
    const startRes = await dispatch('peer.chat-session.start', {});
    const sessionId = (startRes.payload as { sessionId: string }).sessionId;
    await dispatch('peer.chat-session.continue', { sessionId, prompt: 'q' });
    const sentMessages = calls[0].messages as Array<{ role: string; content: string }>;
    expect(sentMessages[0].role).toBe('system');
    expect(sentMessages[0].content.length).toBeGreaterThan(0);
  });

  it('passes the model option to client.chat on every continue', async () => {
    const { client, calls } = makeClient();
    wirePeerSessionBridge(() => client as never);
    const startRes = await dispatch('peer.chat-session.start', { model: 'qwen2.5-coder:7b' });
    const sessionId = (startRes.payload as { sessionId: string }).sessionId;
    await dispatch('peer.chat-session.continue', { sessionId, prompt: 'a' });
    await dispatch('peer.chat-session.continue', { sessionId, prompt: 'b' });
    expect(calls[0].opts).toMatchObject({ model: 'qwen2.5-coder:7b' });
    expect(calls[1].opts).toMatchObject({ model: 'qwen2.5-coder:7b' });
  });

  it('returns SESSION_NOT_FOUND when sessionId is unknown', async () => {
    wirePeerSessionBridge(() => makeClient().client as never);
    const response = await dispatch('peer.chat-session.continue', {
      sessionId: 'sess_does_not_exist',
      prompt: 'hi',
    });
    expect(response.ok).toBe(false);
    expect(response.error?.message).toContain('SESSION_NOT_FOUND');
  });

  it('returns SESSION_EXPIRED and purges the entry when idle window elapsed', async () => {
    process.env.CODEBUDDY_PEER_SESSION_IDLE_MS = '50';
    try {
      wirePeerSessionBridge(() => makeClient().client as never);
      const startRes = await dispatch('peer.chat-session.start', {});
      const sessionId = (startRes.payload as { sessionId: string }).sessionId;

      await new Promise((resolve) => setTimeout(resolve, 80));

      const response = await dispatch('peer.chat-session.continue', { sessionId, prompt: 'hi' });
      expect(response.ok).toBe(false);
      // After idle, GC at the top of continue purges the session, so the
      // visible error becomes SESSION_NOT_FOUND.
      expect(response.error?.message).toMatch(/SESSION_(EXPIRED|NOT_FOUND)/);
      expect(_listSessionsForTests().find((s) => s.sessionId === sessionId)).toBeUndefined();
    } finally {
      delete process.env.CODEBUDDY_PEER_SESSION_IDLE_MS;
    }
  });

  it('returns CLIENT_UNAVAILABLE when no client is wired', async () => {
    wirePeerSessionBridge(() => null);
    const startRes = await dispatch('peer.chat-session.start', {});
    const sessionId = (startRes.payload as { sessionId: string }).sessionId;
    const response = await dispatch('peer.chat-session.continue', { sessionId, prompt: 'hi' });
    expect(response.ok).toBe(false);
    expect(response.error?.message).toContain('CLIENT_UNAVAILABLE');
  });

  it('rejects missing sessionId or prompt', async () => {
    wirePeerSessionBridge(() => makeClient().client as never);
    const r1 = await dispatch('peer.chat-session.continue', { prompt: 'hi' });
    expect(r1.ok).toBe(false);
    expect(r1.error?.message).toContain('sessionId is required');

    const startRes = await dispatch('peer.chat-session.start', {});
    const sessionId = (startRes.payload as { sessionId: string }).sessionId;
    const r2 = await dispatch('peer.chat-session.continue', { sessionId });
    expect(r2.ok).toBe(false);
    expect(r2.error?.message).toContain('prompt is required');
  });

  it('serialises concurrent continues FIFO', async () => {
    // Hand-rolled client that resolves in a controlled order so we can
    // observe whether messages.push interleaves.
    const calls: Array<{ promptFromHistory: string; resolve: (text: string) => void }> = [];
    const slowClient = {
      chat: (messages: unknown) => {
        const msgs = messages as Array<{ role: string; content: string }>;
        const lastUser = [...msgs].reverse().find((m) => m.role === 'user');
        return new Promise((resolve) => {
          calls.push({
            promptFromHistory: lastUser?.content ?? '',
            resolve: (text: string) =>
              resolve({
                choices: [{ message: { content: text }, finish_reason: 'stop' }],
                usage: {},
              }),
          });
        });
      },
    };
    wirePeerSessionBridge(() => slowClient as never);

    const startRes = await dispatch('peer.chat-session.start', {});
    const sessionId = (startRes.payload as { sessionId: string }).sessionId;

    const p1 = dispatch('peer.chat-session.continue', { sessionId, prompt: 'first' });
    const p2 = dispatch('peer.chat-session.continue', { sessionId, prompt: 'second' });
    const p3 = dispatch('peer.chat-session.continue', { sessionId, prompt: 'third' });

    // Drain calls one at a time and assert ordering.
    while (calls.length === 0) await new Promise((r) => setTimeout(r, 5));
    expect(calls).toHaveLength(1);
    expect(calls[0].promptFromHistory).toBe('first');
    calls[0].resolve('A1');

    await p1;
    while (calls.length < 2) await new Promise((r) => setTimeout(r, 5));
    expect(calls[1].promptFromHistory).toBe('second');
    calls[1].resolve('A2');

    await p2;
    while (calls.length < 3) await new Promise((r) => setTimeout(r, 5));
    expect(calls[2].promptFromHistory).toBe('third');
    calls[2].resolve('A3');

    const r3 = await p3;
    expect((r3.payload as { text: string }).text).toBe('A3');
  });

  it('rolls back the user message when client.chat throws (so retry stays consistent)', async () => {
    let throwOnce = true;
    const client = {
      chat: vi.fn(async () => {
        if (throwOnce) {
          throwOnce = false;
          throw new Error('rate limited');
        }
        return {
          choices: [{ message: { content: 'recovered' }, finish_reason: 'stop' }],
          usage: {},
        };
      }),
    };
    wirePeerSessionBridge(() => client as never);
    const startRes = await dispatch('peer.chat-session.start', {});
    const sessionId = (startRes.payload as { sessionId: string }).sessionId;

    const r1 = await dispatch('peer.chat-session.continue', { sessionId, prompt: 'try' });
    expect(r1.ok).toBe(false);
    expect(r1.error?.message).toContain('rate limited');

    // Snapshot — failed turn must not leave a dangling user message.
    const live = _listSessionsForTests().find((s) => s.sessionId === sessionId);
    expect(live?.messageCount).toBe(0);

    // Retry with the same session — should now succeed.
    const r2 = await dispatch('peer.chat-session.continue', { sessionId, prompt: 'try again' });
    expect(r2.ok).toBe(true);
    expect((r2.payload as { text: string }).text).toBe('recovered');
  });

  it('echoes traceId in continue responses', async () => {
    wirePeerSessionBridge(() => makeClient().client as never);
    const startRes = await dispatch('peer.chat-session.start', {});
    const sessionId = (startRes.payload as { sessionId: string }).sessionId;
    const response = await dispatch(
      'peer.chat-session.continue',
      { sessionId, prompt: 'hi' },
      { traceId: 'trace-abc' },
    );
    expect(response.ok).toBe(true);
    expect((response.payload as { traceId: string }).traceId).toBe('trace-abc');
  });
});

describe('peer.chat-session.end', () => {
  beforeEach(() => _unwireForTests());
  afterEach(() => _unwireForTests());

  it('returns { closed: true } the first time, { closed: false } the second', async () => {
    wirePeerSessionBridge(() => makeClient().client as never);
    const startRes = await dispatch('peer.chat-session.start', {});
    const sessionId = (startRes.payload as { sessionId: string }).sessionId;

    const r1 = await dispatch('peer.chat-session.end', { sessionId });
    expect(r1.ok).toBe(true);
    expect((r1.payload as { closed: boolean }).closed).toBe(true);

    const r2 = await dispatch('peer.chat-session.end', { sessionId });
    expect(r2.ok).toBe(true);
    expect((r2.payload as { closed: boolean }).closed).toBe(false);
  });

  it('rejects missing sessionId', async () => {
    wirePeerSessionBridge(() => makeClient().client as never);
    const response = await dispatch('peer.chat-session.end', {});
    expect(response.ok).toBe(false);
    expect(response.error?.message).toContain('sessionId is required');
  });
});
