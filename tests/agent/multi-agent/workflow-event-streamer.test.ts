/**
 * MultiAgentSystem live event streamer (Phase D) tests.
 *
 * Validates that attachStreamer subscribes to all expected MAS events
 * and writes formatted lines to a writer (we inject a spy in tests).
 * Detach removes all listeners.
 */

import { describe, it, expect } from 'vitest';
import { EventEmitter } from 'events';
import { attachStreamer } from '../../../src/agent/multi-agent/workflow-event-streamer.js';

function setup() {
  const ee = new EventEmitter();
  const writes: string[] = [];
  const handle = attachStreamer(ee as never, (chunk) => { writes.push(chunk); });
  return { ee, writes, handle };
}

describe('attachStreamer (Phase D)', () => {
  it('formats workflow:start with the goal', () => {
    const { ee, writes } = setup();
    ee.emit('workflow:start', { plan: { goal: 'add hello endpoint' } });
    expect(writes.join('')).toContain('[workflow] started: add hello endpoint');
  });

  it('formats workflow:complete with duration + summary', () => {
    const { ee, writes } = setup();
    ee.emit('workflow:complete', { result: { totalDuration: 12500, summary: 'all good' } });
    const out = writes.join('');
    expect(out).toContain('[workflow] completed in 13s: all good');
  });

  it('formats workflow:error with message', () => {
    const { ee, writes } = setup();
    ee.emit('workflow:error', { error: { message: 'API quota exceeded' } });
    expect(writes.join('')).toContain('[workflow] error: API quota exceeded');
  });

  it('formats workflow:stopped', () => {
    const { ee, writes } = setup();
    ee.emit('workflow:stopped');
    expect(writes.join('')).toContain('[workflow] stopped by user');
  });

  it('formats agent:start with role and task title', () => {
    const { ee, writes } = setup();
    ee.emit('agent:start', { role: 'coder', task: { title: 'implement endpoint' } });
    expect(writes.join('')).toContain('[agent:coder] start: implement endpoint');
  });

  it('formats agent:complete with status and duration', () => {
    const { ee, writes } = setup();
    ee.emit('agent:complete', { role: 'reviewer', result: { success: true, duration: 3500 } });
    expect(writes.join('')).toContain('[agent:reviewer] done in 4s');
  });

  it('formats agent:complete failure', () => {
    const { ee, writes } = setup();
    ee.emit('agent:complete', { role: 'tester', result: { success: false, duration: 1000 } });
    expect(writes.join('')).toContain('[agent:tester] failed in 1s');
  });

  it('formats agent:tool with name', () => {
    const { ee, writes } = setup();
    ee.emit('agent:tool', { role: 'coder', name: 'create_file' });
    expect(writes.join('')).toContain('[agent:coder] tool: create_file');
  });

  it('emits non-task workflow:event entries (e.g. phase_started)', () => {
    const { ee, writes } = setup();
    ee.emit('workflow:event', { type: 'phase_started', message: 'Planning phase started', timestamp: new Date() });
    expect(writes.join('')).toContain('[event] Planning phase started');
  });

  it('SKIPS task_started/task_completed in workflow:event (deduped)', () => {
    const { ee, writes } = setup();
    ee.emit('workflow:event', { type: 'task_started', message: 'Started: t1', timestamp: new Date() });
    ee.emit('workflow:event', { type: 'task_completed', message: 'Done: t1', timestamp: new Date() });
    expect(writes.join('')).not.toContain('Started: t1');
    expect(writes.join('')).not.toContain('Done: t1');
  });

  it('detach removes all listeners — no further events written', () => {
    const { ee, writes, handle } = setup();
    handle.detach();
    ee.emit('workflow:start', { plan: { goal: 'should not appear' } });
    ee.emit('agent:start', { role: 'coder', task: { title: 'should not appear' } });
    expect(writes).toHaveLength(0);
  });

  it('default writer is process.stdout.write (smoke test)', () => {
    const ee = new EventEmitter();
    // Just verify attachStreamer accepts no writer arg without throwing
    const handle = attachStreamer(ee as never);
    expect(typeof handle.detach).toBe('function');
    handle.detach();
  });
});
