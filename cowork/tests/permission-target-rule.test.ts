import { describe, expect, it } from 'vitest';
import {
  deriveFolderScopedPermissionRule,
  deriveRefinedPermissionRule,
  deriveScopedPermissionRule,
} from '../src/renderer/utils/permission-target-rule';

describe('deriveScopedPermissionRule', () => {
  it('derives a scoped rule from a URL', () => {
    expect(
      deriveScopedPermissionRule('mcp__Chrome__navigate_page', {
        url: 'https://example.com/path/to/page',
      })
    ).toBe('mcp__Chrome__navigate_page(https://example.com/*)');
  });

  it('falls back to target/app strings when URL is unavailable', () => {
    expect(
      deriveScopedPermissionRule('mcp__GUI_Operate__click', {
        app: 'Google Chrome',
      })
    ).toBe('mcp__GUI_Operate__click(Google Chrome*)');
  });

  it('derives a wildcard rule from bash commands that share the same leading executable', () => {
    expect(
      deriveScopedPermissionRule('Bash', {
        command: 'npm test && npm run lint',
      })
    ).toBe('Bash(npm *)');
  });

  it('does not derive a bash rule when compound commands do not share the same leading executable', () => {
    expect(
      deriveScopedPermissionRule('Bash', {
        command: 'npm test && git status',
      })
    ).toBeNull();
  });

  it('derives a refined exact bash rule for a single command', () => {
    expect(
      deriveRefinedPermissionRule('Bash', {
        command: 'git log --oneline',
      })
    ).toBe('Bash(git log --oneline)');
  });

  it('keeps the broad bash rule when the command is compound', () => {
    expect(
      deriveRefinedPermissionRule('Bash', {
        command: 'git status && git diff',
      })
    ).toBe('Bash(git *)');
  });

  it('derives an exact file-scoped rule for path-based tools', () => {
    expect(
      deriveScopedPermissionRule('Edit', {
        file_path: 'src\\components\\Button.tsx',
      })
    ).toBe('Edit(src/components/Button.tsx)');
  });

  it('derives a folder-scoped rule for nested file paths', () => {
    expect(
      deriveFolderScopedPermissionRule('Edit', {
        file_path: 'src\\components\\Button.tsx',
      })
    ).toBe('Edit(src/components/*)');
  });

  it('does not derive a folder-scoped rule for top-level files', () => {
    expect(
      deriveFolderScopedPermissionRule('Write', {
        file_path: 'README.md',
      })
    ).toBeNull();
  });
});
