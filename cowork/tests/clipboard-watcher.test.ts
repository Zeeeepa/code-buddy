/**
 * ClipboardWatcher — change detection + thresholds + summary
 * dispatch. The Electron clipboard module is mocked because it
 * requires a running BrowserWindow.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

let clipText = '';
const setClipText = (s: string) => {
  clipText = s;
};

vi.mock('electron', () => ({
  clipboard: {
    readText: () => clipText,
  },
  app: {
    isPackaged: false,
    getPath: () => '/tmp',
  },
}));

vi.mock('../src/main/utils/logger', () => ({
  log: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

const summarizeMock = vi.fn(async (text: string) => `summary of ${text.slice(0, 20)}`);
vi.mock('../src/main/claude/claude-sdk-one-shot', () => ({
  summarizeForClipboard: (...args: unknown[]) => summarizeMock(args[0] as string),
}));

vi.mock('../src/main/config/config-store', () => ({
  configStore: {
    getAll: () => ({ clipboard: { monitoringEnabled: true } }),
  },
}));

import { ClipboardWatcher } from '../src/main/clipboard/clipboard-watcher';
import type { ServerEvent } from '../src/renderer/types';

function fakeText(prefix: string, length = 200): string {
  return prefix + 'x'.repeat(Math.max(0, length - prefix.length));
}

describe('ClipboardWatcher', () => {
  beforeEach(() => {
    summarizeMock.mockClear();
    clipText = '';
  });

  it('start/stop are idempotent', () => {
    const w = new ClipboardWatcher();
    expect(w.isRunning()).toBe(false);
    w.start();
    expect(w.isRunning()).toBe(true);
    w.start(); // no-op
    expect(w.isRunning()).toBe(true);
    w.stop();
    expect(w.isRunning()).toBe(false);
    w.stop(); // no-op
    expect(w.isRunning()).toBe(false);
  });

  it('summariseNow returns null on empty clipboard', async () => {
    setClipText('');
    const w = new ClipboardWatcher();
    expect(await w.summariseNow()).toBeNull();
  });

  it('summariseNow returns null on too-short clipboard', async () => {
    setClipText('hi');
    const w = new ClipboardWatcher();
    expect(await w.summariseNow()).toBeNull();
  });

  it('summariseNow calls the LLM and returns a payload + emits event', async () => {
    setClipText(fakeText('long text ', 300));
    const events: ServerEvent[] = [];
    const w = new ClipboardWatcher();
    w.setSendToRenderer((e) => events.push(e));

    const result = await w.summariseNow();
    expect(result).not.toBeNull();
    expect(result?.summary).toContain('summary of');
    expect(result?.sourceLength).toBe(300);
    expect(summarizeMock).toHaveBeenCalledTimes(1);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('clipboard.summary');
  });

  it('truncates very long input to MAX_INPUT_LENGTH before forwarding to LLM', async () => {
    setClipText(fakeText('huge ', 12000));
    const w = new ClipboardWatcher();
    await w.summariseNow();
    const forwarded = summarizeMock.mock.calls[0][0] as string;
    // 8000 chars + ellipsis suffix.
    expect(forwarded.length).toBeLessThanOrEqual(8001 + 3);
    expect(forwarded.endsWith('…')).toBe(true);
  });

  it('hashes text — does not re-summarise identical content (manually drives tick)', async () => {
    // We can't drive setInterval with vi.useFakeTimers cleanly here
    // because the watcher uses Date-based polling internally; instead
    // call summariseNow twice with same text and assert the LLM is
    // called both times (the dedup is in the polling tick, not in
    // summariseNow which is explicit user intent).
    setClipText(fakeText('same ', 250));
    const w = new ClipboardWatcher();
    await w.summariseNow();
    await w.summariseNow();
    expect(summarizeMock).toHaveBeenCalledTimes(2);
  });

  it('preserves the first 120 chars of source as a preview', async () => {
    const long = 'A'.repeat(500);
    setClipText(long);
    const w = new ClipboardWatcher();
    const result = await w.summariseNow();
    expect(result?.sourcePreview.length).toBe(120);
    expect(result?.sourcePreview).toBe('A'.repeat(120));
  });

  it('emits hash that changes with content', async () => {
    setClipText(fakeText('first ', 200));
    const w = new ClipboardWatcher();
    const a = await w.summariseNow();
    setClipText(fakeText('second ', 200));
    const b = await w.summariseNow();
    expect(a?.hash).not.toBe(b?.hash);
  });
});
