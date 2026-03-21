import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies that PluginManager imports
vi.mock('fs-extra', () => ({
  default: {
    pathExists: vi.fn().mockResolvedValue(false),
    ensureDir: vi.fn().mockResolvedValue(undefined),
    readdir: vi.fn().mockResolvedValue([]),
    existsSync: vi.fn().mockReturnValue(false),
    readJsonSync: vi.fn().mockReturnValue({}),
  },
  pathExists: vi.fn().mockResolvedValue(false),
  ensureDir: vi.fn().mockResolvedValue(undefined),
  readdir: vi.fn().mockResolvedValue([]),
  existsSync: vi.fn().mockReturnValue(false),
  readJsonSync: vi.fn().mockReturnValue({}),
}));

vi.mock('../../src/tools/tool-manager.js', () => ({
  getToolManager: () => ({ register: vi.fn() }),
}));

vi.mock('../../src/commands/slash-commands.js', () => ({
  getSlashCommandManager: () => ({ commands: new Map() }),
}));

vi.mock('../../src/plugins/isolated-plugin-runner.js', () => ({
  createIsolatedPluginRunner: vi.fn(),
  IsolatedPluginRunner: vi.fn(),
}));

vi.mock('../../src/plugins/bundled/index.js', () => ({
  getBundledProviders: () => [],
}));

import { PluginManager } from '../../src/plugins/plugin-manager.js';

describe('ContextEngine trust gate', () => {
  it('blocks non-trusted plugin from registering ownsCompaction engine', () => {
    const pm = new PluginManager({ trustedPlugins: [], pluginDir: '/tmp/test-plugins' });

    const events: string[] = [];
    pm.on('plugin:context-engine-denied', () => events.push('denied'));
    pm.on('plugin:context-engine-registered', () => events.push('registered'));

    // Simulate the registerContextEngine call with ownsCompaction=true
    const context = (pm as any).createPluginContext({
      manifest: { id: 'untrusted-plugin', name: 'Test', version: '1.0.0' },
      status: 'active',
    });

    context.registerContextEngine({
      id: 'evil-engine',
      ownsCompaction: true,
    });

    expect(events).toContain('denied');
    expect(events).not.toContain('registered');
    expect(pm._registeredContextEngine).toBeNull();
  });

  it('allows trusted plugin to register ownsCompaction engine', () => {
    const pm = new PluginManager({ trustedPlugins: ['trusted-plugin'], pluginDir: '/tmp/test-plugins' });

    const events: string[] = [];
    pm.on('plugin:context-engine-registered', () => events.push('registered'));

    const context = (pm as any).createPluginContext({
      manifest: { id: 'trusted-plugin', name: 'Test', version: '1.0.0' },
      status: 'active',
    });

    context.registerContextEngine({
      id: 'good-engine',
      ownsCompaction: true,
    });

    expect(events).toContain('registered');
    expect(pm._registeredContextEngine).not.toBeNull();
  });

  it('allows non-trusted plugin to register engine without ownsCompaction', () => {
    const pm = new PluginManager({ trustedPlugins: [], pluginDir: '/tmp/test-plugins' });

    const events: string[] = [];
    pm.on('plugin:context-engine-registered', () => events.push('registered'));
    pm.on('plugin:context-engine-denied', () => events.push('denied'));

    const context = (pm as any).createPluginContext({
      manifest: { id: 'untrusted-plugin', name: 'Test', version: '1.0.0' },
      status: 'active',
    });

    context.registerContextEngine({
      id: 'safe-engine',
      ownsCompaction: false,
    });

    expect(events).toContain('registered');
    expect(events).not.toContain('denied');
    expect(pm._registeredContextEngine).not.toBeNull();
  });
});
