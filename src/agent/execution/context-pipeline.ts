/**
 * Context Pipeline — extracted per-turn context injections.
 *
 * Both `processUserMessage` (sequential) and `processUserMessageStream`
 * apply the same set of context injections per turn. This module factors
 * those out so the two paths share one source of truth.
 *
 * The pipeline has three phases:
 *   1. `prepareTurnMessages` — compaction + transcript repair (always)
 *   2. `injectInitialContext` — round 0 enrichment (workspace, lessons, KG,
 *      decision memory, ICM memory, code graph)
 *   3. `injectNextRoundContext` — subsequent rounds (lessons + KG when query
 *      is complex, todo suffix always)
 *   4. `sanitizeAssistantOutput` — strip leakage tokens from final text
 *
 * @module agent/execution/context-pipeline
 */

import type { CodeBuddyMessage } from '../../codebuddy/client.js';
import type { ContextManagerV2 } from '../../context/context-manager-v2.js';
import { repairToolCallPairs } from '../../context/transcript-repair.js';
import { sanitizeModelOutput, stripInvisibleChars } from '../../utils/output-sanitizer.js';
import { getLessonsTracker } from '../lessons-tracker.js';
import { getTodoTracker } from '../todo-tracker.js';
import type { ContextInjectionLevel, QueryComplexity } from './query-classifier.js';

/** Minimal shape of the ICM bridge that this pipeline consumes. */
interface ICMBridgeLike {
  isAvailable(): boolean;
  searchMemory(message: string, opts: { limit: number }): Promise<Array<{ content: string }>>;
}

/** Race a promise against a timeout, returning fallback if it doesn't settle. */
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return Promise.race([
    promise.finally(() => { if (timer) clearTimeout(timer); }),
    new Promise<T>((resolve) => { timer = setTimeout(() => resolve(fallback), ms); }),
  ]);
}

/**
 * Phase 1 — Compact via contextManager + repair orphaned tool_call/tool_result
 * pairs left by compression. Always runs at the start of every turn.
 */
export function prepareTurnMessages(
  contextManager: ContextManagerV2,
  messages: CodeBuddyMessage[]
): CodeBuddyMessage[] {
  return repairToolCallPairs(contextManager.prepareMessages(messages));
}

export interface InitialContextDeps {
  message: string;
  cwd: string;
  ctxLevel: ContextInjectionLevel;
  loadWorkspaceContext: (cwd: string) => Promise<string>;
  decisionContextProvider: ((q: string) => Promise<string | null>) | null;
  icmBridgeProvider: (() => ICMBridgeLike | null) | null;
  codeGraphContextProvider: ((msg: string) => string | null) | null;
}

/**
 * Phase 2 — Inject round-0 context: workspace, lessons, knowledge graph,
 * decision memory, ICM memory, code graph. Each block is gated by the
 * `ctxLevel` from query classification. Mutates `preparedMessages` in place.
 */
export async function injectInitialContext(
  preparedMessages: CodeBuddyMessage[],
  deps: InitialContextDeps
): Promise<void> {
  if (deps.ctxLevel.workspace) {
    try {
      const wsCtx = await deps.loadWorkspaceContext(deps.cwd);
      if (wsCtx) {
        preparedMessages.push({ role: 'system', content: wsCtx });
      }
    } catch { /* workspace context optional */ }
  }

  if (deps.ctxLevel.lessons) {
    const lessonsBlock = getLessonsTracker(deps.cwd).buildContextBlock();
    if (lessonsBlock) {
      preparedMessages.push({
        role: 'system',
        content: `<context type="lessons">\n${lessonsBlock}\n</context>`,
      });
    }
  }

  if (deps.ctxLevel.knowledgeGraph) {
    try {
      const { getKnowledgeGraph } = await import('../../memory/knowledge-graph.js');
      const kg = getKnowledgeGraph();
      await kg.load();
      const kgBlock = kg.formatContextBlockSmart(deps.message, 600);
      if (kgBlock) {
        preparedMessages.push({ role: 'system', content: kgBlock });
      }
    } catch { /* knowledge graph is optional */ }
  }

  if (deps.ctxLevel.decisionMemory && deps.decisionContextProvider) {
    try {
      const decisionsBlock = await withTimeout(
        deps.decisionContextProvider(deps.message),
        3000,
        null
      );
      if (decisionsBlock) {
        preparedMessages.push({
          role: 'system',
          content: `<context type="decision">\n${decisionsBlock}\n</context>`,
        });
      }
    } catch { /* decision-memory optional */ }
  }

  if (deps.ctxLevel.icmMemory && deps.icmBridgeProvider) {
    try {
      const icm = deps.icmBridgeProvider();
      if (icm?.isAvailable()) {
        const memories = await withTimeout(
          icm.searchMemory(deps.message, { limit: 3 }),
          3000,
          [] as Array<{ content: string }>
        );
        if (memories.length > 0) {
          const memoryLines = memories.map((m) => `- ${m.content}`).join('\n');
          preparedMessages.push({
            role: 'system',
            content: `<context type="memory">\nRelevant cross-session memories:\n${memoryLines}\n</context>`,
          });
        }
      }
    } catch { /* ICM search optional */ }
  }

  if (deps.ctxLevel.codeGraph && deps.codeGraphContextProvider) {
    try {
      const graphCtx = deps.codeGraphContextProvider(deps.message);
      if (graphCtx) {
        preparedMessages.push({
          role: 'system',
          content: `<context type="code_graph">\n${graphCtx}\n</context>`,
        });
      }
    } catch { /* code graph context optional */ }
  }
}

export interface NextRoundContextDeps {
  message: string;
  cwd: string;
  queryComplexity: QueryComplexity;
}

/**
 * Phase 3 — Inject context for rounds ≥1: lessons + knowledge graph (only
 * when query is `complex`), todo suffix (always). Workspace context is NOT
 * re-injected — it's stable across rounds.
 */
export async function injectNextRoundContext(
  preparedMessages: CodeBuddyMessage[],
  deps: NextRoundContextDeps
): Promise<void> {
  if (deps.queryComplexity === 'complex') {
    const lessonsBlock = getLessonsTracker(deps.cwd).buildContextBlock();
    if (lessonsBlock) {
      preparedMessages.push({
        role: 'system',
        content: `<context type="lessons">\n${lessonsBlock}\n</context>`,
      });
    }

    try {
      const { getKnowledgeGraph } = await import('../../memory/knowledge-graph.js');
      const kg = getKnowledgeGraph();
      const kgBlock = kg.formatContextBlock(deps.message, 600);
      if (kgBlock) {
        preparedMessages.push({ role: 'system', content: kgBlock });
      }
    } catch { /* knowledge graph is optional */ }
  }

  const todoSuffix = getTodoTracker(deps.cwd).buildContextSuffix();
  if (todoSuffix) {
    preparedMessages.push({
      role: 'system',
      content: `<context type="todo">\n${todoSuffix}\n</context>`,
    });
  }
}

/**
 * Phase 4 — Sanitize assistant output: strip model leakage tokens
 * (`<think>`, `<|im_start|>`, `[INST]`, GLM-5/DeepSeek artifacts) and
 * invisible characters. Tests assert sanitized output — do not bypass.
 */
export function sanitizeAssistantOutput(raw: string): string {
  return stripInvisibleChars(sanitizeModelOutput(raw));
}
