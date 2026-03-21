/**
 * Instruction File Excludes (CC10)
 *
 * Loads exclude patterns from .codebuddy/settings.json "codebuddyMdExcludes"
 * to skip loading CODEBUDDY.md files in monorepo subdirectories.
 *
 * Inspired by Claude Code's claudeMdExcludes setting.
 */

import * as fs from 'fs';
import * as path from 'path';
import { matchGlob } from '../utils/glob-utils.js';
import { logger } from '../utils/logger.js';

// ============================================================================
// Cache
// ============================================================================

let _excludePatterns: string[] | null = null;
let _excludeCachePath: string | null = null;

/**
 * Clear the excludes cache (for testing).
 */
export function clearExcludesCache(): void {
  _excludePatterns = null;
  _excludeCachePath = null;
}

// ============================================================================
// Loader
// ============================================================================

/**
 * Load exclude patterns from settings.json.
 * Returns an array of glob patterns (e.g., ["packages/legacy/**"]).
 */
export function loadExcludePatterns(projectRoot: string = process.cwd()): string[] {
  const settingsPath = path.join(projectRoot, '.codebuddy', 'settings.json');

  if (_excludePatterns && _excludeCachePath === settingsPath) {
    return _excludePatterns;
  }

  let patterns: string[] = [];

  if (fs.existsSync(settingsPath)) {
    try {
      const raw = fs.readFileSync(settingsPath, 'utf-8');
      const settings = JSON.parse(raw);
      if (Array.isArray(settings.codebuddyMdExcludes)) {
        patterns = settings.codebuddyMdExcludes;
        logger.debug(`Loaded ${patterns.length} instruction exclude patterns`);
      }
    } catch (err) {
      logger.debug(`Failed to load instruction excludes: ${err}`);
    }
  }

  _excludePatterns = patterns;
  _excludeCachePath = settingsPath;
  return patterns;
}

// ============================================================================
// Matcher
// ============================================================================

/**
 * Check if an instruction file should be excluded based on codebuddyMdExcludes.
 *
 * @param filePath - Absolute path to the instruction file (CODEBUDDY.md, CONTEXT.md, etc.)
 * @param projectRoot - Project root directory
 * @returns true if the file should be excluded (not loaded)
 */
export function shouldExcludeInstructionFile(
  filePath: string,
  projectRoot: string = process.cwd(),
): boolean {
  const patterns = loadExcludePatterns(projectRoot);
  if (patterns.length === 0) return false;

  // Get relative path from project root
  const relativePath = path.relative(projectRoot, filePath).replace(/\\/g, '/');

  return patterns.some(pattern => matchGlob(relativePath, pattern));
}
