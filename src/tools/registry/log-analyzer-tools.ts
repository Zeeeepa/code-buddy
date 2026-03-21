/**
 * Log Analyzer Tool Adapter
 *
 * ITool-compliant adapter for the analyze_logs tool.
 * Wraps the log analyzer for use with the FormalToolRegistry.
 */

import type { ToolResult } from '../../types/index.js';
import type { ITool, ToolSchema, IToolMetadata, IValidationResult, ToolCategoryType } from './types.js';
import { executeAnalyzeLogs } from '../log-analyzer-tool.js';

/**
 * LogAnalyzerTool - ITool adapter for log file analysis
 */
export class LogAnalyzerTool implements ITool {
  readonly name = 'analyze_logs';
  readonly description = 'Analyze log files to extract structured entries, detect patterns, and find anomalies. Supports JSON, standard, syslog, and simple log formats.';

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    return await executeAnalyzeLogs({
      file_path: input.file_path as string,
      max_lines: input.max_lines as number | undefined,
      level_filter: input.level_filter as string | undefined,
      search: input.search as string | undefined,
      tail: input.tail as number | undefined,
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
            description: 'Path to the log file to analyze',
          },
          max_lines: {
            type: 'number',
            description: 'Maximum number of log lines to process (default: 100000)',
          },
          level_filter: {
            type: 'string',
            description: 'Filter entries by log level (error, warn, info, debug, trace)',
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
    };
  }

  validate(input: unknown): IValidationResult {
    if (typeof input !== 'object' || input === null) {
      return { valid: false, errors: ['Input must be an object'] };
    }

    const data = input as Record<string, unknown>;

    if (typeof data.file_path !== 'string' || data.file_path.trim() === '') {
      return { valid: false, errors: ['file_path must be a non-empty string'] };
    }

    if (data.max_lines !== undefined && (typeof data.max_lines !== 'number' || data.max_lines < 1)) {
      return { valid: false, errors: ['max_lines must be a positive number'] };
    }

    if (data.level_filter !== undefined) {
      if (!['error', 'warn', 'info', 'debug', 'trace'].includes(data.level_filter as string)) {
        return { valid: false, errors: ['level_filter must be one of: error, warn, info, debug, trace'] };
      }
    }

    return { valid: true };
  }

  getMetadata(): IToolMetadata {
    return {
      name: this.name,
      description: this.description,
      category: 'utility' as ToolCategoryType,
      keywords: ['log', 'analyze', 'parse', 'error', 'warn', 'debug', 'trace', 'pattern', 'anomaly', 'syslog', 'json'],
      priority: 7,
      modifiesFiles: false,
      makesNetworkRequests: false,
    };
  }

  isAvailable(): boolean {
    return true;
  }
}

/**
 * Create log analyzer tool instances
 */
export function createLogAnalyzerTools(): ITool[] {
  return [new LogAnalyzerTool()];
}

/**
 * Reset log analyzer tool instances (for testing)
 */
export function resetLogAnalyzerInstances(): void {
  // No shared instance to reset — tool is stateless
}
