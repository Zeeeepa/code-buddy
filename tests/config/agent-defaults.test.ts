import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('AgentDefaults', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('getImageGenerationModel returns undefined when not configured', async () => {
    vi.doMock('../../src/config/toml-config.js', () => ({
      getConfigManager: () => ({
        getConfig: () => ({}),
      }),
    }));
    const { getImageGenerationModel } = await import('../../src/config/agent-defaults.js');
    expect(getImageGenerationModel()).toBeUndefined();
  });

  it('getImageGenerationModel returns model when configured', async () => {
    vi.doMock('../../src/config/toml-config.js', () => ({
      getConfigManager: () => ({
        getConfig: () => ({
          agent_defaults: { imageGenerationModel: 'dall-e-3' },
        }),
      }),
    }));
    const { getImageGenerationModel } = await import('../../src/config/agent-defaults.js');
    expect(getImageGenerationModel()).toBe('dall-e-3');
  });

  it('getImageGenerationModel returns undefined on error', async () => {
    vi.doMock('../../src/config/toml-config.js', () => ({
      getConfigManager: () => ({
        getConfig: () => { throw new Error('Config not loaded'); },
      }),
    }));
    const { getImageGenerationModel } = await import('../../src/config/agent-defaults.js');
    expect(getImageGenerationModel()).toBeUndefined();
  });
});
