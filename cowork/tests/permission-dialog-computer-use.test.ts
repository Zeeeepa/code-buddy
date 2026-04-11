import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const permissionDialogPath = path.resolve(
  process.cwd(),
  'src/renderer/components/PermissionDialog.tsx'
);
const permissionRuleAssistPanelPath = path.resolve(
  process.cwd(),
  'src/renderer/components/PermissionRuleAssistPanel.tsx'
);

describe('PermissionDialog computer use UX', () => {
  it('wires the permission dialog to the extracted assist panel and rules actions', () => {
    const source = fs.readFileSync(permissionDialogPath, 'utf8');
    expect(source).toContain('relatedGuiAction');
    expect(source).toContain('setShowComputerUseOverlay');
    expect(source).toContain("t('permission.computerUseTitle'");
    expect(source).toContain("t('permission.openComputerUseOverlay'");
    expect(source).toContain('computer-use-preview');
    expect(source).toContain('data-testid="permission-dialog"');
    expect(source).toContain("import { usePermissionRuleAssist }");
    expect(source).toContain("import { PermissionRuleAssistPanel }");
    expect(source).toContain('<PermissionRuleAssistPanel');
    expect(source).toContain('usePermissionRuleAssist({');
    expect(source).toContain('setPermissionRuleTestDraft');
    expect(source).toContain('setPermissionRuleDraft');
    expect(source).toContain('relatedDetails: relatedGuiAction?.details');
    expect(source).toContain('respondToPermission');
  });

  it('keeps the extracted assist panel responsible for preview, covered, and refine states', () => {
    const source = fs.readFileSync(permissionRuleAssistPanelPath, 'utf8');
    expect(source).toContain('function PermissionRuleAssistPanel({');
    expect(source).toContain('data-testid="permission-rule-preview"');
    expect(source).toContain('data-testid="permission-rule-preview-matched-rule"');
    expect(source).toContain('data-testid="permission-rule-preview-covered-note"');
    expect(source).toContain('data-testid="permission-covered-suggestion-note"');
    expect(source).toContain('data-testid="permission-review-covered-rule-button"');
    expect(source).toContain('data-testid="permission-allow-review-button"');
    expect(source).toContain('data-testid="permission-deny-review-button"');
    expect(source).toContain('data-testid="permission-use-folder-rule-button"');
    expect(source).toContain("t('permission.rulePreviewTitle')");
    expect(source).toContain("t('permission.rulePreviewChecking')");
    expect(source).toContain("t('permission.rulePreviewError')");
    expect(source).toContain("t(`permission.covered.${rulePreview.result.decision}`)");
    expect(source).toContain("t('permission.coveredSuggestion'");
    expect(source).toContain("t('permission.suggestedRule'");
    expect(source).toContain("t('permission.ruleDraftLabel'");
    expect(source).toContain("'permission.ruleDraftHint'");
    expect(source).toContain("'permission.ruleDraftInvalid'");
    expect(source).toContain("t('permission.useFolderRule'");
    expect(source).toContain("t('permission.ruleDraftPlaceholder'");
    expect(source).toContain("t('permission.restoreSuggestedRule'");
    expect(source).toContain('onOpenRulesReview: (decision: \'allow\' | \'deny\', ruleOverride?: string | null) => void;');
    expect(source).toContain("onOpenRulesReview('allow')");
    expect(source).toContain("onOpenRulesReview('deny')");
    expect(source).toContain('onOpenRulesReview(matchedDecision, derivedReviewRule)');
    expect(source).toContain("t('permission.allowAndReviewRules'");
    expect(source).toContain("t('permission.denyAndReviewRules'");
    expect(source).toContain("t('permission.allowAndReviewSpecificRule'");
    expect(source).toContain("t('permission.denyAndReviewSpecificRule'");
    expect(source).toContain("t('permission.alwaysDenyTarget'");
    expect(source).toContain("t('permission.rememberingDeniedTarget'");
    expect(source).toContain("t('permission.alwaysAllowTarget'");
  });
});
