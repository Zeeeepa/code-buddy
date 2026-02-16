/**
 * SSH Transport
 *
 * Executes commands and transfers files to remote devices via SSH/SCP.
 * Uses spawn('ssh', ...) and spawn('scp', ...) for operations.
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

export class SSHTransport implements DeviceTransport {
  readonly type = 'ssh' as const;
  private connected = false;
  private config: TransportConfig;

  constructor(config: TransportConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    // Test connection with a simple command
    const result = await this.execute('echo connected');
    if (result.exitCode !== 0) {
      throw new Error(`SSH connection failed: ${result.stderr}`);
    }
    this.connected = true;
    logger.info('SSH transport connected', { device: this.config.deviceId });
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    logger.info('SSH transport disconnected', { device: this.config.deviceId });
  }

  async execute(command: string, options?: ExecuteOptions): Promise<ExecuteResult> {
    const sshArgs = this.buildSSHArgs();
    const timeout = options?.timeout ?? 30000;

    if (options?.cwd) {
      command = `cd ${this.shellEscape(options.cwd)} && ${command}`;
    }

    if (options?.env) {
      const envPrefix = Object.entries(options.env)
        .map(([k, v]) => `${k}=${this.shellEscape(v)}`)
        .join(' ');
      command = `${envPrefix} ${command}`;
    }

    sshArgs.push(command);

    return new Promise<ExecuteResult>((resolve) => {
      const proc = spawn('ssh', sshArgs, { timeout });
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
    const scpArgs = this.buildSCPArgs();
    const target = `${this.getHostSpec()}:${remotePath}`;
    scpArgs.push(localPath, target);

    const result = await this.spawnAndWait('scp', scpArgs);
    if (result.exitCode !== 0) {
      throw new Error(`SCP upload failed: ${result.stderr}`);
    }
  }

  async downloadFile(remotePath: string, localPath: string): Promise<void> {
    const scpArgs = this.buildSCPArgs();
    const source = `${this.getHostSpec()}:${remotePath}`;
    scpArgs.push(source, localPath);

    const result = await this.spawnAndWait('scp', scpArgs);
    if (result.exitCode !== 0) {
      throw new Error(`SCP download failed: ${result.stderr}`);
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  async getCapabilities(): Promise<DeviceCapability[]> {
    const caps: DeviceCapability[] = ['system_run', 'file_transfer'];

    // Detect platform
    const uname = await this.execute('uname -s');
    const platform = uname.stdout.trim().toLowerCase();

    if (platform === 'darwin') {
      caps.push('camera', 'screenshot', 'screen_record');
    } else if (platform === 'linux') {
      // Check for screenshot tools
      const scrot = await this.execute('which scrot 2>/dev/null || which gnome-screenshot 2>/dev/null');
      if (scrot.exitCode === 0) caps.push('screenshot');
      // Check for ffmpeg (camera/screen recording)
      const ffmpeg = await this.execute('which ffmpeg 2>/dev/null');
      if (ffmpeg.exitCode === 0) caps.push('camera', 'screen_record');
    }

    return caps;
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private buildSSHArgs(): string[] {
    const args: string[] = ['-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=accept-new'];
    if (this.config.keyPath) {
      args.push('-i', this.config.keyPath);
    }
    if (this.config.port) {
      args.push('-p', String(this.config.port));
    }
    args.push(this.getHostSpec());
    return args;
  }

  private buildSCPArgs(): string[] {
    const args: string[] = ['-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=accept-new'];
    if (this.config.keyPath) {
      args.push('-i', this.config.keyPath);
    }
    if (this.config.port) {
      args.push('-P', String(this.config.port));
    }
    return args;
  }

  private getHostSpec(): string {
    const user = this.config.username || '';
    const host = this.config.address || 'localhost';
    return user ? `${user}@${host}` : host;
  }

  private shellEscape(str: string): string {
    return `'${str.replace(/'/g, "'\\''")}'`;
  }

  private spawnAndWait(cmd: string, args: string[]): Promise<ExecuteResult> {
    return new Promise<ExecuteResult>((resolve) => {
      const proc = spawn(cmd, args, { timeout: 60000 });
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
