/**
 * Base Device Transport Interface
 *
 * Defines the contract for device communication transports.
 * Implementations: SSH, ADB, Local.
 */

// ============================================================================
// Types
// ============================================================================

export type DeviceCapability =
  | 'camera'
  | 'screen_record'
  | 'location'
  | 'notifications'
  | 'system_run'
  | 'file_transfer'
  | 'screenshot';

export interface ExecuteResult {
  /** Exit code (0 = success) */
  exitCode: number;
  /** Standard output */
  stdout: string;
  /** Standard error */
  stderr: string;
}

export interface ExecuteOptions {
  /** Timeout in milliseconds */
  timeout?: number;
  /** Working directory on the device */
  cwd?: string;
  /** Environment variables */
  env?: Record<string, string>;
}

export interface TransportConfig {
  /** Device identifier */
  deviceId: string;
  /** Display name */
  name?: string;
  /** Connection address (host, serial, etc.) */
  address?: string;
  /** Connection port */
  port?: number;
  /** Username for authentication */
  username?: string;
  /** Path to SSH key or auth credential */
  keyPath?: string;
}

// ============================================================================
// DeviceTransport Interface
// ============================================================================

export interface DeviceTransport {
  /** Transport type identifier */
  readonly type: 'ssh' | 'adb' | 'local';

  /** Connect to the device */
  connect(): Promise<void>;

  /** Disconnect from the device */
  disconnect(): Promise<void>;

  /** Execute a command on the device */
  execute(command: string, options?: ExecuteOptions): Promise<ExecuteResult>;

  /** Upload a file from local to remote */
  uploadFile(localPath: string, remotePath: string): Promise<void>;

  /** Download a file from remote to local */
  downloadFile(remotePath: string, localPath: string): Promise<void>;

  /** Check if currently connected */
  isConnected(): boolean;

  /** Detect available capabilities on the device */
  getCapabilities(): Promise<DeviceCapability[]>;
}
