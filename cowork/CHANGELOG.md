# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Cowork-on-core migration (Phases 1–5)** — Cowork now runs on the
  same Code Buddy core agentic loop as the CLI by default. The legacy
  `pi-coding-agent` runner is retained as a fallback. New
  `RUNNER_AUDIT.md` documents the parity matrix and remaining gaps.
- **Engine MCP runtime sync** — when you add/edit/remove an MCP server
  in Settings, the change now propagates to the embedded engine's
  `MCPManager` singleton automatically (previously only pi saw the
  update). New `EngineAdapter.setMcpServers()` API.
- **Runner status badge** — titlebar shows a CPU icon (green for
  engine, orange for pi fallback, red for error). Click for details.
- **Settings → Core engine** page with a 3-state radio: Auto / Always
  on / Always off. Persisted across restarts. Env var
  `CODEBUDDY_EMBEDDED=0` continues to override in Auto mode.
- 24 new tests covering MCP sync (10), event mapping (9), and
  embedded-mode precedence (5).

### Removed

- Unused credentials store module and Keychain integration (eliminated macOS Keychain popup)

## [3.3.0-beta.8] - 2026-03-29

### Added

- Build verification and post-install reliability checks
- ~100 test files with coverage thresholds in CI

### Fixed

- 8 critical + 10 high security findings from Round 3 audit
- 20 medium-severity hardening fixes
- Sandbox security against injection and symlink attacks
- MCP server staging and lifecycle issues
- Skills ENOTDIR when built-in skills symlink into .asar archive
- Remote gateway null check in `loadPairedUsers`
- Scrypt `maxmem` for startup key derivation
- CI stabilization

## [3.2.0] - 2026-03-02

### Added

- GUI operation support for Windows (WeChat summary workflow)
- Drag-and-drop file attachments with bubble layout

### Changed

- Updated app icons for packaging (branding refresh)
- Widened chat content area layout

### Fixed

- Improved `key_press` robustness for GUI automation

## [3.1.0] - 2026-02-13

### Added

- Full V2 plugin runtime and management system
- Demo videos in documentation

### Fixed

- Custom Anthropic timeout handling in API tests
- Agent runner `sdkPlugins` runtime ReferenceError
- Hardcoded Chinese text removed from config modal and titlebar
- Sensitive log redaction hardened
- Packaged app version alignment to 3.0.0

## [3.0.0] - 2026-02-08

### Changed

- **Breaking**: Removed proxy layer — all AI requests now go through Claude Agent SDK directly
- Architecture redesigned to SDK-first approach

### Fixed

- GUI dock click targeting and verification gating

## [2.0.0] - 2026-01-25

### Changed

- Major architecture overhaul from v1

## [1.0.0] - 2025-12-01

### Added

- Initial release

[Unreleased]: https://github.com/OpenCoworkAI/open-cowork/compare/v3.3.0-beta.8...HEAD
[3.3.0-beta.8]: https://github.com/OpenCoworkAI/open-cowork/compare/v3.2.0...v3.3.0-beta.8
[3.2.0]: https://github.com/OpenCoworkAI/open-cowork/compare/v3.1.0...v3.2.0
[3.1.0]: https://github.com/OpenCoworkAI/open-cowork/compare/v3.0.0...v3.1.0
[3.0.0]: https://github.com/OpenCoworkAI/open-cowork/compare/v2.0.0...v3.0.0
[2.0.0]: https://github.com/OpenCoworkAI/open-cowork/compare/v1.0...v2.0.0
[1.0.0]: https://github.com/OpenCoworkAI/open-cowork/releases/tag/v1.0
