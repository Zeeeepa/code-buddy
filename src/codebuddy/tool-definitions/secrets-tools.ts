/**
 * Secrets Detector Tool Definitions
 *
 * OpenAI function calling schema for the scan_secrets tool.
 */

import type { CodeBuddyTool } from './types.js';

export const SCAN_SECRETS_TOOL: CodeBuddyTool = {
  type: 'function',
  function: {
    name: 'scan_secrets',
    description: 'Scan source files for hardcoded secrets, credentials, and API keys. Detects AWS keys, GitHub tokens, Slack tokens, Stripe keys, Google API keys, JWTs, private keys, passwords, connection strings, and generic secrets. All matches are redacted in the output.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File or directory path to scan for secrets',
        },
        recursive: {
          type: 'boolean',
          description: 'Whether to scan directories recursively (default: true)',
        },
        exclude: {
          type: 'array',
          description: 'Directory names to exclude from scanning',
          items: { type: 'string' },
        },
      },
      required: ['path'],
    },
  },
};

export const SECRETS_TOOLS: CodeBuddyTool[] = [SCAN_SECRETS_TOOL];
