/**
 * Coverage Target Configuration
 *
 * Reads coverage thresholds from project config files (package.json, .nycrc, .c8rc)
 * and compares against actual coverage results.
 */

import { readFile } from 'fs/promises';
import { join } from 'path';

export interface CoverageTarget {
  lines?: number;
  functions?: number;
  branches?: number;
  statements?: number;
}

/** Default coverage targets used when no config is found */
const DEFAULT_TARGETS: CoverageTarget = {
  lines: 80,
  functions: 70,
  branches: 60,
  statements: 80,
};

/**
 * Read a JSON file safely, returning null on failure.
 */
async function readJsonFile(filePath: string): Promise<Record<string, unknown> | null> {
  try {
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Extract coverage targets from Jest's coverageThreshold.global config.
 */
function extractJestThresholds(packageJson: Record<string, unknown>): CoverageTarget | null {
  const jest = packageJson.jest as Record<string, unknown> | undefined;
  if (!jest) return null;

  const threshold = jest.coverageThreshold as Record<string, unknown> | undefined;
  if (!threshold) return null;

  const global = threshold.global as Record<string, number> | undefined;
  if (!global) return null;

  return {
    lines: global.lines,
    functions: global.functions,
    branches: global.branches,
    statements: global.statements,
  };
}

/**
 * Extract coverage targets from Vitest coverage thresholds.
 * Looks in package.json under vitest.coverage or vitest.test.coverage.
 */
function extractVitestThresholds(packageJson: Record<string, unknown>): CoverageTarget | null {
  // Check for vitest config in package.json
  const vitest = packageJson.vitest as Record<string, unknown> | undefined;
  if (!vitest) return null;

  // vitest.coverage.thresholds or vitest.coverage.100 pattern
  const coverage = vitest.coverage as Record<string, unknown> | undefined;
  if (!coverage) return null;

  const thresholds = coverage.thresholds as Record<string, number> | undefined;
  if (thresholds) {
    return {
      lines: thresholds.lines,
      functions: thresholds.functions,
      branches: thresholds.branches,
      statements: thresholds.statements,
    };
  }

  return null;
}

/**
 * Extract coverage targets from .nycrc or .c8rc files.
 */
function extractNycThresholds(config: Record<string, unknown>): CoverageTarget | null {
  // nyc/c8 uses top-level keys or check-coverage section
  const checkCoverage = config['check-coverage'] as boolean | undefined;
  if (checkCoverage === false) return null;

  const lines = config.lines as number | undefined;
  const functions = config.functions as number | undefined;
  const branches = config.branches as number | undefined;
  const statements = config.statements as number | undefined;

  if (lines !== undefined || functions !== undefined || branches !== undefined || statements !== undefined) {
    return { lines, functions, branches, statements };
  }

  return null;
}

/**
 * Get coverage targets for a project by reading its config files.
 *
 * Checks in order:
 *  1. package.json -> jest.coverageThreshold.global
 *  2. package.json -> vitest.coverage.thresholds
 *  3. .nycrc / .nycrc.json
 *  4. .c8rc / .c8rc.json
 *  5. Fallback defaults: 80% lines, 70% functions, 60% branches
 */
export async function getCoverageTargets(projectRoot: string): Promise<CoverageTarget> {
  // 1. Try package.json
  const packageJson = await readJsonFile(join(projectRoot, 'package.json'));
  if (packageJson) {
    // Jest thresholds
    const jestTargets = extractJestThresholds(packageJson);
    if (jestTargets) return { ...DEFAULT_TARGETS, ...jestTargets };

    // Vitest thresholds
    const vitestTargets = extractVitestThresholds(packageJson);
    if (vitestTargets) return { ...DEFAULT_TARGETS, ...vitestTargets };
  }

  // 2. Try .nycrc / .nycrc.json
  for (const nycFile of ['.nycrc.json', '.nycrc']) {
    const nycConfig = await readJsonFile(join(projectRoot, nycFile));
    if (nycConfig) {
      const nycTargets = extractNycThresholds(nycConfig);
      if (nycTargets) return { ...DEFAULT_TARGETS, ...nycTargets };
    }
  }

  // 3. Try .c8rc / .c8rc.json
  for (const c8File of ['.c8rc.json', '.c8rc']) {
    const c8Config = await readJsonFile(join(projectRoot, c8File));
    if (c8Config) {
      const c8Targets = extractNycThresholds(c8Config);
      if (c8Targets) return { ...DEFAULT_TARGETS, ...c8Targets };
    }
  }

  // 4. Return defaults
  return { ...DEFAULT_TARGETS };
}

/**
 * Compare current coverage against targets.
 * Returns whether targets are met and a list of gaps.
 */
export function compareCoverage(
  current: CoverageTarget,
  target: CoverageTarget
): { met: boolean; gaps: string[] } {
  const gaps: string[] = [];

  if (target.lines !== undefined && current.lines !== undefined) {
    if (current.lines < target.lines) {
      gaps.push(`Lines: ${current.lines.toFixed(1)}% < ${target.lines}% target`);
    }
  }

  if (target.functions !== undefined && current.functions !== undefined) {
    if (current.functions < target.functions) {
      gaps.push(`Functions: ${current.functions.toFixed(1)}% < ${target.functions}% target`);
    }
  }

  if (target.branches !== undefined && current.branches !== undefined) {
    if (current.branches < target.branches) {
      gaps.push(`Branches: ${current.branches.toFixed(1)}% < ${target.branches}% target`);
    }
  }

  if (target.statements !== undefined && current.statements !== undefined) {
    if (current.statements < target.statements) {
      gaps.push(`Statements: ${current.statements.toFixed(1)}% < ${target.statements}% target`);
    }
  }

  return { met: gaps.length === 0, gaps };
}

/**
 * Format a coverage comparison for display.
 */
export function formatCoverageComparison(
  current: CoverageTarget,
  target: CoverageTarget
): string {
  const { met, gaps } = compareCoverage(current, target);
  const lines: string[] = ['Coverage Report'];
  lines.push('='.repeat(50));

  const metrics: Array<{ name: string; cur: number | undefined; tgt: number | undefined }> = [
    { name: 'Lines', cur: current.lines, tgt: target.lines },
    { name: 'Functions', cur: current.functions, tgt: target.functions },
    { name: 'Branches', cur: current.branches, tgt: target.branches },
    { name: 'Statements', cur: current.statements, tgt: target.statements },
  ];

  for (const { name, cur, tgt } of metrics) {
    if (cur !== undefined && tgt !== undefined) {
      const pass = cur >= tgt;
      const icon = pass ? 'PASS' : 'FAIL';
      lines.push(`  [${icon}] ${name}: ${cur.toFixed(1)}% (target: ${tgt}%)`);
    } else if (tgt !== undefined) {
      lines.push(`  [----] ${name}: no data (target: ${tgt}%)`);
    }
  }

  lines.push('');
  if (met) {
    lines.push('All coverage targets met.');
  } else {
    lines.push(`${gaps.length} target(s) not met:`);
    for (const gap of gaps) {
      lines.push(`  - ${gap}`);
    }
  }

  return lines.join('\n');
}
