/**
 * License Scanner Tool Definitions
 *
 * OpenAI function calling schema for the scan_licenses tool.
 */

import type { CodeBuddyTool } from './types.js';

export const SCAN_LICENSES_TOOL: CodeBuddyTool = {
  type: 'function',
  function: {
    name: 'scan_licenses',
    description: 'Scan project dependencies for license compliance. Reads package.json and node_modules to classify each dependency license as permissive, copyleft, weak-copyleft, proprietary, or unknown. Checks compatibility with the project license and flags incompatible dependencies. npm projects only (v1).',
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
  },
};

export const LICENSE_SCANNER_TOOLS: CodeBuddyTool[] = [SCAN_LICENSES_TOOL];
