# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-01-28

### Overview

Major release featuring three waves of improvements via 27+ parallel AI agents, delivering comprehensive security hardening, performance optimizations, architectural refactoring, and extensive test coverage (362 test files, 16,900+ test cases).

---

### Security (7 Improvements)

- **CSP Headers**: Add Content Security Policy headers for XSS prevention in HTTP server
- **Command Injection Prevention**: Fix bash command injection with shell escaping and blocked command patterns
- **Workspace Isolation**: Implement path validation and symlink detection to prevent directory traversal
- **Plugin Isolation**: Add worker thread sandboxing with resource limits (CPU, memory, timeout)
- **Input Validation Layer**: Comprehensive Zod schema validation for all user inputs
- **Secure API Key Handling**: Environment variable filtering to prevent key leakage in logs/errors
- **Migration Transactions**: Database migrations now support atomic transactions with rollback on failure

---

### Performance (6 Improvements)

- **Semantic Caching**: Implement LSH-based semantic cache for O(1) similarity lookups
- **Async Optimization**: Replace sync I/O with async across 16 files (context-loader, session-store, plan-generator)
- **Promise.all/allSettled**: Optimize concurrent operations throughout the codebase
- **Parallel Tool Execution**: Add semaphore pattern for controlled parallel tool runs
- **Context Compression**: Sliding window with intelligent summarization for long conversations
- **Enhanced Streaming**: Chunk timeouts, adaptive throttle, and progress indicators

---

### Architecture (5 Improvements)

- **Tool Registry Pattern**: Replace 30+ switch cases with extensible registry pattern
- **Unified Events System**: TypedEventEmitter with 13+ event categories for type-safe pub/sub
- **BaseAgent Refactoring**: Extract into focused facades (Session, ModelRouting, Infrastructure, MessageHistory)
- **Type Safety Improvements**: Add type guards and explicit interfaces across 10+ modules
- **Memory Leak Fixes**: Bounded data structures with MAX_SUMMARIES limit to prevent unbounded growth

---

### New Features (5 Improvements)

- **Reverse Search**: Ctrl+R bash-style reverse search for command history
- **Debug Command**: `/debug` with subcommands (on/off, status, dump, timing, replay)
- **Config Validation**: `/config` command with Zod schema validation and migration support
- **Health Check Endpoints**: REST API endpoints (`/api/health`, `/api/health/ready`, `/api/health/live`)
- **Plugin Provider System**: Register custom LLM, embedding, and search providers via plugins

---

### Observability (4 Improvements)

- **Telemetry System**: Counter, Gauge, and Histogram metric types with export support
- **Error UX Improvements**: Structured errors with categories, severity levels, and diagnostics
- **Retry Logic**: Exponential backoff with jitter for transient failures
- **Graceful Shutdown**: Signal handlers (SIGINT, SIGTERM) for clean resource cleanup

---

### Tests (300+ New Test Files)

Total: **362 test files** with **16,900+ test cases**

Key test additions from the three improvement waves:

| Test File | Description |
|-----------|-------------|
| `http-server.test.ts` | 49 tests, 100% coverage |
| `local-llm-provider.test.ts` | 2000+ lines, comprehensive streaming tests |
| `scripting-parser.test.ts` | 1516 lines, Buddy Script language tests |
| `fcs-parser.test.ts` | 1516 lines, FCS language tests |
| `plugin-manager.test.ts` | 313+ tests for plugin system |
| `workspace-isolation.test.ts` | Security boundary tests |
| `tool-permissions.test.ts` | Permission model tests (853 lines) |
| `bash-tool.test.ts` | Command injection prevention tests |
| `cache.test.ts` | Semantic caching tests |
| `metrics.test.ts` | Observability tests |
| `middleware-pipeline.test.ts` | Request processing tests (748 lines) |
| `queue-base.test.ts` | Task queue tests (909 lines) |
| `priority-queue.test.ts` | Scheduling tests (659 lines) |
| `agent-infrastructure.test.ts` | Infrastructure facade tests |
| `credential-manager.test.ts` | Credential security tests (620 lines) |
| `chunk-processor.test.ts` | Stream processing tests (571 lines) |
| `formal-tool-registry.test.ts` | Registry pattern tests (554 lines) |
| `service-container.test.ts` | DI container tests |
| `architect-mode.test.ts` | Architecture mode tests |

---

### Added

#### Third Wave (January 28, 2026)

- **Plugin Provider Interface**: Register custom LLM, embedding, and search providers
- **Priority-based Provider Selection**: Intelligent fallback when providers are unavailable
- **Stream Helpers**: Utility functions (`withTimeout`, `safeStreamRead`, `withMaxIterations`)
- **Unified Validators**: Consolidated validation utilities in `input-validator.ts`
- **Loop Guards**: Timeout protection for parser loops (FCS, scripting)

#### Second Wave (January 28, 2026)

- **Plugin Configuration System**: Schema-validated config with defaults
- **Cache File Watching**: Automatic invalidation when source files change
- **RAG Reranking**: Improved relevance scoring for codebase search
- **Async Document Parsing**: Streaming support for large documents
- **Enhanced Error Types**: Additional context and stack traces

#### First Wave (January 22, 2026) - via 27 Parallel Agents

- **Docker Tool**: Container management (build, run, exec, compose)
- **Kubernetes Tool**: K8s cluster management (pods, deployments, services, logs)
- **Browser Tool**: Web automation with Playwright integration
- **Multi-Provider Support**: Claude, ChatGPT, Gemini, Ollama, local LLMs
- **Application Factory**: Dependency injection for application bootstrap
- **Diff Generator**: Unified diff output for file changes
- **Debug Logger**: Comprehensive debugging with timing and replay

---

### Fixed

#### Third Wave
- Stream reader cleanup in `model-hub.ts` and `ollama-embeddings.ts`
- Generator function lint errors in tool orchestrator
- Process.env null checks across codebase

#### Second Wave
- Plugin config loading with proper parameter handling
- HTTP server stream error handling and cleanup
- Parser loop guards with timeout protection

#### First Wave
- Cache test thresholds for `minTokensToCache`
- Memory leaks in event emitters
- Async/await consistency across modules

---

### Changed

- **Input Validator**: Unified validators object consolidating all validation utilities
- **Error Types**: Enhanced error classes with categories and severity
- **Plugin Types**: Comprehensive TypeScript interfaces for plugin system
- **Streaming Types**: Extended with progress indicators and throttle config

---

### Breaking Changes

- **Plugin API v2**: Plugins must implement new `PluginProvider` interface for provider registration
- **Event System**: Migrate from legacy events to TypedEventEmitter
- **Config Format**: New schema-validated configuration format (auto-migrated on first run)

---

### Documentation

- **Plugin Development Guide**: `docs/guides/PLUGIN_DEVELOPMENT.md`

---

### Previous Features (Now Released)

#### Local LLM Infrastructure (December 2025)

- **GPU VRAM Monitor** (`src/hardware/gpu-monitor.ts`)
  - Real-time VRAM monitoring for NVIDIA, AMD, Apple, Intel GPUs
  - Dynamic offload recommendations based on available memory
  - Layer count calculation for optimal GPU/CPU split

- **Ollama Embeddings** (`src/context/codebase-rag/ollama-embeddings.ts`)
  - Neural embeddings via Ollama /api/embeddings endpoint
  - 100% local, no external API needed
  - Models: nomic-embed-text (768d), mxbai-embed-large (1024d), all-minilm (384d)

- **HNSW Vector Store** (`src/context/codebase-rag/hnsw-store.ts`)
  - Hierarchical Navigable Small World algorithm for O(log n) search
  - 50x faster than brute force at 100K vectors
  - Persistence to disk with save/load

- **Model Hub HuggingFace** (`src/models/model-hub.ts`)
  - Auto-download GGUF models from HuggingFace
  - VRAM-based model recommendations
  - Quantization support: Q8_0, Q6_K, Q5_K_M, Q4_K_M, Q4_0

#### Research-Based Improvements (December 2025)

- **TDD Mode** - Test-first code generation (ICSE 2024: +45.97% Pass@1)
- **Prompt Caching** - Up to 90% cost reduction
- **Auto-Lint Integration** - Multi-linter support (ESLint, Prettier, Ruff, Clippy)
- **Auto-Test Integration** - Multi-framework support (Jest, Vitest, pytest)
- **Lifecycle Hooks** - Pre/post hooks for edit, bash, commit, prompt
- **AI Code Review** - Pre-commit review with 73.8% acceptance rate
- **CI/CD Integration** - GitHub Actions, GitLab CI, CircleCI

#### Enterprise Features

- **Team Collaboration** - WebSocket real-time collaboration with RBAC
- **Analytics Dashboard** - Usage metrics, cost tracking, performance (P50/P90/P99)
- **Plugin Marketplace** - Discovery, installation, sandboxed execution
- **Offline Mode** - Response caching, local LLM fallback, request queuing
- **Checkpoint System** - File snapshots, undo/redo, diff viewing
- **Custom Personas** - 7 built-in personas, trigger-based selection
- **Enhanced Memory** - Long-term semantic memory, project context learning

#### IDE Integrations

- **VS Code Extension** - Chat sidebar, code actions, inline completions
- **LSP Server** - Works with Neovim, Sublime, Emacs
- **Embedded Browser** - Puppeteer-based headless browser
- **Voice Control** - Wake word detection, speech-to-text

#### Core Features

- **AI Code Review** - Security, bug, performance, style detection
- **Parallel Executor** - Git worktree isolation, up to 16 concurrent agents
- **GitHub Integration** - PR creation, issue management, webhooks

---

## [1.0.0] - 2025-12-01

### Added

- Initial public release of Code Buddy
- Agentic loop with Grok API integration via OpenAI SDK
- Terminal UI with React/Ink
- File editing with automatic checkpoints
- MCP (Model Context Protocol) support
- Agent modes: plan, code, ask, architect
- Security modes: suggest, auto-edit, full-auto
- YOLO mode for full autonomy (400 tool rounds, $100 limit)
- Session management and history persistence
- Plugin system foundation
- Git integration with smart diff handling
- Search tools with ripgrep integration
- Todo list management

---

## [0.0.12] - Previous Release

### Features
- Git commands support
- Model selection and persistence
- Improved UI components

## [0.0.11] - Previous Release

### Features
- Search tool with ripgrep integration
- Todo list management
- Confirmation dialogs

## [0.0.10] - Previous Release

### Features
- Basic file editing capabilities
- Bash command execution
- Initial release of Code Buddy

---

## Version History Guidelines

### Types of Changes

- **Added** for new features
- **Changed** for changes in existing functionality
- **Deprecated** for soon-to-be removed features
- **Removed** for now removed features
- **Fixed** for any bug fixes
- **Security** for vulnerability fixes

### Semantic Versioning

- **Major version (X.0.0)**: Breaking changes
- **Minor version (0.X.0)**: New features, backward compatible
- **Patch version (0.0.X)**: Bug fixes, backward compatible

### Release Process

1. Update this CHANGELOG with all changes since last release
2. Update version in package.json
3. Create git tag: `git tag v2.0.0`
4. Push tag: `git push origin v2.0.0`
5. GitHub Actions will automatically publish to npm

---

[2.0.0]: https://github.com/phuetz/code-buddy/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/phuetz/code-buddy/compare/v0.0.12...v1.0.0
[0.0.12]: https://github.com/phuetz/code-buddy/compare/v0.0.11...v0.0.12
[0.0.11]: https://github.com/phuetz/code-buddy/compare/v0.0.10...v0.0.11
[0.0.10]: https://github.com/phuetz/code-buddy/releases/tag/v0.0.10
