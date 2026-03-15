# Context & Memory Management

The context management system ensures conversations stay within the LLM's token limit while preserving the most important information.

## Context Manager V2

Four-stage compression pipeline (`src/context/context-manager-v2.ts`):

| Stage | Strategy | Token Reduction |
|-------|----------|----------------|
| 1 | Sliding window with importance scoring | 30-50% |
| 2 | Tool result truncation | 10-30% |
| 3 | LLM-based summarization | 40-70% |
| 4 | Hard truncation (last resort) | 70-90% |

Importance scores by content type:

| Content Type | Score | Preservation |
|-------------|-------|-------------|
| Error messages | 0.95 | Nearly always preserved |
| Architectural decisions | 0.90 | High priority |
| Code blocks | 0.70 | Medium-high |
| General conversation | 0.25 | First to compress |

## Attention Bias Patterns

- **Todo.md**: Appended at END of context (transformer recency bias)
- **Lessons.md**: Injected BEFORE messages (high priority)
- **Decision memory**: Injected with architectural rationale
- **Code graph**: Per-turn ego-graph of mentioned entities

## Tool Output Management

**Adaptive compaction**: Threshold scales to 30% of model context window (not hardcoded).

**TTL-based expiry** (`src/context/tool-output-masking.ts`):

| Age (% of max) | Treatment |
|----------------|-----------|
| 0-50% | Full content preserved |
| 50-75% | Head/tail preview (10+10 lines) |
| 75-100% | One-line stub |
| >100% | Removed entirely |

**Backward-scanned FIFO masking**: Newest ~50K tokens protected, older outputs replaced with previews.

## JIT Context Discovery

When tools access files, the system dynamically loads context files (`CODEBUDDY.md`, `CONTEXT.md`) from the accessed subdirectory. Context grows organically as the agent explores.

## Memory Consolidation

Two-phase pipeline (`src/memory/memory-consolidation.ts`):

1. **Extraction**: Detect preferences, patterns, corrections from user messages
2. **Consolidation**: Merge into `.codebuddy/memory/` folder with dedup

Output structure:

- `memory_summary.md` — Always loaded into system prompt
- `MEMORY.md` — Full handbook entries
- `rollout_summaries/` — Per-session distilled summaries