---
title: "tests — context"
module: "tests-context"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.869Z"
---
# tests — context

The `tests/context` module is a critical part of the codebase, dedicated to ensuring the robustness, correctness, and efficiency of the application's context management system. It provides comprehensive test coverage for the various components responsible for handling, processing, and optimizing conversational context for interactions with Large Language Models (LLMs).

This documentation outlines the purpose of the `tests/context` module and details the key components within `src/context` that are rigorously tested, highlighting their functionality and the specific aspects verified by the tests.

## Core Context Management

The foundation of context handling revolves around a pluggable engine and a central manager, supported by a guard for token limits.

### `ContextEngine` (Interface & `DefaultContextEngine`)

*   **Purpose**: Defines a pluggable interface (`ContextEngine`) for custom context management logic, allowing different strategies to be swapped in. `DefaultContextEngine` provides a baseline implementation.
*   **Tested Aspects**:
    *   **Hook Call Order**: Verifies that all lifecycle hooks (`bootstrap`, `ingest`, `assemble`, `compact`, `afterTurn`, `prepareSubagentSpawn`, `onSubagentEnded`) are called in the expected sequence.
    *   **Default Behaviors**: Confirms that the `DefaultContextEngine` performs pass-through operations for `ingest` and `compact`, and provides sensible defaults for `assemble` (returning messages with zero token count if no manager is set) and subagent context preparation (limiting messages based on role).
    *   **`ownsCompaction` Flag**: Tests the behavior of engines that declare `ownsCompaction = true`, demonstrating how they can take over the `assemble` step to implement custom message trimming.

### `ContextManagerV2`

*   **Purpose**: The central orchestrator for conversational context. It manages message history, applies various compaction strategies, and interacts with other context components to maintain an optimal context window for LLM interactions.
*   **Tested Aspects** (specifically gap coverage from `context-manager-v2-gaps.test.ts`):
    *   **Memory Metrics**: Verifies the accurate tracking and reporting of `summaryCount`, `summaryTokens`, `peakMessageCount`, `compressionCount`, `totalTokensSaved`, `lastCompressionTime`, and `warningsTriggered`.
    *   **Warning Thresholds**: Ensures `shouldWarn()` correctly identifies when context usage exceeds configured thresholds (e.g., 50%, 75%, 90%) and that warnings are deduplicated (not re-triggered for the same threshold) and can be reset.
    *   **Auto-Compaction**: Tests `shouldAutoCompact()` to confirm it correctly signals when the current token count surpasses the `autoCompactThreshold`.
    *   **Lifecycle Management**: Verifies `forceCleanup()` resets metrics and clears warnings, and `dispose()` safely clears internal state and can be called multiple times.
    *   **Enhanced Compression API**: Checks the initial state and basic functionality of `getLastCompressionResult()`, `listContextArchives()`, and `recoverFullContext()`.

### `ContextWindowGuard`

*   **Purpose**: Acts as a gatekeeper for the LLM's context window, preventing token overruns and providing warnings when usage approaches critical limits.
*   **Tested Aspects**:
    *   **Token Resolution Hierarchy**: Verifies the correct priority for determining the effective context window size (session config > agent config > model config > model default > system default).
    *   **Warning and Blocking Logic**: Ensures `evaluateContextWindowGuard()` correctly identifies when to warn (below `CONTEXT_WINDOW_WARN_BELOW_TOKENS`) or block (below `CONTEXT_WINDOW_HARD_MIN_TOKENS`) based on current usage.
    *   **Event Emission**: Confirms the `ContextWindowGuard` class emits `warning`, `blocked`, and `threshold-crossed` events at appropriate times.
    *   **Configuration**: Tests that `enableWarnings` and `enableBlocking` flags correctly control the guard's behavior.
    *   **Singleton Pattern**: Verifies that `getContextWindowGuard()` consistently returns the same instance and `resetContextWindowGuard()` creates a fresh one.
    *   **Utility Functions**: Tests `normalizePositiveInt()` for input validation and `shouldCompact()` for determining when compaction is necessary.

## Initial Context & Bootstrap

### `BootstrapLoader`

*   **Purpose**: Responsible for discovering and loading initial context files (e.g., `BOOTSTRAP.md`, `SOUL.md`) from both project-specific (`.codebuddy/`) and global directories at session start.
*   **Tested Aspects**:
    *   **File Discovery**: Verifies that the loader correctly finds and loads single or multiple files from both project and global directories, and checks all default file names.
    *   **Project Overrides Global**: Ensures that project-level files take precedence over global files with the same name, and gracefully falls back to global if the project file is missing or empty.
    *   **Token Limit & Truncation**: Tests that content exceeding `maxChars` is truncated, and that the loader stops processing additional files once the limit is reached. It also verifies `tokenCount` accuracy.
    *   **Security Pattern Rejection**: Crucially, it tests the rejection of files containing dangerous patterns (e.g., `eval()`, `require('child_process')`, `<script>` tags) to prevent malicious code injection, logging warnings for skipped files.
    *   **Custom Configuration**: Confirms support for custom file names, project directory names, and global directory paths.
    *   **Content Formatting**: Verifies that multiple sections are separated by horizontal rules and that content is trimmed and formatted with section headers.

## Context Compaction & Pruning Strategies

These components work together to reduce the size of the context while preserving the most important information.

### `ImportanceScorer`

*   **Purpose**: Assigns a numerical importance score to each message, guiding compaction strategies on which messages to prioritize for retention or summarization.
*   **Tested Aspects**:
    *   **Content Type Detection**: Verifies accurate classification of messages into types like `system`, `code`, `error`, `decision`, `file_content`, `command`, `tool_result`, and `conversation`.
    *   **Scoring Formula**: Tests the application of base weights (e.g., system messages are highest, conversation lowest), recency boost (more recent messages score higher), and length penalty (longer messages are penalized).
    *   **Role Bonuses**: Confirms that `user` and `system` roles receive specific score bonuses.
    *   **Compression Prioritization**: Ensures `prioritizeForCompression()` returns message indices sorted by ascending score, indicating the order in which messages should be considered for removal or summarization.
    *   **Configuration**: Verifies that custom weights, recency boost, and length penalty thresholds can be configured.

### `Adaptive Chunker`

*   **Purpose**: Divides a list of messages into smaller, more manageable chunks, optimizing for parallel processing and balanced distribution.
*   **Tested Aspects**:
    *   **Message Statistics**: Accurately calculates `totalMessages`, `totalTokens`, `avgTokensPerMessage`, `maxTokensPerMessage`, and `minTokensPerMessage`.
    *   **Optimal Chunk Count**: Determines an appropriate number of chunks based on message statistics and target chunk sizes, adjusting to avoid too small or too large chunks.
    *   **Chunking Logic**: Verifies that messages are correctly grouped into chunks, respecting `maxChunkSize` and tracking `tokenCount` per chunk.
    *   **Chunk Balancing**: Ensures `balanceChunks()` merges small chunks to create more evenly sized chunks and re-indexes them correctly.

### `Parallel Summarizer`

*   **Purpose**: Summarizes individual message chunks, potentially in parallel, to reduce their token count while retaining key information.
*   **Tested Aspects**:
    *   **`LocalSummarizer`**: Tests the ability to extract important sentences from text based on keywords and indicators, handling empty or non-critical text gracefully.
    *   **Parallel Summarization**: Verifies that `summarizeChunksParallel()` processes multiple chunks concurrently, returning summaries with correct indexing and calculating compression ratios.
    *   **Summary Merging**: Ensures `mergeSummaries()` combines individual chunk summaries, adding part markers (e.g., `[Part 1/4]`) for larger sets of summaries.
    *   **Text Truncation**: Tests `truncateText()` for preserving head and tail sections of long text while inserting a truncation marker.

### `Progressive Fallback`

*   **Purpose**: Implements a series of increasingly aggressive content reduction strategies to fit messages within a target token budget.
*   **Tested Aspects**:
    *   **Individual Strategies**: Verifies the behavior of `applyTruncation` (head/tail preservation), `removeMiddle` (70/30 head/tail split), `extractKeyInfo` (keyword-based sentence extraction, fallback to aggressive truncate), and `aggressiveTruncate` (hard truncation).
    *   **Progressive Application**: Ensures `applyProgressiveFallback()` attempts strategies in order of aggressiveness, using the first one that meets the target token count.
    *   **Message Fallback**: Tests `applyMessageFallback()`'s ability to summarize an entire set of messages into a single system message, including compression stats and fallback markers.

### `Memory Flush` (`extractFlushableMemories`)

*   **Purpose**: Identifies and extracts structured memories (decisions, facts, context) from assistant messages for long-term storage or retrieval.
*   **Tested Aspects**:
    *   **Memory Type Extraction**: Verifies the ability to extract `decision`, `fact`, and `context` memories based on content patterns.
    *   **Role-Based Extraction**: Ensures context is primarily extracted from assistant messages, not user messages.
    *   **Deduplication**: Tests that similar or identical memories are deduplicated.
    *   **Auto-Tagging**: Confirms that extracted memories are tagged with `auto-extracted` and `compaction`.
    *   **Sentence Length Limits**: Verifies that extracted sentences adhere to minimum and maximum length constraints.

## Background Context Operations

### `PrecompactionFlusher`

*   **Purpose**: Asynchronously extracts and saves important facts from the conversation to a `MEMORY.md` file, acting as a silent background memory archivist.
*   **Tested Aspects**:
    *   **Trigger Conditions**: Verifies that flushing is skipped for short message histories (e.g., less than 4 messages).
    *   **LLM Interaction**: Confirms that `flush()` calls the provided `chatFn` with a system prompt and a conversation snapshot.
    *   **`NO_REPLY` Handling**: Ensures that `NO_REPLY` responses from the LLM (or short acknowledgements) correctly suppress fact extraction.
    *   **Fact Extraction**: Tests that bulleted lists from the LLM response are parsed as facts and that `factsCount` is accurate.
    *   **File Saving**: Verifies that facts are appended to `workDir/MEMORY.md` with a datestamp header, and that it gracefully falls back to a global `.codebuddy/MEMORY.md` if the local write fails.
    *   **Snapshot Building**: Ensures the conversation snapshot sent to the LLM filters out system messages, truncates long content, and limits the total number of messages.

## Output & Transcript Repair

### `ObservationVariator`

*   **Purpose**: Prevents repetitive phrasing in tool results and memory blocks by cycling through different templates, enhancing the naturalness of LLM interactions.
*   **Tested Aspects**:
    *   **Template Cycling**: Verifies that `wrapToolResult()` and `wrapMemoryBlock()` cycle through a set of distinct templates/phrasings on consecutive turns.
    *   **Turn Management**: Ensures `nextTurn()` correctly advances the internal turn counter and `reset()` returns it to the initial state.
    *   **Singleton Behavior**: Confirms that `getObservationVariator()` returns a consistent instance and `resetObservationVariator()` creates a new one.

### `patchDanglingToolCalls` (from `transcript-repair.js`)

*   **Purpose**: Modifies the message transcript to inject synthetic `[executing...]` tool results for any tool calls made by the *last* assistant message that have not yet received a corresponding tool output. This prevents LLMs from getting stuck waiting for a tool result that might not arrive immediately.
*   **Tested Aspects**:
    *   **Dangling Call Detection**: Correctly identifies tool calls in the last assistant message that lack a subsequent `tool` message with a matching `tool_call_id`.
    *   **Synthetic Result Injection**: Inserts `tool` messages with `[executing...]` content for each dangling call.
    *   **Scope**: Ensures only the *last* assistant message with `tool_calls` is considered for patching, and that existing tool results are respected.
    *   **Mutation**: Verifies that the function modifies the original message array in place by appending new messages.

## Architectural Overview

The context management system is modular, with `ContextManagerV2` acting as the central coordinator. It leverages various specialized components for different aspects of context handling.

```mermaid
graph TD
    subgraph Core Management
        CMV2[ContextManagerV2]
        CE[ContextEngine Interface]
        CWG[ContextWindowGuard]
    end

    subgraph Initial Context
        BL[BootstrapLoader]
    end

    subgraph Compaction & Pruning
        IS[ImportanceScorer]
        AC[Adaptive Chunker]
        PS[Parallel Summarizer]
        PF[Progressive Fallback]
        MF[Memory Flush (extract)]
    end

    subgraph Background Operations
        PCF[PrecompactionFlusher]
    end

    subgraph Output & Repair
        OV[ObservationVariator]
        TD[Transcript Repair (patchDanglingToolCalls)]
    end

    BL --> CMV2
    CE <--> CMV2
    CWG <--> CMV2

    CMV2 --> IS
    CMV2 --> AC
    CMV2 --> PS
    CMV2 --> PF
    CMV2 --> MF

    CMV2 --> PCF
    CMV2 --> OV
    CMV2 --> TD

    PS --> AC
    PF --> PS
    MF --> PF
```

## Contributing to Context Tests

When contributing to the context management system, it's crucial to understand the existing test patterns:

*   **Isolation**: Most tests mock external dependencies (like `fs/promises` or LLM `chatFn`) to ensure fast, reliable, and isolated unit tests.
*   **Edge Cases**: Pay close attention to tests covering empty inputs, boundary conditions (e.g., `maxChars: 0`), and error handling.
*   **Behavior-Driven**: Tests often describe the *behavior* of the component (e.g., "should prefer project file over global file") rather than just implementation details.
*   **Metrics & State**: For stateful components like `ContextManagerV2` or `ContextWindowGuard`, tests frequently verify internal metrics and state changes.
*   **Security**: For components handling external input (like `BootstrapLoader`), security pattern rejection is a key testing area.

When adding new features or fixing bugs, ensure you:
1.  **Add new test cases** that specifically target the new functionality or the bug fix.
2.  **Update existing tests** if the expected behavior of a component changes.
3.  **Maintain isolation** by mocking dependencies where appropriate.
4.  **Run all tests** (`vitest` or `jest`) to ensure no regressions are introduced.