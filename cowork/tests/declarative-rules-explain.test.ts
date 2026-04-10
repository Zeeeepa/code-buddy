import { describe, expect, it } from 'vitest';
import { explainDeclarativePermissionFromPermissions } from '../../src/security/declarative-rules';

describe('explainDeclarativePermissionFromPermissions', () => {
  it('returns the matched allow rule', () => {
    const result = explainDeclarativePermissionFromPermissions(
      'mcp__Chrome__navigate_page',
      { url: 'https://example.com/docs' },
      {
        allow: ['mcp__Chrome__navigate_page(https://example.com/*)'],
        deny: [],
      }
    );

    expect(result).toEqual({
      decision: 'allow',
      matchedRule: 'mcp__Chrome__navigate_page(https://example.com/*)',
    });
  });

  it('returns the matched deny rule with precedence', () => {
    const result = explainDeclarativePermissionFromPermissions(
      'Bash',
      { command: 'rm -rf build' },
      {
        allow: ['Bash(*)'],
        deny: ['Bash(rm -rf *)'],
      }
    );

    expect(result).toEqual({
      decision: 'deny',
      matchedRule: 'Bash(rm -rf *)',
    });
  });
});
