/**
 * Import Management Tool Definitions
 *
 * OpenAI function calling schema for the organize_imports tool.
 */

import type { CodeBuddyTool } from './types.js';

export const ORGANIZE_IMPORTS_TOOL: CodeBuddyTool = {
  type: 'function',
  function: {
    name: 'organize_imports',
    description: 'Organize, add missing, or remove unused imports in a source file. Supports TypeScript, JavaScript, and Python. Uses LSP when available, falls back to regex-based analysis.',
    parameters: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Path to the file to organize imports for',
        },
        action: {
          type: 'string',
          description: 'Action to perform',
          enum: ['organize', 'remove_unused', 'add_missing'],
        },
        symbol: {
          type: 'string',
          description: 'Symbol name to add import for (required when action is add_missing)',
        },
      },
      required: ['file_path'],
    },
  },
};

export const IMPORT_TOOLS: CodeBuddyTool[] = [ORGANIZE_IMPORTS_TOOL];
