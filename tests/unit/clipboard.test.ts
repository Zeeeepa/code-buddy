/**
 * Unit Tests for Clipboard Utility
 *
 * Tests cross-platform clipboard operations with mocked execSync.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock child_process before import
const mockExecSync = vi.fn();
vi.mock('child_process', () => ({
  execSync: (...args: unknown[]) => mockExecSync(...args),
}));

// Mock os.platform
const mockPlatform = vi.fn();
vi.mock('os', () => ({
  platform: () => mockPlatform(),
}));

// Mock logger
vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Clipboard Utility', () => {
  beforeEach(() => {
    vi.resetModules();
    mockExecSync.mockReset();
    mockPlatform.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('copyToClipboard', () => {
    it('should use pbcopy on macOS', async () => {
      mockPlatform.mockReturnValue('darwin');
      mockExecSync.mockReturnValue(undefined);

      const { copyToClipboard } = await import('../../src/utils/clipboard.js');
      const result = copyToClipboard('hello world');

      expect(result).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith('pbcopy', {
        input: 'hello world',
        stdio: ['pipe', 'ignore', 'ignore'],
      });
    });

    it('should use clip on Windows', async () => {
      mockPlatform.mockReturnValue('win32');
      mockExecSync.mockReturnValue(undefined);

      const { copyToClipboard } = await import('../../src/utils/clipboard.js');
      const result = copyToClipboard('test data');

      expect(result).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith('clip', {
        input: 'test data',
        stdio: ['pipe', 'ignore', 'ignore'],
      });
    });

    it('should try xclip/xsel/wl-copy on Linux and handle fallbacks', async () => {
      mockPlatform.mockReturnValue('linux');
      // First call (xclip) fails, second call (xsel) succeeds
      mockExecSync
        .mockImplementationOnce(() => { throw new Error('xclip not found'); })
        .mockReturnValueOnce(undefined);

      const { copyToClipboard } = await import('../../src/utils/clipboard.js');
      const result = copyToClipboard('linux text');

      expect(result).toBe(true);
      expect(mockExecSync).toHaveBeenCalledTimes(2);
    });

    it('should return false when all Linux clipboard tools fail', async () => {
      mockPlatform.mockReturnValue('linux');
      mockExecSync.mockImplementation(() => { throw new Error('not found'); });

      const { copyToClipboard } = await import('../../src/utils/clipboard.js');
      const result = copyToClipboard('test');

      expect(result).toBe(false);
    });
  });

  describe('readFromClipboard', () => {
    it('should use pbpaste on macOS', async () => {
      mockPlatform.mockReturnValue('darwin');
      mockExecSync.mockReturnValue('clipboard content');

      const { readFromClipboard } = await import('../../src/utils/clipboard.js');
      const result = readFromClipboard();

      expect(result).toBe('clipboard content');
    });

    it('should return null when clipboard read fails', async () => {
      mockPlatform.mockReturnValue('darwin');
      mockExecSync.mockImplementation(() => { throw new Error('no pasteboard'); });

      const { readFromClipboard } = await import('../../src/utils/clipboard.js');
      const result = readFromClipboard();

      expect(result).toBe(null);
    });
  });

  describe('isClipboardAvailable', () => {
    it('should return true on macOS and Windows', async () => {
      mockPlatform.mockReturnValue('darwin');
      const { isClipboardAvailable } = await import('../../src/utils/clipboard.js');
      expect(isClipboardAvailable()).toBe(true);

      mockPlatform.mockReturnValue('win32');
      expect(isClipboardAvailable()).toBe(true);
    });

    it('should check for Linux clipboard tools', async () => {
      mockPlatform.mockReturnValue('linux');
      // which xclip succeeds
      mockExecSync.mockReturnValueOnce(undefined);

      const { isClipboardAvailable } = await import('../../src/utils/clipboard.js');
      expect(isClipboardAvailable()).toBe(true);
    });

    it('should return false on Linux when no tools are available', async () => {
      mockPlatform.mockReturnValue('linux');
      mockExecSync.mockImplementation(() => { throw new Error('not found'); });

      const { isClipboardAvailable } = await import('../../src/utils/clipboard.js');
      expect(isClipboardAvailable()).toBe(false);
    });
  });
});
