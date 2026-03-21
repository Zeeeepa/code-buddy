import { describe, it, expect, vi, afterEach } from 'vitest';

// Mock marketplace and plugin manager
vi.mock('../../src/plugins/marketplace.js', () => ({
  getPluginMarketplace: () => ({
    getInstalled: () => [],
    formatStatus: () => 'OK',
  }),
}));

vi.mock('../../src/plugins/plugin-manager.js', () => ({
  getPluginManager: () => ({
    getAllPlugins: () => [],
  }),
}));

import { handlePlugin } from '../../src/commands/handlers/plugin-handlers.js';

describe('handlePlugin (singular, owner-gated)', () => {
  const originalChannelId = process.env.CODEBUDDY_CHANNEL_ID;

  afterEach(() => {
    if (originalChannelId) {
      process.env.CODEBUDDY_CHANNEL_ID = originalChannelId;
    } else {
      delete process.env.CODEBUDDY_CHANNEL_ID;
    }
  });

  it('allows access in local terminal session', async () => {
    delete process.env.CODEBUDDY_CHANNEL_ID;
    const result = await handlePlugin(['status']);
    expect(result.handled).toBe(true);
    // Should delegate to handlePlugins and not be blocked
    expect(result.entry?.content).not.toContain('restricted');
  });

  it('blocks access in channel sessions', async () => {
    process.env.CODEBUDDY_CHANNEL_ID = 'slack-123';
    const result = await handlePlugin(['status']);
    expect(result.handled).toBe(true);
    expect(result.entry?.content).toContain('restricted');
  });
});
