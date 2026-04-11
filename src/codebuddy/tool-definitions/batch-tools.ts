/**
 * Batch Tool Definition
 *
 * LLM-callable tool for executing multiple tool calls in parallel.
 * Designed for read-only operations (search, view, grep) to reduce
 * round trips between the LLM and tool execution.
 */

import type { CodeBuddyTool } from './types.js';

export const BATCH_TOOL: CodeBuddyTool = {
  type: 'function',
  function: {
    name: 'batch_tools',
    description: 'Execute multiple tool calls in parallel. Best for read-only operations like searching, viewing files, and finding symbols. Destructive tools (bash, create_file, edit) are blocked unless YOLO mode is active. Maximum 25 calls per batch.',
    parameters: {
      type: 'object',
      properties: {
        calls: {
          type: 'array',
          description: 'Array of tool calls to execute in parallel',
          items: {
            type: 'object',
            properties: {
              tool: {
                type: 'string',
                description: 'The tool name to execute (e.g., "view_file", "search", "grep")',
              },
              args: {
                type: 'object',
                description: 'Arguments to pass to the tool',
              },
            },
            required: ['tool', 'args'],
          },
        },
        description: {
          type: 'string',
          description: 'Optional description of what this batch is doing',
        },
      },
      required: ['calls'],
    },
  },
};

export const BATCH_TOOLS: CodeBuddyTool[] = [
  BATCH_TOOL,
];
