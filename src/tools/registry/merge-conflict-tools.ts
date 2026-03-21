/**
 * Merge Conflict Tool Adapter
 *
 * ITool-compliant adapter for the resolve_conflicts tool.
 * Wraps the merge conflict resolver for use with the FormalToolRegistry.
 */

import type { ToolResult } from '../../types/index.js';
import type { ITool, ToolSchema, IToolMetadata, IValidationResult, ToolCategoryType } from './types.js';
import { executeResolveConflicts } from '../merge-conflict-tool.js';

/**
 * ResolveConflictsExecuteTool - ITool adapter for git merge conflict resolution
 */
export class ResolveConflictsExecuteTool implements ITool {
  readonly name = 'resolve_conflicts';
  readonly description = 'Detect and resolve Git merge conflicts. Scans for conflicted files, shows conflict details, or auto-resolves using strategies (ours, theirs, both, ai).';

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    return await executeResolveConflicts({
      file_path: input.file_path as string | undefined,
      strategy: input.strategy as 'ours' | 'theirs' | 'both' | 'ai' | undefined,
      scan_only: input.scan_only as boolean | undefined,
    });
  }

  getSchema(): ToolSchema {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {
          file_path: {
            type: 'string',
            description: 'Path to the file with merge conflicts (omit to scan all files)',
          },
          strategy: {
            type: 'string',
            description: 'Resolution strategy: ours, theirs, both, or ai',
          },
          scan_only: {
            type: 'boolean',
            description: 'Only scan and list conflicts without resolving',
          },
        },
        required: [],
      },
    };
  }

  validate(input: unknown): IValidationResult {
    if (typeof input !== 'object' || input === null) {
      return { valid: false, errors: ['Input must be an object'] };
    }

    const data = input as Record<string, unknown>;

    if (data.strategy !== undefined) {
      if (!['ours', 'theirs', 'both', 'ai'].includes(data.strategy as string)) {
        return { valid: false, errors: ['strategy must be one of: ours, theirs, both, ai'] };
      }
    }

    return { valid: true };
  }

  getMetadata(): IToolMetadata {
    return {
      name: this.name,
      description: this.description,
      category: 'git' as ToolCategoryType,
      keywords: ['merge', 'conflict', 'resolve', 'git', 'ours', 'theirs', 'rebase'],
      priority: 7,
      modifiesFiles: true,
      makesNetworkRequests: false,
    };
  }

  isAvailable(): boolean {
    return true;
  }
}

/**
 * Create merge conflict tool instances
 */
export function createMergeConflictTools(): ITool[] {
  return [new ResolveConflictsExecuteTool()];
}

/**
 * Reset merge conflict tool instances (for testing)
 */
export function resetMergeConflictInstances(): void {
  // No shared instance to reset — tool is stateless
}
