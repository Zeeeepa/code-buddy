# Security

<details>
<summary>Relevant source files</summary>

- `src/security.ts`

</details>

The project has **44** security [modules](./3-commands-utils.md#modules) in `src/security/`.

## Security [Dependencies](./20-client.md#dependencies)

| Package | Category |
|---------|----------|
| `cors` | HTTP Hardening |

## Security Modules

| Module | Functions | Imported By |
|--------|-----------|-------------|
| `src/security/sandbox` | 0 | 6 |
| `src/security/audit-logger` | 0 | 4 |
| `src/channels/pro/scoped-auth` | 0 | 4 |
| `src/sandbox/sandbox-backend` | 0 | 4 |
| `src/security/bash-parser` | 0 | 3 |
| `src/security/ssrf-guard` | 0 | 3 |
| `src/agent/specialized/security-review/types` | 0 | 3 |
| `src/security/security-modes` | 0 | 3 |
| `src/security/data-redaction` | 0 | 3 |
| `src/security/dangerous-patterns` | 0 | 3 |
| `src/security/tool-policy/types` | 0 | 3 |
| `src/config/secret-ref` | 0 | 2 |
| `src/security/credential-manager` | 0 | 2 |
| `src/security/dependency-vuln-scanner` | 0 | 2 |
| `src/security/shell-env-policy` | 0 | 2 |
| `src/security/write-policy` | 0 | 2 |
| `src/server/auth/api-keys` | 0 | 2 |
| `src/agent/specialized/code-guardian-agent` | 0 | 2 |
| `src/agent/specialized/security-review-agent` | 0 | 2 |
| `src/sandbox/safe-eval` | 0 | 2 |
| `src/security/bash-allowlist/types` | 0 | 2 |
| `src/security/bash-allowlist/pattern-matcher` | 0 | 2 |
| `src/security/tool-policy/tool-groups` | 0 | 2 |
| `src/security/tool-policy/profiles` | 0 | 2 |
| `src/server/auth/jwt` | 0 | 2 |

## Summary

**Security** covers:
1. **Security Dependencies**
2. **Security Modules**


---

**See also:** [Overview](./1-overview.md)


**Referenced by:** [Testing](./27-testing.md)


---
[← Previous: Code Quality Metrics](./23-metrics.md) | [Next: Configuration →](./25-configuration.md)
