# Changelog

All notable changes to Code Buddy are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased] — 2026-03-06

### Added — OpenClaw Parity (3 Passes)

#### Pass 1: Channel Adapters
- **IRC channel adapter** (`src/channels/irc/index.ts`) — SASL auth, TLS, multi-channel, notices, actions
- **Feishu/Lark channel adapter** (`src/channels/feishu/index.ts`) — text, card, image messages, group chat
- **Synology Chat channel adapter** (`src/channels/synology-chat/index.ts`) — incoming/outgoing webhooks
- Extended `ChannelType` union with 6 new types: `irc`, `feishu`, `synology-chat`, `twitch`, `tlon`, `gmail`
- Enhanced Gmail adapter with Pub/Sub push notifications, watch setup, unread count

#### Pass 2: Infrastructure & CLI
- **Cross-platform service installer** (`src/daemon/service-installer.ts`) — launchd plist (macOS), systemd user service (Linux), Task Scheduler XML (Windows)
- **Companion app node manager** (`src/nodes/index.ts`) — device pairing with short codes, 20+ platform capabilities (camera, location, clipboard, etc.), remote invocation
- **Encrypted secrets vault** (`src/commands/cli/secrets-command.ts`) — AES-256-GCM with scrypt KDF, key rotation, audit trail, env import
- **Cloud deployment configs** (`src/deploy/cloud-configs.ts`) — generators for Fly.io, Railway, Render, Hetzner, Northflank, GCP
- **Nix package support** (`src/deploy/nix-config.ts`) — `flake.nix` and `default.nix` generation
- **`buddy update` command** (`src/commands/update.ts`) — self-update with `--channel stable|beta|dev`, `--check`, `--force`
- **`buddy nodes` command** (`src/commands/cli/node-commands.ts`) — list, pair, approve, describe, remove, invoke, pending
- **`buddy secrets` command** — list, set, get, remove, rotate, audit, import-env
- **`buddy approvals` command** (`src/commands/cli/approvals-command.ts`) — approval store with create, approve, deny, list, policy
- **`buddy deploy` command** (`src/commands/cli/deploy-command.ts`) — platforms, init, nix subcommands
- **Additional LLM providers** (`src/providers/additional-providers.ts`) — Mistral, Deepgram, MiniMax, Moonshot, Venice AI, Z.AI
- **Poll automation** (`src/automation/polls.ts`) — URL/file/command/custom polling with change detection and retry logic
- **Auth monitoring** (`src/automation/auth-monitoring.ts`) — credential state tracking across providers and channels
- **QR pairing utility** (`src/utils/qr-pairing.ts`) — terminal QR code display for device pairing

#### Pass 3: Protocol & Engine Parity
- **Gateway WebSocket handshake** — connect/hello-ok protocol with device identity, challenge nonce, stateVersion, presence snapshots
- **Session patch handler** — per-session config updates (thinkingLevel, verbose, model, activation, sendPolicy)
- **Presence handler** — online/offline/away/typing status broadcasting
- **Password auth mode** — gateway supports `token`, `password`, and `none` auth modes
- **Bind modes** — `loopback` (127.0.0.1), `all` (0.0.0.0), `tailscale` (Tailscale Serve)
- **Idle session reset** — `idleMinutes` config with per-session-type and per-channel overrides
- **Session maintenance** — `SessionMaintenanceConfig` with pruneAfterDays, maxEntries, rotateBytes, maxDiskBytes
- **11 new lifecycle hooks** — `command:new`, `command:reset`, `command:stop`, `session:compact:before/after`, `agent:bootstrap`, `gateway:startup`, `message:received/transcribed/preprocessed/sent`
- **Lobster approval gates** — `executeWithApproval()` pauses at approval steps and returns `resumeToken`; `resumeWorkflow()` resumes from token
- **Send policy engine** (`src/channels/send-policy.ts`) — rule-based deny/allow on channel, chatType, keyPrefix, peerId; runtime `/send on|off|inherit`
- **Message preprocessing pipeline** (`src/channels/message-preprocessing.ts`) — 4-stage: media detection → audio transcription → link extraction → content enrichment
- **Canvas HTTP routes** (`src/server/routes/canvas.ts`) — `/__codebuddy__/canvas/` serving, A2UI host page, eval endpoint
- **Identity files extended** — added `INSTRUCTIONS.md`, `BOOT.md`, `BOOTSTRAP.md`, `HEARTBEAT.md` to default identity files

#### Pass 4: Lobster OpenClaw Compatibility
- **Implicit dependency inference** — `normalizeOpenClawFormat()` scans `stdin` and `command` for `$step.stdout` references, auto-adds to `dependsOn[]`
- **`env` / `args` normalization** — `env` merges into `variables`; `args` defaults resolve into `variables`
- **Approval field support** — `approval: 'required' | 'optional'` on steps (in addition to `command: 'approve'`)
- **Conditional execution** — `condition` field with `evaluateCondition()` supporting `==`, `!=`, truthy/falsy
- **Variable expansion** — `$step.approved`, `$step.exitCode` alongside existing `$step.stdout`, `$step.json`
- **13 OpenClaw compatibility tests** (`tests/features/openclaw-parity.test.ts`)

#### Code Buddy vs OpenClaw Advantages (documented)
- Added comparison table to README.md covering 12 areas of superiority
- Updated ARCHITECTURE.md Lobster section with full OpenClaw compatibility details

### Fixed
- `src/commands/update.ts:75` — logger signature compatibility (wrap error in object literal)
