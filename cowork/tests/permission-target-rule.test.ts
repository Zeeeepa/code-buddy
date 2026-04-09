import { describe, expect, it } from 'vitest';
import { deriveScopedPermissionRule } from '../src/renderer/utils/permission-target-rule';

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
});
