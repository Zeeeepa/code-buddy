import { describe, expect, it } from 'vitest';
import {
  buildPermissionRulePreviewInput,
  buildPermissionRuleTestArgs,
  extractPermissionRulePrimaryArg,
  isPermissionRuleDraftValid,
  shouldSuggestScopedPermissionRule,
} from '../src/renderer/utils/permission-rule-preview';

describe('permission rule preview utils', () => {
  it('merges missing preview fields from related gui-action details', () => {
    expect(
      buildPermissionRulePreviewInput(
        { text: 'Click button' },
        {
          url: 'https://example.com/settings',
          target: 'Save button',
          app: 'Chrome',
        }
      )
    ).toEqual({
      text: 'Click button',
      url: 'https://example.com/settings',
      target: 'Save button',
      app: 'Chrome',
    });
  });

  it('preserves explicit tool args over gui-action fallback details', () => {
    expect(
      buildPermissionRulePreviewInput(
        {
          url: 'https://workspace.local/',
          target: 'Primary target',
        },
        {
          url: 'https://example.com/settings',
          target: 'Fallback target',
          app: 'Chrome',
        }
      )
    ).toEqual({
      url: 'https://workspace.local/',
      target: 'Primary target',
      app: 'Chrome',
    });
  });

  it('only suggests a scoped rule when the current rules still ask for approval', () => {
    expect(shouldSuggestScopedPermissionRule('Chrome(https://example.com/*)', null)).toBe(false);
    expect(
      shouldSuggestScopedPermissionRule('Chrome(https://example.com/*)', {
        decision: 'allow',
        matchedRule: 'Chrome',
      })
    ).toBe(false);
    expect(
      shouldSuggestScopedPermissionRule('Chrome(https://example.com/*)', {
        decision: 'deny',
        matchedRule: 'Chrome(https://example.com/admin/*)',
      })
    ).toBe(false);
    expect(
      shouldSuggestScopedPermissionRule('Chrome(https://example.com/*)', {
        decision: 'ask',
      })
    ).toBe(true);
  });

  it('validates editable scoped-rule drafts with the same lightweight syntax as the bridge', () => {
    expect(isPermissionRuleDraftValid('')).toBe(false);
    expect(isPermissionRuleDraftValid('   ')).toBe(false);
    expect(isPermissionRuleDraftValid('Chrome(https://example.com/*)')).toBe(true);
    expect(isPermissionRuleDraftValid('Bash')).toBe(true);
    expect(isPermissionRuleDraftValid('Chrome(')).toBe(false);
  });

  it('extracts and rebuilds primary args for browser and shell permission reviews', () => {
    expect(
      extractPermissionRulePrimaryArg('mcp__Chrome__navigate_page', {
        url: 'https://example.com/settings',
      })
    ).toBe('https://example.com/settings');
    expect(
      buildPermissionRuleTestArgs('mcp__Chrome__navigate_page', 'https://example.com/settings')
    ).toEqual({ url: 'https://example.com/settings' });
    expect(extractPermissionRulePrimaryArg('Bash', { command: 'npm test' })).toBe('npm test');
    expect(buildPermissionRuleTestArgs('Bash', 'npm test')).toEqual({ command: 'npm test' });
  });
});
