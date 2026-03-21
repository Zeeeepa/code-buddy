/**
 * Merge Conflict Tool Definitions
 *
 * OpenAI function calling schema for the resolve_conflicts tool.
 */

import type { CodeBuddyTool } from './types.js';

export const RESOLVE_CONFLICTS_TOOL: CodeBuddyTool = {
  type: 'function',
  function: {
    name: 'resolve_conflicts',
    description: 'Detect and resolve Git merge conflicts in files. Can scan for all conflicted files, show conflict details, or automatically resolve using strategies: "ours" (keep current branch), "theirs" (keep incoming), "both" (keep both), or "ai" (intelligent merge). Without a file_path, scans for all files with conflicts.',
    parameters: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Path to the file with merge conflicts (omit to scan all files)',
        },
        strategy: {
          type: 'string',
          enum: ['ours', 'theirs', 'both', 'ai'],
          description: 'Resolution strategy: ours (current branch), theirs (incoming), both (keep both), ai (show for manual resolution). Default: ours',
        },
        scan_only: {
          type: 'boolean',
          description: 'Only scan and list conflicts without resolving',
        },
      },
      required: [],
    },
  },
};

export const MERGE_CONFLICT_TOOLS: CodeBuddyTool[] = [RESOLVE_CONFLICTS_TOOL];
