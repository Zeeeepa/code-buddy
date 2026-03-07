# Real-Conditions Test Suite — Complete Documentation

**100 categories | 590 tests | Cat 26-125**

This test suite exercises **real module imports** (no mocks) across 40+ subsystems of Code Buddy.
API tests use **Gemini 2.5 Flash** with real HTTP calls; non-API tests validate internal logic only.

## How to Run

```bash
export GOOGLE_API_KEY="AIza..."
npx tsx scripts/run-all-tests.ts
```

Reports are saved to `.custom-output/gemini-extended-test-{timestamp}.json`.

---

## File Structure

| File | Categories | Tests |
|------|-----------|-------|
| `cat-context-memory.ts` | 26-27 | 12 |
| `cat-identity-hooks.ts` | 28-29 | 12 |
| `cat-security-advanced.ts` | 30-32 | 15 |
| `cat-messaging.ts` | 33-34 | 11 |
| `cat-gateway-daemon.ts` | 35-37 | 16 |
| `cat-tools-registry.ts` | 38-39 | 12 |
| `cat-workflow-extended.ts` | 40-41 | 12 |
| `cat-api-advanced.ts` | 42-44 | 16 |
| `cat-channels-extended.ts` | 45-47 | 14 |
| `cat-canvas-extended.ts` | 48-50 | 15 |
| `cat-checkpoint-persona.ts` | 51-53 | 19 |
| `cat-utils-core.ts` | 54-57 | 25 |
| `cat-rate-history-cache.ts` | 58-61 | 24 |
| `cat-automation-sdk.ts` | 62-65 | 24 |
| `cat-skills-sandbox.ts` | 66-69 | 23 |
| `cat-api-gemini-extended.ts` | 70-75 | 30 |
| `cat-context-engineering.ts` | 76-80 | 30 |
| `cat-sanitize-glob-deploy.ts` | 81-85 | 31 |
| `cat-channels-plugins.ts` | 86-90 | 32 |
| `cat-agent-advanced.ts` | 91-95 | 32 |
| `cat-memory-tools-config.ts` | 96-100 | 29 |
| `cat-hooks-config-advanced.ts` | 101-105 | 33 |
| `cat-tools-policy-explorer.ts` | 106-110 | 32 |
| `cat-config-backup-toml.ts` | 111-115 | 30 |
| `cat-lifecycle-preprocessing.ts` | 116-120 | 31 |
| `cat-channel-types-toolgroups.ts` | 121-125 | 30 |

---

## Test Harness (`types.ts`)

- **`TestDef`** — `{ name, fn, timeout?, retries?, mandatory? }`
- **`CategoryDef`** — `{ name, tests, abortOnFirst? }`
- **`runWithRetry(fn, label, maxRetries=2, delays=[1500,3000])`** — Exponential backoff
- **`runTest(test, category)`** — Wraps a single test with timeout + retry
- **`runCategory(name, tests, abortOnFirst?)`** — Sequential execution, 800ms inter-test delay
- **`sleep(ms)`** — Promise-based delay

---

## All Categories & Tests

### Cat 26: Context Manager V2 (7 tests, no API)

**Source:** `cat-context-memory.ts` | **Module:** `src/context/context-manager-v2.ts`

| # | Test | Description |
|---|------|-------------|
| 26.1 | `create-with-defaults` | Instantiate ContextManagerV2 with default config |
| 26.2 | `token-counting` | Count tokens for a message array |
| 26.3 | `should-warn-threshold` | Warning triggers at 80% context usage |
| 26.4 | `should-auto-compact` | Auto-compact triggers at 90% context usage |
| 26.5 | `prepare-messages-preserves-short` | Short conversations pass through unchanged |
| 26.6 | `memory-metrics-shape` | getMetrics() returns expected fields |
| 26.7 | `reset-warnings-clears-triggered` | resetWarnings() clears triggered state |

### Cat 27: Hybrid Memory Search (5 tests, no API)

**Source:** `cat-context-memory.ts` | **Module:** `src/memory/hybrid-search.ts`

| # | Test | Description |
|---|------|-------------|
| 27.1 | `singleton-lifecycle` | getInstance/resetInstance singleton pattern |
| 27.2 | `index-and-search` | Index documents and search by query |
| 27.3 | `weights-configuration` | Configure BM25/semantic/recency weights |
| 27.4 | `clear-empties-index` | clear() removes all indexed documents |
| 27.5 | `bm25-tf-frequency-boost` | Term frequency boosts BM25 relevance |

### Cat 28: Identity Manager (6 tests, no API)

**Source:** `cat-identity-hooks.ts` | **Module:** `src/identity/identity-manager.ts`

| # | Test | Description |
|---|------|-------------|
| 28.1 | `load-from-project-dir` | Load SOUL.md/USER.md from project directory |
| 28.2 | `global-fallback` | Falls back to global identity files |
| 28.3 | `project-overrides-global` | Project identity overrides global |
| 28.4 | `get-by-name` | Get identity document by name |
| 28.5 | `prompt-injection-format` | Format identity as prompt injection block |
| 28.6 | `set-creates-file` | set() creates identity file on disk |

### Cat 29: Lifecycle Hooks (6 tests, no API)

**Source:** `cat-identity-hooks.ts` | **Module:** `src/hooks/lifecycle-hooks.ts`

| # | Test | Description |
|---|------|-------------|
| 29.1 | `register-and-get-hooks` | Register hook and retrieve it |
| 29.2 | `execute-handler-hook` | Execute hook with handler function |
| 29.3 | `unregister-hook` | Remove a registered hook |
| 29.4 | `disabled-hook-not-executed` | Disabled hooks are skipped |
| 29.5 | `get-hooks-by-type` | Filter hooks by type (pre-tool, post-edit) |
| 29.6 | `format-status` | Format hooks status for display |

### Cat 30: Security Modes & Patterns (5 tests, no API)

**Source:** `cat-security-advanced.ts` | **Module:** `src/security/security-modes.ts`, `src/security/dangerous-patterns.ts`

| # | Test | Description |
|---|------|-------------|
| 30.1 | `security-mode-type` | SecurityMode type includes suggest/auto-edit/full-auto |
| 30.2 | `security-mode-manager-instantiation` | SecurityModeManager instantiation |
| 30.3 | `dangerous-rm-command-name` | Detects `rm -rf /` as dangerous |
| 30.4 | `match-dangerous-pattern` | Matches patterns like sudo, chmod 777 |
| 30.5 | `safe-commands-pass` | Safe commands (ls, git status) pass checks |

### Cat 31: Skill Scanner (5 tests, no API)

**Source:** `cat-security-advanced.ts` | **Module:** `src/security/skill-scanner.ts`

| # | Test | Description |
|---|------|-------------|
| 31.1 | `scan-file-export` | scanFile() is exported and callable |
| 31.2 | `scan-directory-export` | scanDirectory() is exported |
| 31.3 | `format-scan-report` | formatScanReport() formats findings |
| 31.4 | `finding-severity-types` | Severity types: critical/high/medium/low |
| 31.5 | `scan-all-skills-export` | scanAllSkills() is exported |

### Cat 32: Tool Policy Groups (5 tests, no API)

**Source:** `cat-security-advanced.ts` | **Module:** `src/security/tool-policy/groups.ts`

| # | Test | Description |
|---|------|-------------|
| 32.1 | `groups-export-exists` | TOOL_GROUPS export exists with 10+ groups |
| 32.2 | `tool-groups-maps-tools-to-groups` | Maps tools to their security groups |
| 32.3 | `policy-groups-export` | PolicyGroups functions exported |
| 32.4 | `groups-module-consistency` | Module self-consistency check |
| 32.5 | `dangerous-patterns-set-populated` | Dangerous patterns set has entries |

### Cat 33: Message Preprocessing (6 tests, no API)

**Source:** `cat-messaging.ts` | **Module:** `src/channels/message-preprocessing.ts`

| # | Test | Description |
|---|------|-------------|
| 33.1 | `singleton-lifecycle` | getInstance/resetInstance pattern |
| 33.2 | `config-defaults` | Default config has sensible values |
| 33.3 | `link-extraction` | Extracts URLs from message content |
| 33.4 | `media-detection` | Detects media attachments |
| 33.5 | `content-enrichment` | Enriches message with metadata |
| 33.6 | `update-config` | updateConfig() merges new settings |

### Cat 34: Prompt Suggestions (5 tests, no API)

**Source:** `cat-messaging.ts` | **Module:** `src/agent/prompt-suggestions.ts`

| # | Test | Description |
|---|------|-------------|
| 34.1 | `enable-disable` | Toggle prompt suggestions on/off |
| 34.2 | `heuristic-test-keyword` | Detects "test" keyword for suggestions |
| 34.3 | `heuristic-error-keyword` | Detects "error" keyword for suggestions |
| 34.4 | `cache-retrieval` | Cached suggestions returned on repeat |
| 34.5 | `clear-suggestions` | clear() removes all cached suggestions |

### Cat 35: Gateway Message Types (6 tests, no API)

**Source:** `cat-gateway-daemon.ts` | **Module:** `src/gateway/types.ts`, `src/gateway/server.ts`

| # | Test | Description |
|---|------|-------------|
| 35.1 | `create-message-helper` | createMessage() helper returns valid shape |
| 35.2 | `create-error-message` | createErrorMessage() with error code |
| 35.3 | `default-config` | Default gateway config values |
| 35.4 | `session-manager-create` | SessionManager creation |
| 35.5 | `gateway-types-exported` | All gateway types are exported |
| 35.6 | `message-id-uniqueness` | Message IDs are unique per call |

### Cat 36: Daemon & Daily Reset (5 tests, no API)

**Source:** `cat-gateway-daemon.ts` | **Module:** `src/daemon/daily-reset.ts`, `src/daemon/index.ts`

| # | Test | Description |
|---|------|-------------|
| 36.1 | `daily-reset-instantiation` | DailyReset instantiation |
| 36.2 | `reset-hour-configurable` | Reset hour configurable (default 4:00) |
| 36.3 | `should-reset-logic` | shouldReset() returns boolean |
| 36.4 | `daemon-module-exports` | Daemon module exports all expected symbols |
| 36.5 | `service-installer-exports` | ServiceInstaller exports present |

### Cat 37: Background Tasks (5 tests, no API)

**Source:** `cat-gateway-daemon.ts` | **Module:** `src/agent/background-tasks.ts`

| # | Test | Description |
|---|------|-------------|
| 37.1 | `singleton-lifecycle` | getInstance/resetInstance pattern |
| 37.2 | `list-tasks-initially-empty` | No tasks on fresh instance |
| 37.3 | `get-nonexistent-task` | Returns undefined for unknown task ID |
| 37.4 | `get-task-output-nonexistent` | Returns null for unknown task output |
| 37.5 | `kill-nonexistent-returns-false` | kill() returns false for unknown task |

### Cat 38: Tool Registry (7 tests, no API)

**Source:** `cat-tools-registry.ts` | **Module:** `src/tools/registry/index.ts`

| # | Test | Description |
|---|------|-------------|
| 38.1 | `create-test-registry` | Create a new ToolRegistry instance |
| 38.2 | `empty-registry-stats` | Empty registry has zero counts |
| 38.3 | `register-and-get` | Register a tool and retrieve by name |
| 38.4 | `has-checks-existence` | has() checks tool existence |
| 38.5 | `get-all-and-get-names` | getAll() and getNames() list tools |
| 38.6 | `stats-after-registration` | Stats update after registration |
| 38.7 | `unregister-tool` | unregister() removes a tool |

### Cat 39: Tool Metadata (5 tests, no API)

**Source:** `cat-tools-registry.ts` | **Module:** `src/tools/metadata.ts`

| # | Test | Description |
|---|------|-------------|
| 39.1 | `metadata-has-many-tools` | TOOL_METADATA has 20+ entries |
| 39.2 | `all-tools-have-keywords` | Every tool has keywords array |
| 39.3 | `all-tools-have-priority` | Every tool has numeric priority |
| 39.4 | `category-keywords-coverage` | Categories cover fs/git/web/etc |
| 39.5 | `search-keyword-relevance` | Keyword search finds relevant tools |

### Cat 40: Lobster Engine Extended (7 tests, no API)

**Source:** `cat-workflow-extended.ts` | **Module:** `src/workflows/lobster-engine.ts`

| # | Test | Description |
|---|------|-------------|
| 40.1 | `cycle-detection` | Detects circular dependencies in DAG |
| 40.2 | `duplicate-step-ids` | Rejects duplicate step IDs |
| 40.3 | `unknown-dependency` | Rejects unknown dependency references |
| 40.4 | `variable-resolution` | Resolves `${var}` in step definitions |
| 40.5 | `step-reference-resolution` | Resolves `$stepId.output` references |
| 40.6 | `condition-evaluation` | Evaluates step conditions |
| 40.7 | `resume-token-roundtrip` | Pause/resume token serialization |

### Cat 41: Coding Style Analyzer (5 tests, no API)

**Source:** `cat-workflow-extended.ts` | **Module:** `src/memory/coding-style-analyzer.ts`

| # | Test | Description |
|---|------|-------------|
| 41.1 | `instantiation` | Create CodingStyleAnalyzer |
| 41.2 | `analyze-typescript-style` | Analyze a TypeScript code sample |
| 41.3 | `detect-indent-style` | Detect 2-space vs 4-space vs tab |
| 41.4 | `detect-quotes` | Detect single vs double quotes |
| 41.5 | `detect-semicolons` | Detect semicolon usage |

### Cat 42: Advanced Gemini API (6 tests, API)

**Source:** `cat-api-advanced.ts` | **Module:** `src/providers/gemini-provider.ts`

| # | Test | Description |
|---|------|-------------|
| 42.1 | `system-prompt-complex` | Complex system prompt with constraints |
| 42.2 | `empty-response-handling` | Handle empty/null response gracefully |
| 42.3 | `special-characters-in-prompt` | Unicode and special chars in prompt |
| 42.4 | `very-long-system-prompt` | System prompt truncation at limits |
| 42.5 | `tool-with-enum-param` | Tool definition with enum parameter |
| 42.6 | `nested-object-tool-params` | Tool with nested object parameters |

### Cat 43: Multi-Turn Conversations (5 tests, API)

**Source:** `cat-api-advanced.ts` | **Module:** `src/providers/gemini-provider.ts`

| # | Test | Description |
|---|------|-------------|
| 43.1 | `3-turn-context-retention` | Model retains info across 3 turns |
| 43.2 | `correction-handling` | Model accepts corrections mid-conversation |
| 43.3 | `role-consistency` | Role alternation stays consistent |
| 43.4 | `client-basic-chat` | CodeBuddyClient basic chat roundtrip |
| 43.5 | `empty-assistant-handled` | Empty assistant message handled gracefully |

### Cat 44: Provider Edge Cases (5 tests, mixed)

**Source:** `cat-api-advanced.ts` | **Module:** `src/providers/gemini-provider.ts`

| # | Test | Description |
|---|------|-------------|
| 44.1 | `provider-supports-streaming` | supportsStreaming() returns true |
| 44.2 | `provider-supports-tools` | supportsTools() returns true |
| 44.3 | `provider-supports-vision` | supportsVision() returns true |
| 44.4 | `estimate-tokens` | estimateTokens() returns reasonable count |
| 44.5 | `get-pricing` | getPricing() returns input/output rates |

### Cat 45: Channel Core Types (5 tests, no API)

**Source:** `cat-channels-extended.ts` | **Module:** `src/channels/core.ts`, `src/channels/index.ts`

| # | Test | Description |
|---|------|-------------|
| 45.1 | `core-types-exported` | Core channel types are exported |
| 45.2 | `channel-types-include-major` | ChannelType includes telegram/discord/slack |
| 45.3 | `channel-index-exports` | Channel index re-exports adapters |
| 45.4 | `inbound-message-shape` | InboundMessage interface shape |
| 45.5 | `send-policy-integration` | Send policy module accessible from channels |

### Cat 46: Niche Channels (5 tests, no API)

**Source:** `cat-channels-extended.ts` | **Module:** `src/channels/niche-channels.ts`

| # | Test | Description |
|---|------|-------------|
| 46.1 | `niche-channels-module-exports` | Niche channels module exists |
| 46.2 | `irc-channel-exists` | IRC channel adapter exists |
| 46.3 | `feishu-channel-exists` | Feishu/Lark adapter exists |
| 46.4 | `synology-chat-exists` | Synology Chat adapter exists |
| 46.5 | `line-channel-exists` | LINE adapter exists |

### Cat 47: PR Session Linker (4 tests, no API)

**Source:** `cat-channels-extended.ts` | **Module:** `src/integrations/pr-session-linker.ts`

| # | Test | Description |
|---|------|-------------|
| 47.1 | `module-exports` | Module exports expected symbols |
| 47.2 | `instantiation` | PRSessionLinker instantiation |
| 47.3 | `link-and-get` | Link a PR to a session and retrieve it |
| 47.4 | `unlink` | Unlink a PR from a session |

### Cat 48: Canvas Undo/Redo & Rendering (6 tests, no API)

**Source:** `cat-canvas-extended.ts` | **Module:** `src/canvas/canvas-manager.ts`

| # | Test | Description |
|---|------|-------------|
| 48.1 | `undo-reverts-add` | Undo reverses an add operation |
| 48.2 | `redo-restores-element` | Redo restores an undone element |
| 48.3 | `can-undo-can-redo` | canUndo/canRedo state tracking |
| 48.4 | `snap-to-grid` | Snap element coordinates to grid |
| 48.5 | `locked-element-cannot-move` | Locked elements reject moves |
| 48.6 | `render-to-html` | Render canvas to HTML output |

### Cat 49: ROI Tracker Extended (5 tests, no API)

**Source:** `cat-canvas-extended.ts` | **Module:** `src/analytics/roi-tracker.ts`

| # | Test | Description |
|---|------|-------------|
| 49.1 | `format-report-output` | formatReport() produces readable output |
| 49.2 | `recommendations-high-roi` | High-ROI tasks generate recommendations |
| 49.3 | `export-data-json` | exportData() returns valid JSON |
| 49.4 | `clear-removes-all` | clear() removes all tracked data |
| 49.5 | `success-rate-calculation` | Correct success rate percentage |

### Cat 50: Observability & Tracing (4 tests, no API)

**Source:** `cat-canvas-extended.ts` | **Module:** `src/observability/index.ts`, `src/observability/tracing.ts`

| # | Test | Description |
|---|------|-------------|
| 50.1 | `observability-module-exports` | Module exports init/record functions |
| 50.2 | `init-observability-idempotent` | init() is idempotent (safe to call twice) |
| 50.3 | `tracing-module-exports` | Tracing module exports spans/traces |
| 50.4 | `no-crash-without-env-vars` | Works without OTEL_ENDPOINT/SENTRY_DSN |

### Cat 51: Checkpoint Manager (7 tests, no API)

**Source:** `cat-checkpoint-persona.ts` | **Module:** `src/context/checkpoint-manager.ts`

| # | Test | Description |
|---|------|-------------|
| 51.1 | `create-checkpoint` | Create a checkpoint with file data |
| 51.2 | `checkpoint-max-limit` | Respects max checkpoint limit |
| 51.3 | `checkpoint-before-edit` | Auto-checkpoint before file edit |
| 51.4 | `checkpoint-before-create` | Auto-checkpoint before file creation |
| 51.5 | `rewind-to-checkpoint` | Rewind restores file state |
| 51.6 | `rewind-nonexistent-fails` | Rewind to unknown checkpoint fails |
| 51.7 | `checkpoint-event-emitted` | Checkpoint creation emits event |

### Cat 52: Persona Manager (7 tests, no API)

**Source:** `cat-checkpoint-persona.ts` | **Module:** `src/personas/persona-manager.ts`

| # | Test | Description |
|---|------|-------------|
| 52.1 | `builtin-personas-loaded` | Built-in personas are loaded |
| 52.2 | `get-persona-by-id` | Get persona by its ID |
| 52.3 | `set-active-persona` | Set the active persona |
| 52.4 | `nonexistent-persona-fails` | Setting unknown persona fails |
| 52.5 | `builtin-vs-custom` | Distinguish built-in from custom personas |
| 52.6 | `build-system-prompt` | Build system prompt with persona traits |
| 52.7 | `format-status` | Format persona status for display |

### Cat 53: Conversation Exporter (5 tests, no API)

**Source:** `cat-checkpoint-persona.ts` | **Module:** `src/utils/session-enhancements.ts`

| # | Test | Description |
|---|------|-------------|
| 53.1 | `exporter-instantiation` | Create ConversationExporter instance |
| 53.2 | `export-markdown` | Export conversation as Markdown |
| 53.3 | `export-json` | Export conversation as JSON |
| 53.4 | `export-text` | Export conversation as plain text |
| 53.5 | `empty-conversation` | Handle empty conversation export |

### Cat 54: Token Counter (6 tests, no API)

**Source:** `cat-utils-core.ts` | **Module:** Token counting utilities

| # | Test | Description |
|---|------|-------------|
| 54.1 | `create-token-counter` | Create TokenCounter instance |
| 54.2 | `count-tokens-string` | Count tokens in a string |
| 54.3 | `count-tokens-empty` | Empty string returns 0 tokens |
| 54.4 | `count-message-tokens` | Count tokens in message objects |
| 54.5 | `format-token-count` | Format token count with K/M suffixes |
| 54.6 | `estimate-streaming-tokens` | Estimate tokens during streaming |

### Cat 55: Retry Utility (7 tests, no API)

**Source:** `cat-utils-core.ts` | **Module:** `src/utils/retry.ts`

| # | Test | Description |
|---|------|-------------|
| 55.1 | `retry-succeeds-first-try` | Succeeds on first attempt (no retry) |
| 55.2 | `retry-succeeds-after-failures` | Succeeds after transient failures |
| 55.3 | `retry-exhausted-throws` | Throws after max retries exhausted |
| 55.4 | `retry-isRetryable-filter` | Custom isRetryable predicate |
| 55.5 | `retry-onRetry-callback` | onRetry callback invoked per retry |
| 55.6 | `retry-abort-signal` | AbortSignal stops retries |
| 55.7 | `retry-timeout` | Timeout aborts the operation |

### Cat 56: LRU Cache (7 tests, no API)

**Source:** `cat-utils-core.ts` | **Module:** LRU cache implementation

| # | Test | Description |
|---|------|-------------|
| 56.1 | `basic-set-get` | Set and get a cache entry |
| 56.2 | `eviction-on-max-size` | Evicts oldest on max size |
| 56.3 | `lru-ordering` | Accessing an entry moves it to front |
| 56.4 | `delete-entry` | Delete a specific entry |
| 56.5 | `cache-stats` | Cache hit/miss statistics |
| 56.6 | `clear-cache` | clear() removes all entries |
| 56.7 | `has-method` | has() checks key existence |

### Cat 57: Fuzzy Match (5 tests, no API)

**Source:** `cat-utils-core.ts` | **Module:** Fuzzy string matching

| # | Test | Description |
|---|------|-------------|
| 57.1 | `exact-match-similarity-1` | Exact match returns similarity 1.0 |
| 57.2 | `empty-string-similarity-0` | Empty vs non-empty returns 0.0 |
| 57.3 | `similar-strings-high-score` | Similar strings score > 0.7 |
| 57.4 | `very-different-strings-low-score` | Different strings score < 0.3 |
| 57.5 | `find-fuzzy-matches` | Find matches above threshold |

### Cat 58: Rate Limiter (6 tests, no API)

**Source:** `cat-rate-history-cache.ts` | **Module:** Rate limiting implementation

| # | Test | Description |
|---|------|-------------|
| 58.1 | `instantiation-defaults` | Default rate limiter config |
| 58.2 | `custom-config` | Custom window/limit configuration |
| 58.3 | `execute-immediate` | Execute within rate limit succeeds |
| 58.4 | `get-status` | Get current rate limit status |
| 58.5 | `queue-overflow-rejects` | Rejects when queue overflows |
| 58.6 | `event-emission` | Emits events on limit/reset |

### Cat 59: History Manager (7 tests, no API)

**Source:** `cat-rate-history-cache.ts` | **Module:** Command/input history

| # | Test | Description |
|---|------|-------------|
| 59.1 | `create-with-defaults` | Create with default max entries |
| 59.2 | `add-and-get-entries` | Add entries and retrieve them |
| 59.3 | `no-consecutive-duplicates` | Deduplicates consecutive entries |
| 59.4 | `empty-string-rejected` | Rejects empty strings |
| 59.5 | `max-entries-enforcement` | Enforces max entry count |
| 59.6 | `navigate-previous-next` | Navigate history up/down |
| 59.7 | `exclude-prefixes` | Exclude entries starting with prefix |

### Cat 60: Response Cache (6 tests, no API)

**Source:** `cat-rate-history-cache.ts` | **Module:** LLM response caching

| # | Test | Description |
|---|------|-------------|
| 60.1 | `instantiation` | Create ResponseCache instance |
| 60.2 | `set-and-get` | Cache and retrieve a response |
| 60.3 | `cache-miss-on-different-context` | Different context = cache miss |
| 60.4 | `generate-context-hash` | Generates consistent context hashes |
| 60.5 | `get-stats` | Cache statistics (hits/misses) |
| 60.6 | `short-response-not-cached` | Very short responses not cached |

### Cat 61: Diff Generator (5 tests, no API)

**Source:** `cat-rate-history-cache.ts` | **Module:** File diff generation

| # | Test | Description |
|---|------|-------------|
| 61.1 | `generate-diff-no-changes` | No changes = empty diff |
| 61.2 | `generate-diff-with-changes` | Changed lines produce diff output |
| 61.3 | `diff-summary-format` | Summary includes +/- line counts |
| 61.4 | `creation-diff` | New file diff (all additions) |
| 61.5 | `deletion-diff` | Deleted file diff (all removals) |

### Cat 62: Poll Manager (7 tests, no API)

**Source:** `cat-automation-sdk.ts` | **Module:** `src/automation/poll-manager.ts`

| # | Test | Description |
|---|------|-------------|
| 62.1 | `singleton-lifecycle` | getInstance/resetInstance pattern |
| 62.2 | `add-poll` | Add a polling target |
| 62.3 | `remove-poll` | Remove a polling target |
| 62.4 | `remove-nonexistent-returns-false` | Removing unknown target returns false |
| 62.5 | `get-poll` | Get a poll by ID |
| 62.6 | `add-replaces-existing` | Adding same ID replaces previous |
| 62.7 | `stop-all-clears-timers` | stopAll() clears all timers |

### Cat 63: Auth Monitor (7 tests, no API)

**Source:** `cat-automation-sdk.ts` | **Module:** `src/automation/auth-monitor.ts`

| # | Test | Description |
|---|------|-------------|
| 63.1 | `singleton-lifecycle` | getInstance/resetInstance pattern |
| 63.2 | `add-and-get-target` | Add an auth target and retrieve |
| 63.3 | `remove-target` | Remove an auth target |
| 63.4 | `list-targets` | List all monitored targets |
| 63.5 | `auth-state-types` | Auth state types: valid/expired/revoked |
| 63.6 | `config-defaults` | Default monitoring config |
| 63.7 | `custom-config` | Custom monitoring intervals |

### Cat 64: Agent SDK (5 tests, no API)

**Source:** `cat-automation-sdk.ts` | **Module:** `src/sdk/agent-sdk.ts`

| # | Test | Description |
|---|------|-------------|
| 64.1 | `instantiation` | Create AgentSDK instance |
| 64.2 | `register-tool` | Register a custom tool |
| 64.3 | `unregister-tool` | Unregister a tool |
| 64.4 | `empty-prompt-throws` | Empty prompt throws error |
| 64.5 | `config-defaults` | SDK default configuration |

### Cat 65: RTK Compressor (5 tests, no API)

**Source:** `cat-automation-sdk.ts` | **Module:** RTK output compression

| # | Test | Description |
|---|------|-------------|
| 65.1 | `rtk-availability-check` | Check if RTK is available |
| 65.2 | `reset-rtk-cache` | Reset RTK cache |
| 65.3 | `is-rtk-compatible` | Check command RTK compatibility |
| 65.4 | `interactive-not-compatible` | Interactive commands not RTK-compatible |
| 65.5 | `wrap-command-format` | Wrap command for RTK execution |

### Cat 66: Skill Parser (6 tests, no API)

**Source:** `cat-skills-sandbox.ts` | **Module:** `src/skills/skill-parser.ts`

| # | Test | Description |
|---|------|-------------|
| 66.1 | `parse-valid-skill-file` | Parse a valid SKILL.md file |
| 66.2 | `parse-invalid-no-frontmatter-throws` | Missing frontmatter throws |
| 66.3 | `parse-missing-name-throws` | Missing name field throws |
| 66.4 | `validate-skill-export` | validateSkill() is exported |
| 66.5 | `parse-with-tags` | Parse skill with tags array |
| 66.6 | `skill-has-loaded-at` | Parsed skill has loadedAt timestamp |

### Cat 67: Skill Registry (6 tests, no API)

**Source:** `cat-skills-sandbox.ts` | **Module:** `src/skills/skill-registry.ts`

| # | Test | Description |
|---|------|-------------|
| 67.1 | `instantiation` | Create SkillRegistry instance |
| 67.2 | `get-nonexistent-skill` | Returns undefined for unknown skill |
| 67.3 | `list-before-load` | List before loading returns empty |
| 67.4 | `has-search-method` | search() method exists |
| 67.5 | `count-and-tags` | Count and list all tags |
| 67.6 | `event-emitter` | Emits events on skill load |

### Cat 68: Auto-Sandbox Router (6 tests, no API)

**Source:** `cat-skills-sandbox.ts` | **Module:** `src/security/sandbox.ts`

| # | Test | Description |
|---|------|-------------|
| 68.1 | `instantiation` | Create AutoSandbox router |
| 68.2 | `disabled-never-sandboxes` | Disabled mode never sandboxes |
| 68.3 | `safe-commands-not-sandboxed` | Safe commands bypass sandbox |
| 68.4 | `npm-always-sandboxed` | npm commands always sandboxed |
| 68.5 | `never-sandbox-override` | Override to never sandbox |
| 68.6 | `custom-always-sandbox` | Custom always-sandbox patterns |

### Cat 69: Confirmation Service (5 tests, no API)

**Source:** `cat-skills-sandbox.ts` | **Module:** Confirmation service singleton

| # | Test | Description |
|---|------|-------------|
| 69.1 | `singleton-instance` | Singleton getInstance() |
| 69.2 | `session-flags` | Set and check session flags |
| 69.3 | `event-emitter` | Emits confirmation events |
| 69.4 | `request-confirmation-method` | requestConfirmation() exists |
| 69.5 | `session-flags-shape` | Session flags object shape |

### Cat 70: Gemini Structured Output (5 tests, API)

**Source:** `cat-api-gemini-extended.ts` | **Module:** `src/providers/gemini-provider.ts`

| # | Test | Description |
|---|------|-------------|
| 70.1 | `json-extraction` | Extract JSON from response |
| 70.2 | `structured-object` | Request structured object output |
| 70.3 | `code-generation` | Generate code snippet |
| 70.4 | `boolean-answer` | Boolean yes/no answer |
| 70.5 | `numeric-answer` | Numeric answer extraction |

### Cat 71: Gemini Streaming Extended (5 tests, API)

**Source:** `cat-api-gemini-extended.ts` | **Module:** `src/providers/gemini-provider.ts`

| # | Test | Description |
|---|------|-------------|
| 71.1 | `stream-long-response` | Stream a long response (100+ chars) |
| 71.2 | `stream-with-system-prompt` | Streaming with system prompt |
| 71.3 | `stream-done-event` | Stream emits done event |
| 71.4 | `stream-multiple-chunks` | Stream produces multiple chunks |
| 71.5 | `stream-tool-call-detection` | Detect tool calls in stream |

### Cat 72: Interpreter Service (5 tests, no API)

**Source:** `cat-api-gemini-extended.ts` | **Module:** `src/interpreter/interpreter-service.ts`

| # | Test | Description |
|---|------|-------------|
| 72.1 | `instantiation` | Create InterpreterService |
| 72.2 | `profile-defaults` | Default profile configuration |
| 72.3 | `auto-run-toggle` | Toggle auto-run mode |
| 72.4 | `safe-mode-property` | Safe mode property |
| 72.5 | `reset-clears-state` | reset() clears all state |

### Cat 73: Cost Tracker (6 tests, no API)

**Source:** `cat-api-gemini-extended.ts` | **Module:** Cost tracking utilities

| # | Test | Description |
|---|------|-------------|
| 73.1 | `instantiation` | Create CostTracker instance |
| 73.2 | `record-usage` | Record token usage with cost |
| 73.3 | `model-breakdown` | Breakdown costs by model |
| 73.4 | `budget-limit-event` | Emit event when budget exceeded |
| 73.5 | `format-report` | Format cost report for display |
| 73.6 | `session-tokens-accumulate` | Tokens accumulate across calls |

### Cat 74: Settings Manager (5 tests, no API)

**Source:** `cat-api-gemini-extended.ts` | **Module:** `src/utils/settings-manager.ts`

| # | Test | Description |
|---|------|-------------|
| 74.1 | `singleton` | Singleton pattern |
| 74.2 | `load-user-settings` | Load user settings from disk |
| 74.3 | `default-model` | Default model configuration |
| 74.4 | `models-list` | Available models list |
| 74.5 | `base-url-default` | Default base URL |

### Cat 75: Security Integration (4 tests, no API)

**Source:** `cat-api-gemini-extended.ts` | **Module:** Cross-module security alignment

| # | Test | Description |
|---|------|-------------|
| 75.1 | `dangerous-and-sandbox-alignment` | Dangerous patterns align with sandbox |
| 75.2 | `security-mode-and-confirmation-coexist` | Security modes work with confirmation |
| 75.3 | `skill-scanner-and-policy-groups-coexist` | Skill scanner + policy groups coexist |
| 75.4 | `all-dangerous-commands-covered` | All dangerous commands are covered |

### Cat 76: Observation Variator (6 tests, no API)

**Source:** `cat-context-engineering.ts` | **Module:** `src/context/observation-variator.ts`

| # | Test | Description |
|---|------|-------------|
| 76.1 | `singleton-access` | Singleton getInstance() |
| 76.2 | `reset-creates-new` | reset() creates new instance |
| 76.3 | `wrap-tool-result` | Wrap tool result with template |
| 76.4 | `wrap-memory-block` | Wrap memory block with template |
| 76.5 | `next-turn-changes-template` | Template rotates each turn |
| 76.6 | `reset-resets-turn` | reset() resets turn counter |

### Cat 77: Restorable Compression (7 tests, no API)

**Source:** `cat-context-engineering.ts` | **Module:** `src/context/restorable-compression.ts`

| # | Test | Description |
|---|------|-------------|
| 77.1 | `singleton-access` | Singleton getInstance() |
| 77.2 | `reset-creates-new` | reset() creates new instance |
| 77.3 | `compress-empty-messages` | Empty messages array handled |
| 77.4 | `compress-preserves-short-messages` | Short messages not compressed |
| 77.5 | `list-identifiers-initially-empty` | No identifiers initially |
| 77.6 | `store-size-initially-zero` | Store starts empty |
| 77.7 | `evict-no-crash` | Eviction on empty store doesn't crash |

### Cat 78: Head-Tail Truncation (7 tests, no API)

**Source:** `cat-context-engineering.ts` | **Module:** Truncation utilities

| # | Test | Description |
|---|------|-------------|
| 78.1 | `no-truncation-needed` | Short text not truncated |
| 78.2 | `truncation-by-lines` | Truncate by line count |
| 78.3 | `needs-truncation-check` | needsTruncation() predicate |
| 78.4 | `max-chars-truncation` | Truncate by character count |
| 78.5 | `semantic-truncate-basic` | Semantic truncation preserves meaning |
| 78.6 | `empty-string-no-truncation` | Empty string handled |
| 78.7 | `original-bytes-tracked` | Track original byte count |

### Cat 79: Stable JSON (5 tests, no API)

**Source:** `cat-context-engineering.ts` | **Module:** Deterministic JSON serialization

| # | Test | Description |
|---|------|-------------|
| 79.1 | `sorted-keys` | Keys sorted alphabetically |
| 79.2 | `deterministic-output` | Same object = same output |
| 79.3 | `nested-objects-sorted` | Nested objects also sorted |
| 79.4 | `normalize-json-string` | Normalize JSON string |
| 79.5 | `handles-arrays-and-nulls` | Arrays and nulls handled |

### Cat 80: Context Manager V3 (5 tests, no API)

**Source:** `cat-context-engineering.ts` | **Module:** `src/context/context-manager-v3.ts`

| # | Test | Description |
|---|------|-------------|
| 80.1 | `factory-creation` | Factory method creation |
| 80.2 | `constructor-with-config` | Constructor with config object |
| 80.3 | `get-stats-empty` | Stats on empty manager |
| 80.4 | `should-warn-empty` | No warning on empty state |
| 80.5 | `dispose-no-crash` | dispose() doesn't crash |

### Cat 81: Sanitize Utilities (8 tests, no API)

**Source:** `cat-sanitize-glob-deploy.ts` | **Module:** Input sanitization utilities

| # | Test | Description |
|---|------|-------------|
| 81.1 | `sanitize-file-path` | Sanitize file path |
| 81.2 | `sanitize-path-traversal-blocked` | Block `../` traversal |
| 81.3 | `escape-regex` | Escape regex special characters |
| 81.4 | `sanitize-html` | Strip HTML tags |
| 81.5 | `truncate-string` | Truncate to max length |
| 81.6 | `remove-control-characters` | Remove control chars |
| 81.7 | `sanitize-json-valid` | Validate JSON string |
| 81.8 | `sanitize-port` | Validate port number |

### Cat 82: Glob Matcher (7 tests, no API)

**Source:** `cat-sanitize-glob-deploy.ts` | **Module:** Glob pattern matching

| # | Test | Description |
|---|------|-------------|
| 82.1 | `glob-to-regex` | Convert glob to regex |
| 82.2 | `match-glob-basic` | Basic glob matching |
| 82.3 | `match-any-glob` | Match against multiple globs |
| 82.4 | `filter-by-glob` | Filter file list by glob |
| 82.5 | `exclude-by-glob` | Exclude files by glob |
| 82.6 | `filter-tools` | Filter tool names by glob |
| 82.7 | `is-tool-enabled` | Check if tool is enabled by glob |

### Cat 83: Base URL (5 tests, no API)

**Source:** `cat-sanitize-glob-deploy.ts` | **Module:** `src/utils/base-url.ts`

| # | Test | Description |
|---|------|-------------|
| 83.1 | `default-constant` | Default base URL constant |
| 83.2 | `normalize-strips-trailing-slash` | Strips trailing slash |
| 83.3 | `normalize-valid-url` | Valid URL passes normalization |
| 83.4 | `normalize-invalid-throws` | Invalid URL throws error |
| 83.5 | `normalize-localhost` | localhost URL accepted |

### Cat 84: Cloud Deploy Configs (6 tests, no API)

**Source:** `cat-sanitize-glob-deploy.ts` | **Module:** `src/deploy/`

| # | Test | Description |
|---|------|-------------|
| 84.1 | `generate-fly-config` | Generate Fly.io deployment config |
| 84.2 | `generate-railway-config` | Generate Railway config |
| 84.3 | `generate-render-config` | Generate Render config |
| 84.4 | `router-function` | Deploy platform router |
| 84.5 | `config-has-env-vars` | Config includes environment variables |
| 84.6 | `all-platforms-generate` | All platforms generate valid config |

### Cat 85: Nix Config (5 tests, no API)

**Source:** `cat-sanitize-glob-deploy.ts` | **Module:** `src/deploy/`

| # | Test | Description |
|---|------|-------------|
| 85.1 | `generate-flake-nix` | Generate flake.nix |
| 85.2 | `generate-default-nix` | Generate default.nix |
| 85.3 | `node-version-in-flake` | Node version in flake output |
| 85.4 | `version-in-output` | Version string in output |
| 85.5 | `description-in-output` | Description in output |

### Cat 86: Send Policy Engine (7 tests, no API)

**Source:** `cat-channels-plugins.ts` | **Module:** `src/channels/send-policy.ts`

| # | Test | Description |
|---|------|-------------|
| 86.1 | `singleton-access` | Singleton getInstance() |
| 86.2 | `default-allows` | Default policy allows sends |
| 86.3 | `add-deny-rule` | Add a deny rule |
| 86.4 | `set-override` | Set channel override |
| 86.5 | `clear-overrides` | Clear all overrides |
| 86.6 | `remove-rule` | Remove a specific rule |
| 86.7 | `get-config` | Get full policy config |

### Cat 87: DM Pairing Manager (7 tests, no API)

**Source:** `cat-channels-plugins.ts` | **Module:** `src/channels/dm-pairing.ts`

| # | Test | Description |
|---|------|-------------|
| 87.1 | `singleton-access` | Singleton getInstance() |
| 87.2 | `approve-directly` | Approve a DM pairing |
| 87.3 | `is-approved-check` | Check if peer is approved |
| 87.4 | `revoke-approval` | Revoke an approval |
| 87.5 | `list-approved` | List all approved peers |
| 87.6 | `list-pending-empty` | Empty pending list initially |
| 87.7 | `get-stats` | Pairing statistics |

### Cat 88: Reconnection Manager (6 tests, no API)

**Source:** `cat-channels-plugins.ts` | **Module:** Channel reconnection logic

| # | Test | Description |
|---|------|-------------|
| 88.1 | `instantiation` | Create ReconnectionManager |
| 88.2 | `not-exhausted-initially` | Not exhausted on creation |
| 88.3 | `on-connected-resets` | onConnected() resets attempts |
| 88.4 | `cancel-stops-reconnect` | cancel() stops reconnection |
| 88.5 | `get-current-delay` | Get current backoff delay |
| 88.6 | `get-config` | Get reconnection config |

### Cat 89: Offline Queue (6 tests, no API)

**Source:** `cat-channels-plugins.ts` | **Module:** Offline message queue

| # | Test | Description |
|---|------|-------------|
| 89.1 | `empty-queue` | Queue starts empty |
| 89.2 | `enqueue-and-size` | Enqueue message and check size |
| 89.3 | `drain-returns-all` | drain() returns all queued messages |
| 89.4 | `peek-does-not-remove` | peek() doesn't remove messages |
| 89.5 | `max-size-enforced` | Max queue size enforced |
| 89.6 | `clear-empties` | clear() empties the queue |

### Cat 90: Plugin Manifest Manager (6 tests, no API)

**Source:** `cat-channels-plugins.ts` | **Module:** `src/plugins/plugin-manifest.ts`

| # | Test | Description |
|---|------|-------------|
| 90.1 | `instantiation` | Create PluginManifestManager |
| 90.2 | `list-plugins-empty` | Empty list initially |
| 90.3 | `get-nonexistent-plugin` | Returns undefined for unknown |
| 90.4 | `validate-manifest-valid` | Valid manifest passes validation |
| 90.5 | `validate-manifest-invalid` | Invalid manifest fails |
| 90.6 | `plugin-count-and-enabled` | Count total and enabled plugins |

### Cat 91: Lessons Tracker (7 tests, no API)

**Source:** `cat-agent-advanced.ts` | **Module:** `src/agent/lessons-tracker.ts`

| # | Test | Description |
|---|------|-------------|
| 91.1 | `instantiation` | Create LessonsTracker |
| 91.2 | `add-lesson` | Add a lesson (PATTERN/RULE/etc) |
| 91.3 | `list-lessons` | List all lessons |
| 91.4 | `remove-lesson` | Remove a lesson by ID |
| 91.5 | `search-lessons` | Search lessons by keyword |
| 91.6 | `get-stats` | Lesson statistics |
| 91.7 | `export-formats` | Export lessons as markdown/JSON |

### Cat 92: Todo Tracker (7 tests, no API)

**Source:** `cat-agent-advanced.ts` | **Module:** `src/agent/todo-tracker.ts`

| # | Test | Description |
|---|------|-------------|
| 92.1 | `instantiation` | Create TodoTracker |
| 92.2 | `add-todo` | Add a todo item |
| 92.3 | `complete-todo` | Mark todo as complete |
| 92.4 | `remove-todo` | Remove a todo item |
| 92.5 | `get-pending` | Get pending todos only |
| 92.6 | `has-pending` | Check if pending todos exist |
| 92.7 | `clear-done` | Clear completed todos |

### Cat 93: Conversation Branching (7 tests, no API)

**Source:** `cat-agent-advanced.ts` | **Module:** Conversation branching system

| # | Test | Description |
|---|------|-------------|
| 93.1 | `singleton-access` | Singleton getInstance() |
| 93.2 | `has-main-branch` | Main branch exists by default |
| 93.3 | `add-message` | Add message to current branch |
| 93.4 | `create-branch` | Create a new branch |
| 93.5 | `switch-branch` | Switch between branches |
| 93.6 | `delete-branch` | Delete a branch |
| 93.7 | `rename-branch` | Rename a branch |

### Cat 94: Selective Rollback (6 tests, no API)

**Source:** `cat-agent-advanced.ts` | **Module:** Version rollback system

| # | Test | Description |
|---|------|-------------|
| 94.1 | `singleton-access` | Singleton getInstance() |
| 94.2 | `save-version` | Save a version snapshot |
| 94.3 | `get-versions` | List saved versions |
| 94.4 | `get-latest-version` | Get most recent version |
| 94.5 | `compare-versions` | Compare two versions |
| 94.6 | `get-stats` | Version statistics |

### Cat 95: Three-Way Diff (5 tests, no API)

**Source:** `cat-agent-advanced.ts` | **Module:** Three-way merge/diff

| # | Test | Description |
|---|------|-------------|
| 95.1 | `identical-no-conflicts` | Identical inputs = no conflicts |
| 95.2 | `ours-only-change` | Only-ours change merges cleanly |
| 95.3 | `conflict-detected` | Conflicting changes detected |
| 95.4 | `resolve-conflicts` | Conflict resolution strategies |
| 95.5 | `format-conflict-markers` | Format Git-style conflict markers |

### Cat 96: Auto Memory Manager (6 tests, no API)

**Source:** `cat-memory-tools-config.ts` | **Module:** Auto-memory subsystem

| # | Test | Description |
|---|------|-------------|
| 96.1 | `singleton-access` | Singleton getInstance() |
| 96.2 | `write-and-list` | Write memory and list entries |
| 96.3 | `delete-memory` | Delete a memory entry |
| 96.4 | `recall-memories` | Recall memories by query |
| 96.5 | `get-memory-path` | Get memory file path |
| 96.6 | `recall-summary` | Get summary of all memories |

### Cat 97: Memory Flush (6 tests, no API)

**Source:** `cat-memory-tools-config.ts` | **Module:** Pre-compaction memory flush

| # | Test | Description |
|---|------|-------------|
| 97.1 | `pre-threshold-singleton` | PreThreshold singleton |
| 97.2 | `should-flush-below-threshold` | No flush below threshold |
| 97.3 | `should-flush-above-threshold` | Flush above threshold |
| 97.4 | `backend-manager-singleton` | BackendManager singleton |
| 97.5 | `register-backend` | Register a flush backend |
| 97.6 | `flush-count-tracking` | Track flush count |

### Cat 98: Code Quality Scorer (6 tests, no API)

**Source:** `cat-memory-tools-config.ts` | **Module:** Code quality analysis

| # | Test | Description |
|---|------|-------------|
| 98.1 | `analyze-simple-code` | Analyze a simple code sample |
| 98.2 | `grade-assignment` | Assign A/B/C/D/F grade |
| 98.3 | `detects-code-smells` | Detect code smells |
| 98.4 | `generates-suggestions` | Generate improvement suggestions |
| 98.5 | `format-report` | Format quality report |
| 98.6 | `metrics-shape` | Quality metrics object shape |

### Cat 99: Singleton Utility (6 tests, no API)

**Source:** `cat-memory-tools-config.ts` | **Module:** Generic singleton utility

| # | Test | Description |
|---|------|-------------|
| 99.1 | `create-singleton` | Create a singleton instance |
| 99.2 | `resettable-singleton` | Resettable singleton pattern |
| 99.3 | `lazy-singleton` | Lazy initialization singleton |
| 99.4 | `has-singleton` | Check if singleton exists |
| 99.5 | `module-singleton` | Module-level singleton |
| 99.6 | `peek-singleton` | Peek without creating |

### Cat 100: Config Constants (5 tests, no API)

**Source:** `cat-memory-tools-config.ts` | **Module:** `src/config/constants.ts`

| # | Test | Description |
|---|------|-------------|
| 100.1 | `agent-config-exists` | AGENT_CONFIG constant exists |
| 100.2 | `supported-models-populated` | SUPPORTED_MODELS has entries |
| 100.3 | `api-config-defaults` | API config defaults |
| 100.4 | `server-config` | Server config (port, CORS) |
| 100.5 | `error-and-success-messages` | Error/success message constants |

### Cat 101: Hook Registry (7 tests, no API)

**Source:** `cat-hooks-config-advanced.ts` | **Module:** `src/hooks/advanced-hooks.ts`

| # | Test | Description |
|---|------|-------------|
| 101.1 | `registry-singleton` | getHookRegistry() singleton |
| 101.2 | `add-hook` | Add a hook to registry |
| 101.3 | `remove-hook` | Remove a hook by name |
| 101.4 | `get-hook-by-name` | Retrieve hook by name |
| 101.5 | `list-hooks` | List all registered hooks |
| 101.6 | `get-hooks-for-event` | Get hooks for specific event |
| 101.7 | `clear-hooks` | Clear all hooks |

### Cat 102: Advanced Hook Runner (6 tests, no API)

**Source:** `cat-hooks-config-advanced.ts` | **Module:** `src/hooks/advanced-hooks.ts`

| # | Test | Description |
|---|------|-------------|
| 102.1 | `runner-instantiation` | Create AdvancedHookRunner |
| 102.2 | `runner-singleton` | getAdvancedHookRunner() singleton |
| 102.3 | `matches-event-basic` | Basic event matching |
| 102.4 | `matches-event-with-matcher` | Event matching with regex matcher |
| 102.5 | `hook-event-enum-values` | HookEvent enum has 10+ values |
| 102.6 | `once-hook-fired-tracking` | Once-hooks removed after firing |

### Cat 103: TOML Config (7 tests, no API)

**Source:** `cat-hooks-config-advanced.ts` | **Module:** `src/config/toml-config.ts`

| # | Test | Description |
|---|------|-------------|
| 103.1 | `default-config-exists` | DEFAULT_CONFIG has active_model, providers, models |
| 103.2 | `parse-toml-basic` | Parse simple key = "value" |
| 103.3 | `parse-toml-sections` | Parse [section] blocks |
| 103.4 | `parse-toml-numbers` | Parse integer and float values |
| 103.5 | `serialize-toml` | Serialize config back to TOML |
| 103.6 | `default-providers` | Default providers: xai, anthropic, openai, google |
| 103.7 | `default-models` | Default models list has 5+ entries |

### Cat 104: Effort & AutoCompact (7 tests, no API)

**Source:** `cat-hooks-config-advanced.ts` | **Module:** `src/config/advanced-config.ts`

| # | Test | Description |
|---|------|-------------|
| 104.1 | `effort-default-medium` | Default effort level is medium |
| 104.2 | `effort-set-level` | Set effort to high |
| 104.3 | `effort-model-params` | Low vs high model params differ |
| 104.4 | `autocompact-default-80` | Default autocompact threshold is 80% |
| 104.5 | `autocompact-set-threshold` | Set custom threshold |
| 104.6 | `autocompact-invalid-threshold` | Invalid threshold throws |
| 104.7 | `autocompact-should-compact` | shouldCompact() logic |

### Cat 105: Fallback & Setting Sources (6 tests, no API)

**Source:** `cat-hooks-config-advanced.ts` | **Module:** `src/config/advanced-config.ts`

| # | Test | Description |
|---|------|-------------|
| 105.1 | `fallback-default-config` | Default model is grok-3, no fallback |
| 105.2 | `fallback-activate` | Activate fallback to grok-3-mini |
| 105.3 | `fallback-deactivate` | Deactivate fallback, restore primary |
| 105.4 | `fallback-should-on-429` | shouldFallback() true on 429 |
| 105.5 | `setting-source-manager` | 5 sources enabled by default |
| 105.6 | `setting-source-disable` | Disable a setting source |

### Cat 106: Tool Groups Policy (7 tests, no API)

**Source:** `cat-tools-policy-explorer.ts` | **Module:** `src/security/tool-policy/groups.ts`

| # | Test | Description |
|---|------|-------------|
| 106.1 | `tool-groups-defined` | 10+ groups including group:all, group:fs |
| 106.2 | `is-tool-group` | isToolGroup() validates group names |
| 106.3 | `normalize-tool-name` | Read→read_file, Bash→bash |
| 106.4 | `expand-tool-groups` | expandToolGroups() resolves groups |
| 106.5 | `get-tools-in-group` | getToolsInGroup() lists tools |
| 106.6 | `is-tool-in-group` | isToolInGroup() membership check |
| 106.7 | `get-tool-groups` | getToolGroups() for a tool |

### Cat 107: Tool Group Mapping (6 tests, no API)

**Source:** `cat-tools-policy-explorer.ts` | **Module:** `src/security/tool-policy/tool-groups.ts`

| # | Test | Description |
|---|------|-------------|
| 107.1 | `tool-groups-mapping-exists` | TOOL_GROUPS has 20+ entries |
| 107.2 | `bash-in-runtime-shell` | bash in group:runtime + group:runtime:shell |
| 107.3 | `view-file-in-fs-read` | view_file in group:fs + group:fs:read |
| 107.4 | `delete-file-is-dangerous` | delete_file in group:dangerous |
| 107.5 | `web-fetch-in-web` | web_fetch in group:web |
| 107.6 | `git-push-is-dangerous` | git_push in group:dangerous |

### Cat 108: Plan Tool (7 tests, no API)

**Source:** `cat-tools-policy-explorer.ts` | **Module:** `src/tools/plan-tool.ts`

| # | Test | Description |
|---|------|-------------|
| 108.1 | `plan-tool-instantiation` | Create PlanTool instance |
| 108.2 | `plan-description` | Description mentions "plan" |
| 108.3 | `plan-has-parameters` | Has execute() method |
| 108.4 | `plan-init-no-goal-fails` | Init without goal fails |
| 108.5 | `plan-read-no-file-fails` | Read non-existent plan fails |
| 108.6 | `plan-init-requires-goal` | Init requires goal parameter |
| 108.7 | `plan-unknown-action` | Unknown action returns failure |

### Cat 109: Codebase Explorer (6 tests, no API)

**Source:** `cat-tools-policy-explorer.ts` | **Module:** `src/services/codebase-explorer.ts`

| # | Test | Description |
|---|------|-------------|
| 109.1 | `language-extensions-defined` | LANGUAGE_EXTENSIONS has ts/py/go/rust |
| 109.2 | `typescript-extensions` | TypeScript includes .ts, .tsx |
| 109.3 | `explorer-instantiation` | Create CodebaseExplorer |
| 109.4 | `explorer-explore` | explore() returns file/dir counts |
| 109.5 | `file-categories` | Module exports expected types |
| 109.6 | `explorer-with-options` | Custom options (maxDepth, exclude) |

### Cat 110: Devcontainer Manager (6 tests, no API)

**Source:** `cat-tools-policy-explorer.ts` | **Module:** `src/config/advanced-config.ts`

| # | Test | Description |
|---|------|-------------|
| 110.1 | `devcontainer-instantiation` | Create DevcontainerManager |
| 110.2 | `devcontainer-generate-config` | Generate devcontainer config |
| 110.3 | `devcontainer-serialize` | Serialize config to JSON |
| 110.4 | `devcontainer-container-name` | Get/set container name |
| 110.5 | `devcontainer-forwarded-ports` | Get forwarded ports list |
| 110.6 | `devcontainer-not-inside` | isInsideDevcontainer() returns boolean |

### Cat 111: Config Backup Rotation (7 tests, no API)

**Source:** `cat-config-backup-toml.ts` | **Module:** `src/config/advanced-config.ts`

| # | Test | Description |
|---|------|-------------|
| 111.1 | `backup-instantiation` | Create ConfigBackupRotation |
| 111.2 | `backup-create-and-list` | Create backup and list it |
| 111.3 | `backup-rotation` | Rotate old backups (max 2) |
| 111.4 | `backup-restore` | Restore from backup |
| 111.5 | `backup-get-latest` | Get latest backup path |
| 111.6 | `backup-max-backups` | Custom max backups setting |
| 111.7 | `backup-restore-nonexistent` | Restore nonexistent returns false |

### Cat 112: File Suggestion Provider (5 tests, no API)

**Source:** `cat-config-backup-toml.ts` | **Module:** `src/config/advanced-config.ts`

| # | Test | Description |
|---|------|-------------|
| 112.1 | `provider-instantiation` | Create FileSuggestionProvider |
| 112.2 | `no-custom-provider` | hasCustomProvider() initially false |
| 112.3 | `with-custom-provider` | Custom script provider |
| 112.4 | `get-config` | Get provider config |
| 112.5 | `set-script` | Set custom suggestion script |

### Cat 113: TOML Roundtrip (7 tests, no API)

**Source:** `cat-config-backup-toml.ts` | **Module:** `src/config/toml-config.ts`

| # | Test | Description |
|---|------|-------------|
| 113.1 | `toml-parse-comments-skipped` | Comments ignored in parsing |
| 113.2 | `toml-parse-boolean` | Boolean true/false parsed |
| 113.3 | `toml-parse-arrays` | Array values parsed |
| 113.4 | `toml-parse-subsection` | Nested [a.b] sections parsed |
| 113.5 | `serialize-roundtrip` | Serialize then parse = original |
| 113.6 | `default-tool-config` | Default bash tool config values |
| 113.7 | `default-middleware-config` | Default middleware config values |

### Cat 114: Tool Aliases (6 tests, no API)

**Source:** `cat-config-backup-toml.ts` | **Module:** `src/security/tool-policy/groups.ts`

| # | Test | Description |
|---|------|-------------|
| 114.1 | `tool-aliases-defined` | TOOL_ALIASES has 10+ entries |
| 114.2 | `read-alias` | Read/read → read_file |
| 114.3 | `bash-alias` | Bash/exec/shell → bash |
| 114.4 | `normalize-tool-list` | Normalize and deduplicate list |
| 114.5 | `normalize-unknown-tool` | Unknown tool passes through unchanged |
| 114.6 | `task-alias` | Task → spawn_agent |

### Cat 115: AutoCompact Usage (5 tests, no API)

**Source:** `cat-config-backup-toml.ts` | **Module:** `src/config/advanced-config.ts`

| # | Test | Description |
|---|------|-------------|
| 115.1 | `usage-percent-calc` | 75000/100000 = 75% |
| 115.2 | `usage-percent-zero-max` | Division by zero returns 0 |
| 115.3 | `should-compact-boundary` | Exact boundary triggers compact |
| 115.4 | `from-env-default` | fromEnv() returns valid default |
| 115.5 | `effort-from-env` | EffortLevelManager.fromEnv() returns low/medium/high |

### Cat 116: Lifecycle Hooks Manager (7 tests, no API)

**Source:** `cat-lifecycle-preprocessing.ts` | **Module:** `src/hooks/lifecycle-hooks.ts`

| # | Test | Description |
|---|------|-------------|
| 116.1 | `hooks-manager-instantiation` | Create HooksManager |
| 116.2 | `builtin-hooks-registered` | lint-on-edit and format-on-edit registered |
| 116.3 | `default-hooks-config` | DEFAULT_HOOKS_CONFIG values |
| 116.4 | `builtin-hooks-array` | BUILTIN_HOOKS has 4+ entries |
| 116.5 | `lint-on-edit-hook` | lint-on-edit is post-edit, disabled, uses eslint |
| 116.6 | `pre-commit-hooks` | Pre-commit hooks have failOnError=true |
| 116.7 | `hooks-manager-with-config` | HooksManager with custom timeout |

### Cat 117: Lifecycle Hook Types (6 tests, no API)

**Source:** `cat-lifecycle-preprocessing.ts` | **Module:** `src/hooks/lifecycle-hooks.ts`

| # | Test | Description |
|---|------|-------------|
| 117.1 | `hook-type-pre-edit` | HookType includes pre-edit |
| 117.2 | `hook-context-shape` | HookContext interface shape |
| 117.3 | `hook-result-shape` | HookResult interface shape |
| 117.4 | `hook-definition-shape` | HookDefinition with filePatterns |
| 117.5 | `session-hook-types` | Session hook types exist |
| 117.6 | `format-on-edit-hook` | format-on-edit uses prettier, 4+ patterns |

### Cat 118: Message Preprocessing (7 tests, no API)

**Source:** `cat-lifecycle-preprocessing.ts` | **Module:** `src/channels/message-preprocessing.ts`

| # | Test | Description |
|---|------|-------------|
| 118.1 | `preprocessor-singleton` | MessagePreprocessor singleton |
| 118.2 | `preprocessor-same-instance` | Same instance returned |
| 118.3 | `preprocessor-reset` | resetInstance() creates new |
| 118.4 | `preprocessor-with-config` | Custom config (transcription off) |
| 118.5 | `preprocessor-default-config` | Default constructor works |
| 118.6 | `preprocessing-result-shape` | PreprocessingResult interface |
| 118.7 | `preprocessing-config-shape` | PreprocessingConfig defaults |

### Cat 119: Default Config UI & Agent (6 tests, no API)

**Source:** `cat-lifecycle-preprocessing.ts` | **Module:** `src/config/toml-config.ts`

| # | Test | Description |
|---|------|-------------|
| 119.1 | `default-ui-config` | theme=default, streaming=true |
| 119.2 | `default-agent-config` | yolo_mode=false, self_healing=true |
| 119.3 | `default-vim-keybindings-off` | vim_keybindings=false |
| 119.4 | `default-parallel-tools-off` | parallel_tools=false |
| 119.5 | `default-sound-effects-off` | sound_effects=false |
| 119.6 | `bash-denylist` | Bash denylist includes `rm -rf` |

### Cat 120: Default Config Integrations (5 tests, no API)

**Source:** `cat-lifecycle-preprocessing.ts` | **Module:** `src/config/toml-config.ts`

| # | Test | Description |
|---|------|-------------|
| 120.1 | `integrations-rtk-enabled` | RTK enabled by default |
| 120.2 | `integrations-icm-enabled` | ICM enabled by default |
| 120.3 | `rtk-min-output-length` | RTK min output = 500 |
| 120.4 | `bash-allowlist` | Bash allowlist includes git |
| 120.5 | `view-file-always-allowed` | view_file permission = always |

### Cat 121: Channel Core Types (7 tests, no API)

**Source:** `cat-channel-types-toolgroups.ts` | **Module:** `src/channels/core.ts`, `src/channels/session-isolation.ts`

| # | Test | Description |
|---|------|-------------|
| 121.1 | `channel-type-telegram` | Channel module imports work |
| 121.2 | `content-types-exist` | 7 content types defined |
| 121.3 | `session-isolator-singleton` | getSessionIsolator() singleton |
| 121.4 | `session-isolator-same-instance` | Same instance on double call |
| 121.5 | `identity-linker-singleton` | getIdentityLinker() singleton |
| 121.6 | `identity-linker-reset` | resetIdentityLinker() creates new |
| 121.7 | `message-direction-types` | inbound/outbound directions |

### Cat 122: Tool Groups Extended (6 tests, no API)

**Source:** `cat-channel-types-toolgroups.ts` | **Module:** `src/security/tool-policy/tool-groups.ts`

| # | Test | Description |
|---|------|-------------|
| 122.1 | `mcp-tool-detection` | MCP tools in group:mcp |
| 122.2 | `plugin-tool-detection` | Plugin tools in group:plugin |
| 122.3 | `unknown-tool-empty-groups` | Unknown tool has no groups |
| 122.4 | `planning-tools-no-groups` | plan/think have no groups |
| 122.5 | `get-tools-in-group` | Tools in group:runtime:shell |
| 122.6 | `docker-tools-exist` | 4+ docker tools exist |

### Cat 123: Setting Source Extended (6 tests, no API)

**Source:** `cat-channel-types-toolgroups.ts` | **Module:** `src/config/advanced-config.ts`

| # | Test | Description |
|---|------|-------------|
| 123.1 | `from-flag` | fromFlag('user,project') parses correctly |
| 123.2 | `to-flag` | toFlag() serializes sources |
| 123.3 | `enable-source` | enableSource() adds source |
| 123.4 | `get-all-sources` | getAllSources() returns 5 |
| 123.5 | `from-flag-invalid` | Invalid flags fall back to all |
| 123.6 | `from-flag-mixed` | Mixed valid/invalid parsed |

### Cat 124: Config Backup Edge Cases (5 tests, no API)

**Source:** `cat-channel-types-toolgroups.ts` | **Module:** `src/config/advanced-config.ts`

| # | Test | Description |
|---|------|-------------|
| 124.1 | `list-backups-no-dir` | No dir = empty list |
| 124.2 | `rotate-no-excess` | No rotation needed = 0 deleted |
| 124.3 | `backup-default-max-5` | Default max backups = 5 |
| 124.4 | `multiple-config-files` | Separate backup lists per file |
| 124.5 | `backup-sorted-by-timestamp-desc` | Backups sorted newest first |

### Cat 125: Hook Event Coverage (6 tests, no API)

**Source:** `cat-channel-types-toolgroups.ts` | **Module:** `src/hooks/advanced-hooks.ts`

| # | Test | Description |
|---|------|-------------|
| 125.1 | `all-hook-events-enum` | HookEvent has 15+ values |
| 125.2 | `hook-matcher-regex` | Regex matcher filters tools |
| 125.3 | `hook-no-matcher-matches-all` | No matcher = matches everything |
| 125.4 | `hook-matcher-with-no-tool-name` | Matcher + no toolName = no match |
| 125.5 | `subagent-events` | SubagentStart/SubagentStop events |
| 125.6 | `config-change-event` | ConfigChange/TaskCompleted/PermissionRequest |

---

## Summary by Subsystem

| Subsystem | Categories | Tests |
|-----------|-----------|-------|
| **Context & Memory** | 26-27, 76-80, 96-97 | 52 |
| **Identity & Personas** | 28, 52 | 13 |
| **Hooks & Lifecycle** | 29, 101-102, 116-117, 125 | 38 |
| **Security** | 30-32, 68-69, 75 | 24 |
| **Config (TOML, Advanced)** | 100, 103-105, 110-115, 119-120, 123-124 | 82 |
| **Tool Policy & Registry** | 38-39, 106-107, 114, 122 | 37 |
| **Channels & Messaging** | 33, 45-46, 86-89, 118, 121 | 56 |
| **Gateway & Daemon** | 35-37 | 16 |
| **Workflows & Engine** | 40-41, 108 | 19 |
| **Agent (Lessons, Todo, Branching)** | 34, 91-95 | 39 |
| **Canvas & Observability** | 48-50 | 15 |
| **Providers & API (Gemini)** | 42-44, 70-71 | 26 |
| **Utils (Retry, Cache, Diff, etc)** | 54-61, 81-83 | 57 |
| **Skills & Plugins** | 47, 66-67, 90 | 22 |
| **Automation & SDK** | 62-65 | 24 |
| **Deploy** | 84-85 | 11 |
| **Interpreter & Cost** | 72-74 | 16 |
| **Checkpoint & Export** | 51, 53 | 12 |
| **Code Quality & Singleton** | 98-99 | 12 |
| **Plan & Explorer** | 108-109 | 13 |

## Test Type Breakdown

| Type | Count | Notes |
|------|-------|-------|
| No API (unit/integration) | ~560 | Real module imports, no HTTP calls |
| API (Gemini 2.5 Flash) | ~26 | Cat 42-44, 70-71 |
| Mixed | ~4 | Some tests optional-API |

**Total: 590 tests across 100 categories**
