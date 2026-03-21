import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildGitHubInstallCommand, createUpdateCommand } from '../../src/commands/update.js';

// Mock child_process.execSync
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

// Mock logger
vi.mock('../../src/utils/logger.js', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

describe('update --tag / --from-source', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('buildGitHubInstallCommand', () => {
    it('constructs correct command for main branch', () => {
      expect(buildGitHubInstallCommand('main')).toBe(
        'npm install -g github:phuetz/grok-cli#main'
      );
    });

    it('constructs correct command for a version tag', () => {
      expect(buildGitHubInstallCommand('v1.2.3')).toBe(
        'npm install -g github:phuetz/grok-cli#v1.2.3'
      );
    });

    it('constructs correct command for an arbitrary branch', () => {
      expect(buildGitHubInstallCommand('feature/new-thing')).toBe(
        'npm install -g github:phuetz/grok-cli#feature/new-thing'
      );
    });
  });

  describe('--tag option via Commander', () => {
    it('--tag main calls execSync with GitHub install command', async () => {
      const { execSync } = await import('child_process');
      const cmd = createUpdateCommand();
      cmd.exitOverride();

      await cmd.parseAsync(['node', 'test', '--tag', 'main']);

      expect(execSync).toHaveBeenCalledWith(
        'npm install -g github:phuetz/grok-cli#main',
        { stdio: 'inherit' }
      );
    });

    it('--tag v2.0.0 calls execSync with the correct ref', async () => {
      const { execSync } = await import('child_process');
      const cmd = createUpdateCommand();
      cmd.exitOverride();

      await cmd.parseAsync(['node', 'test', '--tag', 'v2.0.0']);

      expect(execSync).toHaveBeenCalledWith(
        'npm install -g github:phuetz/grok-cli#v2.0.0',
        { stdio: 'inherit' }
      );
    });

    it('displays development install warning when --tag is used', async () => {
      const cmd = createUpdateCommand();
      cmd.exitOverride();

      await cmd.parseAsync(['node', 'test', '--tag', 'main']);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Installing from GitHub (development install)')
      );
    });

    it('skips channel switching logic when --tag is provided', async () => {
      // If channel logic ran, it would import UpdateChannelManager.
      // With --tag, it should not be imported at all.
      const cmd = createUpdateCommand();
      cmd.exitOverride();

      // This should succeed without needing UpdateChannelManager
      await cmd.parseAsync(['node', 'test', '--tag', 'main']);

      // Verify no channel-related output
      const allLogCalls = consoleLogSpy.mock.calls.map(c => c.join(' ')).join('\n');
      expect(allLogCalls).not.toContain('Channel:');
      expect(allLogCalls).not.toContain('Latest:');
    });
  });

  describe('--from-source alias', () => {
    it('--from-source maps to --tag main', async () => {
      const { execSync } = await import('child_process');
      const cmd = createUpdateCommand();
      cmd.exitOverride();

      await cmd.parseAsync(['node', 'test', '--from-source']);

      expect(execSync).toHaveBeenCalledWith(
        'npm install -g github:phuetz/grok-cli#main',
        { stdio: 'inherit' }
      );
    });

    it('--from-source displays the development install warning', async () => {
      const cmd = createUpdateCommand();
      cmd.exitOverride();

      await cmd.parseAsync(['node', 'test', '--from-source']);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Installing from GitHub (development install)')
      );
    });

    it('--from-source shows ref as main in output', async () => {
      const cmd = createUpdateCommand();
      cmd.exitOverride();

      await cmd.parseAsync(['node', 'test', '--from-source']);

      const allLogCalls = consoleLogSpy.mock.calls.map(c => c.join(' ')).join('\n');
      expect(allLogCalls).toContain('Ref: main');
    });
  });

  describe('error handling', () => {
    it('calls process.exit(1) on install failure', async () => {
      const { execSync } = await import('child_process');
      (execSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('npm failed');
      });

      const cmd = createUpdateCommand();
      cmd.exitOverride();

      await cmd.parseAsync(['node', 'test', '--tag', 'main']);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('GitHub install failed')
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });
});
