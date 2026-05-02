/**
 * /session slash handler tests
 *
 * Covers: action validation, status output shape, enable/disable
 * idempotence, create/join arg validation, case-insensitivity.
 *
 * Uses the real TeamSessionManager (no fs mock). The manager creates
 * ~/.codebuddy/sessions/ at instantiation but does not write session
 * files until createSession() is called — which we do not invoke in
 * happy paths to keep tests filesystem-clean.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { handleSession, _resetSessionHandlerForTests } from '../../src/commands/handlers/team-session-handler.js';
import { resetTeamSessionManager } from '../../src/collaboration/team-session.js';

describe('handleSession (/session)', () => {
  beforeEach(() => {
    resetTeamSessionManager();
    _resetSessionHandlerForTests();
  });

  afterEach(() => {
    resetTeamSessionManager();
    _resetSessionHandlerForTests();
  });

  it('rejects unknown action with help text', async () => {
    const r = await handleSession(['lol']);
    expect(r.handled).toBe(true);
    expect(r.entry?.content).toContain('Unknown session action');
    expect(r.entry?.content).toContain('Usage: /session');
  });

  it('shows help when action is "help"', async () => {
    const r = await handleSession(['help']);
    expect(r.entry?.content).toContain('Usage: /session');
    expect(r.entry?.content).toContain('enable');
    expect(r.entry?.content).toContain('disable');
    expect(r.entry?.content).toContain('status');
    expect(r.entry?.content).toContain('create');
    expect(r.entry?.content).toContain('join');
    expect(r.entry?.content).toContain('list');
    expect(r.entry?.content).toContain('leave');
  });

  it('defaults to status when no action provided', async () => {
    const r = await handleSession([]);
    expect(r.entry?.content).toContain('Team Session Manager Status');
    expect(r.entry?.content).toContain('Enabled:');
    expect(r.entry?.content).toContain('Real-time sync:');
  });

  it('status shows DISABLED V0.2 marker for sync when no server_url', async () => {
    const r = await handleSession(['status']);
    expect(r.entry?.content).toContain('DISABLED — V0.2');
  });

  it('enable instantiates the manager', async () => {
    const r = await handleSession(['enable']);
    expect(r.entry?.content).toContain('Team session manager started');

    const status = await handleSession(['status']);
    expect(status.entry?.content).toMatch(/Enabled:\s+yes/);
  });

  it('enable is idempotent', async () => {
    await handleSession(['enable']);
    const r2 = await handleSession(['enable']);
    expect(r2.entry?.content).toContain('already enabled');
  });

  it('disable resets the manager when enabled', async () => {
    await handleSession(['enable']);
    const r = await handleSession(['disable']);
    expect(r.entry?.content).toContain('Team session manager stopped');

    const status = await handleSession(['status']);
    expect(status.entry?.content).toMatch(/Enabled:\s+no/);
  });

  it('disable is a no-op when not enabled', async () => {
    const r = await handleSession(['disable']);
    expect(r.entry?.content).toContain('not enabled');
  });

  it('create with no name returns usage', async () => {
    const r = await handleSession(['create']);
    expect(r.entry?.content).toContain('Usage: /session create <name>');
  });

  it('join with no sessionId returns usage', async () => {
    const r = await handleSession(['join']);
    expect(r.entry?.content).toContain('Usage: /session join <sessionId>');
  });

  it('join with unknown sessionId reports not found', async () => {
    const r = await handleSession(['join', 'nonexistent-id-0000']);
    expect(r.entry?.content).toContain('Session not found');
    expect(r.entry?.content).toContain('/session list');
  });

  it('leave with no active session is a no-op', async () => {
    const r = await handleSession(['leave']);
    expect(r.entry?.content).toContain('No active session');
  });

  it('action is case-insensitive', async () => {
    const r = await handleSession(['ENABLE']);
    expect(r.entry?.content).toContain('Team session manager started');
    await handleSession(['DISABLE']);
  });
});
