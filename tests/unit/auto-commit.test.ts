/**
 * Tests for Auto-Commit Tool
 *
 * Validates commit message generation, config handling, and integration.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateCommitMessage,
  autoCommitChanges,
  maybeAutoCommit,
  type AutoCommitConfig,
} from '../../src/tools/auto-commit.js';

// Mock child_process.execFile to avoid real git operations
vi.mock('child_process', () => ({
  execFile: vi.fn(),
}));

vi.mock('util', async (importOriginal) => {
  const original = await importOriginal() as Record<string, unknown>;
  return {
    ...original,
    promisify: (fn: unknown) => {
      return async (...args: unknown[]) => {
        const { execFile } = await import('child_process');
        return new Promise((resolve, reject) => {
          (execFile as unknown as Function)(...args, (err: Error | null, stdout: string, stderr: string) => {
            if (err) reject(err);
            else resolve({ stdout, stderr });
          });
        });
      };
    },
  };
});

describe('Auto-Commit — generateCommitMessage', () => {
  const defaultConfig: AutoCommitConfig = {
    enabled: true,
    messageStyle: 'conventional',
    includeFileList: true,
    signOff: false,
  };

  it('generates conventional commit message with scope', () => {
    const msg = generateCommitMessage(
      ['src/tools/my-tool.ts'],
      'add new tool feature',
      defaultConfig,
    );
    expect(msg).toMatch(/^feat\(tools\): AI-assisted: add new tool feature/);
  });

  it('detects fix type from description', () => {
    const msg = generateCommitMessage(
      ['src/utils/helper.ts'],
      'fix null pointer in helper',
      defaultConfig,
    );
    expect(msg).toMatch(/^fix\(utils\): AI-assisted:/);
  });

  it('detects test type from description', () => {
    const msg = generateCommitMessage(
      ['tests/unit/foo.test.ts'],
      'add test for bar function',
      defaultConfig,
    );
    expect(msg).toMatch(/^test\(/);
  });

  it('detects refactor type from description', () => {
    const msg = generateCommitMessage(
      ['src/index.ts'],
      'refactor module structure',
      defaultConfig,
    );
    expect(msg).toMatch(/^refactor/);
  });

  it('includes file list when configured', () => {
    const msg = generateCommitMessage(
      ['src/a.ts', 'src/b.ts'],
      'update files',
      defaultConfig,
    );
    expect(msg).toContain('Changed files:');
    expect(msg).toContain('src/a.ts');
    expect(msg).toContain('src/b.ts');
  });

  it('excludes file list when configured', () => {
    const msg = generateCommitMessage(
      ['src/a.ts'],
      'update file',
      { ...defaultConfig, includeFileList: false },
    );
    expect(msg).not.toContain('Changed files:');
  });

  it('generates short style message', () => {
    const msg = generateCommitMessage(
      ['src/a.ts'],
      'quick fix',
      { ...defaultConfig, messageStyle: 'short' },
    );
    expect(msg).toBe('AI: quick fix');
    expect(msg.length).toBeLessThanOrEqual(72);
  });

  it('generates descriptive style message', () => {
    const msg = generateCommitMessage(
      ['src/a.ts'],
      'add new feature',
      { ...defaultConfig, messageStyle: 'descriptive' },
    );
    expect(msg).toMatch(/^AI-assisted: add new feature/);
  });

  it('truncates long conventional commit messages', () => {
    const longDesc = 'a'.repeat(100);
    const msg = generateCommitMessage(
      ['src/a.ts'],
      longDesc,
      { ...defaultConfig, includeFileList: false },
    );
    const firstLine = msg.split('\n')[0];
    expect(firstLine.length).toBeLessThanOrEqual(72);
    expect(firstLine).toMatch(/\.\.\.$/);
  });

  it('truncates file list when > 20 files', () => {
    const files = Array.from({ length: 25 }, (_, i) => `src/file${i}.ts`);
    const msg = generateCommitMessage(files, 'update many', defaultConfig);
    expect(msg).toContain('... and 5 more');
  });
});

describe('Auto-Commit — autoCommitChanges', () => {
  it('returns error for empty file list', async () => {
    const result = await autoCommitChanges([], 'no files');
    expect(result.success).toBe(false);
    expect(result.message).toContain('No files to commit');
  });
});

describe('Auto-Commit — maybeAutoCommit', () => {
  it('returns null for non-file-modifying tools', async () => {
    const result = await maybeAutoCommit('web_search', '{}', 'searched');
    expect(result).toBeNull();
  });

  it('returns null for file-modifying tool when auto-commit is disabled', async () => {
    // getAutoCommitConfig returns enabled=false by default
    const result = await maybeAutoCommit('create_file', '{"path":"test.ts"}', 'created file');
    expect(result).toBeNull();
  });
});
