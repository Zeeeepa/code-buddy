/**
 * Vulnerability Scanner Tool Adapter
 *
 * ITool-compliant adapter for the scan_vulnerabilities tool.
 * Wraps the dependency vulnerability scanner for use with the FormalToolRegistry.
 */

import type { ToolResult } from '../../types/index.js';
import type { ITool, ToolSchema, IToolMetadata, IValidationResult, ToolCategoryType } from './types.js';
import { executeScanVulnerabilities } from '../../security/dependency-vuln-scanner.js';

/**
 * VulnScannerExecuteTool - ITool adapter for dependency vulnerability scanning
 */
export class VulnScannerExecuteTool implements ITool {
  readonly name = 'scan_vulnerabilities';
  readonly description = 'Scan project dependencies for known security vulnerabilities. Auto-detects package managers and runs audit commands.';

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    return await executeScanVulnerabilities({
      path: input.path as string | undefined,
      package_manager: input.package_manager as 'npm' | 'pip' | 'cargo' | 'go' | 'gem' | 'composer' | undefined,
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
            description: 'Project root path to scan (default: cwd)',
          },
          package_manager: {
            type: 'string',
            description: 'Scan only a specific package manager (npm, pip, cargo, go, gem, composer)',
          },
        },
        required: [],
      },
    };
  }

  validate(input: unknown): IValidationResult {
    if (typeof input !== 'object' || input === null) {
      return { valid: false, errors: ['Input must be an object'] };
    }

    const data = input as Record<string, unknown>;

    if (data.package_manager !== undefined) {
      if (!['npm', 'pip', 'cargo', 'go', 'gem', 'composer'].includes(data.package_manager as string)) {
        return { valid: false, errors: ['package_manager must be one of: npm, pip, cargo, go, gem, composer'] };
      }
    }

    return { valid: true };
  }

  getMetadata(): IToolMetadata {
    return {
      name: this.name,
      description: this.description,
      category: 'system' as ToolCategoryType,
      keywords: ['vulnerability', 'security', 'audit', 'dependency', 'npm', 'pip', 'cargo', 'cve', 'scan'],
      priority: 7,
      modifiesFiles: false,
      makesNetworkRequests: true,
    };
  }

  isAvailable(): boolean {
    return true;
  }
}

/**
 * Create vulnerability scanner tool instances
 */
export function createVulnScannerTools(): ITool[] {
  return [new VulnScannerExecuteTool()];
}

/**
 * Reset vulnerability scanner tool instances (for testing)
 */
export function resetVulnScannerInstances(): void {
  // No shared instance to reset — tool is stateless
}
