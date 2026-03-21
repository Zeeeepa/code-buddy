/**
 * Codebase Replace Tool Definition
 *
 * LLM-callable tool for codebase-wide find & replace.
 */

import type { CodeBuddyTool } from './types.js';

export const CODEBASE_REPLACE_TOOL: CodeBuddyTool = {
  type: 'function',
  function: {
    name: 'codebase_replace',
    description: 'Find and replace text across multiple files in the codebase. Supports literal text and regex patterns. Use dryRun to preview changes before applying.',
    parameters: {
      type: 'object',
      properties: {
        search_pattern: {
          type: 'string',
          description: 'The text or regex pattern to search for',
        },
        replacement: {
          type: 'string',
          description: 'The replacement string. For regex, use $1, $2 for capture groups.',
        },
        glob: {
          type: 'string',
          description: 'File glob pattern to filter files (e.g., "**/*.ts", "src/**/*.js"). Default: "**/*"',
        },
        is_regex: {
          type: 'boolean',
          description: 'Treat search_pattern as a regular expression. Default: false',
        },
        dry_run: {
          type: 'boolean',
          description: 'Preview changes without modifying files. Default: false',
        },
        max_files: {
          type: 'number',
          description: 'Maximum number of files to modify (safety limit). Default: 50',
        },
      },
      required: ['search_pattern', 'replacement'],
    },
  },
};

export const CODEBASE_REPLACE_TOOLS: CodeBuddyTool[] = [
  CODEBASE_REPLACE_TOOL,
];
