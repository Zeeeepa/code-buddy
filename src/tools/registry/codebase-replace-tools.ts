/**
 * Codebase Replace Tool Adapter
 *
 * ITool-compliant adapter for the codebase_replace find & replace tool.
 * Wraps the codebaseReplace function for use with the FormalToolRegistry.
 */

import type { ToolResult } from '../../types/index.js';
import type { ITool, ToolSchema, IToolMetadata, IValidationResult, ToolCategoryType } from './types.js';
import { codebaseReplace, formatReplaceResult } from '../codebase-replace-tool.js';

/**
 * CodebaseReplaceTool - ITool adapter for codebase-wide find & replace
 */
export class CodebaseReplaceTool implements ITool {
  readonly name = 'codebase_replace';
  readonly description = 'Find and replace text across multiple files in the codebase. Supports literal text and regex patterns, with dry-run preview.';

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    try {
      const result = await codebaseReplace(
        input.search_pattern as string,
        input.replacement as string,
        {
          glob: (input.glob as string) || undefined,
          isRegex: (input.is_regex as boolean) || false,
          dryRun: (input.dry_run as boolean) || false,
          maxFiles: (input.max_files as number) || 50,
        }
      );

      const output = formatReplaceResult(result);

      return {
        success: true,
        output,
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  getSchema(): ToolSchema {
    return {
      name: this.name,
      description: this.description,
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
            description: 'File glob pattern to filter files (e.g., "**/*.ts"). Default: "**/*"',
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
    };
  }

  validate(input: unknown): IValidationResult {
    if (typeof input !== 'object' || input === null) {
      return { valid: false, errors: ['Input must be an object'] };
    }

    const data = input as Record<string, unknown>;

    if (typeof data.search_pattern !== 'string' || data.search_pattern.trim() === '') {
      return { valid: false, errors: ['search_pattern must be a non-empty string'] };
    }

    if (typeof data.replacement !== 'string') {
      return { valid: false, errors: ['replacement must be a string'] };
    }

    return { valid: true };
  }

  getMetadata(): IToolMetadata {
    return {
      name: this.name,
      description: this.description,
      category: 'file_write' as ToolCategoryType,
      keywords: ['replace', 'find', 'rename', 'refactor', 'codebase', 'search', 'substitute', 'bulk', 'mass', 'global'],
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
 * Create codebase replace tool instances
 */
export function createCodebaseReplaceTools(): ITool[] {
  return [new CodebaseReplaceTool()];
}

/**
 * Reset codebase replace tool instances (for testing)
 */
export function resetCodebaseReplaceInstances(): void {
  // No shared instance to reset — tool is stateless
}
