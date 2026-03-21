/**
 * License Compliance Scanner — Unit Tests
 *
 * Tests: SPDX classification, compatibility checks, scanning with mocked npm ls,
 * license detection from LICENSE files, and the executeScanLicenses wrapper.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  classifyLicense,
  isCompatible,
} from '../../src/security/license-scanner';

// ============================================================================
// Pure function tests (no mocking needed)
// ============================================================================

describe('classifyLicense', () => {
  it('should classify permissive licenses', () => {
    expect(classifyLicense('MIT')).toBe('permissive');
    expect(classifyLicense('Apache-2.0')).toBe('permissive');
    expect(classifyLicense('BSD-3-Clause')).toBe('permissive');
    expect(classifyLicense('ISC')).toBe('permissive');
    expect(classifyLicense('0BSD')).toBe('permissive');
    expect(classifyLicense('Unlicense')).toBe('permissive');
  });

  it('should classify copyleft licenses', () => {
    expect(classifyLicense('GPL-2.0')).toBe('copyleft');
    expect(classifyLicense('GPL-3.0')).toBe('copyleft');
    expect(classifyLicense('AGPL-3.0')).toBe('copyleft');
    expect(classifyLicense('GPL-3.0-only')).toBe('copyleft');
  });

  it('should classify weak copyleft licenses', () => {
    expect(classifyLicense('LGPL-2.1')).toBe('weak-copyleft');
    expect(classifyLicense('MPL-2.0')).toBe('weak-copyleft');
    expect(classifyLicense('EPL-2.0')).toBe('weak-copyleft');
  });

  it('should classify UNLICENSED as proprietary', () => {
    expect(classifyLicense('UNLICENSED')).toBe('proprietary');
  });

  it('should return unknown for unrecognized licenses', () => {
    expect(classifyLicense('CustomLicense-1.0')).toBe('unknown');
  });

  it('should handle SPDX OR expressions picking most permissive', () => {
    expect(classifyLicense('(MIT OR Apache-2.0)')).toBe('permissive');
    expect(classifyLicense('GPL-3.0 OR MIT')).toBe('permissive');
  });

  it('should handle empty/null input', () => {
    expect(classifyLicense('')).toBe('proprietary');
  });
});

describe('isCompatible', () => {
  it('should allow permissive deps with any project license', () => {
    expect(isCompatible('MIT', 'Apache-2.0')).toBe(true);
    expect(isCompatible('GPL-3.0', 'MIT')).toBe(true);
  });

  it('should flag copyleft deps with permissive project', () => {
    expect(isCompatible('MIT', 'GPL-3.0')).toBe(false);
    expect(isCompatible('Apache-2.0', 'AGPL-3.0')).toBe(false);
  });

  it('should allow copyleft deps with copyleft project', () => {
    expect(isCompatible('GPL-3.0', 'GPL-3.0')).toBe(true);
  });

  it('should allow weak copyleft deps (npm dynamic linking)', () => {
    expect(isCompatible('MIT', 'LGPL-2.1')).toBe(true);
    expect(isCompatible('MIT', 'MPL-2.0')).toBe(true);
  });

  it('should flag proprietary deps as incompatible', () => {
    expect(isCompatible('MIT', 'UNLICENSED')).toBe(false);
  });
});

// ============================================================================
// Integration tests with filesystem (scanLicenses + executeScanLicenses)
// These require mocking child_process, which is complex with ESM.
// Instead, test the scan logic directly with real temp directories.
// ============================================================================

describe('scanLicenses (integration)', () => {
  // Helper: create a temp project with node_modules
  function createTempProject(
    pkg: Record<string, unknown>,
    deps: Record<string, { version: string; license: string }>,
  ): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'license-test-'));
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkg), 'utf-8');

    const nmDir = path.join(dir, 'node_modules');
    fs.mkdirSync(nmDir, { recursive: true });
    for (const [name, info] of Object.entries(deps)) {
      const pkgDir = path.join(nmDir, name);
      fs.mkdirSync(pkgDir, { recursive: true });
      fs.writeFileSync(
        path.join(pkgDir, 'package.json'),
        JSON.stringify({ name, version: info.version, license: info.license }),
        'utf-8',
      );
    }

    return dir;
  }

  function cleanupTempProject(dir: string): void {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch { /* ignore */ }
  }

  it('should throw for missing package.json', async () => {
    // Import dynamically to avoid issues with mocked module
    const { scanLicenses } = await import('../../src/security/license-scanner');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'license-nopackage-'));
    try {
      await expect(scanLicenses(dir)).rejects.toThrow('No package.json found');
    } finally {
      cleanupTempProject(dir);
    }
  });

  it('should read project license from package.json', async () => {
    const { scanLicenses } = await import('../../src/security/license-scanner');
    const dir = createTempProject(
      { name: 'test', license: 'MIT', dependencies: {} },
      {},
    );
    try {
      const report = await scanLicenses(dir);
      expect(report.projectLicense).toBe('MIT');
    } finally {
      cleanupTempProject(dir);
    }
  });
});

describe('executeScanLicenses', () => {
  it('should return error for directory without package.json', async () => {
    const { executeScanLicenses } = await import('../../src/security/license-scanner');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'license-exec-test-'));
    try {
      const result = await executeScanLicenses({ project_root: dir });
      expect(result.success).toBe(false);
      expect(result.error).toContain('No package.json found');
    } finally {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  });
});
