export function deriveScopedPermissionRule(
  toolName: string,
  toolArgs: Record<string, unknown>,
  fallbackDetails?: Record<string, unknown>
): string | null {
  const urlCandidate =
    (typeof toolArgs.url === 'string' ? toolArgs.url : '') ||
    (typeof fallbackDetails?.url === 'string' ? fallbackDetails.url : '');
  if (urlCandidate) {
    try {
      const parsed = new URL(urlCandidate);
      return `${toolName}(${parsed.origin}/*)`;
    } catch {
      return `${toolName}(${urlCandidate}*)`;
    }
  }

  const targetCandidate =
    (typeof toolArgs.target === 'string' ? toolArgs.target : '') ||
    (typeof fallbackDetails?.target === 'string' ? fallbackDetails.target : '') ||
    (typeof toolArgs.app === 'string' ? toolArgs.app : '') ||
    (typeof fallbackDetails?.app === 'string' ? fallbackDetails.app : '');

  if (targetCandidate) {
    return `${toolName}(${targetCandidate}*)`;
  }

  return null;
}
