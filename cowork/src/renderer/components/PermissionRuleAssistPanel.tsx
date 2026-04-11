import { Shield } from 'lucide-react';
import type { TFunction } from 'i18next';
import { shouldSuggestScopedPermissionRule, type PermissionRulePreviewResult } from '../utils/permission-rule-preview';

export interface PermissionRuleAssistPanelProps {
  t: TFunction;
  rulePreviewTone: string;
  rulePreview: {
    status: 'idle' | 'loading' | 'ready' | 'error';
    result: PermissionRulePreviewResult | null;
  };
  derivedScopedRule: string | null;
  derivedReviewRule: string | null;
  derivedFolderRule: string | null;
  scopedRuleDraft: string;
  normalizedScopedRuleDraft: string;
  isScopedRuleDraftValid: boolean;
  showScopedRuleSuggestion: boolean;
  hasCoveredSuggestionNote: boolean;
  showRuleDraftPanel: boolean;
  matchedDecision: 'allow' | 'deny' | null;
  savingScopedTargetDecision: 'allow' | 'deny' | null;
  onChangeScopedRuleDraft: (value: string) => void;
  onUseFolderRule: () => void;
  onUseSuggestedRule: () => void;
  onSaveScopedRule: (decision: 'allow' | 'deny') => Promise<void>;
  onOpenRulesReview: (decision: 'allow' | 'deny', ruleOverride?: string | null) => void;
}

export function PermissionRuleAssistPanel({
  t,
  rulePreviewTone,
  rulePreview,
  derivedScopedRule,
  derivedReviewRule,
  derivedFolderRule,
  scopedRuleDraft,
  normalizedScopedRuleDraft,
  isScopedRuleDraftValid,
  showScopedRuleSuggestion,
  hasCoveredSuggestionNote,
  showRuleDraftPanel,
  matchedDecision,
  savingScopedTargetDecision,
  onChangeScopedRuleDraft,
  onUseFolderRule,
  onUseSuggestedRule,
  onSaveScopedRule,
  onOpenRulesReview,
}: PermissionRuleAssistPanelProps) {
  return (
    <>
      <div className={`mt-4 p-3 border rounded-xl ${rulePreviewTone}`}>
        <div data-testid="permission-rule-preview">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-4 h-4" />
            <span className="text-sm font-medium">{t('permission.rulePreviewTitle')}</span>
          </div>
          {rulePreview.status === 'loading' && (
            <p className="text-xs">{t('permission.rulePreviewChecking')}</p>
          )}
          {rulePreview.status === 'error' && (
            <p className="text-xs">{t('permission.rulePreviewError')}</p>
          )}
          {rulePreview.status === 'ready' && rulePreview.result && (
            <div className="space-y-1">
              <p className="text-xs">{t(`permission.rulePreview.${rulePreview.result.decision}`)}</p>
              {rulePreview.result.decision !== 'ask' && rulePreview.result.matchedRule && (
                <div
                  className="text-[11px] font-medium"
                  data-testid="permission-rule-preview-covered-note"
                >
                  {t(`permission.covered.${rulePreview.result.decision}`)}
                </div>
              )}
              {rulePreview.result.matchedRule && (
                <code
                  className="block text-[11px] font-mono text-text-primary break-all"
                  data-testid="permission-rule-preview-matched-rule"
                >
                  {t('rules.matchedRule', { rule: rulePreview.result.matchedRule })}
                </code>
              )}
              {hasCoveredSuggestionNote && derivedReviewRule && (
                <div
                  className="text-[11px] text-text-muted"
                  data-testid="permission-covered-suggestion-note"
                >
                  {t('permission.coveredSuggestion', { rule: derivedReviewRule })}
                </div>
              )}
              {shouldSuggestScopedPermissionRule(derivedScopedRule, rulePreview.result) &&
                derivedScopedRule && (
                  <div className="text-[11px] text-text-muted">
                    {t('permission.suggestedRule', { rule: derivedScopedRule })}
                  </div>
                )}
            </div>
          )}
        </div>
      </div>

      {showRuleDraftPanel && derivedScopedRule && (
        <div className="mt-2 space-y-2">
          <div className="p-3 rounded-xl border border-border-muted bg-surface-muted">
            <div className="flex items-center justify-between gap-2 mb-2">
              <label className="text-xs font-medium text-text-primary" htmlFor="scoped-rule-draft">
                {t('permission.ruleDraftLabel', 'Scoped rule to save')}
              </label>
              <div className="flex items-center gap-2">
                {derivedFolderRule && scopedRuleDraft !== derivedFolderRule && (
                  <button
                    type="button"
                    onClick={onUseFolderRule}
                    className="text-[11px] text-accent hover:text-accent-hover"
                    data-testid="permission-use-folder-rule-button"
                  >
                    {t('permission.useFolderRule', 'Use folder rule')}
                  </button>
                )}
                {scopedRuleDraft !== derivedScopedRule && (
                  <button
                    type="button"
                    onClick={onUseSuggestedRule}
                    className="text-[11px] text-accent hover:text-accent-hover"
                  >
                    {t('permission.restoreSuggestedRule', 'Use suggested rule')}
                  </button>
                )}
              </div>
            </div>
            <input
              id="scoped-rule-draft"
              type="text"
              value={scopedRuleDraft}
              onChange={(e) => onChangeScopedRuleDraft(e.target.value)}
              placeholder={t('permission.ruleDraftPlaceholder', 'Edit the scoped rule before saving')}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
              data-testid="permission-scoped-rule-draft-input"
            />
            <div
              className={`mt-2 text-[11px] ${
                isScopedRuleDraftValid ? 'text-text-muted' : 'text-error'
              }`}
            >
              {isScopedRuleDraftValid
                ? t(
                    'permission.ruleDraftHint',
                    'Adjust the scoped rule if you want a narrower or broader match before saving it.'
                  )
                : t(
                    'permission.ruleDraftInvalid',
                    'Use Tool or Tool(pattern) syntax before saving this rule.'
                  )}
            </div>
          </div>
          {showScopedRuleSuggestion ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  onClick={() => void onSaveScopedRule('allow')}
                  disabled={savingScopedTargetDecision !== null || !isScopedRuleDraftValid}
                  className="btn btn-ghost text-sm"
                  data-testid="permission-always-allow-target-button"
                >
                  {savingScopedTargetDecision === 'allow'
                    ? t('permission.rememberingTarget', 'Saving rule…')
                    : t('permission.alwaysAllowTarget', { target: normalizedScopedRuleDraft })}
                </button>
                <button
                  onClick={() => void onSaveScopedRule('deny')}
                  disabled={savingScopedTargetDecision !== null || !isScopedRuleDraftValid}
                  className="btn btn-ghost text-sm text-error hover:text-error"
                  data-testid="permission-always-deny-target-button"
                >
                  {savingScopedTargetDecision === 'deny'
                    ? t('permission.rememberingDeniedTarget', 'Saving block rule…')
                    : t('permission.alwaysDenyTarget', { target: normalizedScopedRuleDraft })}
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onOpenRulesReview('allow')}
                  className="btn btn-ghost text-sm"
                  data-testid="permission-allow-review-button"
                >
                  {t('permission.allowAndReviewRules', 'Allow and review in permission rules')}
                </button>
                <button
                  type="button"
                  onClick={() => onOpenRulesReview('deny')}
                  className="btn btn-ghost text-sm"
                  data-testid="permission-deny-review-button"
                >
                  {t('permission.denyAndReviewRules', 'Deny and review in permission rules')}
                </button>
              </div>
            </>
          ) : matchedDecision ? (
            <button
              type="button"
              onClick={() => onOpenRulesReview(matchedDecision, derivedReviewRule)}
              className="w-full btn btn-ghost text-sm"
              data-testid="permission-review-covered-rule-button"
            >
              {matchedDecision === 'allow'
                ? t('permission.allowAndReviewSpecificRule', 'Review a more specific allow rule')
                : t('permission.denyAndReviewSpecificRule', 'Review a more specific deny rule')}
            </button>
          ) : null}
        </div>
      )}
    </>
  );
}
