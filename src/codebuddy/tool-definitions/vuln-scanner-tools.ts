/**
 * Vulnerability Scanner Tool Definitions
 *
 * OpenAI function calling schema for the scan_vulnerabilities tool.
 */

import type { CodeBuddyTool } from './types.js';

export const SCAN_VULNERABILITIES_TOOL: CodeBuddyTool = {
  type: 'function',
  function: {
    name: 'scan_vulnerabilities',
    description: 'Scan project dependencies for known security vulnerabilities. Auto-detects package managers (npm, pip, cargo, go, gem, composer) and runs their audit commands. Returns structured results with severity levels, CVEs, and fix recommendations.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Project root path to scan (default: current working directory)',
        },
        package_manager: {
          type: 'string',
          enum: ['npm', 'pip', 'cargo', 'go', 'gem', 'composer'],
          description: 'Scan only a specific package manager (omit to scan all detected)',
        },
      },
      required: [],
    },
  },
};

export const VULN_SCANNER_TOOLS: CodeBuddyTool[] = [SCAN_VULNERABILITIES_TOOL];
