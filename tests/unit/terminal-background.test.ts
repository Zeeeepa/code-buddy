/**
 * Tests for Terminal Background Auto-Detection
 *
 * Tests environment variable heuristics and cache behavior.
 * OSC 11 query testing is limited since it requires a real TTY.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock logger
vi.mock('@/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Terminal Background Detection', () => {
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    // Reset module state between tests
    const mod = await import('@/utils/terminal-background.js');
    mod.resetTerminalBackgroundCache();

    // Clean environment
    delete process.env.COLORFGBG;
    delete process.env.DARK_MODE;
    delete process.env.CODEBUDDY_THEME;
  });

  afterEach(() => {
    // Restore environment
    process.env = { ...originalEnv };
  });

  it('should detect dark background from COLORFGBG', async () => {
    process.env.COLORFGBG = '15;0'; // white fg, black bg (dark terminal)
    const { detectTerminalBackground } = await import('@/utils/terminal-background.js');
    const result = await detectTerminalBackground();
    expect(result).toBe('dark');
  });

  it('should detect light background from COLORFGBG', async () => {
    process.env.COLORFGBG = '0;15'; // black fg, white bg (light terminal)
    const { detectTerminalBackground } = await import('@/utils/terminal-background.js');
    const result = await detectTerminalBackground();
    expect(result).toBe('light');
  });

  it('should respect DARK_MODE=1 env var', async () => {
    process.env.DARK_MODE = '1';
    const { detectTerminalBackground } = await import('@/utils/terminal-background.js');
    const result = await detectTerminalBackground();
    expect(result).toBe('dark');
  });

  it('should respect CODEBUDDY_THEME=light env var', async () => {
    process.env.CODEBUDDY_THEME = 'light';
    const { detectTerminalBackground } = await import('@/utils/terminal-background.js');
    const result = await detectTerminalBackground();
    expect(result).toBe('light');
  });

  it('should cache the detection result', async () => {
    process.env.DARK_MODE = '1';
    const { getTerminalBackground, resetTerminalBackgroundCache } = await import('@/utils/terminal-background.js');

    resetTerminalBackgroundCache();

    const first = await getTerminalBackground();
    expect(first).toBe('dark');

    // Change env — should still return cached value
    process.env.DARK_MODE = '0';
    const second = await getTerminalBackground();
    expect(second).toBe('dark'); // Still cached

    // After reset, should re-detect
    resetTerminalBackgroundCache();
    process.env.CODEBUDDY_THEME = 'light';
    delete process.env.DARK_MODE;
    const third = await getTerminalBackground();
    expect(third).toBe('light');
  });
});
