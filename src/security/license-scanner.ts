/**
 * License Compliance Scanner
 *
 * Scans npm dependencies for license information and checks compatibility
 * with the project's own license. npm only for v1.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger.js';
import type { ToolResult } from '../types/index.js';

const execFileAsync = promisify(execFile);

// ============================================================================
// Types
// ============================================================================

export type LicenseCategory = 'permissive' | 'copyleft' | 'weak-copyleft' | 'proprietary' | 'unknown';

export interface LicenseInfo {
  package: string;
  version: string;
  license: string;         // SPDX identifier
  category: LicenseCategory;
  compatible: boolean;     // with project license
  source: 'package.json' | 'LICENSE' | 'COPYING' | 'detected';
}

export interface LicenseReport {
  projectLicense: string;
  dependencies: LicenseInfo[];
  summary: {
    permissive: number;
    copyleft: number;
    weakCopyleft: number;
    unknown: number;
    incompatible: number;
  };
  warnings: string[];
}

// ============================================================================
// SPDX Classification
// ============================================================================

const PERMISSIVE_LICENSES = new Set([
  'MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'Unlicense', '0BSD',
  'CC0-1.0', 'WTFPL', 'Zlib', 'Artistic-2.0', 'BSL-1.0', 'CC-BY-4.0', 'CC-BY-3.0',
  'PostgreSQL', 'X11', 'JSON', 'BlueOak-1.0.0',
]);

const COPYLEFT_LICENSES = new Set([
  'GPL-2.0', 'GPL-2.0-only', 'GPL-2.0-or-later',
  'GPL-3.0', 'GPL-3.0-only', 'GPL-3.0-or-later',
  'AGPL-3.0', 'AGPL-3.0-only', 'AGPL-3.0-or-later',
]);

const WEAK_COPYLEFT_LICENSES = new Set([
  'LGPL-2.1', 'LGPL-2.1-only', 'LGPL-2.1-or-later',
  'LGPL-3.0', 'LGPL-3.0-only', 'LGPL-3.0-or-later',
  'MPL-2.0', 'EPL-2.0', 'EPL-1.0', 'CDDL-1.0', 'CDDL-1.1',
  'OSL-3.0', 'EUPL-1.1', 'EUPL-1.2',
]);

/**
 * Classify an SPDX license identifier
 */
export function classifyLicense(spdx: string): LicenseCategory {
  if (!spdx || spdx === 'UNLICENSED') return 'proprietary';

  // Handle SPDX expressions: "(MIT OR Apache-2.0)" → pick most permissive
  const cleaned = spdx
    .replace(/[()]/g, '')
    .split(/\s+(?:OR|AND)\s+/i)
    .map(s => s.trim());

  // If any sub-license is permissive, classify as permissive (OR logic)
  for (const lic of cleaned) {
    if (PERMISSIVE_LICENSES.has(lic)) return 'permissive';
  }
  for (const lic of cleaned) {
    if (WEAK_COPYLEFT_LICENSES.has(lic)) return 'weak-copyleft';
  }
  for (const lic of cleaned) {
    if (COPYLEFT_LICENSES.has(lic)) return 'copyleft';
  }

  return 'unknown';
}

/**
 * Check if a dependency license is compatible with the project license.
 *
 * Simple rule: if the project is permissive (MIT, Apache, BSD),
 * copyleft dependencies are incompatible (they'd require the project
 * to adopt copyleft).
 */
export function isCompatible(projectLicense: string, depLicense: string): boolean {
  const projectCategory = classifyLicense(projectLicense);
  const depCategory = classifyLicense(depLicense);

  // Unknown deps are flagged as potentially incompatible
  if (depCategory === 'unknown') return true; // Not flagged as incompatible but warned
  if (depCategory === 'proprietary') return false;

  // Permissive deps are always compatible
  if (depCategory === 'permissive') return true;

  // If the project is already copyleft, copyleft deps are fine
  if (projectCategory === 'copyleft') return true;

  // Weak copyleft is generally OK for dynamic linking (npm)
  if (depCategory === 'weak-copyleft') return true;

  // Copyleft dep + permissive project = incompatible
  if (depCategory === 'copyleft' && projectCategory === 'permissive') return false;

  return true;
}

// ============================================================================
// Dependency Extraction
// ============================================================================

interface NpmLsEntry {
  version?: string;
  resolved?: string;
  dependencies?: Record<string, NpmLsEntry>;
}

interface NpmLsOutput {
  name?: string;
  version?: string;
  dependencies?: Record<string, NpmLsEntry>;
}

/**
 * Flatten npm ls --json output into package@version list
 */
function flattenDeps(
  deps: Record<string, NpmLsEntry> | undefined,
  result: Map<string, string>,
): void {
  if (!deps) return;
  for (const [name, info] of Object.entries(deps)) {
    const key = name;
    if (!result.has(key) && info.version) {
      result.set(key, info.version);
    }
    flattenDeps(info.dependencies, result);
  }
}

/**
 * Get the license string for a package from node_modules
 */
function getPackageLicense(
  nodeModulesPath: string,
  pkgName: string,
): { license: string; source: LicenseInfo['source'] } {
  // Try package.json first
  const pkgJsonPath = path.join(nodeModulesPath, pkgName, 'package.json');
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
    if (typeof pkg.license === 'string') {
      return { license: pkg.license, source: 'package.json' };
    }
    if (pkg.license && typeof pkg.license === 'object' && pkg.license.type) {
      return { license: pkg.license.type, source: 'package.json' };
    }
    // Handle "licenses" array (deprecated but still in use)
    if (Array.isArray(pkg.licenses) && pkg.licenses.length > 0) {
      const licStr = pkg.licenses.map((l: { type?: string }) => l.type || 'unknown').join(' OR ');
      return { license: licStr, source: 'package.json' };
    }
  } catch { /* package.json not readable */ }

  // Try LICENSE file
  const licenseFiles = ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENCE', 'COPYING'];
  for (const licFile of licenseFiles) {
    const licPath = path.join(nodeModulesPath, pkgName, licFile);
    try {
      const content = fs.readFileSync(licPath, 'utf-8').slice(0, 2000);
      const detected = detectLicenseFromText(content);
      if (detected) {
        const source = licFile.startsWith('COPYING') ? 'COPYING' as const : 'LICENSE' as const;
        return { license: detected, source };
      }
    } catch { /* file not readable */ }
  }

  return { license: 'unknown', source: 'detected' };
}

/**
 * Detect SPDX license from LICENSE file text
 */
function detectLicenseFromText(text: string): string | null {
  const lower = text.toLowerCase();

  if (/mit license/i.test(text) || /permission is hereby granted, free of charge/i.test(text)) {
    return 'MIT';
  }
  if (/apache license.*version 2/i.test(text)) {
    return 'Apache-2.0';
  }
  if (/bsd 3-clause/i.test(text) || /redistribution and use in source and binary forms/i.test(text)) {
    if (/neither the name/i.test(text)) return 'BSD-3-Clause';
    return 'BSD-2-Clause';
  }
  if (/isc license/i.test(text)) {
    return 'ISC';
  }
  if (/gnu general public license.*version 3/i.test(text) || lower.includes('gpl-3')) {
    return 'GPL-3.0';
  }
  if (/gnu general public license.*version 2/i.test(text) || lower.includes('gpl-2')) {
    return 'GPL-2.0';
  }
  if (/gnu lesser general public/i.test(text) || lower.includes('lgpl')) {
    return 'LGPL-2.1';
  }
  if (/mozilla public license.*2\.0/i.test(text)) {
    return 'MPL-2.0';
  }
  if (/the unlicense/i.test(text)) {
    return 'Unlicense';
  }

  return null;
}

// ============================================================================
// Main Scan Function
// ============================================================================

/**
 * Scan project dependencies for license compliance
 */
export async function scanLicenses(projectRoot: string): Promise<LicenseReport> {
  const resolvedRoot = path.resolve(projectRoot);
  const pkgJsonPath = path.join(resolvedRoot, 'package.json');

  if (!fs.existsSync(pkgJsonPath)) {
    throw new Error(`No package.json found at ${resolvedRoot}. License scanner v1 supports npm projects only.`);
  }

  // Read project license
  let projectLicense = 'unknown';
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
    projectLicense = typeof pkg.license === 'string' ? pkg.license : 'unknown';
  } catch {
    throw new Error('Failed to parse package.json');
  }

  // Get dependency tree via npm ls
  const depMap = new Map<string, string>();
  try {
    const { stdout } = await execFileAsync('npm', ['ls', '--json', '--all', '--long=false'], {
      cwd: resolvedRoot,
      maxBuffer: 10 * 1024 * 1024,
    });
    const tree: NpmLsOutput = JSON.parse(stdout);
    flattenDeps(tree.dependencies, depMap);
  } catch (err) {
    // npm ls often exits with non-zero for peer dep issues; try to parse stdout anyway
    const error = err as { stdout?: string; stderr?: string };
    if (error.stdout) {
      try {
        const tree: NpmLsOutput = JSON.parse(error.stdout);
        flattenDeps(tree.dependencies, depMap);
      } catch {
        // Fallback: just read direct deps from package.json
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
          const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
          for (const [name, version] of Object.entries(allDeps)) {
            depMap.set(name, String(version).replace(/^[\^~>=<]+/, ''));
          }
        } catch { /* give up */ }
      }
    }
  }

  const nodeModulesPath = path.join(resolvedRoot, 'node_modules');
  const dependencies: LicenseInfo[] = [];
  const warnings: string[] = [];

  for (const [pkgName, version] of depMap) {
    const { license, source } = getPackageLicense(nodeModulesPath, pkgName);
    const category = classifyLicense(license);
    const compatible = isCompatible(projectLicense, license);

    dependencies.push({
      package: pkgName,
      version,
      license,
      category,
      compatible,
      source,
    });

    if (!compatible) {
      warnings.push(`INCOMPATIBLE: ${pkgName}@${version} (${license}) is ${category} — not compatible with project license (${projectLicense})`);
    }
    if (category === 'unknown' && license !== 'unknown') {
      warnings.push(`UNKNOWN LICENSE: ${pkgName}@${version} has unrecognized license "${license}" — review manually`);
    }
    if (license === 'unknown') {
      warnings.push(`NO LICENSE: ${pkgName}@${version} — no license information found`);
    }
  }

  // Sort dependencies by category priority (copyleft first, then weak, then unknown)
  const categoryOrder: Record<LicenseCategory, number> = {
    copyleft: 0,
    'weak-copyleft': 1,
    proprietary: 2,
    unknown: 3,
    permissive: 4,
  };
  dependencies.sort((a, b) => categoryOrder[a.category] - categoryOrder[b.category]);

  const summary = {
    permissive: dependencies.filter(d => d.category === 'permissive').length,
    copyleft: dependencies.filter(d => d.category === 'copyleft').length,
    weakCopyleft: dependencies.filter(d => d.category === 'weak-copyleft').length,
    unknown: dependencies.filter(d => d.category === 'unknown').length,
    incompatible: dependencies.filter(d => !d.compatible).length,
  };

  return { projectLicense, dependencies, summary, warnings };
}

// ============================================================================
// Tool Execute Function
// ============================================================================

/**
 * Execute the scan_licenses tool (called from tool handler / registry adapter).
 */
export async function executeScanLicenses(args: {
  project_root: string;
}): Promise<ToolResult> {
  try {
    const report = await scanLicenses(args.project_root);

    const lines: string[] = [];
    lines.push(`# License Compliance Report`);
    lines.push('');
    lines.push(`Project license: **${report.projectLicense}**`);
    lines.push(`Total dependencies scanned: ${report.dependencies.length}`);
    lines.push('');
    lines.push('## Summary');
    lines.push(`- Permissive: ${report.summary.permissive}`);
    lines.push(`- Weak Copyleft: ${report.summary.weakCopyleft}`);
    lines.push(`- Copyleft: ${report.summary.copyleft}`);
    lines.push(`- Unknown: ${report.summary.unknown}`);
    lines.push(`- Incompatible: ${report.summary.incompatible}`);

    if (report.warnings.length > 0) {
      lines.push('');
      lines.push('## Warnings');
      for (const w of report.warnings.slice(0, 30)) {
        lines.push(`- ${w}`);
      }
      if (report.warnings.length > 30) {
        lines.push(`- ... and ${report.warnings.length - 30} more warnings`);
      }
    }

    // Show non-permissive deps
    const nonPermissive = report.dependencies.filter(d => d.category !== 'permissive');
    if (nonPermissive.length > 0) {
      lines.push('');
      lines.push('## Non-Permissive Dependencies');
      for (const d of nonPermissive.slice(0, 30)) {
        const compat = d.compatible ? '' : ' [INCOMPATIBLE]';
        lines.push(`- ${d.package}@${d.version}: ${d.license} (${d.category})${compat}`);
      }
    }

    const status = report.summary.incompatible > 0 ? 'ISSUES FOUND' : 'CLEAN';
    lines.push('');
    lines.push(`**Status: ${status}**`);

    return { success: true, output: lines.join('\n') };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn('scan_licenses failed', { error: message });
    return { success: false, error: message };
  }
}
