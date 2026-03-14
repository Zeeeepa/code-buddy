/**
 * JIT (Just-In-Time) Context Discovery
 *
 * Dynamically loads .codebuddy/ context files when tools access
 * subdirectories. Context grows organically as the agent explores,
 * rather than loading everything at startup.
 *
 * Inspired by Gemini CLI's jit-context.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger.js';

/** Context file names to discover */
const CONTEXT_FILES = [
  'CODEBUDDY.md',
  'CONTEXT.md',
  'INSTRUCTIONS.md',
  'AGENTS.md',
  'README.md',
];

/** Directories that may contain context files */
const CONTEXT_DIRS = ['.codebuddy', '.claude'];

/** Set of already-loaded paths (avoid re-loading) */
const loadedPaths = new Set<string>();

/** Maximum context size per discovery (chars) */
const MAX_JIT_CONTEXT_CHARS = 4000;

/** Maximum directory depth to traverse upward */
const MAX_UPWARD_DEPTH = 10;

export const JIT_CONTEXT_PREFIX = '\n\n--- Discovered Context ---\n';
export const JIT_CONTEXT_SUFFIX = '\n--- End Context ---';

/**
 * Clear loaded paths cache (for testing).
 */
export function clearJitCache(): void {
  loadedPaths.clear();
}

/**
 * Discover and load context files for a given accessed path.
 *
 * Walks upward from the accessed file's directory to the project root,
 * checking for context files at each level. Only loads files that
 * haven't been loaded before in this session.
 *
 * @param accessedPath - The file/directory path being accessed by a tool
 * @param projectRoot - The project root directory (stop walking here)
 * @returns Concatenated context content, or empty string if nothing new found
 */
export function discoverJitContext(
  accessedPath: string,
  projectRoot: string = process.cwd(),
): string {
  try {
    const normalizedRoot = path.resolve(projectRoot);
    const normalizedPath = path.resolve(accessedPath);

    // Start from the accessed file's directory
    let currentDir = fs.existsSync(normalizedPath) && fs.statSync(normalizedPath).isDirectory()
      ? normalizedPath
      : path.dirname(normalizedPath);

    const discoveredContent: string[] = [];
    let depth = 0;

    while (depth < MAX_UPWARD_DEPTH) {
      // Check if we've gone above the project root
      if (!currentDir.startsWith(normalizedRoot) && currentDir !== normalizedRoot) {
        break;
      }

      // Look for context files in this directory
      for (const contextFile of CONTEXT_FILES) {
        const filePath = path.join(currentDir, contextFile);
        if (!loadedPaths.has(filePath) && fs.existsSync(filePath)) {
          try {
            const content = fs.readFileSync(filePath, 'utf-8');
            if (content.trim()) {
              const relativePath = path.relative(normalizedRoot, filePath).replace(/\\/g, '/');
              discoveredContent.push(`[${relativePath}]\n${content.trim()}`);
              loadedPaths.add(filePath);
              logger.debug(`JIT context: loaded ${relativePath}`);
            }
          } catch { /* read error — skip */ }
        }
      }

      // Also check .codebuddy/ and .claude/ subdirectories
      for (const contextDir of CONTEXT_DIRS) {
        const dirPath = path.join(currentDir, contextDir);
        if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
          for (const contextFile of CONTEXT_FILES) {
            const filePath = path.join(dirPath, contextFile);
            if (!loadedPaths.has(filePath) && fs.existsSync(filePath)) {
              try {
                const content = fs.readFileSync(filePath, 'utf-8');
                if (content.trim()) {
                  const relativePath = path.relative(normalizedRoot, filePath).replace(/\\/g, '/');
                  discoveredContent.push(`[${relativePath}]\n${content.trim()}`);
                  loadedPaths.add(filePath);
                  logger.debug(`JIT context: loaded ${relativePath}`);
                }
              } catch { /* read error — skip */ }
            }
          }
        }
      }

      // Move up
      const parent = path.dirname(currentDir);
      if (parent === currentDir) break; // reached filesystem root
      currentDir = parent;
      depth++;
    }

    if (discoveredContent.length === 0) return '';

    let result = discoveredContent.join('\n\n');
    if (result.length > MAX_JIT_CONTEXT_CHARS) {
      result = result.substring(0, MAX_JIT_CONTEXT_CHARS - 3) + '...';
    }

    return `${JIT_CONTEXT_PREFIX}${result}${JIT_CONTEXT_SUFFIX}`;
  } catch (err) {
    logger.debug('JIT context discovery failed', { error: String(err) });
    return '';
  }
}
