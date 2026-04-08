/**
 * SessionBranchingBridge — Claude Cowork parity Phase 2
 *
 * Wraps Code Buddy's ConversationBranchManager so Cowork can fork, switch,
 * and merge conversation branches from the UI. Branches are stored per
 * session in `~/.codebuddy/branches/<sessionId>/`.
 *
 * @module main/session/session-branching
 */

import { log, logWarn } from '../utils/logger';
import { loadCoreModule } from '../utils/core-loader';

export interface BranchSummary {
  id: string;
  name: string;
  parentId?: string;
  parentMessageIndex?: number;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  isCurrent: boolean;
}

export interface BranchTreeNode {
  branch: BranchSummary;
  children: BranchTreeNode[];
}

type CoreBranchManagerCtor = new (sessionId?: string) => {
  createBranch: (
    name: string,
    fromBranchId?: string,
    atMessageIndex?: number
  ) => CoreBranch;
  fork: (name: string) => CoreBranch;
  forkFromMessage: (name: string, messageIndex: number) => CoreBranch;
  checkout: (branchId: string) => CoreBranch | null;
  getCurrentBranch: () => CoreBranch;
  getCurrentBranchId: () => string;
  merge: (sourceBranchId: string, strategy?: 'append' | 'replace') => boolean;
  deleteBranch: (branchId: string) => boolean;
  renameBranch: (branchId: string, newName: string) => boolean;
  getAllBranches: () => CoreBranch[];
};

type CoreBranch = {
  id: string;
  name: string;
  parentId?: string;
  parentMessageIndex?: number;
  messages: unknown[];
  createdAt: Date | string;
  updatedAt: Date | string;
};

type CoreBranchModule = {
  ConversationBranchManager: CoreBranchManagerCtor;
};

let cachedModule: CoreBranchModule | null = null;
const managers = new Map<string, InstanceType<CoreBranchManagerCtor>>();

async function loadBranchModule(): Promise<CoreBranchModule | null> {
  if (cachedModule) return cachedModule;
  const mod = await loadCoreModule<CoreBranchModule>(
    'persistence/conversation-branches.js'
  );
  if (mod) {
    cachedModule = mod;
    log('[SessionBranchingBridge] Core branch manager loaded');
  } else {
    logWarn('[SessionBranchingBridge] Core branch manager unavailable');
  }
  return mod;
}

async function getManager(
  sessionId: string
): Promise<InstanceType<CoreBranchManagerCtor> | null> {
  const cached = managers.get(sessionId);
  if (cached) return cached;

  const mod = await loadBranchModule();
  if (!mod) return null;
  try {
    const mgr = new mod.ConversationBranchManager(sessionId);
    managers.set(sessionId, mgr);
    return mgr;
  } catch (err) {
    logWarn('[SessionBranchingBridge] manager init failed:', err);
    return null;
  }
}

function toSummary(
  branch: CoreBranch,
  currentId: string,
  messageCount: number
): BranchSummary {
  const createdAt =
    branch.createdAt instanceof Date
      ? branch.createdAt.getTime()
      : new Date(branch.createdAt).getTime();
  const updatedAt =
    branch.updatedAt instanceof Date
      ? branch.updatedAt.getTime()
      : new Date(branch.updatedAt).getTime();
  return {
    id: branch.id,
    name: branch.name,
    parentId: branch.parentId,
    parentMessageIndex: branch.parentMessageIndex,
    createdAt,
    updatedAt,
    messageCount,
    isCurrent: branch.id === currentId,
  };
}

export class SessionBranchingBridge {
  async listBranches(sessionId: string): Promise<BranchSummary[]> {
    const mgr = await getManager(sessionId);
    if (!mgr) return [];
    try {
      const currentId = mgr.getCurrentBranchId();
      return mgr
        .getAllBranches()
        .map((b) => toSummary(b, currentId, b.messages.length));
    } catch (err) {
      logWarn('[SessionBranchingBridge] listBranches failed:', err);
      return [];
    }
  }

  async fork(
    sessionId: string,
    name: string,
    fromMessageIndex?: number
  ): Promise<{ success: boolean; branch?: BranchSummary; error?: string }> {
    const mgr = await getManager(sessionId);
    if (!mgr) {
      return { success: false, error: 'Branch manager unavailable' };
    }
    try {
      const branch =
        typeof fromMessageIndex === 'number'
          ? mgr.forkFromMessage(name, fromMessageIndex)
          : mgr.fork(name);
      const currentId = mgr.getCurrentBranchId();
      return {
        success: true,
        branch: toSummary(branch, currentId, branch.messages.length),
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async checkout(
    sessionId: string,
    branchId: string
  ): Promise<{ success: boolean; error?: string }> {
    const mgr = await getManager(sessionId);
    if (!mgr) {
      return { success: false, error: 'Branch manager unavailable' };
    }
    try {
      const result = mgr.checkout(branchId);
      if (!result) {
        return { success: false, error: 'Branch not found' };
      }
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async mergeBranch(
    sessionId: string,
    sourceBranchId: string,
    strategy: 'append' | 'replace' = 'append'
  ): Promise<{ success: boolean; error?: string }> {
    const mgr = await getManager(sessionId);
    if (!mgr) {
      return { success: false, error: 'Branch manager unavailable' };
    }
    try {
      const ok = mgr.merge(sourceBranchId, strategy);
      return ok ? { success: true } : { success: false, error: 'Merge failed' };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async deleteBranch(
    sessionId: string,
    branchId: string
  ): Promise<{ success: boolean; error?: string }> {
    const mgr = await getManager(sessionId);
    if (!mgr) {
      return { success: false, error: 'Branch manager unavailable' };
    }
    try {
      const ok = mgr.deleteBranch(branchId);
      return ok ? { success: true } : { success: false, error: 'Delete failed' };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async renameBranch(
    sessionId: string,
    branchId: string,
    newName: string
  ): Promise<{ success: boolean; error?: string }> {
    const mgr = await getManager(sessionId);
    if (!mgr) {
      return { success: false, error: 'Branch manager unavailable' };
    }
    try {
      const ok = mgr.renameBranch(branchId, newName);
      return ok ? { success: true } : { success: false, error: 'Rename failed' };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
