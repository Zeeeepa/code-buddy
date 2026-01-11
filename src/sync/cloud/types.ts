/**
 * Cloud Sync Types
 *
 * Type definitions for cloud synchronization and backup.
 */

// ============================================================================
// Cloud Provider Types
// ============================================================================

export type CloudProvider = 's3' | 'gcs' | 'azure' | 'local';

export interface CloudConfig {
  /** Cloud provider */
  provider: CloudProvider;
  /** Bucket or container name */
  bucket: string;
  /** Region (for AWS S3) */
  region?: string;
  /** Credentials */
  credentials?: {
    accessKeyId?: string;
    secretAccessKey?: string;
    accountName?: string;
    accountKey?: string;
    connectionString?: string;
  };
  /** Encryption key for client-side encryption */
  encryptionKey?: string;
  /** Custom endpoint (for S3-compatible storage) */
  endpoint?: string;
  /** Path prefix for all objects */
  prefix?: string;
}

// ============================================================================
// Sync Types
// ============================================================================

export type SyncStatus =
  | 'idle'
  | 'syncing'
  | 'downloading'
  | 'uploading'
  | 'resolving_conflicts'
  | 'error';

export type SyncDirection = 'push' | 'pull' | 'bidirectional';

export type ConflictResolution = 'local' | 'remote' | 'newest' | 'manual';

export interface SyncConfig {
  /** Enable automatic sync */
  autoSync: boolean;
  /** Sync interval in ms */
  syncInterval: number;
  /** Sync direction */
  direction: SyncDirection;
  /** Conflict resolution strategy */
  conflictResolution: ConflictResolution;
  /** Items to sync */
  items: SyncItem[];
  /** Exclude patterns */
  excludePatterns?: string[];
  /** Compression */
  compression: boolean;
  /** Encryption */
  encryption: boolean;
}

export interface SyncItem {
  /** Item type */
  type: 'sessions' | 'memory' | 'settings' | 'checkpoints' | 'custom';
  /** Local path */
  localPath: string;
  /** Remote path */
  remotePath: string;
  /** Enabled */
  enabled: boolean;
  /** Last sync time */
  lastSync?: Date;
  /** Priority */
  priority?: number;
}

// ============================================================================
// Sync State Types
// ============================================================================

export interface SyncState {
  /** Current status */
  status: SyncStatus;
  /** Last successful sync */
  lastSync?: Date;
  /** Last error */
  lastError?: string;
  /** Items being synced */
  currentItems?: string[];
  /** Progress (0-100) */
  progress?: number;
  /** Bytes transferred */
  bytesTransferred?: number;
  /** Total bytes */
  totalBytes?: number;
}

export interface SyncResult {
  /** Success */
  success: boolean;
  /** Items synced */
  itemsSynced: number;
  /** Bytes uploaded */
  bytesUploaded: number;
  /** Bytes downloaded */
  bytesDownloaded: number;
  /** Conflicts found */
  conflicts: SyncConflict[];
  /** Errors */
  errors: SyncError[];
  /** Duration in ms */
  duration: number;
  /** Timestamp */
  timestamp: Date;
}

export interface SyncConflict {
  /** Item path */
  path: string;
  /** Local version */
  local: {
    version: string;
    modifiedAt: Date;
    size: number;
  };
  /** Remote version */
  remote: {
    version: string;
    modifiedAt: Date;
    size: number;
  };
  /** Resolution */
  resolution?: 'local' | 'remote' | 'merged';
  /** Resolved data */
  resolvedData?: unknown;
}

export interface SyncError {
  /** Item path */
  path: string;
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Retryable */
  retryable: boolean;
}

// ============================================================================
// Backup Types
// ============================================================================

export interface BackupConfig {
  /** Enable automatic backups */
  autoBackup: boolean;
  /** Backup interval in ms */
  backupInterval: number;
  /** Maximum backups to keep */
  maxBackups: number;
  /** Items to backup */
  items: string[];
  /** Compression level (0-9) */
  compressionLevel: number;
  /** Split large backups */
  splitSize?: number;
}

export interface BackupManifest {
  /** Backup ID */
  id: string;
  /** Creation time */
  createdAt: Date;
  /** Version */
  version: string;
  /** Items included */
  items: BackupItem[];
  /** Total size (uncompressed) */
  totalSize: number;
  /** Compressed size */
  compressedSize: number;
  /** Checksum */
  checksum: string;
  /** Encrypted */
  encrypted: boolean;
  /** Split into parts */
  parts?: number;
}

export interface BackupItem {
  /** Item path */
  path: string;
  /** Item type */
  type: string;
  /** Size */
  size: number;
  /** Checksum */
  checksum: string;
  /** Offset in archive */
  offset: number;
}

export interface BackupListEntry {
  /** Backup ID */
  id: string;
  /** Creation time */
  createdAt: Date;
  /** Size */
  size: number;
  /** Items count */
  itemCount: number;
  /** Description */
  description?: string;
}

// ============================================================================
// Version Types
// ============================================================================

export interface VersionInfo {
  /** Version ID */
  id: string;
  /** Item path */
  path: string;
  /** Timestamp */
  timestamp: Date;
  /** Size */
  size: number;
  /** Checksum */
  checksum: string;
  /** Author (device/user) */
  author?: string;
  /** Parent version */
  parent?: string;
}

export interface VersionHistory {
  /** Item path */
  path: string;
  /** Current version */
  current: string;
  /** Version list */
  versions: VersionInfo[];
}

// ============================================================================
// Event Types
// ============================================================================

export type SyncEvent =
  | { type: 'sync_started'; direction: SyncDirection }
  | { type: 'sync_completed'; result: SyncResult }
  | { type: 'sync_failed'; error: string }
  | { type: 'sync_progress'; progress: number; item?: string }
  | { type: 'conflict_detected'; conflict: SyncConflict }
  | { type: 'conflict_resolved'; conflict: SyncConflict }
  | { type: 'backup_created'; backup: BackupManifest }
  | { type: 'backup_restored'; backup: BackupManifest }
  | { type: 'item_uploaded'; path: string; size: number }
  | { type: 'item_downloaded'; path: string; size: number };

export type SyncEventHandler = (event: SyncEvent) => void;
