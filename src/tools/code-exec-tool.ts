/**
 * Code Mode — Isolated JavaScript Execution with Tool Bridge
 *
 * The LLM writes raw JavaScript that can call other tools via
 * an async `tools` object. Enables complex multi-tool orchestration
 * in a single action.
 *
 * Features:
 * - Isolated execution via vm.runInNewContext
 * - All registered tools available as tools.<name>()
 * - yield_control() for long-running scripts
 * - store()/load() for persistent state across calls
 * - Configurable timeout (default 30s)
 *
 * Inspired by OpenAI Codex CLI's code_mode/mod.rs
 */

import { BaseTool, ParameterDefinition } from './base-tool.js';
import { ToolResult } from '../types/index.js';
import { logger } from '../utils/logger.js';
import * as vm from 'vm';

// ============================================================================
// Types
// ============================================================================

export type ToolExecutor = (toolName: string, args: Record<string, unknown>) => Promise<ToolResult>;

interface CodeExecState {
  /** Persistent key-value store across calls */
  store: Map<string, unknown>;
  /** Output buffer */
  output: string[];
  /** Whether the script yielded control */
  yielded: boolean;
}

// ============================================================================
// State
// ============================================================================

const state: CodeExecState = {
  store: new Map(),
  output: [],
  yielded: false,
};

/** Tool executor function (injected from agent) */
let _toolExecutor: ToolExecutor | null = null;

/** Available tool names for the bridge */
let _availableTools: string[] = [];

/**
 * Set the tool executor for code mode.
 */
export function setCodeModeToolExecutor(executor: ToolExecutor, tools: string[]): void {
  _toolExecutor = executor;
  _availableTools = tools;
}

/**
 * Reset code mode state (for testing).
 */
export function resetCodeModeState(): void {
  state.store.clear();
  state.output = [];
  state.yielded = false;
}

// ============================================================================
// Tool
// ============================================================================

/** Default execution timeout (ms) */
const DEFAULT_TIMEOUT_MS = 30_000;

export class CodeExecTool extends BaseTool {
  readonly name = 'code_exec';
  readonly description = 'Execute JavaScript code with access to all tools via the `tools` object. Use for complex multi-tool orchestration. Available: tools.<toolName>(args), store(key, value), load(key), text(content), yield_control().';

  protected getParameters(): Record<string, ParameterDefinition> {
    return {
      code: {
        type: 'string',
        description: 'JavaScript code to execute. Use `await tools.<name>(args)` to call tools.',
        required: true,
      },
      timeout_ms: {
        type: 'number',
        description: 'Execution timeout in milliseconds (default 30000).',
      },
    };
  }

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const code = input.code as string;
    if (!code) return this.error('code is required');

    const timeoutMs = typeof input.timeout_ms === 'number' ? input.timeout_ms : DEFAULT_TIMEOUT_MS;
    const startTime = Date.now();

    state.output = [];
    state.yielded = false;

    try {
      // Build the tools bridge object
      const toolsBridge: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {};

      if (_toolExecutor) {
        for (const toolName of _availableTools) {
          const safeName = toolName.replace(/[^a-zA-Z0-9_]/g, '_');
          toolsBridge[safeName] = async (args: Record<string, unknown>) => {
            const result = await _toolExecutor!(toolName, args);
            return result.success ? result.output : { error: result.error };
          };
        }
      }

      // Build sandbox context
      const sandbox = {
        tools: toolsBridge,
        ALL_TOOLS: _availableTools,
        console: {
          log: (...args: unknown[]) => state.output.push(args.map(String).join(' ')),
          error: (...args: unknown[]) => state.output.push(`[ERROR] ${args.map(String).join(' ')}`),
          warn: (...args: unknown[]) => state.output.push(`[WARN] ${args.map(String).join(' ')}`),
        },
        text: (content: string) => state.output.push(content),
        store: (key: string, value: unknown) => { state.store.set(key, value); },
        load: (key: string) => state.store.get(key),
        yield_control: () => { state.yielded = true; },
        setTimeout: undefined, // Block timers
        setInterval: undefined,
        process: undefined, // Block process access
        require: undefined, // Block require
      };

      // Execute in isolated context
      const wrappedCode = `(async () => { ${code} })()`;
      const script = new vm.Script(wrappedCode);
      const context = vm.createContext(sandbox);

      await script.runInContext(context, { timeout: timeoutMs });

      const elapsed = Date.now() - startTime;
      const statusLine = state.yielded
        ? `Script yielded control after ${elapsed}ms`
        : `Script completed in ${elapsed}ms`;

      const output = [statusLine, '', ...state.output].join('\n');
      return this.success(output.substring(0, 50000)); // Cap output

    } catch (err) {
      const elapsed = Date.now() - startTime;
      const errMsg = err instanceof Error ? err.message : String(err);

      if (errMsg.includes('Script execution timed out')) {
        const output = [`Script timed out after ${elapsed}ms`, '', ...state.output].join('\n');
        return this.error(output.substring(0, 10000));
      }

      logger.debug(`code_exec error: ${errMsg}`);
      const output = [`Script failed after ${elapsed}ms: ${errMsg}`, '', ...state.output].join('\n');
      return this.error(output.substring(0, 10000));
    }
  }
}
