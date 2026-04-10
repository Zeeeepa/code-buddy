export type PermissionRuleScope = 'site' | 'app' | 'generic';

export interface ClassifiedPermissionRule {
  rule: string;
  scope: PermissionRuleScope;
}

function parseRulePattern(rule: string): { toolName: string; pattern: string | null } {
  const match = rule.match(/^(\w+)\((.+)\)$/);
  if (!match) {
    return { toolName: rule.trim(), pattern: null };
  }
  return { toolName: match[1].trim(), pattern: match[2].trim() };
}

export function classifyPermissionRule(rule: string): PermissionRuleScope {
  const { toolName, pattern } = parseRulePattern(rule);
  if (!pattern) {
    return 'generic';
  }

  if (/^https?:\/\//i.test(pattern)) {
    return 'site';
  }

  if (/chrome|gui|computer/i.test(toolName)) {
    return 'app';
  }

  return 'generic';
}

export function groupPermissionRules(rules: string[]): Record<PermissionRuleScope, string[]> {
  const grouped: Record<PermissionRuleScope, string[]> = {
    site: [],
    app: [],
    generic: [],
  };

  for (const rule of rules) {
    grouped[classifyPermissionRule(rule)].push(rule);
  }

  return grouped;
}
