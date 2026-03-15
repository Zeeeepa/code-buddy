# Security Architecture

The project implements a seven-layer defense-in-depth security model. Each layer catches different attack vectors, ensuring that a bypass in one layer is caught by another.

## Security Layers

| Layer | Component | Purpose |
|-------|-----------|---------|
| 1. Input Validation | Schema checking, sanitization | Prevents malformed data |
| 2. Authentication | JWT, API keys, DM pairing | Prevents unauthorized access |
| 3. Path Validation | Traversal detection, symlink escape | Prevents filesystem attacks |
| 4. Command Validation | Tree-sitter bash parsing | Prevents command injection |
| 5. Network Protection | SSRF guard, IP filtering | Prevents server-side request forgery |
| 6. Execution Control | Confirmation, sandbox, policies | User approval gate |
| 7. Post-Execution | Result sanitization, audit logging | Prevents data leakage |

## Guardian Sub-Agent

An AI-powered automatic approval reviewer (`src/security/guardian-agent.ts`) evaluates tool calls with structured risk scoring:

| Risk Score | Decision | Examples |
|-----------|----------|----------|
| 0-20 | Auto-approve | Read operations, standard builds |
| 20-60 | Auto-approve | File edits, package installs |
| 60-80 | Approve with warning | System modifications, network ops |
| 80-90 | Prompt user | Credential access, unknown scripts |
| 90-100 | Deny | `rm -rf /`, fork bombs, `drop database` |

## Environment Variable Filtering

Shell commands run in a filtered environment (`src/security/shell-env-policy.ts`):

- Variables matching `*KEY*`, `*SECRET*`, `*TOKEN*`, `*PASSWORD*` are stripped
- Three inheritance modes: `core` (minimal), `all` (filtered), `none` (empty)
- Provider-specific patterns: `AWS_*`, `OPENAI_*`, `STRIPE_*`, etc.

## Policy Amendments

When a command is blocked, the system suggests an allow rule (`src/security/policy-amendments.ts`):

- Rules stored in `.codebuddy/rules/allow-rules.json`
- Shell operators (`&&`, `||`, `;`, `|`) after the matched prefix are blocked
- Banned prefixes: interpreters (python, node), shells (bash, sh), `sudo`, `curl`