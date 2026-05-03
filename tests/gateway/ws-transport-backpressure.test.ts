/**
 * Phase (d).8 V0.4.1 — gateway ws-transport backpressure tests.
 *
 * Mirror of tests/server/broadcast-backpressure.test.ts but for the
 * src/gateway/ws-transport.ts surface (port 18789, separate from the
 * main server WS at port 3000).
 *
 * Validates that broadcast() and broadcastToSession() skip clients
 * whose ws.bufferedAmount exceeds the configured ceiling, that
 * per-client drop counters are maintained, and that
 * getBroadcastDropStats() surfaces the cross-client total.
 *
 * The tests instantiate WebSocketGateway WITHOUT calling start() — no
 * real WS server. Clients are injected via the test-only hooks.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { WebSocket } from 'ws';

import { WebSocketGateway, DEFAULT_WS_CONFIG } from '../../src/gateway/index.js';
import { SERVER_CONFIG } from '../../src/config/constants.js';
import { createMessage } from '../../src/gateway/server.js';

/**
 * Minimal server-side ws stub — only the surface broadcast()'s code
 * path touches: readyState, bufferedAmount, send.
 */
class FakeServerSocket {
  readyState = 1; // WebSocket.OPEN
  bufferedAmount = 0;
  sent: string[] = [];
  send(data: string): void {
    this.sent.push(data);
  }
}

/** Build a WebSocketClient compatible with the internal interface. */
function buildClient(opts: {
  id: string;
  socket: FakeServerSocket;
  sessionIds?: string[];
}) {
  const sessions = new Set<string>(opts.sessionIds ?? []);
  return {
    id: opts.id,
    socket: opts.socket as unknown as WebSocket,
    state: {
      id: opts.id,
      authenticated: true,
      sessions,
      connectedAt: Date.now(),
      lastActivityAt: Date.now(),
    },
    isAlive: true,
    droppedMessages: 0,
  };
}

describe('gateway ws-transport backpressure — Phase (d).8 V0.4.1', () => {
  let gateway: WebSocketGateway;

  beforeEach(() => {
    gateway = new WebSocketGateway(DEFAULT_WS_CONFIG);
    delete process.env.CODEBUDDY_FLEET_BROADCAST_BUFFER_LIMIT;
  });

  afterEach(() => {
    gateway._resetClientsForTests();
    delete process.env.CODEBUDDY_FLEET_BROADCAST_BUFFER_LIMIT;
  });

  it('delivers to a client whose buffer is below the limit', () => {
    const sock = new FakeServerSocket();
    const client = buildClient({ id: 'c1', socket: sock });
    gateway._registerClientForTests(client);

    gateway.broadcast(createMessage('agent_event', { kind: 'tool' }));

    expect(sock.sent).toHaveLength(1);
    const decoded = JSON.parse(sock.sent[0]);
    expect(decoded.type).toBe('agent_event');
    expect(client.droppedMessages).toBe(0);
    expect(gateway.getBroadcastDropStats().totalDropped).toBe(0);
  });

  it('skips a client whose bufferedAmount exceeds the default limit', () => {
    const sock = new FakeServerSocket();
    sock.bufferedAmount = SERVER_CONFIG.WS_BROADCAST_BUFFER_LIMIT + 1;
    const client = buildClient({ id: 'slow', socket: sock });
    gateway._registerClientForTests(client);

    gateway.broadcast(createMessage('agent_event', {}));

    expect(sock.sent).toHaveLength(0);
    expect(client.droppedMessages).toBe(1);
    expect(gateway.getBroadcastDropStats().totalDropped).toBe(1);
  });

  it('only the saturated client is skipped — others still receive', () => {
    const slow = new FakeServerSocket();
    slow.bufferedAmount = SERVER_CONFIG.WS_BROADCAST_BUFFER_LIMIT + 100;
    const free = new FakeServerSocket();
    const slowClient = buildClient({ id: 'slow', socket: slow });
    const freeClient = buildClient({ id: 'free', socket: free });
    gateway._registerClientForTests(slowClient);
    gateway._registerClientForTests(freeClient);

    gateway.broadcast(createMessage('agent_event', { x: 1 }));

    expect(slow.sent).toHaveLength(0);
    expect(free.sent).toHaveLength(1);
    expect(slowClient.droppedMessages).toBe(1);
    expect(freeClient.droppedMessages).toBe(0);

    const stats = gateway.getBroadcastDropStats();
    expect(stats.totalDropped).toBe(1);
    expect(stats.perClient).toEqual([{ clientId: 'slow', dropped: 1 }]);
  });

  it('broadcastToSession honors backpressure', () => {
    const slow = new FakeServerSocket();
    slow.bufferedAmount = SERVER_CONFIG.WS_BROADCAST_BUFFER_LIMIT + 1;
    const free = new FakeServerSocket();
    const slowClient = buildClient({ id: 'slow', socket: slow, sessionIds: ['s1'] });
    const freeClient = buildClient({ id: 'free', socket: free, sessionIds: ['s1'] });
    const offSession = buildClient({
      id: 'other',
      socket: new FakeServerSocket(),
      sessionIds: ['s2'],
    });
    gateway._registerClientForTests(slowClient);
    gateway._registerClientForTests(freeClient);
    gateway._registerClientForTests(offSession);

    gateway.broadcastToSession('s1', createMessage('session_message', {}));

    expect(slow.sent).toHaveLength(0);
    expect(free.sent).toHaveLength(1);
    expect((offSession.socket as unknown as FakeServerSocket).sent).toHaveLength(0);
    expect(slowClient.droppedMessages).toBe(1);
    expect(freeClient.droppedMessages).toBe(0);
    expect(offSession.droppedMessages).toBe(0); // off-session, never considered
  });

  it('broadcastToSession excludeClientId short-circuits before backpressure check', () => {
    // The exclude check must happen BEFORE the backpressure check, so an
    // excluded client over the bufferedAmount limit is NOT counted as a
    // drop. Defensive lock against a future refactor reordering these.
    const slow = new FakeServerSocket();
    slow.bufferedAmount = SERVER_CONFIG.WS_BROADCAST_BUFFER_LIMIT + 1;
    const free = new FakeServerSocket();
    const slowClient = buildClient({ id: 'slow', socket: slow, sessionIds: ['s1'] });
    const freeClient = buildClient({ id: 'free', socket: free, sessionIds: ['s1'] });
    gateway._registerClientForTests(slowClient);
    gateway._registerClientForTests(freeClient);

    // Exclude the slow client — its over-limit buffer must NOT be a drop.
    gateway.broadcastToSession('s1', createMessage('session_message', {}), 'slow');

    expect(slow.sent).toHaveLength(0);
    expect(free.sent).toHaveLength(1);
    expect(slowClient.droppedMessages).toBe(0); // excluded, not dropped
    expect(freeClient.droppedMessages).toBe(0);
    expect(gateway.getBroadcastDropStats().totalDropped).toBe(0);
  });

  it('honors CODEBUDDY_FLEET_BROADCAST_BUFFER_LIMIT env override', () => {
    process.env.CODEBUDDY_FLEET_BROADCAST_BUFFER_LIMIT = '1000';
    const sock = new FakeServerSocket();
    sock.bufferedAmount = 1500; // over the override, way under the 2 MiB default
    const client = buildClient({ id: 'env', socket: sock });
    gateway._registerClientForTests(client);

    gateway.broadcast(createMessage('agent_event', {}));

    expect(sock.sent).toHaveLength(0);
    expect(client.droppedMessages).toBe(1);
  });

  it('filter short-circuits before backpressure check (no spurious drop)', () => {
    // Lock the ordering: a filtered-out client must NOT be counted as a
    // backpressure drop even if its bufferedAmount happens to be over
    // the limit. Mirror of the scope-filter test in (d).7.
    const sock = new FakeServerSocket();
    sock.bufferedAmount = SERVER_CONFIG.WS_BROADCAST_BUFFER_LIMIT + 1;
    const client = buildClient({ id: 'filtered', socket: sock });
    gateway._registerClientForTests(client);

    gateway.broadcast(
      createMessage('agent_event', {}),
      (c) => c.id !== 'filtered', // filter excludes this client
    );

    expect(sock.sent).toHaveLength(0);
    expect(client.droppedMessages).toBe(0); // filtered, not dropped
    expect(gateway.getBroadcastDropStats().totalDropped).toBe(0);
  });
});
