/**
 * Local Transport
 *
 * Executes commands directly on the local machine via child_process.
 * No file transfer needed — the local filesystem is directly accessible.
 */

import { spawn } from 'child_process';
import * as os from 'os';
import type {
  DeviceTransport,
  DeviceCapability,
  ExecuteResult,
  ExecuteOptions,
} from './base-transport.js';
import { logger } from '../../utils/logger.js';

export class LocalTransport implements DeviceTransport {
  readonly type = 'local' as const;
  private connected = false;

  async connect(): Promise<void> {
    this.connected = true;
    logger.info('Local transport connected');
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    logger.info('Local transport disconnected');
  }

  async execute(command: string, options?: ExecuteOptions): Promise<ExecuteResult> {
    const timeout = options?.timeout ?? 30000;
    const shell = process.platform === 'win32' ? 'cmd' : '/bin/sh';
    const shellArgs = process.platform === 'win32' ? ['/c', command] : ['-c', command];

    return new Promise<ExecuteResult>((resolve) => {
      const proc = spawn(shell, shellArgs, {
        timeout,
        cwd: options?.cwd,
        env: options?.env ? { ...process.env, ...options.env } : undefined,
      });
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

  async uploadFile(_localPath: string, _remotePath: string): Promise<void> {
    // Local transport: no-op, files are already local
    logger.debug('Local transport uploadFile: no-op (files are local)');
  }

  async downloadFile(_remotePath: string, _localPath: string): Promise<void> {
    // Local transport: no-op, files are already local
    logger.debug('Local transport downloadFile: no-op (files are local)');
  }

  isConnected(): boolean {
    return this.connected;
  }

  async getCapabilities(): Promise<DeviceCapability[]> {
    const caps: DeviceCapability[] = ['system_run'];
    const platform = os.platform();

    if (platform === 'darwin') {
      caps.push('screenshot', 'camera', 'screen_record');
    } else if (platform === 'linux') {
      // Check for screenshot tools
      const scrot = await this.execute('which scrot 2>/dev/null || which gnome-screenshot 2>/dev/null');
      if (scrot.exitCode === 0) caps.push('screenshot');
      const ffmpeg = await this.execute('which ffmpeg 2>/dev/null');
      if (ffmpeg.exitCode === 0) caps.push('camera', 'screen_record');
    }

    return caps;
  }
}
