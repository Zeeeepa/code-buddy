import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const rulesPath = path.resolve(
  process.cwd(),
  'src/renderer/components/settings/SettingsPermissionRules.tsx'
);
const storePath = path.resolve(process.cwd(), 'src/renderer/store/index.ts');

describe('SettingsPermissionRules computer-use quick rules', () => {
  it('surfaces recent computer-use targets as allow-rule suggestions', () => {
    const source = fs.readFileSync(rulesPath, 'utf8');
    expect(source).toContain('recentComputerUseSuggestions');
    expect(source).toContain("t('rules.computerUseTargets'");
    expect(source).toContain("deriveScopedPermissionRule(action.toolName");
    expect(source).toContain('groupedAllow');
    expect(source).toContain("t('rules.scope.site'");
    expect(source).toContain("t('rules.matchedRule'");
    expect(source).toContain('ruleQuery');
    expect(source).toContain('scopeFilter');
    expect(source).toContain("t('rules.searchPlaceholder'");
    expect(source).toContain('permissionRuleTestDraft');
    expect(source).toContain('permissionRuleDraft');
    expect(source).toContain('clearPermissionRuleTestDraft');
    expect(source).toContain('clearPermissionRuleDraft');
    expect(source).toContain('buildPermissionRuleTestArgs');
    expect(source).toContain('classifyPermissionRule');
    expect(source).toContain('isActive');
    expect(source).toContain('data-testid="settings-permission-rules"');
    expect(source).toContain('data-testid="settings-rules-allow-input"');
    expect(source).toContain('data-testid="settings-rules-deny-input"');
    expect(source).toContain('data-testid="settings-rules-test-arg-input"');
  });

  it('exposes a renderer-side permission injection hook for e2e automation', () => {
    const source = fs.readFileSync(storePath, 'utf8');
    expect(source).toContain('w.__injectPermissionRequest');
    expect(source).toContain('activeProjectId: s.activeProjectId || null');
    expect(source).toContain('store.setActiveProjectId(guiAction.projectId)');
    expect(source).toContain('store.setPendingPermission(permission)');
    expect(source).toContain('store.appendGuiAction');
  });
});
