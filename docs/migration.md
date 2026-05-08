# Migration guide

Code Buddy is largely backwards-compatible across V0.x → V1.0. There
are no required config rewrites. This document captures the deltas
worth knowing if you're upgrading from earlier versions.

## V0.5 → V1.0

### New TOML sections (all opt-in, default `enabled = false`)

- `[heartbeat]` — periodic `HEARTBEAT.md` review (Phase d.18 ground floor)
- `[autonomous_fleet]` — Autonomous Fleet Protocol v0.1 driver. Requires
  `repo_path` + `host`. See `docs/fleet-guide.md` § Phase (d).18.
- `[daily_reset]` — daily context boundary (audit OpenClaw heritage)

None of these activate without explicit `enabled = true`. Existing
projects keep working unchanged.

### New env vars (Phases d.17 → d.20)

| Env | Purpose | Default |
|---|---|---|
| `CODEBUDDY_PEER_ROLE` | `main`/`orchestrator`/`leaf` — leaf refuses outbound RPC | `main` |
| `CODEBUDDY_PEER_MAX_DEPTH` | call-chain depth cap before `MAX_DEPTH_EXCEEDED` | `3` |
| `CODEBUDDY_PEER_PROVIDER` | force a specific provider for `peer.chat` | auto-detect |
| `CODEBUDDY_PEER_MODEL` | override model used by `peer.chat` | provider default |
| `CODEBUDDY_PEER_DELEGATE_MAX_PER_TURN` | per-turn cap for `peer_delegate` tool | `5` |
| `CODEBUDDY_FLEET_STREAM` | opt-in fleet event broadcasts on tool start/complete | unset |

See `.env.example` for the full list with comments.

### New tools registered by default

- `peer_delegate(peer, prompt, …)` — LLM-callable delegate to a fleet
  peer. Returns text + usage. Anti-loop guarded (ROLE_LEAF + per-turn
  cap + depth cap).
- `list_peers()` — read-only snapshot of `FleetRegistry`.

Both are `fleetSafe: false` (outbound only). Inbound peers gate via
the existing A2A `fleetSafe` allowlist — unchanged.

### Behaviour changes (no API break)

- **Metrics TTL is now enforced** (V0.5 → V1.0). Prior behaviour was
  warn-only when persisted multi-agent metrics exceeded the configured
  TTL (`metrics_ttl_days`, default 30). V1.0 deletes the file and
  resets the in-memory baseline. This only affects sessions where
  `enable_persistence = true` AND metrics are older than the TTL —
  fresh sessions and sessions inside the TTL window are unchanged.

- **Cowork `<EnrollmentDialog>`** now probes `presence.hasModel()`
  before taking the camera and routes to `<ModelInstallDialog>` when
  the Buffalo_S model is missing, instead of failing late at encode time.

- **Cowork `<PresenceIndicator>`** is now live-driven by main-process
  `presence:event` IPC frames. Unchanged when no peer events are
  received — the static enrolled-count fallback still applies.

### Cowork version

- The Cowork desktop app version was previously `3.3.0-beta.x` (legacy
  OpenCoworkAI fork). With V1.0 it aligns to `1.0.0-rc.6` to match the
  core. No data migration required — settings, sessions, presence
  store all stay where they are (`<userData>` paths unchanged).

### Slash commands added

- `/fleet autonomous status|tick-now` — V1.0 (Phase d.18)
- `/heartbeat enable|disable|status` — V0.4.1 (already shipped)
- `/daily-reset enable|disable|status|run` — V0.4.1 (already shipped)

No commands removed in V1.0.

## V0.4.x → V0.5

This older delta is documented inline in `CHANGELOG.md` under the
`[0.5.0]` and `[0.5.1-fleet]` sections.

## Earlier upgrades

For pre-V0.4 migrations, see Git history. Code Buddy V0.1-V0.3 used
a different CLI structure that's been largely stable since V0.4.
