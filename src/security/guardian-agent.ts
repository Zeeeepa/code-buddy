/**
 * Guardian Sub-Agent — AI-powered automatic approval reviewer
 *
 * Evaluates tool calls for safety using a dedicated LLM sub-agent.
 * Operates in read-only mode with structured risk scoring (0-100).
 * Approves automatically when risk < 80, prompts user otherwise.
 *
 * Inspired by OpenAI Codex CLI's guardian.rs
 *
 * Timeout: 90 seconds, fail-closed (deny on any error).
 */

import { logger } from '../utils/logger.js';

// ============================================================================
// Types
// ============================================================================

export interface GuardianEvaluation {
  /** Risk score 0-100 (0 = completely safe, 100 = extremely dangerous) */
  riskScore: number;
  /** Human-readable reasoning for the score */
  reasoning: string;
  /** Decision based on threshold */
  decision: 'approve' | 'prompt_user' | 'deny';
  /** Specific risks identified */
  risks: string[];
}

export interface GuardianContext {
  /** The tool/command being evaluated */
  toolName: string;
  /** Arguments or command content */
  content: string;
  /** Current working directory */
  cwd: string;
  /** Files recently modified in this session */
  recentFiles?: string[];
  /** Whether YOLO mode is active */
  yoloMode?: boolean;
}

/** LLM call function signature (injected to avoid circular deps) */
export type GuardianLLMCall = (
  systemPrompt: string,
  userPrompt: string,
) => Promise<string>;

// ============================================================================
// Configuration
// ============================================================================

/** Risk score below which auto-approve is granted */
const AUTO_APPROVE_THRESHOLD = 80;

/** Timeout for guardian evaluation in ms */
const GUARDIAN_TIMEOUT_MS = 90_000;

/** Operations that are always safe (no guardian needed) */
const ALWAYS_SAFE_OPERATIONS = new Set([
  'read_file', 'view_file', 'file_read', 'grep', 'glob',
  'list_files', 'search_files', 'find_references', 'tree',
  'get_file_info', 'reason', 'think', 'plan',
  'ask_human', 'knowledge_search', 'knowledge_list',
  'codebase_map', 'code_graph', 'lessons_search',
  'restore_context', 'memory_search', 'todo_update',
]);

/** Operations that are always dangerous (always prompt) */
const ALWAYS_DANGEROUS_PATTERNS = [
  /rm\s+-rf/i, /rm\s+-r\s+\//i,
  /mkfs/i, /dd\s+if=/i,
  /format\s+[a-z]:/i,
  /drop\s+database/i, /drop\s+table/i,
  /truncate\s+table/i,
  /git\s+push\s+.*--force/i,
  /git\s+reset\s+--hard/i,
  /:(){ :|:& };:/,  // fork bomb
  />\s*\/dev\/sd/i,  // overwrite disk
];

// ============================================================================
// System prompt
// ============================================================================

const GUARDIAN_SYSTEM_PROMPT = `You are a security guardian evaluating whether an AI coding agent's action is safe to execute.

Evaluate the action and respond with a JSON object:
{
  "risk_score": <number 0-100>,
  "reasoning": "<brief explanation>",
  "risks": ["<specific risk 1>", "<specific risk 2>"]
}

Risk score guide:
- 0-20: Completely safe (read operations, standard build commands)
- 20-40: Low risk (writing to project files, running tests)
- 40-60: Moderate risk (installing packages, modifying configs)
- 60-80: High risk (system modifications, network operations, deleting files)
- 80-100: Critical risk (destructive operations, credential access, system-level changes)

Rules:
- File operations within the project directory are generally safe (20-40)
- Running tests, linters, and build tools is safe (10-30)
- Installing packages from known registries is moderate (40-50)
- Deleting files is moderate to high depending on what (40-70)
- System-level commands (chmod, chown, mount) are high risk (60-80)
- Operations involving credentials, secrets, or authentication are critical (80+)
- Destructive operations (rm -rf, format, drop database) are critical (90+)
- Network operations to unknown hosts are high risk (60-80)`;

// ============================================================================
// Guardian Agent
// ============================================================================

/** Cached LLM call function */
let _llmCall: GuardianLLMCall | null = null;

/**
 * Set the LLM call function for the guardian.
 * Called during agent initialization.
 */
export function setGuardianLLMCall(fn: GuardianLLMCall): void {
  _llmCall = fn;
}

/**
 * Quick heuristic check — skip LLM call for obviously safe/dangerous operations.
 */
function quickEval(ctx: GuardianContext): GuardianEvaluation | null {
  // Always safe
  if (ALWAYS_SAFE_OPERATIONS.has(ctx.toolName)) {
    return {
      riskScore: 5,
      reasoning: `${ctx.toolName} is a read-only operation`,
      decision: 'approve',
      risks: [],
    };
  }

  // Always dangerous
  for (const pattern of ALWAYS_DANGEROUS_PATTERNS) {
    if (pattern.test(ctx.content)) {
      return {
        riskScore: 95,
        reasoning: `Command matches dangerous pattern: ${pattern.source}`,
        decision: 'deny',
        risks: [`Destructive operation detected`],
      };
    }
  }

  return null; // Need LLM evaluation
}

/**
 * Evaluate a tool call for safety using the guardian sub-agent.
 *
 * @returns GuardianEvaluation with risk score and decision
 */
export async function evaluateToolCall(ctx: GuardianContext): Promise<GuardianEvaluation> {
  // Quick heuristic check first
  const quick = quickEval(ctx);
  if (quick) return quick;

  // If no LLM call configured, fail-open for non-dangerous operations
  if (!_llmCall) {
    return {
      riskScore: 50,
      reasoning: 'Guardian LLM not configured — defaulting to prompt user',
      decision: 'prompt_user',
      risks: ['No guardian LLM available'],
    };
  }

  try {
    const userPrompt = [
      `Tool: ${ctx.toolName}`,
      `Content: ${ctx.content.substring(0, 2000)}`,
      `Working directory: ${ctx.cwd}`,
      ctx.recentFiles?.length ? `Recent files: ${ctx.recentFiles.slice(0, 5).join(', ')}` : '',
    ].filter(Boolean).join('\n');

    // Race with timeout
    const response = await Promise.race([
      _llmCall(GUARDIAN_SYSTEM_PROMPT, userPrompt),
      new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error('Guardian timeout')), GUARDIAN_TIMEOUT_MS)
      ),
    ]);

    // Parse response
    const jsonMatch = response.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
      logger.debug('Guardian: failed to parse LLM response');
      return { riskScore: 50, reasoning: 'Failed to parse guardian response', decision: 'prompt_user', risks: [] };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const riskScore = typeof parsed.risk_score === 'number'
      ? Math.max(0, Math.min(100, parsed.risk_score))
      : 50;
    const reasoning = typeof parsed.reasoning === 'string' ? parsed.reasoning : '';
    const risks = Array.isArray(parsed.risks) ? parsed.risks.filter((r: unknown) => typeof r === 'string') : [];

    const decision: GuardianEvaluation['decision'] =
      riskScore < AUTO_APPROVE_THRESHOLD ? 'approve' :
      riskScore >= 90 ? 'deny' :
      'prompt_user';

    logger.debug(`Guardian: ${ctx.toolName} → risk=${riskScore}, decision=${decision}`);

    return { riskScore, reasoning, decision, risks };
  } catch (err) {
    // Fail-closed: on any error, prompt the user
    logger.debug(`Guardian evaluation failed: ${err instanceof Error ? err.message : String(err)}`);
    return {
      riskScore: 50,
      reasoning: `Guardian evaluation failed: ${err instanceof Error ? err.message : 'unknown error'}`,
      decision: 'prompt_user',
      risks: ['Guardian evaluation failed'],
    };
  }
}

/**
 * Check if the guardian should be used for a given tool call.
 * Returns false for always-safe operations (no point in LLM eval).
 */
export function shouldUseGuardian(toolName: string): boolean {
  return !ALWAYS_SAFE_OPERATIONS.has(toolName);
}
