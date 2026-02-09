/**
 * @deprecated Use src/scripting/sync-bindings.ts instead. This file re-exports for backward compatibility.
 */
export {
  createSyncBindings,
  getWorkspaceTracker,
  resetWorkspaceTracker,
  WorkspaceStateTracker,
} from '../scripting/sync-bindings.js';
export type {
  WorkspaceSnapshot,
  FileState,
  SessionContext,
  FileDiff,
  SyncBindingsConfig,
} from '../scripting/sync-bindings.js';
