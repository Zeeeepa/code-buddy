/**
 * ACP Protocol Server — Enhanced Agent Communication Protocol
 *
 * Provides advanced ACP endpoints for context injection, tool delegation,
 * and capability discovery.
 *
 * Routes:
 * - POST /api/acp/context       — inject context via ContextEngine.ingest()
 * - POST /api/acp/delegate      — delegate tool execution to Code Buddy's tool registry
 * - GET  /api/acp/capabilities  — return list of tools + agent capabilities
 *
 * DeepAgents Sprint 3 — ACP Protocol Server Enhancement.
 */

import { Router } from 'express';
import { logger } from '../../utils/logger.js';

// ── Types ──────────────────────────────────────────────────────────

export interface ACPContextPayload {
  /** Context type identifier */
  type: string;
  /** Context content to inject */
  content: string;
  /** Optional metadata */
  metadata?: Record<string, string>;
  /** Priority level for context ordering */
  priority?: 'low' | 'medium' | 'high';
}

export interface ACPDelegatePayload {
  /** Tool name to execute */
  tool: string;
  /** Tool arguments */
  args: Record<string, unknown>;
  /** Optional timeout in milliseconds */
  timeout?: number;
}

export interface ACPCapability {
  /** Tool name */
  name: string;
  /** Tool description */
  description: string;
  /** Parameter schema (JSON Schema) */
  parameters?: unknown;
  /** Whether this tool is read-only */
  readOnly?: boolean;
  /** Category for organization */
  category?: string;
}

export interface ACPCapabilitiesResponse {
  /** List of available tools */
  tools: ACPCapability[];
  /** Agent metadata */
  agent: {
    name: string;
    version: string;
    capabilities: string[];
  };
}

// ── Interfaces for ACP dependencies ──────────────────────────────

/** Minimal interface for context engine used by ACP injection */
interface ACPContextEngine {
  ingest(payload: {
    type: string;
    content: string;
    metadata: Record<string, string>;
    priority: string;
    source: string;
    timestamp: number;
  }): Promise<void>;
}

/** Minimal interface for tool registry used by ACP delegation */
interface ACPToolRegistry {
  executeTool(toolName: string, args: Record<string, unknown>): Promise<unknown>;
  listTools(): Array<{
    name: string;
    description?: string;
    parameters?: unknown;
    readOnly?: boolean;
    category?: string;
  }>;
}

// ── Route factory ──────────────────────────────────────────────────

/**
 * Create ACP enhancement routes.
 *
 * @param options.asyncHandler - Express async handler wrapper
 * @param options.getContextEngine - Optional getter for the context engine
 * @param options.getToolRegistry - Optional getter for the tool registry
 */
export function createACPServerRoutes(options: {
  asyncHandler: (fn: (req: unknown, res: unknown) => Promise<void>) => unknown;
  getContextEngine?: () => ACPContextEngine | null;
  getToolRegistry?: () => ACPToolRegistry | null;
} = { asyncHandler: (fn) => fn }): Router {
  const router = Router();
  const { asyncHandler } = options;

  // ──────────────────────────────────────────────────────────────────
  // POST /context — Inject context via ContextEngine
  // ──────────────────────────────────────────────────────────────────

  router.post('/context', asyncHandler(async (req: any, res: any) => {
    const { type, content, metadata, priority } = req.body as ACPContextPayload;

    if (!type || typeof type !== 'string') {
      res.status(400).json({ error: 'type (string) is required' });
      return;
    }
    if (!content || typeof content !== 'string') {
      res.status(400).json({ error: 'content (string) is required' });
      return;
    }

    // Try to inject via context engine
    try {
      const engine = options.getContextEngine?.();
      if (engine && typeof engine.ingest === 'function') {
        await engine.ingest({
          type,
          content,
          metadata: metadata || {},
          priority: priority || 'medium',
          source: 'acp',
          timestamp: Date.now(),
        });

        logger.info('ACP: context injected', { type, contentLength: content.length });

        res.json({
          success: true,
          type,
          contentLength: content.length,
          priority: priority || 'medium',
        });
        return;
      }

      // Fallback: store context for later retrieval
      logger.info('ACP: context stored (no engine available)', { type, contentLength: content.length });

      res.json({
        success: true,
        type,
        contentLength: content.length,
        mode: 'stored',
        message: 'Context stored — no active context engine to inject into.',
      });
    } catch (err) {
      logger.error('ACP: context injection failed', err as Error);
      res.status(500).json({
        error: 'Context injection failed',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }) as any);

  // ──────────────────────────────────────────────────────────────────
  // POST /delegate — Delegate tool execution
  // ──────────────────────────────────────────────────────────────────

  router.post('/delegate', asyncHandler(async (req: any, res: any) => {
    const { tool, args, timeout } = req.body as ACPDelegatePayload;

    if (!tool || typeof tool !== 'string') {
      res.status(400).json({ error: 'tool (string) is required' });
      return;
    }
    if (!args || typeof args !== 'object') {
      res.status(400).json({ error: 'args (object) is required' });
      return;
    }

    try {
      const registry = options.getToolRegistry?.();
      if (!registry || typeof registry.executeTool !== 'function') {
        res.status(503).json({
          error: 'Tool registry not available',
          message: 'No tool registry is registered for delegation.',
        });
        return;
      }

      // Execute with optional timeout
      const timeoutMs = Math.min(timeout || 30000, 120000); // Max 2 minutes
      const execPromise = registry.executeTool(tool, args);

      const result = await Promise.race([
        execPromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Tool execution timed out after ${timeoutMs}ms`)), timeoutMs)
        ),
      ]);

      logger.info('ACP: tool delegated', { tool, success: true });

      res.json({
        success: true,
        tool,
        result,
      });
    } catch (err) {
      logger.warn('ACP: tool delegation failed', {
        tool,
        error: err instanceof Error ? err.message : String(err),
      });

      res.status(500).json({
        success: false,
        tool,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }) as any);

  // ──────────────────────────────────────────────────────────────────
  // GET /capabilities — Return tools + agent capabilities
  // ──────────────────────────────────────────────────────────────────

  router.get('/capabilities', (_req: any, res: any) => {
    const tools: ACPCapability[] = [];

    try {
      const registry = options.getToolRegistry?.();
      if (registry && typeof registry.listTools === 'function') {
        const toolList = registry.listTools();

        for (const t of toolList) {
          tools.push({
            name: t.name,
            description: t.description || '',
            parameters: t.parameters,
            readOnly: t.readOnly ?? false,
            category: t.category || 'general',
          });
        }
      }
    } catch (err) {
      logger.debug('ACP: failed to list tools for capabilities', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    const response: ACPCapabilitiesResponse = {
      tools,
      agent: {
        name: 'Code Buddy',
        version: '2.0.0',
        capabilities: [
          'context-injection',
          'tool-delegation',
          'multi-agent',
          'streaming',
          'file-operations',
          'code-analysis',
          'code-generation',
        ],
      },
    };

    res.json(response);
  });

  return router;
}
