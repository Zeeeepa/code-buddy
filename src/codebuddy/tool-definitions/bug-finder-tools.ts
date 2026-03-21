/**
 * Bug Finder Tool Definitions
 *
 * OpenAI function calling schema for the find_bugs tool.
 */

import type { CodeBuddyTool } from './types.js';

export const FIND_BUGS_TOOL: CodeBuddyTool = {
  type: 'function',
  function: {
    name: 'find_bugs',
    description: 'Scan source files for potential bugs using regex-based static analysis. Detects null access patterns, unchecked errors, resource leaks, race conditions, security issues (eval, innerHTML, SQL injection), and dead code. Supports TypeScript, JavaScript, Python, Go, Rust, and Java.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File or directory path to scan for bugs',
        },
        severity: {
          type: 'string',
          description: 'Filter by minimum severity level',
          enum: ['all', 'critical', 'high'],
        },
      },
      required: ['path'],
    },
  },
};

export const BUG_FINDER_TOOLS: CodeBuddyTool[] = [FIND_BUGS_TOOL];
