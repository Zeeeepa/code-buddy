/**
 * ADB Transport
 *
 * Executes commands and transfers files to Android devices via ADB.
 * Uses spawn('adb', ...) for all operations.
 */

import { spawn } from 'child_process';
import type {
  DeviceTransport,
  DeviceCapability,
  ExecuteResult,
  ExecuteOptions,
  TransportConfig,
} from './base-transport.js';
import { logger } from '../../utils/logger.js';

export class ADBTransport implements DeviceTransport {
  readonly type = 'adb' as const;
  private connected = false;
  private config: TransportConfig;

  constructor(config: TransportConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    // If address is provided, connect to network device
    if (this.config.address) {
      const target = this.config.port
        ? `${this.config.address}:${this.config.port}`
        : this.config.address;
      const result = await this.adb(['connect', target]);
      if (result.exitCode !== 0 && !result.stdout.includes('connected')) {
        throw new Error(`ADB connect failed: ${result.stderr || result.stdout}`);
      }
    }

    // Verify device is accessible
    const result = await this.adb(['shell', 'echo', 'connected']);
    if (result.exitCode !== 0) {
      throw new Error(`ADB device not accessible: ${result.stderr}`);
    }
    this.connected = true;
    logger.info('ADB transport connected', { device: this.config.deviceId });
  }

  async disconnect(): Promise<void> {
    if (this.config.address) {
      const target = this.config.port
        ? `${this.config.address}:${this.config.port}`
        : this.config.address;
      await this.adb(['disconnect', target]);
    }
    this.connected = false;
    logger.info('ADB transport disconnected', { device: this.config.deviceId });
  }

  async execute(command: string, options?: ExecuteOptions): Promise<ExecuteResult> {
    const args = this.baseArgs();
    const timeout = options?.timeout ?? 30000;

    let fullCommand = command;
    if (options?.cwd) {
      fullCommand = `cd ${options.cwd} && ${command}`;
    }

    args.push('shell', fullCommand);

    return new Promise<ExecuteResult>((resolve) => {
      const proc = spawn('adb', args, { timeout });
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
      proc.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

      proc.on('close', (code) => {
        resolve({ exitCode: code ?? 1, stdout: stdout.trimEnd(), stderr: stderr.trimEnd() });
      });

      proc.on('error', (err) => {
        resolve({ exitCode: 1, stdout: '', stderr: err.message });
      });
    });
  }

  async uploadFile(localPath: string, remotePath: string): Promise<void> {
    const args = this.baseArgs();
    args.push('push', localPath, remotePath);

    const result = await this.adb(args);
    if (result.exitCode !== 0) {
      throw new Error(`ADB push failed: ${result.stderr}`);
    }
  }

  async downloadFile(remotePath: string, localPath: string): Promise<void> {
    const args = this.baseArgs();
    args.push('pull', remotePath, localPath);

    const result = await this.adb(args);
    if (result.exitCode !== 0) {
      throw new Error(`ADB pull failed: ${result.stderr}`);
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  async getCapabilities(): Promise<DeviceCapability[]> {
    return ['system_run', 'file_transfer', 'screenshot', 'screen_record', 'camera', 'location'];
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private baseArgs(): string[] {
    const args: string[] = [];
    if (this.config.deviceId) {
      args.push('-s', this.config.deviceId);
    }
    return args;
  }

  private adb(args: string[]): Promise<ExecuteResult> {
    return new Promise<ExecuteResult>((resolve) => {
      const proc = spawn('adb', args, { timeout: 30000 });
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
      proc.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

      proc.on('close', (code) => {
        resolve({ exitCode: code ?? 1, stdout: stdout.trimEnd(), stderr: stderr.trimEnd() });
      });

      proc.on('error', (err) => {
        resolve({ exitCode: 1, stdout: '', stderr: err.message });
      });
    });
  }
}
