/**
 * HunkDiffService — Phase 3 step 1
 *
 * Parses unified diff text into hunks and reverts rejected hunks
 * by writing a reverse patch to a temp file and applying it with
 * `git apply -R`. Falls back to line-based revert when not in a
 * git repo.
 *
 * @module main/diff/hunk-diff-service
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execFileSync } from 'child_process';
import { randomUUID } from 'crypto';
import { logWarn } from '../utils/logger';

export interface ParsedHunk {
  index: number;
  header: string;
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: string[];
  /** Text body of the hunk INCLUDING the header line. */
  body: string;
}

export interface ParseHunksResult {
  hunks: ParsedHunk[];
  preamble: string;
}

/**
 * Parse a unified-diff excerpt into individual hunks.
 * The excerpt may or may not include "--- a/file" / "+++ b/file"
 * file-headers — we capture anything before the first "@@ ..." as
 * the `preamble` so we can re-emit a valid patch later.
 */
export function parseUnifiedDiff(excerpt: string): ParseHunksResult {
  const lines = excerpt.split('\n');
  const preambleLines: string[] = [];
  const hunks: ParsedHunk[] = [];
  let current: ParsedHunk | null = null;
  let inHunk = false;

  const headerRe = /^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/;

  for (const line of lines) {
    const match = headerRe.exec(line);
    if (match) {
      if (current) hunks.push(current);
      current = {
        index: hunks.length,
        header: line,
        oldStart: parseInt(match[1], 10),
        oldCount: match[2] ? parseInt(match[2], 10) : 1,
        newStart: parseInt(match[3], 10),
        newCount: match[4] ? parseInt(match[4], 10) : 1,
        lines: [],
        body: line + '\n',
      };
      inHunk = true;
      continue;
    }
    if (!inHunk) {
      preambleLines.push(line);
      continue;
    }
    if (current) {
      current.lines.push(line);
      current.body += line + '\n';
    }
  }
  if (current) hunks.push(current);

  return {
    hunks,
    preamble: preambleLines.join('\n'),
  };
}

function isInGitRepo(filePath: string): boolean {
  try {
    const cwd = path.dirname(filePath);
    execFileSync('git', ['rev-parse', '--is-inside-work-tree'], {
      cwd,
      timeout: 3000,
      stdio: 'pipe',
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Build a minimal unified-diff patch containing only the given
 * hunks, suitable for `git apply -R`.
 */
function buildPatch(filePath: string, hunks: ParsedHunk[]): string {
  const relPath = filePath.replace(/\\/g, '/');
  const header = `--- a/${relPath}\n+++ b/${relPath}\n`;
  return header + hunks.map((h) => h.body).join('');
}

function revertViaGit(filePath: string, hunks: ParsedHunk[]): boolean {
  const cwd = path.dirname(filePath);
  const patchPath = path.join(os.tmpdir(), `cowork-hunk-${randomUUID()}.patch`);
  try {
    fs.writeFileSync(patchPath, buildPatch(filePath, hunks), 'utf-8');
    execFileSync('git', ['apply', '-R', '--unidiff-zero', patchPath], {
      cwd,
      timeout: 5000,
      stdio: 'pipe',
    });
    return true;
  } catch (err) {
    logWarn('[HunkDiffService] git apply -R failed, falling back:', (err as Error).message);
    return false;
  } finally {
    try {
      fs.unlinkSync(patchPath);
    } catch {
      /* ignore */
    }
  }
}

/**
 * Fallback: manually revert hunks by string-replacing the "new"
 * lines with the "old" lines in the current file contents.
 */
function revertManually(filePath: string, hunks: ParsedHunk[]): boolean {
  try {
    let contents = fs.readFileSync(filePath, 'utf-8');
    for (const hunk of hunks) {
      const oldBody: string[] = [];
      const newBody: string[] = [];
      for (const l of hunk.lines) {
        if (l.startsWith('+')) newBody.push(l.slice(1));
        else if (l.startsWith('-')) oldBody.push(l.slice(1));
        else if (l.startsWith(' ')) {
          oldBody.push(l.slice(1));
          newBody.push(l.slice(1));
        }
      }
      const newText = newBody.join('\n');
      const oldText = oldBody.join('\n');
      if (!newText) continue;
      if (contents.includes(newText)) {
        contents = contents.replace(newText, oldText);
      }
    }
    fs.writeFileSync(filePath, contents, 'utf-8');
    return true;
  } catch (err) {
    logWarn('[HunkDiffService] manual revert failed:', (err as Error).message);
    return false;
  }
}

export interface RevertHunksResult {
  success: boolean;
  method: 'git' | 'manual' | 'none';
  error?: string;
}

/**
 * Revert the given hunks from a file.
 * Tries `git apply -R` first (cleanest), then falls back to manual
 * string-replacement of the new-content with old-content.
 */
export function revertHunks(filePath: string, hunks: ParsedHunk[]): RevertHunksResult {
  if (!fs.existsSync(filePath)) {
    return { success: false, method: 'none', error: `File not found: ${filePath}` };
  }
  if (hunks.length === 0) {
    return { success: true, method: 'none' };
  }

  if (isInGitRepo(filePath)) {
    if (revertViaGit(filePath, hunks)) {
      return { success: true, method: 'git' };
    }
  }

  if (revertManually(filePath, hunks)) {
    return { success: true, method: 'manual' };
  }
  return { success: false, method: 'none', error: 'Both git and manual revert failed' };
}
