import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const rulesPath = path.resolve(
  process.cwd(),
  'src/renderer/components/settings/SettingsPermissionRules.tsx'
);

describe('SettingsPermissionRules computer-use quick rules', () => {
  it('surfaces recent computer-use targets as allow-rule suggestions', () => {
    const source = fs.readFileSync(rulesPath, 'utf8');
    expect(source).toContain('recentComputerUseSuggestions');
    expect(source).toContain("t('rules.computerUseTargets'");
    expect(source).toContain("deriveScopedPermissionRule(action.toolName");
    expect(source).toContain('groupedAllow');
    expect(source).toContain("t('rules.scope.site'");
    expect(source).toContain("t('rules.matchedRule'");
  });
});
