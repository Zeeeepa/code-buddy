## Security Module Documentation

This document provides detailed documentation for the security module, covering its purpose, security model, permission tiers, guardian risk scoring, and threat detection mechanisms.

### 1. Purpose

The security module is designed to safeguard the agent's operations by implementing robust permission controls, detecting sensitive information, preventing server-side request forgery, and providing an AI-powered approval system for tool calls. Its core purpose is to ensure the agent operates within defined safety parameters and to mitigate potential risks associated with automated actions.

### 2. Security Model

The overarching security model emphasizes a "fail-closed" approach, meaning that in cases of error or uncertainty, the system defaults to denying potentially risky actions. The Guardian sub-agent operates in a read-only mode for evaluations, ensuring that its analysis itself does not introduce new vulnerabilities. Critical information, such as detected secrets, is redacted in output to prevent accidental exposure.

### 3. Permission Tiers

The system employs a five-tier permission system to control the agent's actions and interactions. These tiers allow for granular control over what the agent can do and when it requires user intervention:

*   **`default`**: Standard operational mode, adhering to general safety guidelines and requiring approvals for sensitive actions.
*   **`plan`**: The agent can formulate plans but requires explicit user acceptance before executing any actions.
*   **`acceptEdits`**: The agent is permitted to make modifications (e.g., file edits) but may still require approval for other categories of actions.
*   **`dontAsk`**: The agent is allowed to execute actions without prompting the user for approval. This mode should be used with caution.
*   **`bypassPermissions`**: This is the most permissive mode, allowing the agent to bypass all internal permission checks. This mode can be disabled via configuration (`disableBypass`) to enforce a higher level of security.

Tool classifications (e.g., `READ_ONLY_TOOLS`, `EDIT_TOOLS`) are used to categorize actions and apply appropriate permission checks based on the configured mode.

### 4. Guardian Risk Scoring

The `Guardian Sub-Agent` is an AI-powered automatic approval reviewer for tool calls. It evaluates the safety of proposed actions using a dedicated Large Language Model (LLM) and assigns a structured risk score between 0 and 100:

*   **Risk Score < 80**: The action is considered safe and is automatically approved.
*   **Risk Score >= 80**: The action is considered potentially risky, and the user is prompted for explicit approval.
*   **Errors**: Any error during the evaluation process results in a "fail-closed" decision, meaning the action is denied.

Each `GuardianEvaluation` includes the `riskScore`, a `reasoning` (human-readable explanation), a `decision` (`approve`, `prompt_user`, or `deny`), and a list of `risks` identified.

The `GuardianContext` provides the necessary information for the evaluation, including `toolName`, `content` (arguments/command), `cwd` (current working directory), `recentFiles`, and a `yoloMode` flag.

### 5. Threat Detection

The security module incorporates several mechanisms for detecting and mitigating various threats:

*   **Secrets Detection (`Secrets Detector`)**:
    *   **Purpose**: Scans source code and other files for hardcoded sensitive information.
    *   **Detection Scope**: Identifies AWS keys, GitHub tokens, GitLab tokens, Slack tokens, Stripe keys, Google API keys, JWTs, private keys, passwords in code, database connection strings, and generic API keys/secrets.
    *   **Output**: Provides `SecretFinding` details including `filePath`, `line`, `column`, `type`, `severity` (critical, high, medium), a redacted `match` (first 4 characters shown), a `description`, and a `suggestion` for remediation.

*   **SSRF Protection (`SSRF Guard`)**:
    *   **Purpose**: Prevents Server-Side Request Forgery (SSRF) attacks by strictly controlling outbound HTTP requests made by the agent.
    *   **Protection Scope**: Blocks access to private, loopback, and link-local IPv4 and IPv6 addresses. This includes advanced bypass vectors such as IPv4-mapped IPv6, NAT64 prefixes, 6to4, Teredo, and various octal, hexadecimal, short, and packed IPv4 literals.
    *   **Security Measures**: Strips sensitive headers on cross-origin redirects to prevent information leakage. Operates on a "fail-closed" principle, blocking requests if parsing errors occur.
    *   **Configuration**: Allows for `allowedHosts` (exact hostname or wildcard domains) and `extraBlockedHosts` (additional CIDR-like ranges) to customize access, and `resolveDns` to control DNS resolution behavior.