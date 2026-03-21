/**
 * Bug Finder Tool Adapter
 *
 * ITool-compliant adapter for the find_bugs static analysis tool.
 * Wraps the regex-based bug finder for use with the FormalToolRegistry.
 */

import type { ToolResult } from '../../types/index.js';
import type { ITool, ToolSchema, IToolMetadata, IValidationResult, ToolCategoryType } from './types.js';
import { executeFindBugs } from '../bug-finder-tool.js';

/**
 * BugFinderExecuteTool - ITool adapter for static bug analysis
 */
export class BugFinderExecuteTool implements ITool {
  readonly name = 'find_bugs';
  readonly description = 'Scan source files for potential bugs using regex-based static analysis. Detects null access, unchecked errors, resource leaks, race conditions, security issues, and dead code.';

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    return await executeFindBugs({
      path: input.path as string,
      severity: input.severity as 'all' | 'critical' | 'high' | undefined,
    });
  }

  getSchema(): ToolSchema {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'File or directory path to scan for bugs',
          },
          severity: {
            type: 'string',
            description: 'Filter by minimum severity level (all, critical, high)',
          },
        },
        required: ['path'],
      },
    };
  }

  validate(input: unknown): IValidationResult {
    if (typeof input !== 'object' || input === null) {
      return { valid: false, errors: ['Input must be an object'] };
    }

    const data = input as Record<string, unknown>;

    if (typeof data.path !== 'string' || data.path.trim() === '') {
      return { valid: false, errors: ['path must be a non-empty string'] };
    }

    if (data.severity !== undefined) {
      if (!['all', 'critical', 'high'].includes(data.severity as string)) {
        return { valid: false, errors: ['severity must be one of: all, critical, high'] };
      }
    }

    return { valid: true };
  }

  getMetadata(): IToolMetadata {
    return {
      name: this.name,
      description: this.description,
      category: 'codebase' as ToolCategoryType,
      keywords: ['bug', 'find', 'scan', 'analysis', 'security', 'lint', 'static', 'check', 'vulnerability', 'error', 'leak'],
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
 * Create bug finder tool instances
 */
export function createBugFinderTools(): ITool[] {
  return [new BugFinderExecuteTool()];
}

/**
 * Reset bug finder tool instances (for testing)
 */
export function resetBugFinderInstances(): void {
  // No shared instance to reset — tool is stateless
}
