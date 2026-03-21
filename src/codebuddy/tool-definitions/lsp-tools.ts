/**
 * LSP Tool Definitions
 *
 * OpenAI function-calling schemas for LSP rename and code action tools.
 */

import type { CodeBuddyTool } from './types.js';

export const LSP_RENAME_TOOL: CodeBuddyTool = {
  type: 'function',
  function: {
    name: 'lsp_rename',
    description: 'Rename a symbol across the codebase using the Language Server Protocol. Performs a cross-file rename operation, updating all references. Requires the appropriate LSP server installed (e.g. typescript-language-server for TS/JS, pylsp for Python).',
    parameters: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Path to the file containing the symbol to rename',
        },
        line: {
          type: 'number',
          description: 'Line number of the symbol (1-based)',
        },
        character: {
          type: 'number',
          description: 'Column number of the symbol (1-based)',
        },
        new_name: {
          type: 'string',
          description: 'New name for the symbol',
        },
      },
      required: ['file_path', 'line', 'character', 'new_name'],
    },
  },
};

export const LSP_CODE_ACTION_TOOL: CodeBuddyTool = {
  type: 'function',
  function: {
    name: 'lsp_code_action',
    description: 'Get available code actions (quick fixes, refactorings) for a position or range in a file using the Language Server Protocol.',
    parameters: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Path to the file',
        },
        start_line: {
          type: 'number',
          description: 'Start line of the range (1-based)',
        },
        start_character: {
          type: 'number',
          description: 'Start column of the range (1-based)',
        },
        end_line: {
          type: 'number',
          description: 'End line of the range (1-based, defaults to start_line)',
        },
        end_character: {
          type: 'number',
          description: 'End column of the range (1-based, defaults to start_character)',
        },
      },
      required: ['file_path', 'start_line', 'start_character'],
    },
  },
};

export const LSP_TOOLS: CodeBuddyTool[] = [
  LSP_RENAME_TOOL,
  LSP_CODE_ACTION_TOOL,
];
