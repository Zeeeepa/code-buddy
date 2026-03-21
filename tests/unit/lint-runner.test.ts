/**
 * Unit Tests for Multi-Language Lint Runner
 *
 * Tests cover:
 * - Linter detection (eslint, ruff, clippy, golangci-lint, rubocop, phpstan)
 * - CLI availability checking
 * - Lint execution and output parsing
 * - Fix mode
 * - Result formatting
 */

import { existsSync, readFileSync } from 'fs';
import { spawnSync } from 'child_process';
import {
  createLintRunner,
  formatLintResults,
  formatDetectedLinters,
  type LinterConfig,
  type LintResult,
} from '../../src/tools/lint-runner';

// Mock fs
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}));

// Mock child_process
jest.mock('child_process', () => ({
  spawnSync: jest.fn(),
}));

const mockExistsSync = existsSync as jest.Mock;
const mockReadFileSync = readFileSync as jest.Mock;
const mockSpawnSync = spawnSync as jest.Mock;

describe('LintRunner', () => {
  let runner: ReturnType<typeof createLintRunner>;

  beforeEach(() => {
    jest.clearAllMocks();
    runner = createLintRunner();

    // Default: no files exist, no commands available
    mockExistsSync.mockReturnValue(false);
    mockSpawnSync.mockReturnValue({ status: 1, stdout: '', stderr: '' });
  });

  describe('detect', () => {
    it('should detect eslint from .eslintrc.js', async () => {
      mockExistsSync.mockImplementation((path: string) => {
        return path.endsWith('.eslintrc.js');
      });
      mockSpawnSync.mockReturnValue({ status: 0, stdout: '/usr/bin/eslint\n', stderr: '' });

      const configs = await runner.detect('/project');
      expect(configs.length).toBe(1);
      expect(configs[0].name).toBe('eslint');
      expect(configs[0].available).toBe(true);
      expect(configs[0].detectedVia).toBe('.eslintrc.js');
    });

    it('should detect eslint from eslint.config.mjs', async () => {
      mockExistsSync.mockImplementation((path: string) => {
        return path.endsWith('eslint.config.mjs');
      });

      const configs = await runner.detect('/project');
      expect(configs.length).toBe(1);
      expect(configs[0].name).toBe('eslint');
      expect(configs[0].detectedVia).toBe('eslint.config.mjs');
    });

    it('should detect ruff from ruff.toml', async () => {
      mockExistsSync.mockImplementation((path: string) => {
        return path.endsWith('ruff.toml') && !path.includes('.ruff.toml');
      });

      const configs = await runner.detect('/project');
      expect(configs.length).toBe(1);
      expect(configs[0].name).toBe('ruff');
      expect(configs[0].detectedVia).toBe('ruff.toml');
    });

    it('should detect ruff from pyproject.toml with [tool.ruff]', async () => {
      mockExistsSync.mockImplementation((path: string) => {
        return path.endsWith('pyproject.toml');
      });
      mockReadFileSync.mockReturnValue('[tool.ruff]\nselect = ["E", "F"]');

      const configs = await runner.detect('/project');
      expect(configs.length).toBe(1);
      expect(configs[0].name).toBe('ruff');
      expect(configs[0].detectedVia).toContain('pyproject.toml');
    });

    it('should detect clippy from Cargo.toml', async () => {
      mockExistsSync.mockImplementation((path: string) => {
        return path.endsWith('Cargo.toml');
      });

      const configs = await runner.detect('/project');
      expect(configs.length).toBe(1);
      expect(configs[0].name).toBe('clippy');
      expect(configs[0].command).toBe('cargo');
    });

    it('should detect golangci-lint from go.mod', async () => {
      mockExistsSync.mockImplementation((path: string) => {
        return path.endsWith('go.mod');
      });

      const configs = await runner.detect('/project');
      expect(configs.length).toBe(1);
      expect(configs[0].name).toBe('golangci-lint');
    });

    it('should detect rubocop from .rubocop.yml', async () => {
      mockExistsSync.mockImplementation((path: string) => {
        return path.endsWith('.rubocop.yml');
      });

      const configs = await runner.detect('/project');
      expect(configs.length).toBe(1);
      expect(configs[0].name).toBe('rubocop');
    });

    it('should detect phpstan from phpstan.neon', async () => {
      mockExistsSync.mockImplementation((path: string) => {
        return path.endsWith('phpstan.neon') && !path.includes('.dist');
      });

      const configs = await runner.detect('/project');
      expect(configs.length).toBe(1);
      expect(configs[0].name).toBe('phpstan');
    });

    it('should detect multiple linters in polyglot project', async () => {
      mockExistsSync.mockImplementation((path: string) => {
        return path.endsWith('.eslintrc.json') || path.endsWith('Cargo.toml');
      });

      const configs = await runner.detect('/project');
      expect(configs.length).toBe(2);
      const names = configs.map(c => c.name);
      expect(names).toContain('eslint');
      expect(names).toContain('clippy');
    });

    it('should return empty array when no linters detected', async () => {
      const configs = await runner.detect('/project');
      expect(configs).toEqual([]);
    });

    it('should mark CLI as unavailable when not installed', async () => {
      mockExistsSync.mockImplementation((path: string) => {
        return path.endsWith('go.mod');
      });
      // spawnSync returns non-zero (command not found)
      mockSpawnSync.mockReturnValue({ status: 1, stdout: '', stderr: '' });

      const configs = await runner.detect('/project');
      expect(configs.length).toBe(1);
      expect(configs[0].available).toBe(false);
    });
  });

  describe('run', () => {
    it('should return error for unavailable linter', async () => {
      const config: LinterConfig = {
        name: 'eslint',
        command: 'eslint',
        available: false,
        filePatterns: ['*.js'],
        detectedVia: '.eslintrc.js',
      };

      const result = await runner.run(config);
      expect(result.success).toBe(false);
      expect(result.rawOutput).toContain('not installed');
    });

    it('should run eslint successfully', async () => {
      const config: LinterConfig = {
        name: 'eslint',
        command: 'eslint',
        available: true,
        filePatterns: ['*.js', '*.ts'],
        detectedVia: '.eslintrc.js',
      };

      mockSpawnSync.mockReturnValue({
        status: 0,
        stdout: '',
        stderr: '',
      });

      const result = await runner.run(config);
      expect(result.success).toBe(true);
      expect(result.linter).toBe('eslint');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should parse lint issues from output', async () => {
      const config: LinterConfig = {
        name: 'ruff',
        command: 'ruff',
        available: true,
        filePatterns: ['*.py'],
        detectedVia: 'ruff.toml',
      };

      mockSpawnSync.mockReturnValue({
        status: 1,
        stdout: 'src/main.py:10:5: E501 Line too long\nsrc/utils.py:3:1: F401 Module imported but unused\n',
        stderr: '',
      });

      const result = await runner.run(config);
      expect(result.success).toBe(false);
      expect(result.issueCount).toBe(2);
      expect(result.issues[0].file).toBe('src/main.py');
      expect(result.issues[0].line).toBe(10);
      expect(result.issues[1].file).toBe('src/utils.py');
    });

    it('should run with specific files', async () => {
      const config: LinterConfig = {
        name: 'eslint',
        command: 'eslint',
        available: true,
        filePatterns: ['*.ts'],
        detectedVia: 'eslint.config.js',
      };

      mockSpawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });

      const result = await runner.run(config, ['src/foo.ts', 'src/bar.ts']);
      expect(result.success).toBe(true);
      // Verify spawnSync was called with file args
      const call = mockSpawnSync.mock.calls.find(
        (c: [string, string[]]) => c[1]?.includes('src/foo.ts')
      );
      expect(call).toBeTruthy();
    });
  });

  describe('fix', () => {
    it('should run linter in fix mode', async () => {
      const config: LinterConfig = {
        name: 'ruff',
        command: 'ruff',
        available: true,
        filePatterns: ['*.py'],
        detectedVia: 'ruff.toml',
      };

      mockSpawnSync.mockReturnValue({
        status: 0,
        stdout: 'Fixed 3 issues',
        stderr: '',
      });

      const result = await runner.fix(config);
      expect(result.success).toBe(true);
      expect(result.linter).toBe('ruff');
      // Verify --fix was in the args
      const call = mockSpawnSync.mock.calls[0];
      expect(call[1]).toContain('--fix');
    });

    it('should return error for unavailable linter in fix mode', async () => {
      const config: LinterConfig = {
        name: 'rubocop',
        command: 'rubocop',
        available: false,
        filePatterns: ['*.rb'],
        detectedVia: '.rubocop.yml',
      };

      const result = await runner.fix(config);
      expect(result.success).toBe(false);
      expect(result.rawOutput).toContain('not installed');
    });
  });

  describe('formatLintResults', () => {
    it('should format empty results', () => {
      const output = formatLintResults([]);
      expect(output).toContain('No linters detected');
    });

    it('should format successful results', () => {
      const results: LintResult[] = [
        {
          linter: 'eslint',
          success: true,
          issueCount: 0,
          issues: [],
          fixedCount: 0,
          rawOutput: '',
          duration: 150,
        },
      ];

      const output = formatLintResults(results);
      expect(output).toContain('[PASS]');
      expect(output).toContain('eslint');
      expect(output).toContain('No issues found');
    });

    it('should format results with issues', () => {
      const results: LintResult[] = [
        {
          linter: 'ruff',
          success: false,
          issueCount: 2,
          issues: [
            { file: 'main.py', line: 10, column: 1, severity: 'error', message: 'Syntax error', rule: 'E999' },
            { file: 'utils.py', line: 5, column: 1, severity: 'warning', message: 'Unused import', rule: 'F401' },
          ],
          fixedCount: 0,
          rawOutput: '',
          duration: 200,
        },
      ];

      const output = formatLintResults(results);
      expect(output).toContain('[FAIL]');
      expect(output).toContain('ruff');
      expect(output).toContain('1 error(s)');
      expect(output).toContain('1 warning(s)');
      expect(output).toContain('Syntax error');
    });
  });

  describe('formatDetectedLinters', () => {
    it('should format detected linters', () => {
      const configs: LinterConfig[] = [
        {
          name: 'eslint',
          command: 'eslint',
          available: true,
          filePatterns: ['*.js', '*.ts'],
          detectedVia: '.eslintrc.js',
        },
        {
          name: 'ruff',
          command: 'ruff',
          available: false,
          filePatterns: ['*.py'],
          detectedVia: 'ruff.toml',
        },
      ];

      const output = formatDetectedLinters(configs);
      expect(output).toContain('eslint');
      expect(output).toContain('installed');
      expect(output).toContain('ruff');
      expect(output).toContain('NOT installed');
    });

    it('should handle empty configs', () => {
      const output = formatDetectedLinters([]);
      expect(output).toContain('No linters detected');
    });
  });
});
