/**
 * Builds the compact contextPack string for the agent system prompt.
 */

import type { RepoProfile } from './types.js';

export function buildContextPack(p: RepoProfile): string {
  const parts: string[] = [];

  if (p.languages.length > 0) {
    parts.push(`Language: ${p.languages.join(', ')}`);
  }
  if (p.framework) {
    parts.push(`Framework: ${p.framework}`);
  }
  if (p.packageManager) {
    parts.push(`Package manager: ${p.packageManager}`);
  }
  const cmds = Object.entries(p.commands)
    .map(([k, v]) => `${k}="${v}"`)
    .join(', ');
  if (cmds) {
    parts.push(`Commands: ${cmds}`);
  }
  const dirs = Object.entries(p.directories)
    .map(([k, v]) => `${k}=${v}`)
    .join(', ');
  if (dirs) {
    parts.push(`Dirs: ${dirs}`);
  }
  if (p.conventions.naming) {
    parts.push(`Naming: ${p.conventions.naming}`);
  }

  return parts.join(' | ');
}
