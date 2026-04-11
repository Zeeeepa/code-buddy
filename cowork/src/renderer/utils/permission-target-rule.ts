function normalizeRulePath(value: string): string {
  return value.replace(/\\/g, '/');
}

function getPathCandidate(
  toolArgs: Record<string, unknown>,
  fallbackDetails?: Record<string, unknown>
): string {
  return (
    (typeof toolArgs.file_path === 'string' ? toolArgs.file_path : '') ||
    (typeof toolArgs.path === 'string' ? toolArgs.path : '') ||
    (typeof fallbackDetails?.file_path === 'string' ? fallbackDetails.file_path : '') ||
    (typeof fallbackDetails?.path === 'string' ? fallbackDetails.path : '')
  );
}

function getCommandCandidate(
  toolArgs: Record<string, unknown>,
  fallbackDetails?: Record<string, unknown>
): string {
  return (
    (typeof toolArgs.command === 'string' ? toolArgs.command : '') ||
    (typeof toolArgs.cmd === 'string' ? toolArgs.cmd : '') ||
    (typeof fallbackDetails?.command === 'string' ? fallbackDetails.command : '') ||
    (typeof fallbackDetails?.cmd === 'string' ? fallbackDetails.cmd : '')
  );
}

function deriveCommandRule(toolName: string, command: string): string | null {
  const subCommands = command
    .split(/\s*(?:&&|\|\||;)\s*/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (subCommands.length === 0) {
    return null;
  }

  const firstTokens = subCommands
    .map((part) => part.split(/\s+/)[0]?.trim())
    .filter(Boolean);

  if (firstTokens.length === 0) {
    return null;
  }

  const firstToken = firstTokens[0];
  if (firstTokens.some((token) => token !== firstToken)) {
    return null;
  }

  const shouldUseWildcard = subCommands.some((part) => part !== firstToken);
  return shouldUseWildcard ? `${toolName}(${firstToken} *)` : `${toolName}(${firstToken})`;
}

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

  const commandCandidate = getCommandCandidate(toolArgs, fallbackDetails);

  if (commandCandidate) {
    return deriveCommandRule(toolName, commandCandidate);
  }

  const pathCandidate = getPathCandidate(toolArgs, fallbackDetails);

  if (pathCandidate) {
    return `${toolName}(${normalizeRulePath(pathCandidate)})`;
  }

  return null;
}

export function deriveRefinedPermissionRule(
  toolName: string,
  toolArgs: Record<string, unknown>,
  fallbackDetails?: Record<string, unknown>
): string | null {
  const commandCandidate = getCommandCandidate(toolArgs, fallbackDetails);
  if (/^(bash|shell_exec)$/i.test(toolName) && commandCandidate) {
    const subCommands = commandCandidate
      .split(/\s*(?:&&|\|\||;)\s*/)
      .map((part) => part.trim())
      .filter(Boolean);

    if (subCommands.length === 1) {
      return `${toolName}(${subCommands[0]})`;
    }
  }

  return deriveScopedPermissionRule(toolName, toolArgs, fallbackDetails);
}

export function deriveFolderScopedPermissionRule(
  toolName: string,
  toolArgs: Record<string, unknown>,
  fallbackDetails?: Record<string, unknown>
): string | null {
  const pathCandidate = getPathCandidate(toolArgs, fallbackDetails);
  if (!pathCandidate) {
    return null;
  }

  const normalizedPath = normalizeRulePath(pathCandidate);
  const lastSlashIndex = normalizedPath.lastIndexOf('/');
  if (lastSlashIndex <= 0) {
    return null;
  }

  const folderPath = normalizedPath.slice(0, lastSlashIndex);
  if (!folderPath || folderPath === '.') {
    return null;
  }

  return `${toolName}(${folderPath}/*)`;
}
