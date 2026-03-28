# Reasoning

Code Buddy has two reasoning systems that coexist.

## Extended Thinking (Provider-Level)

Provider-level thinking supported by Grok via `budget_tokens`. Six levels:

| Level | Description |
|:------|:------------|
| `off` | No thinking |
| `minimal` | Minimal reasoning |
| `low` | Light reasoning |
| `medium` | Moderate reasoning |
| `high` | Substantial reasoning |
| `xhigh` | Maximum reasoning budget |

Configured in `src/agent/thinking/extended-thinking.ts`.

## Tree-of-Thought + MCTS

A structured reasoning engine in `src/agent/reasoning/` with four modes:

| Mode | Technique | Description |
|:-----|:----------|:------------|
| `shallow` | Chain-of-Thought | Single-pass CoT reasoning |
| `medium` | Tree-of-Thought BFS | Beam search over thought tree |
| `deep` | MCTS | Monte Carlo Tree Search |
| `exhaustive` | Full MCTS | MCTS + progressive deepening |

**MCTSr Q-value formula**: `Q(a) = 0.5 * (min(R) + mean(R))` (from arXiv 2406.07394)

Features:
- BFS beam search with configurable beam width
- Token budget tracking
- Progressive deepening with auto-escalation
- Streaming progress events via `tool_stream`

### Key Components

| Component | File | Purpose |
|:----------|:-----|:--------|
| Tree-of-Thought | `src/agent/reasoning/tree-of-thought.ts` | Thought generation, evaluation, `solve()` + `solveStreaming()` |
| MCTS | `src/agent/reasoning/mcts.ts` | MCTSr search with BFS/MCTS/progressive modes |
| Reasoning Facade | `src/agent/reasoning/reasoning-facade.ts` | Unified entry point, auto-mode selection, auto-escalation |
| Reasoning Middleware | `src/agent/middleware/reasoning-middleware.ts` | Priority 42, auto-detects complex queries (score 0-15) |

## /think Command

```
/think off                    # Disable reasoning
/think shallow                # Chain-of-Thought
/think medium                 # Tree-of-Thought BFS
/think deep                   # MCTS
/think exhaustive             # Full MCTS + progressive deepening
/think status                 # Show current config and last result
/think <problem description>  # Run reasoning on a specific problem
```

Shortcut aliases:
- `/megathink` -- deep reasoning (10K tokens)
- `/ultrathink` -- exhaustive reasoning (32K tokens)

## Auto-Escalation

The reasoning middleware (priority 42) automatically detects complex queries using a scoring system (0-15). When complexity exceeds a threshold, it auto-escalates the reasoning depth and injects a `<reasoning_guidance>` block into the conversation.

## reason Tool

The `reason` tool is LLM-callable, allowing the agent to invoke structured reasoning during execution. It streams MCTS progress events alongside tool execution in the agent-executor.
