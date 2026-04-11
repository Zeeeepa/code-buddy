import { useEffect, useMemo, useState } from 'react';
import type { PermissionRequest } from '../types';
import {
  deriveFolderScopedPermissionRule,
  deriveRefinedPermissionRule,
  deriveScopedPermissionRule,
} from '../utils/permission-target-rule';
import {
  buildPermissionRulePreviewInput,
  extractPermissionRulePrimaryArg,
  isPermissionRuleDraftValid,
  shouldSuggestScopedPermissionRule,
  type PermissionRulePreviewResult,
} from '../utils/permission-rule-preview';

interface UsePermissionRuleAssistOptions {
  permission: PermissionRequest;
  relatedDetails?: Record<string, unknown>;
  activeProjectId: string | null;
  setShowSettings: (show: boolean) => void;
  setSettingsTab: (tab: string | null) => void;
  setPermissionRuleTestDraft: (draft: { toolName: string; testArg: string } | null) => void;
  setPermissionRuleDraft: (draft: { bucket: 'allow' | 'deny'; rule: string } | null) => void;
  respondToPermission: (toolUseId: string, result: 'allow' | 'deny' | 'allow_always') => void;
}

export function usePermissionRuleAssist({
  permission,
  relatedDetails,
  activeProjectId,
  setShowSettings,
  setSettingsTab,
  setPermissionRuleTestDraft,
  setPermissionRuleDraft,
  respondToPermission,
}: UsePermissionRuleAssistOptions) {
  const [savingScopedTargetDecision, setSavingScopedTargetDecision] = useState<
    'allow' | 'deny' | null
  >(null);
  const [scopedRuleDraft, setScopedRuleDraft] = useState('');
  const [rulePreview, setRulePreview] = useState<{
    status: 'idle' | 'loading' | 'ready' | 'error';
    result: PermissionRulePreviewResult | null;
  }>({
    status: 'idle',
    result: null,
  });

  const previewInput = useMemo(
    () => buildPermissionRulePreviewInput(permission.input, relatedDetails),
    [permission.input, relatedDetails]
  );

  const derivedScopedRule = useMemo(
    () => deriveScopedPermissionRule(permission.toolName, previewInput),
    [permission.toolName, previewInput]
  );

  const derivedReviewRule = useMemo(
    () =>
      deriveRefinedPermissionRule(permission.toolName, previewInput) ??
      deriveScopedPermissionRule(permission.toolName, previewInput),
    [permission.toolName, previewInput]
  );

  const derivedFolderRule = useMemo(
    () => deriveFolderScopedPermissionRule(permission.toolName, previewInput),
    [permission.toolName, previewInput]
  );

  useEffect(() => {
    setScopedRuleDraft(derivedScopedRule ?? '');
  }, [derivedScopedRule]);

  useEffect(() => {
    let cancelled = false;
    const api = window.electronAPI;
    if (!api?.rules?.test) {
      setRulePreview({ status: 'idle', result: null });
      return () => {
        cancelled = true;
      };
    }

    setRulePreview({ status: 'loading', result: null });
    void api.rules
      .test(permission.toolName, previewInput, activeProjectId ?? undefined)
      .then((result) => {
        if (cancelled) return;
        setRulePreview({ status: 'ready', result });
      })
      .catch(() => {
        if (cancelled) return;
        setRulePreview({ status: 'error', result: null });
      });

    return () => {
      cancelled = true;
    };
  }, [activeProjectId, permission.toolName, previewInput]);

  const showScopedRuleSuggestion =
    rulePreview.status !== 'loading' &&
    (rulePreview.status === 'error' ||
      shouldSuggestScopedPermissionRule(derivedScopedRule, rulePreview.result));

  const hasCoveredSuggestionNote = Boolean(
    derivedReviewRule &&
      rulePreview.status === 'ready' &&
      rulePreview.result?.matchedRule &&
      rulePreview.result.decision !== 'ask' &&
      rulePreview.result.matchedRule !== derivedReviewRule
  );

  const showRuleDraftPanel =
    Boolean(derivedScopedRule) && (showScopedRuleSuggestion || hasCoveredSuggestionNote);

  const rulePreviewTone =
    rulePreview.result?.decision === 'allow'
      ? 'bg-success/10 border-success/30 text-success'
      : rulePreview.result?.decision === 'deny'
        ? 'bg-error/10 border-error/30 text-error'
        : 'bg-warning/10 border-warning/30 text-warning';

  const normalizedScopedRuleDraft = scopedRuleDraft.trim();
  const isScopedRuleDraftValid = isPermissionRuleDraftValid(normalizedScopedRuleDraft);

  const matchedDecision =
    rulePreview.result?.decision === 'allow' || rulePreview.result?.decision === 'deny'
      ? rulePreview.result.decision
      : null;

  const openRulesReview = (decision: 'allow' | 'deny', ruleOverride?: string | null) => {
    const nextRule = (ruleOverride ?? normalizedScopedRuleDraft).trim();
    setPermissionRuleTestDraft({
      toolName: permission.toolName,
      testArg: extractPermissionRulePrimaryArg(permission.toolName, previewInput),
    });
    setPermissionRuleDraft(
      isPermissionRuleDraftValid(nextRule)
        ? {
            bucket: decision,
            rule: nextRule,
          }
        : null
    );
    setSettingsTab('rules');
    setShowSettings(true);
    respondToPermission(permission.toolUseId, decision);
  };

  const handleSaveScopedRule = async (decision: 'allow' | 'deny') => {
    if (!window.electronAPI?.rules?.add) return;
    setSavingScopedTargetDecision(decision);
    try {
      const result = await window.electronAPI.rules.add(
        decision,
        normalizedScopedRuleDraft,
        activeProjectId ?? undefined
      );
      if (result.success) {
        respondToPermission(permission.toolUseId, decision);
      }
    } finally {
      setSavingScopedTargetDecision(null);
    }
  };

  return {
    derivedFolderRule,
    derivedReviewRule,
    derivedScopedRule,
    handleSaveScopedRule,
    hasCoveredSuggestionNote,
    isScopedRuleDraftValid,
    matchedDecision,
    normalizedScopedRuleDraft,
    openRulesReview,
    rulePreview,
    rulePreviewTone,
    savingScopedTargetDecision,
    scopedRuleDraft,
    setScopedRuleDraft,
    showRuleDraftPanel,
    showScopedRuleSuggestion,
  };
}
