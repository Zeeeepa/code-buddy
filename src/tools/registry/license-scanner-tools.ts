/**
 * License Scanner Tool Adapter
 *
 * ITool-compliant adapter for the scan_licenses tool.
 * Wraps the license scanner for use with the FormalToolRegistry.
 */

import type { ToolResult } from '../../types/index.js';
import type { ITool, ToolSchema, IToolMetadata, IValidationResult, ToolCategoryType } from './types.js';
import { executeScanLicenses } from '../../security/license-scanner.js';

/**
 * LicenseScannerTool - ITool adapter for license compliance scanning
 */
export class LicenseScannerTool implements ITool {
  readonly name = 'scan_licenses';
  readonly description = 'Scan project dependencies for license compliance. Classifies licenses as permissive, copyleft, weak-copyleft, proprietary, or unknown, and checks compatibility with the project license.';

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    return await executeScanLicenses({
      project_root: input.project_root as string,
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
            description: 'Path to the project root directory (must contain package.json)',
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

    return { valid: true };
  }

  getMetadata(): IToolMetadata {
    return {
      name: this.name,
      description: this.description,
      category: 'codebase' as ToolCategoryType,
      keywords: ['license', 'compliance', 'scan', 'spdx', 'dependency', 'copyleft', 'gpl', 'mit', 'legal', 'audit'],
      priority: 6,
      modifiesFiles: false,
      makesNetworkRequests: true, // runs npm ls
    };
  }

  isAvailable(): boolean {
    return true;
  }
}

/**
 * Create license scanner tool instances
 */
export function createLicenseScannerTools(): ITool[] {
  return [new LicenseScannerTool()];
}

/**
 * Reset license scanner tool instances (for testing)
 */
export function resetLicenseScannerInstances(): void {
  // No shared instance to reset — tool is stateless
}
