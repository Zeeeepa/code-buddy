/**
 * Unit tests for Coverage Target Configuration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { vi } from 'vitest';
import {
  compareCoverage,
  formatCoverageComparison,
} from '../../src/testing/coverage-targets';
import type { CoverageTarget } from '../../src/testing/coverage-targets';

// Mock fs/promises to control file reads
vi.mock('fs/promises', () => ({
  readFile: vi.fn().mockRejectedValue(new Error('ENOENT')),
}));

describe('Coverage Targets', () => {
  it('should compare coverage - all met', () => {
    const current: CoverageTarget = { lines: 90, functions: 85, branches: 75, statements: 92 };
    const target: CoverageTarget = { lines: 80, functions: 70, branches: 60, statements: 80 };

    const result = compareCoverage(current, target);

    expect(result.met).toBe(true);
    expect(result.gaps).toHaveLength(0);
  });

  it('should compare coverage - gaps detected', () => {
    const current: CoverageTarget = { lines: 70, functions: 65, branches: 50, statements: 75 };
    const target: CoverageTarget = { lines: 80, functions: 70, branches: 60, statements: 80 };

    const result = compareCoverage(current, target);

    expect(result.met).toBe(false);
    expect(result.gaps).toHaveLength(4);
    expect(result.gaps[0]).toContain('Lines');
    expect(result.gaps[0]).toContain('70.0%');
    expect(result.gaps[0]).toContain('80%');
  });

  it('should handle partial coverage data', () => {
    const current: CoverageTarget = { lines: 90 };
    const target: CoverageTarget = { lines: 80, functions: 70 };

    const result = compareCoverage(current, target);

    expect(result.met).toBe(true); // functions not compared since current has no data
    expect(result.gaps).toHaveLength(0);
  });

  it('should format coverage comparison - all passing', () => {
    const current: CoverageTarget = { lines: 90, functions: 85, branches: 75, statements: 92 };
    const target: CoverageTarget = { lines: 80, functions: 70, branches: 60, statements: 80 };

    const formatted = formatCoverageComparison(current, target);

    expect(formatted).toContain('Coverage Report');
    expect(formatted).toContain('[PASS]');
    expect(formatted).toContain('All coverage targets met');
    expect(formatted).not.toContain('[FAIL]');
  });

  it('should format coverage comparison - with failures', () => {
    const current: CoverageTarget = { lines: 70, functions: 85, branches: 50, statements: 92 };
    const target: CoverageTarget = { lines: 80, functions: 70, branches: 60, statements: 80 };

    const formatted = formatCoverageComparison(current, target);

    expect(formatted).toContain('[FAIL]');
    expect(formatted).toContain('[PASS]');
    expect(formatted).toContain('target(s) not met');
  });

  it('should handle undefined metrics in comparison', () => {
    const current: CoverageTarget = {};
    const target: CoverageTarget = { lines: 80 };

    const result = compareCoverage(current, target);

    expect(result.met).toBe(true); // No current data to fail on
    expect(result.gaps).toHaveLength(0);
  });
});
