/**
 * TestRunnerBridge — Claude Cowork parity Phase 3 step 12
 *
 * Wraps the core `AutoTestManager` to drive test runs from the Cowork
 * renderer. Detects the project test framework on construction, exposes
 * `run()` / `runFiles()` / `runFailing()` methods, and streams test
 * progress events so the `TestRunnerPanel` can show live results.
 *
 * Core integration is lazy: when the core module is unavailable the
 * bridge falls back to a minimal spawn-based runner that supports
 * `npm test` / `pnpm test` / `yarn test` detection for Node projects.
 *
 * @module main/testing/test-runner-bridge
 */

import { EventEmitter } from 'events';
import { spawn, type ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import { log, logWarn } from '../utils/logger';
import { loadCoreModule } from '../utils/core-loader';

export interface TestCase {
  name: string;
  suite: string;
  file?: string;
  status: 'passed' | 'failed' | 'skipped' | 'pending';
  duration: number;
  error?: string;
  stack?: string;
}

export interface TestResult {
  success: boolean;
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  duration: number;
  framework: string;
  tests: TestCase[];
}

export interface TestRunnerState {
  framework: string | null;
  lastResult: TestResult | null;
  isRunning: boolean;
}

interface CoreAutoTestManagerLike extends EventEmitter {
  runAllTests(): Promise<TestResult>;
  runTestFiles(files: string[]): Promise<TestResult>;
  getLastResults?(): TestResult | null;
  refresh?(): void;
}

interface CoreAutoTestModule {
  getAutoTestManager: (
    workingDirectory?: string,
    config?: Record<string, unknown>
  ) => CoreAutoTestManagerLike;
  initializeAutoTest: (
    workingDirectory: string,
    config?: Record<string, unknown>
  ) => CoreAutoTestManagerLike;
}

let cachedCoreModule: CoreAutoTestModule | null = null;

async function loadCoreAutoTest(): Promise<CoreAutoTestModule | null> {
  if (cachedCoreModule) return cachedCoreModule;
  const mod = await loadCoreModule<CoreAutoTestModule>('testing/auto-test.js');
  if (mod) {
    cachedCoreModule = mod;
    log('[TestRunnerBridge] Core auto-test loaded');
  }
  return mod;
}

interface PackageJsonLike {
  name?: string;
  scripts?: Record<string, string>;
  devDependencies?: Record<string, string>;
  dependencies?: Record<string, string>;
}

function readPackageJson(cwd: string): PackageJsonLike | null {
  const pkgPath = path.join(cwd, 'package.json');
  try {
    const raw = fs.readFileSync(pkgPath, 'utf-8');
    return JSON.parse(raw) as PackageJsonLike;
  } catch {
    return null;
  }
}

function detectFallbackFramework(cwd: string): { framework: string; command: string; args: string[] } | null {
  const pkg = readPackageJson(cwd);
  if (!pkg) return null;
  const deps = { ...(pkg.devDependencies ?? {}), ...(pkg.dependencies ?? {}) };
  if ('vitest' in deps) {
    return { framework: 'Vitest', command: 'npx', args: ['vitest', 'run', '--reporter=verbose'] };
  }
  if ('jest' in deps) {
    return { framework: 'Jest', command: 'npx', args: ['jest', '--passWithNoTests'] };
  }
  if ('mocha' in deps) {
    return { framework: 'Mocha', command: 'npx', args: ['mocha'] };
  }
  if (pkg.scripts?.test) {
    return { framework: 'npm test', command: 'npm', args: ['test', '--silent'] };
  }
  return null;
}

export class TestRunnerBridge extends EventEmitter {
  private workspaceDir: string | null = null;
  private framework: string | null = null;
  private lastResult: TestResult | null = null;
  private activeProcess: ChildProcess | null = null;
  private coreManager: CoreAutoTestManagerLike | null = null;

  setWorkspace(dir: string | null): void {
    if (dir === this.workspaceDir) return;
    this.workspaceDir = dir;
    this.framework = null;
    this.coreManager = null;
    if (dir) {
      void this.detectFramework();
    }
  }

  getState(): TestRunnerState {
    return {
      framework: this.framework,
      lastResult: this.lastResult,
      isRunning: this.activeProcess !== null,
    };
  }

  async detectFramework(): Promise<string | null> {
    if (!this.workspaceDir) return null;
    try {
      const core = await loadCoreAutoTest();
      if (core) {
        const manager = core.initializeAutoTest(this.workspaceDir);
        this.coreManager = manager;
        manager.on('framework:detected', (name: string) => {
          this.framework = name;
          this.emit('test.framework', { framework: name });
        });
        // Core calls detectFramework synchronously in constructor, so framework may already be set
        const state = (manager as unknown as { detectedFramework?: { name: string } }).detectedFramework;
        if (state?.name) {
          this.framework = state.name;
          this.emit('test.framework', { framework: state.name });
          return state.name;
        }
      }
    } catch (err) {
      logWarn('[TestRunnerBridge] core load failed:', err);
    }

    // Fallback: inspect package.json directly
    const fb = detectFallbackFramework(this.workspaceDir);
    if (fb) {
      this.framework = fb.framework;
      this.emit('test.framework', { framework: fb.framework });
      return fb.framework;
    }
    return null;
  }

  private async runWithCore(files: string[]): Promise<TestResult | null> {
    if (!this.coreManager) return null;
    try {
      this.emit('test.start', { files });
      const result = files.length === 0
        ? await this.coreManager.runAllTests()
        : await this.coreManager.runTestFiles(files);
      this.lastResult = result;
      this.emit('test.complete', result);
      return result;
    } catch (err) {
      logWarn('[TestRunnerBridge] core run failed:', err);
      return null;
    }
  }

  private runWithFallback(files: string[]): Promise<TestResult> {
    return new Promise((resolve) => {
      if (!this.workspaceDir) {
        resolve({
          success: false,
          passed: 0,
          failed: 0,
          skipped: 0,
          total: 0,
          duration: 0,
          framework: 'none',
          tests: [],
        });
        return;
      }
      const fb = detectFallbackFramework(this.workspaceDir);
      if (!fb) {
        resolve({
          success: false,
          passed: 0,
          failed: 0,
          skipped: 0,
          total: 0,
          duration: 0,
          framework: 'none',
          tests: [],
        });
        return;
      }
      this.framework = fb.framework;
      const startTime = Date.now();
      const args = files.length > 0 ? [...fb.args, ...files] : fb.args;
      this.emit('test.start', { files, framework: fb.framework });

      let stdout = '';
      let stderr = '';
      const child = spawn(fb.command, args, {
        cwd: this.workspaceDir,
        shell: true,
      });
      this.activeProcess = child;

      child.stdout?.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        stdout += text;
        this.emit('test.output', { stream: 'stdout', text });
      });
      child.stderr?.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        stderr += text;
        this.emit('test.output', { stream: 'stderr', text });
      });
      child.on('error', (err) => {
        this.activeProcess = null;
        const result: TestResult = {
          success: false,
          passed: 0,
          failed: 1,
          skipped: 0,
          total: 1,
          duration: Date.now() - startTime,
          framework: fb.framework,
          tests: [
            {
              name: 'Test runner error',
              suite: '',
              status: 'failed',
              duration: 0,
              error: err.message,
            },
          ],
        };
        this.lastResult = result;
        this.emit('test.complete', result);
        resolve(result);
      });
      child.on('close', (code) => {
        this.activeProcess = null;
        const duration = Date.now() - startTime;
        const output = stdout + stderr;
        const passedMatch = output.match(/(\d+)\s+pass(?:ed|ing)?/i);
        const failedMatch = output.match(/(\d+)\s+fail(?:ed|ing)?/i);
        const skippedMatch = output.match(/(\d+)\s+skip(?:ped)?/i);
        const passed = passedMatch ? Number(passedMatch[1]) : code === 0 ? 1 : 0;
        const failed = failedMatch ? Number(failedMatch[1]) : code === 0 ? 0 : 1;
        const skipped = skippedMatch ? Number(skippedMatch[1]) : 0;
        const total = passed + failed + skipped;
        const result: TestResult = {
          success: code === 0,
          passed,
          failed,
          skipped,
          total,
          duration,
          framework: fb.framework,
          tests: [],
        };
        this.lastResult = result;
        this.emit('test.complete', result);
        resolve(result);
      });
    });
  }

  async run(files: string[] = []): Promise<TestResult> {
    if (this.activeProcess) {
      return this.lastResult ?? {
        success: false,
        passed: 0,
        failed: 0,
        skipped: 0,
        total: 0,
        duration: 0,
        framework: 'none',
        tests: [],
      };
    }
    if (!this.coreManager) {
      await this.detectFramework();
    }
    const coreResult = await this.runWithCore(files);
    if (coreResult) return coreResult;
    return this.runWithFallback(files);
  }

  async runFailing(): Promise<TestResult> {
    const last = this.lastResult;
    if (!last || last.tests.length === 0) {
      return this.run();
    }
    const failingFiles = Array.from(
      new Set(
        last.tests.filter((t) => t.status === 'failed' && t.file).map((t) => t.file as string)
      )
    );
    return this.run(failingFiles);
  }

  cancel(): void {
    if (this.activeProcess) {
      try {
        this.activeProcess.kill('SIGTERM');
      } catch {
        /* ignore */
      }
      this.activeProcess = null;
      this.emit('test.cancelled', null);
    }
  }
}

let singleton: TestRunnerBridge | null = null;

export function getTestRunnerBridge(): TestRunnerBridge {
  if (!singleton) {
    singleton = new TestRunnerBridge();
  }
  return singleton;
}
