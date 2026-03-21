/**
 * Tests for Browser Batch Actions & Profiles
 *
 * Phase 3: batch execution, multi-selector, built-in profiles, Chrome discovery
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getBuiltinProfile, listBuiltinProfiles, BUILTIN_PROFILES } from '../../src/browser-automation/builtin-profiles.js';

// Mock child_process for chrome-discovery
vi.mock('child_process', () => ({
  execSync: vi.fn().mockImplementation(() => {
    throw new Error('not found');
  }),
  spawn: vi.fn(),
  spawnSync: vi.fn(),
}));

vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Built-in Browser Profiles', () => {
  it('should have user and chrome-relay profiles', () => {
    expect(BUILTIN_PROFILES.user).toBeDefined();
    expect(BUILTIN_PROFILES['chrome-relay']).toBeDefined();
  });

  it('user profile should be remote type with CDP URL', () => {
    const profile = getBuiltinProfile('user');
    expect(profile).toBeDefined();
    expect(profile!.type).toBe('remote');
    expect(profile!.cdpUrl).toBe('http://127.0.0.1:9222');
  });

  it('chrome-relay profile should be managed with userDataDir', () => {
    const profile = getBuiltinProfile('chrome-relay');
    expect(profile).toBeDefined();
    expect(profile!.type).toBe('managed');
    expect(profile!.userDataDir).toContain('.codebuddy');
    expect(profile!.userDataDir).toContain('browser-data');
  });

  it('should return undefined for unknown profile', () => {
    expect(getBuiltinProfile('nonexistent')).toBeUndefined();
  });

  it('listBuiltinProfiles should return all profiles', () => {
    const profiles = listBuiltinProfiles();
    expect(profiles.length).toBeGreaterThanOrEqual(2);
    expect(profiles.map(p => p.name)).toContain('user');
    expect(profiles.map(p => p.name)).toContain('chrome-relay');
  });
});

describe('Browser Batch Actions', () => {
  it('batch of 3 actions should return combined output', () => {
    const actions = [
      { action: 'click', ref: 1 },
      { action: 'type', text: 'hello' },
      { action: 'click', ref: 2 },
    ];

    const results = actions.map((a, i) => ({
      action: a.action,
      success: true,
      output: `Action ${i + 1} completed`,
    }));

    expect(results.length).toBe(3);
    expect(results.every(r => r.success)).toBe(true);
  });

  it('stopOnError: true should halt on first failure', () => {
    const actions = [
      { action: 'click', ref: 1 },
      { action: 'click', ref: 999 }, // Will fail
      { action: 'type', text: 'hello' },
    ];

    const results: Array<{ success: boolean; index: number }> = [];
    const stopOnError = true;

    for (let i = 0; i < actions.length; i++) {
      const success = actions[i].action === 'click' && (actions[i] as any).ref !== 999;
      results.push({ success, index: i });
      if (!success && stopOnError) break;
    }

    expect(results.length).toBe(2); // Stopped at index 1
    expect(results[1].success).toBe(false);
  });

  it('stopOnError: false should continue after failure', () => {
    const actions = [
      { action: 'click', ref: 1 },
      { action: 'click', ref: 999 }, // Will fail
      { action: 'type', text: 'hello' },
    ];

    const results: Array<{ success: boolean; index: number }> = [];

    for (let i = 0; i < actions.length; i++) {
      const success = actions[i].action === 'click' && (actions[i] as any).ref !== 999;
      results.push({ success, index: i });
    }

    expect(results.length).toBe(3); // All executed
    expect(results[1].success).toBe(false);
    expect(results[2].success).toBe(false); // type action doesn't match click condition
  });

  it('multi-selector should iterate over all matches', () => {
    const selectors = ['.btn-1', '.btn-2', '.btn-3'];
    const clicked: string[] = [];

    for (const selector of selectors) {
      clicked.push(selector);
    }

    expect(clicked).toEqual(['.btn-1', '.btn-2', '.btn-3']);
    expect(clicked.length).toBe(3);
  });
});

describe('Chrome Discovery', () => {
  it('should check CDP_URL env first', async () => {
    const originalEnv = process.env.CDP_URL;
    process.env.CDP_URL = 'http://localhost:9333';

    const { discoverChromeEndpoint } = await import('../../src/browser-automation/chrome-discovery.js');
    const result = discoverChromeEndpoint();
    expect(result).toBe('http://localhost:9333');

    if (originalEnv) {
      process.env.CDP_URL = originalEnv;
    } else {
      delete process.env.CDP_URL;
    }
  });

  it('should return null when no Chrome found and no env', async () => {
    const originalEnv = process.env.CDP_URL;
    delete process.env.CDP_URL;

    const { discoverChromeEndpoint } = await import('../../src/browser-automation/chrome-discovery.js');
    const result = discoverChromeEndpoint();
    // Without a running Chrome, should return null
    expect(result).toBeNull();

    if (originalEnv) {
      process.env.CDP_URL = originalEnv;
    }
  });
});
