import { describe, expect, it } from 'vitest';
import { explainPermissionWithLocalRules } from '../src/main/security/rules-bridge';

describe('rules bridge local fallback matcher', () => {
  it('matches a chrome deny rule by URL origin pattern', () => {
    expect(
      explainPermissionWithLocalRules(
        'mcp__Chrome__navigate_page',
        { url: 'https://example.com/admin/users' },
        {
          allow: [],
          deny: ['mcp__Chrome__navigate_page(https://example.com/*)'],
        }
      )
    ).toEqual({
      decision: 'deny',
      matchedRule: 'mcp__Chrome__navigate_page(https://example.com/*)',
    });
  });

  it('applies deny precedence for compound bash commands', () => {
    expect(
      explainPermissionWithLocalRules(
        'Bash',
        { command: 'npm test && rm -rf build' },
        {
          allow: ['Bash(*)'],
          deny: ['Bash(rm -rf *)'],
        }
      )
    ).toEqual({
      decision: 'deny',
      matchedRule: 'Bash(rm -rf *)',
    });
  });

  it('matches a target-based computer rule when no URL is present', () => {
    expect(
      explainPermissionWithLocalRules(
        'mcp__Computer__click',
        { target: 'Save button primary' },
        {
          allow: [],
          deny: ['mcp__Computer__click(Save button*)'],
        }
      )
    ).toEqual({
      decision: 'deny',
      matchedRule: 'mcp__Computer__click(Save button*)',
    });
  });

  it('matches a target-based computer allow rule when no URL is present', () => {
    expect(
      explainPermissionWithLocalRules(
        'mcp__Computer__click',
        { target: 'Confirm button primary' },
        {
          allow: ['mcp__Computer__click(Confirm button*)'],
          deny: [],
        }
      )
    ).toEqual({
      decision: 'allow',
      matchedRule: 'mcp__Computer__click(Confirm button*)',
    });
  });

  it('matches a path-based rule even when the incoming file path uses Windows separators', () => {
    expect(
      explainPermissionWithLocalRules(
        'Edit',
        { file_path: 'src\\components\\Button.tsx' },
        {
          allow: ['Edit(src/components/Button.tsx)'],
          deny: [],
        }
      )
    ).toEqual({
      decision: 'allow',
      matchedRule: 'Edit(src/components/Button.tsx)',
    });
  });
});
