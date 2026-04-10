import { describe, expect, it } from 'vitest';
import { classifyPermissionRule, groupPermissionRules } from '../src/renderer/utils/permission-rule-classification';

describe('permission rule classification', () => {
  it('classifies URL-based rules as site scoped', () => {
    expect(classifyPermissionRule('mcp__Chrome__navigate_page(https://example.com/*)')).toBe(
      'site'
    );
  });

  it('classifies computer-use target rules as app scoped', () => {
    expect(classifyPermissionRule('mcp__GUI_Operate__click(Google Chrome*)')).toBe('app');
  });

  it('classifies generic file and tool rules as generic', () => {
    expect(classifyPermissionRule('Read')).toBe('generic');
    expect(classifyPermissionRule('Edit(src/**)')).toBe('generic');
  });

  it('groups rules by scope', () => {
    const grouped = groupPermissionRules([
      'Read',
      'mcp__Chrome__navigate_page(https://example.com/*)',
      'mcp__GUI_Operate__click(Google Chrome*)',
    ]);
    expect(grouped.site).toHaveLength(1);
    expect(grouped.app).toHaveLength(1);
    expect(grouped.generic).toHaveLength(1);
  });
});
