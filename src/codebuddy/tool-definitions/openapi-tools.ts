/**
 * OpenAPI Generator Tool Definitions
 *
 * OpenAI function calling schema for the generate_openapi tool.
 */

import type { CodeBuddyTool } from './types.js';

export const GENERATE_OPENAPI_TOOL: CodeBuddyTool = {
  type: 'function',
  function: {
    name: 'generate_openapi',
    description: 'Auto-generate an OpenAPI 3.0.3 specification from project source code. Detects web frameworks (Express, Fastify, Koa, Flask, FastAPI, Spring, Gin, Echo) and extracts route definitions including HTTP methods, paths, parameters, and request bodies.',
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
          enum: ['express', 'fastify', 'koa', 'flask', 'fastapi', 'spring', 'gin', 'echo'],
        },
        output_format: {
          type: 'string',
          description: 'Output format for the generated spec',
          enum: ['json', 'yaml'],
        },
      },
      required: ['project_root'],
    },
  },
};

export const OPENAPI_TOOLS: CodeBuddyTool[] = [GENERATE_OPENAPI_TOOL];
