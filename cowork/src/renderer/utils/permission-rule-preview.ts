export interface PermissionRulePreviewResult {
  decision: 'allow' | 'ask' | 'deny';
  matchedRule?: string;
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }
  return '';
}

const FALLBACK_DETAIL_KEYS = [
  'url',
  'target',
  'app',
  'text',
  'path',
  'file_path',
  'command',
  'cmd',
  'pattern',
] as const;

function isMissingValue(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

export function buildPermissionRulePreviewInput(
  input: Record<string, unknown>,
  fallbackDetails?: Record<string, unknown>
): Record<string, unknown> {
  if (!fallbackDetails) {
    return input;
  }

  const merged: Record<string, unknown> = { ...input };
  for (const key of FALLBACK_DETAIL_KEYS) {
    const fallbackValue = fallbackDetails[key];
    if (!isMissingValue(fallbackValue) && isMissingValue(merged[key])) {
      merged[key] = fallbackValue;
    }
  }
  return merged;
}

export function shouldSuggestScopedPermissionRule(
  derivedRule: string | null,
  preview: PermissionRulePreviewResult | null
): boolean {
  if (!derivedRule) {
    return false;
  }

  if (!preview) {
    return false;
  }

  return preview.decision === 'ask';
}

export function isPermissionRuleDraftValid(rule: string): boolean {
  const trimmed = rule.trim();
  if (!trimmed) {
    return false;
  }

  return /^\w+(\(.+\))?$/.test(trimmed);
}

export function extractPermissionRulePrimaryArg(
  toolName: string,
  toolArgs: Record<string, unknown>
): string {
  const normalizedTool = toolName.toLowerCase();

  if (normalizedTool === 'bash' || normalizedTool === 'shell_exec') {
    return firstString(toolArgs.command, toolArgs.cmd);
  }

  if (
    ['edit', 'write', 'read', 'str_replace_editor', 'str_replace', 'create_file', 'file_write', 'view_file', 'file_read'].includes(
      normalizedTool
    )
  ) {
    return firstString(toolArgs.file_path, toolArgs.path);
  }

  if (normalizedTool === 'glob') {
    return firstString(toolArgs.pattern, toolArgs.path);
  }

  if (normalizedTool === 'grep' || normalizedTool === 'search') {
    return firstString(toolArgs.path, toolArgs.pattern);
  }

  if (
    normalizedTool.includes('chrome') ||
    normalizedTool.includes('gui') ||
    normalizedTool.includes('computer')
  ) {
    return firstString(
      toolArgs.url,
      toolArgs.target,
      toolArgs.app,
      toolArgs.text,
      toolArgs.input
    );
  }

  return firstString(
    toolArgs.input,
    toolArgs.url,
    toolArgs.target,
    toolArgs.app,
    toolArgs.path,
    toolArgs.file_path,
    toolArgs.command,
    toolArgs.pattern,
    toolArgs.text
  );
}

export function buildPermissionRuleTestArgs(
  toolName: string,
  primaryArg: string
): Record<string, unknown> {
  const trimmed = primaryArg.trim();
  if (!trimmed) {
    return {};
  }

  const normalizedTool = toolName.toLowerCase();
  if (normalizedTool === 'bash' || normalizedTool === 'shell_exec') {
    return { command: trimmed };
  }

  if (
    ['edit', 'write', 'read', 'str_replace_editor', 'str_replace', 'create_file', 'file_write', 'view_file', 'file_read'].includes(
      normalizedTool
    )
  ) {
    return { path: trimmed };
  }

  if (normalizedTool === 'glob') {
    return { pattern: trimmed };
  }

  if (normalizedTool === 'grep' || normalizedTool === 'search') {
    return { path: trimmed };
  }

  if (
    normalizedTool.includes('chrome') ||
    normalizedTool.includes('gui') ||
    normalizedTool.includes('computer')
  ) {
    return /^https?:\/\//i.test(trimmed) ? { url: trimmed } : { target: trimmed };
  }

  return { input: trimmed };
}
