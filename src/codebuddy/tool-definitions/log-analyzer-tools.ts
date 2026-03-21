/**
 * Log Analyzer Tool Definitions
 *
 * OpenAI function calling schema for the analyze_logs tool.
 */

import type { CodeBuddyTool } from './types.js';

export const ANALYZE_LOGS_TOOL: CodeBuddyTool = {
  type: 'function',
  function: {
    name: 'analyze_logs',
    description: 'Analyze log files to extract structured entries, detect patterns, and find anomalies. Supports JSON logs, standard format ([timestamp] LEVEL: message), syslog, and simple (LEVEL message) formats. Streams large files efficiently.',
    parameters: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Path to the log file to analyze',
        },
        max_lines: {
          type: 'number',
          description: 'Maximum number of log lines to process (default: 100000)',
        },
        level_filter: {
          type: 'string',
          description: 'Filter entries by log level',
          enum: ['error', 'warn', 'info', 'debug', 'trace'],
        },
        search: {
          type: 'string',
          description: 'Search string to filter log entries',
        },
        tail: {
          type: 'number',
          description: 'Only analyze the last N lines of the file',
        },
      },
      required: ['file_path'],
    },
  },
};

export const LOG_ANALYZER_TOOLS: CodeBuddyTool[] = [ANALYZE_LOGS_TOOL];
