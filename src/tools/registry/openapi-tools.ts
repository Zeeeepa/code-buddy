/**
 * OpenAPI Generator Tool Adapter
 *
 * ITool-compliant adapter for the generate_openapi tool.
 * Wraps the OpenAPI generator for use with the FormalToolRegistry.
 */

import type { ToolResult } from '../../types/index.js';
import type { ITool, ToolSchema, IToolMetadata, IValidationResult, ToolCategoryType } from './types.js';
import { executeGenerateOpenAPI } from '../openapi-generator.js';

/**
 * OpenAPIGeneratorTool - ITool adapter for OpenAPI spec generation
 */
export class OpenAPIGeneratorTool implements ITool {
  readonly name = 'generate_openapi';
  readonly description = 'Auto-generate an OpenAPI 3.0.3 specification from project source code by detecting web frameworks and extracting route definitions.';

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    return await executeGenerateOpenAPI({
      project_root: input.project_root as string,
      framework: input.framework as string | undefined,
      output_format: input.output_format as 'json' | 'yaml' | undefined,
    });
  }

  getSchema(): ToolSchema {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {
          project_root: {
            type: 'string',
            description: 'Path to the project root directory',
          },
          framework: {
            type: 'string',
            description: 'Force a specific framework (auto-detected if not specified)',
          },
          output_format: {
            type: 'string',
            description: 'Output format: json or yaml',
          },
        },
        required: ['project_root'],
      },
    };
  }

  validate(input: unknown): IValidationResult {
    if (typeof input !== 'object' || input === null) {
      return { valid: false, errors: ['Input must be an object'] };
    }

    const data = input as Record<string, unknown>;

    if (typeof data.project_root !== 'string' || data.project_root.trim() === '') {
      return { valid: false, errors: ['project_root must be a non-empty string'] };
    }

    if (data.output_format !== undefined) {
      if (!['json', 'yaml'].includes(data.output_format as string)) {
        return { valid: false, errors: ['output_format must be one of: json, yaml'] };
      }
    }

    return { valid: true };
  }

  getMetadata(): IToolMetadata {
    return {
      name: this.name,
      description: this.description,
      category: 'codebase' as ToolCategoryType,
      keywords: ['openapi', 'swagger', 'api', 'documentation', 'rest', 'endpoint', 'route', 'spec', 'generate'],
      priority: 6,
      modifiesFiles: true,
      makesNetworkRequests: false,
    };
  }

  isAvailable(): boolean {
    return true;
  }
}

/**
 * Create OpenAPI generator tool instances
 */
export function createOpenAPITools(): ITool[] {
  return [new OpenAPIGeneratorTool()];
}

/**
 * Reset OpenAPI tool instances (for testing)
 */
export function resetOpenAPIInstances(): void {
  // No shared instance to reset — tool is stateless
}
