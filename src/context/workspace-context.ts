/**
 * Workspace Context Builder
 *
 * Generates a per-turn <workspace_context> block injected into the LLM
 * messages. Contains git state + directory tree, refreshed every 30s.
 *
 * Inspired by Codex CLI's per-turn environment_context injection.
 *
 * Budget: 6 000 chars max (~1 500 tokens).
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { getGitState, formatGitState } from './git-context.js';
import { logger } from '../utils/logger.js';

// ============================================================================
// Types
// ============================================================================

export interface WorkspaceContextConfig {
  /** Maximum total chars for the block (default: 6000) */
  maxChars: number;
  /** Cache TTL in ms (default: 30000 = 30s) */
  cacheTtlMs: number;
  /** Directory tree depth (default: 2) */
  treeDepth: number;
  /** Max entries per level (default: 20) */
  maxEntriesPerLevel: number;
  /** Git timeout ms (default: 3000) */
  gitTimeoutMs: number;
}

const DEFAULT_CONFIG: WorkspaceContextConfig = {
  maxChars: 6000,
  cacheTtlMs: 30_000,
  treeDepth: 2,
  maxEntriesPerLevel: 20,
  gitTimeoutMs: 3000,
};

// Directories to skip when building the tree
const SKIP_DIRS = new Set([
  '.git', 'node_modules', 'dist', 'build', '.next', '__pycache__',
  'target', '.cache', '.vscode', '.idea', 'coverage', '.codebuddy',
  '.turbo', '.nuxt', '.output', 'vendor', 'venv', '.venv',
]);

// ============================================================================
// Singleton & Cache
// ============================================================================

let _cachedBlock: string | null = null;
let _cacheTimestamp = 0;
let _cachedCwd: string | null = null;

/**
 * Get the workspace context block for injection into LLM messages.
 * Returns an XML-tagged string or empty string if nothing useful.
 *
 * Cached for 30s to avoid repeated git/fs calls within a tool loop.
 */
export async function getWorkspaceContext(
  cwd: string,
  config: Partial<WorkspaceContextConfig> = {}
): Promise<string> {
  // Skip in test environments to avoid git spawns slowing down test suites
  if (process.env.VITEST || process.env.JEST_WORKER_ID || process.env.NODE_ENV === 'test') {
    return '';
  }

  const cfg = { ...DEFAULT_CONFIG, ...config };
  const now = Date.now();

  // Return cached if fresh and same cwd
  if (
    _cachedBlock !== null &&
    _cachedCwd === cwd &&
    now - _cacheTimestamp < cfg.cacheTtlMs
  ) {
    return _cachedBlock;
  }

  try {
    const block = await buildWorkspaceContext(cwd, cfg);
    _cachedBlock = block;
    _cacheTimestamp = now;
    _cachedCwd = cwd;
    return block;
  } catch (err) {
    logger.debug('getWorkspaceContext failed (non-critical)', { err });
    return '';
  }
}

/**
 * Invalidate the workspace context cache.
 * Useful after file operations that change the workspace.
 */
export function invalidateWorkspaceCache(): void {
  _cachedBlock = null;
  _cacheTimestamp = 0;
  _cachedCwd = null;
}

// ============================================================================
// Builder
// ============================================================================

async function buildWorkspaceContext(
  cwd: string,
  cfg: WorkspaceContextConfig
): Promise<string> {
  // Run git + tree in parallel
  const [gitState, tree] = await Promise.all([
    getGitState(cwd, { timeoutMs: cfg.gitTimeoutMs }),
    buildDirectoryTree(cwd, cfg.treeDepth, cfg.maxEntriesPerLevel),
  ]);

  const parts: string[] = [];

  // Git section (budget: ~3000 chars)
  const gitBlock = formatGitState(gitState, 3000);
  if (gitBlock) {
    parts.push(gitBlock);
  }

  // Tree section (budget: remaining chars)
  if (tree) {
    const gitLen = gitBlock ? gitBlock.length + 1 : 0;
    const treebudget = cfg.maxChars - gitLen - 60; // 60 chars for XML tags
    let treeStr = tree;
    if (treeStr.length > treebudget) {
      treeStr = treeStr.slice(0, treebudget - 15) + '\n... (truncated)';
    }
    parts.push(`Tree:\n${treeStr}`);
  }

  if (parts.length === 0) return '';

  const inner = parts.join('\n');
  const block = `<workspace_context>\n${inner}\n</workspace_context>`;

  // Final budget enforcement
  if (block.length > cfg.maxChars) {
    return block.slice(0, cfg.maxChars - 20) + '\n</workspace_context>';
  }
  return block;
}

// ============================================================================
// Directory Tree
// ============================================================================

async function buildDirectoryTree(
  dir: string,
  maxDepth: number,
  maxPerLevel: number,
  depth: number = 0,
  prefix: string = ''
): Promise<string> {
  if (depth > maxDepth) return '';

  let entries: { name: string; isDir: boolean }[];
  try {
    const dirents = await fs.readdir(dir, { withFileTypes: true });
    entries = dirents
      .filter(d => !d.name.startsWith('.') || depth === 0) // show dotfiles at root
      .filter(d => !d.isDirectory() || !SKIP_DIRS.has(d.name))
      .map(d => ({ name: d.name, isDir: d.isDirectory() }))
      .sort((a, b) => {
        // Directories first, then alphabetical
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  } catch {
    return '';
  }

  const shown = entries.slice(0, maxPerLevel);
  const overflow = entries.length - shown.length;
  const lines: string[] = [];

  for (const entry of shown) {
    const marker = entry.isDir ? `${entry.name}/` : entry.name;
    lines.push(`${prefix}${marker}`);

    if (entry.isDir && depth < maxDepth) {
      const subTree = await buildDirectoryTree(
        path.join(dir, entry.name),
        maxDepth,
        maxPerLevel,
        depth + 1,
        prefix + '  '
      );
      if (subTree) lines.push(subTree);
    }
  }

  if (overflow > 0) {
    lines.push(`${prefix}... (+${overflow} more)`);
  }

  return lines.join('\n');
}
