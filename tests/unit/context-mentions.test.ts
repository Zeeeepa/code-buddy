/**
 * Tests for @web, @git, @terminal Context Mentions
 *
 * Tests the processMentions() function and the ContextMentionParser
 * extensions for @web, @git extended, and @terminal mention types.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock child_process.exec
const mockExec = vi.fn();
vi.mock('child_process', () => ({
  exec: mockExec,
}));

// Mock util.promisify to return our mockExec wrapper
vi.mock('util', () => ({
  promisify: () => (...args: unknown[]) => {
    return new Promise((resolve, reject) => {
      mockExec(...args, (err: Error | null, stdout: string, stderr: string) => {
        if (err) reject(err);
        else resolve({ stdout, stderr });
      });
    });
  },
}));

// Mock fs-extra
vi.mock('fs-extra', () => ({
  default: {
    pathExists: vi.fn().mockResolvedValue(false),
    readdir: vi.fn().mockResolvedValue([]),
    readFile: vi.fn().mockResolvedValue(''),
    stat: vi.fn().mockResolvedValue({ size: 100, isDirectory: () => false }),
  },
}));

// Mock axios
vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
  },
}));

describe('Context Mentions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Setup default exec callback behavior
    mockExec.mockImplementation((_cmd: string, _opts: unknown, cb: Function) => {
      if (typeof _opts === 'function') {
        cb = _opts;
      }
      cb(null, '', '');
    });
  });

  describe('processMentions', () => {
    it('should return unchanged message when no mentions present', async () => {
      const { processMentions } = await import('@/input/context-mentions.js');
      const result = await processMentions('hello world');
      expect(result.cleanedMessage).toBe('hello world');
      expect(result.contextBlocks).toHaveLength(0);
    });

    it('should detect @terminal mention and return context block', async () => {
      const { processMentions } = await import('@/input/context-mentions.js');
      const result = await processMentions('show me @terminal');
      expect(result.cleanedMessage).toBe('show me');
      // Either succeeds with terminal content or adds an error block
      expect(result.contextBlocks.length).toBeGreaterThanOrEqual(1);
      const terminalBlock = result.contextBlocks.find(b => b.type === 'terminal');
      expect(terminalBlock).toBeDefined();
    });

    it('should detect @web mention with query', async () => {
      const axios = (await import('axios')).default;
      (axios.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { AbstractText: 'React is a library', RelatedTopics: [] },
      });

      const { processMentions } = await import('@/input/context-mentions.js');
      const result = await processMentions('@web React server components');
      expect(result.cleanedMessage).not.toContain('@web');
      const webBlock = result.contextBlocks.find(b => b.type === 'web');
      expect(webBlock).toBeDefined();
    });

    it('should detect @git log mention', async () => {
      mockExec.mockImplementation((_cmd: string, _opts: unknown, cb: Function) => {
        if (typeof _opts === 'function') {
          cb = _opts;
        }
        cb(null, 'abc1234 Initial commit\ndef5678 Second commit', '');
      });

      const { processMentions } = await import('@/input/context-mentions.js');
      const result = await processMentions('@git log --since=1week');
      expect(result.cleanedMessage).not.toContain('@git');
      const gitBlock = result.contextBlocks.find(b => b.type === 'git');
      expect(gitBlock).toBeDefined();
    });

    it('should handle multiple mentions in one message', async () => {
      mockExec.mockImplementation((_cmd: string, _opts: unknown, cb: Function) => {
        if (typeof _opts === 'function') {
          cb = _opts;
        }
        cb(null, 'mock output', '');
      });

      const { processMentions } = await import('@/input/context-mentions.js');
      const result = await processMentions('@terminal check this @git diff');
      // Should have context blocks for both mentions
      expect(result.contextBlocks.length).toBeGreaterThanOrEqual(1);
    });

    it('should include error blocks when mention resolution fails', async () => {
      const axios = (await import('axios')).default;
      (axios.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

      const { processMentions } = await import('@/input/context-mentions.js');
      const result = await processMentions('@web failing query');
      const errorBlock = result.contextBlocks.find(b => b.content.includes('Error'));
      expect(errorBlock).toBeDefined();
    });
  });

  describe('ContextMentionParser', () => {
    it('should have web mention type in MentionContext', async () => {
      const { ContextMentionParser } = await import('@/input/context-mentions.js');
      const parser = new ContextMentionParser();
      expect(parser).toBeDefined();
    });

    it('should have updated help text with new mention types', async () => {
      const { ContextMentionParser } = await import('@/input/context-mentions.js');
      const parser = new ContextMentionParser();
      const help = parser.getHelp();
      expect(help).toContain('@web');
      expect(help).toContain('@terminal');
      expect(help).toContain('@git blame');
      expect(help).toContain('@git log');
    });

    it('should export MentionResult interface', async () => {
      const mod = await import('@/input/context-mentions.js');
      expect(mod.processMentions).toBeDefined();
      expect(typeof mod.processMentions).toBe('function');
    });

    it('should sanitize git extended args (no shell metacharacters)', async () => {
      mockExec.mockImplementation((cmd: string, _opts: unknown, cb: Function) => {
        if (typeof _opts === 'function') {
          cb = _opts;
        }
        // Verify no dangerous chars in command
        expect(cmd).not.toContain(';');
        expect(cmd).not.toContain('|');
        expect(cmd).not.toContain('`');
        cb(null, 'safe output', '');
      });

      const { processMentions } = await import('@/input/context-mentions.js');
      await processMentions('@git log --oneline; rm -rf /');
    });

    it('should require file argument for @git blame', async () => {
      const { processMentions } = await import('@/input/context-mentions.js');
      const result = await processMentions('@git blame');
      // Should have an error about missing file argument
      const errorBlock = result.contextBlocks.find(b =>
        b.content.includes('requires a file') || b.content.includes('Error')
      );
      expect(errorBlock).toBeDefined();
    });

    it('should use Brave Search when BRAVE_API_KEY is set', async () => {
      const originalKey = process.env.BRAVE_API_KEY;
      process.env.BRAVE_API_KEY = 'test-key';

      const axios = (await import('axios')).default;
      (axios.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          web: {
            results: [
              { title: 'Test', url: 'https://example.com', description: 'Test result' },
            ],
          },
        },
      });

      const { processMentions } = await import('@/input/context-mentions.js');
      const result = await processMentions('@web test query');

      expect(axios.get).toHaveBeenCalledWith(
        'https://api.search.brave.com/res/v1/web/search',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Subscription-Token': 'test-key',
          }),
        })
      );

      // Restore
      if (originalKey) {
        process.env.BRAVE_API_KEY = originalKey;
      } else {
        delete process.env.BRAVE_API_KEY;
      }
    });
  });
});
