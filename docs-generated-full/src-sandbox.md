---
title: "src — sandbox"
module: "src-sandbox"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.657Z"
---
# src — sandbox

The `src/sandbox` module provides a robust and flexible framework for executing commands and code in isolated, secure environments. It is designed to protect the host system from potentially malicious or resource-intensive operations, offering multiple backend implementations and a granular policy engine for command authorization.

## Purpose and Overview

The primary goal of the `sandbox` module is to enhance the security and stability of the application by:
*   **Isolating execution**: Running untrusted or dangerous commands within a restricted environment.
*   **Resource control**: Limiting CPU, memory, and network access for sandboxed processes.
*   **Policy enforcement**: Defining and enforcing rules for which commands are allowed, denied, or require sandboxing.
*   **Backend flexibility**: Supporting various sandboxing technologies (Docker, OS-level, cloud-based) through a unified interface.
*   **Safe evaluation**: Providing a secure way to evaluate JavaScript expressions without host system access.

This module acts as a critical security layer, ensuring that agent-generated or user-provided commands do not compromise the system.

## Core Concepts

### Sandbox Backend Interface (`SandboxBackendInterface`)
All concrete sandbox implementations adhere to the `SandboxBackendInterface` defined in `src/sandbox/sandbox-backend.ts`. This interface standardizes how different sandboxing technologies are interacted with, allowing the system to swap backends seamlessly.

Key methods include:
*   `isAvailable()`: Checks if the backend can be used on the current system.
*   `execute(command: string, opts?: SandboxExecOptions)`: Runs a command in the sandbox.
*   `kill(containerId: string)`: Terminates a running sandboxed process/container.
*   `cleanup()`: Releases any resources held by the backend.

### Sandbox Registry (`SandboxRegistry`)
The `SandboxRegistry` (in `src/sandbox/sandbox-registry.ts`) implements a Strategy pattern to select the most appropriate sandbox backend at runtime. Backends are registered with a priority, and the registry automatically picks the highest-priority available backend. This ensures the system always attempts to use the strongest available isolation.

### Policy Actions (`PolicyAction`)
The `ExecPolicy` framework uses `PolicyAction` to define the outcome of a command evaluation:
*   `allow`: Execute the command directly on the host.
*   `deny`: Prevent the command from executing.
*   `ask`: Prompt the user for approval before execution.
*   `sandbox`: Route the command to a sandboxed environment.

## Architecture and Execution Flow

The overall flow for executing a command involves several layers:

```mermaid
graph TD
    A[Command Execution Request] --> B{ExecPolicy.evaluate};
    B -- Action: 'sandbox' --> C{AutoSandboxRouter.route};
    B -- Action: 'allow'/'ask'/'deny' --> D{SandboxRegistry.sandboxExecute};
    C -- Mode: 'sandbox' --> D;
    C -- Mode: 'direct' --> E[Direct OS Execution];

    D -- Selects best backend --> F(SandboxBackendInterface);
    F <|-- G[DockerSandbox];
    F <|-- H[OSSandbox];
    F <|-- I[E2BSandbox];
    F <|-- J[OpenShellBackend];

    subgraph Security & Routing
        B
        C
    end

    subgraph Sandbox Backends
        G
        H
        I
        J
    end

    subgraph Core Abstractions
        D
        F
    end
```

1.  **Policy Evaluation**: Any command execution request first passes through `ExecPolicy.evaluate()`. This checks the command against a set of predefined and custom rules.
2.  **Auto-Sandboxing**: If `ExecPolicy` determines the command should be sandboxed (or if it's a dangerous command), `AutoSandboxRouter.route()` is consulted. This router makes a decision based on command patterns and Docker availability.
3.  **Backend Selection**: The `SandboxRegistry.sandboxExecute()` function is the entry point for actual sandboxed execution. It queries registered backends (e.g., `DockerSandbox`, `OSSandbox`, `E2BSandbox`, `OpenShellBackend`) in order of priority to find the first available one.
4.  **Command Execution**: The selected backend's `execute()` method is called, running the command in its specific isolated environment. If no sandbox backend is available or required, the command might fall back to direct OS execution (with appropriate warnings).

## Key Components

### `src/sandbox/execpolicy.ts`
The `ExecPolicy` class provides a granular command authorization system.
*   **Rules**: It manages `PolicyRule` (glob/regex-based) and `PrefixRule` (exact token-array prefix matching) to define actions for commands. Rules are prioritized, with the most specific (longest prefix, highest priority) winning.
*   **Dangerous Patterns**: Includes a built-in list of `DANGEROUS_PATTERNS` (e.g., `rm -rf /`, fork bombs, credential exfiltration attempts) that automatically trigger a `deny` action.
*   **Audit Log**: Records all command evaluations for review and debugging.
*   **Configuration**: Configurable default action, audit logging, and custom rules file path.
*   **Usage**: Accessed via the `getExecPolicy()` singleton. `initializeExecPolicy()` loads rules, including built-in and custom ones.
*   **Connections**: Uses `parseBashCommand` and `isDangerousCommand` from `src/security` for command analysis.

### `src/sandbox/auto-sandbox.ts`
The `AutoSandboxRouter` automatically decides whether a command should be routed to a Docker sandbox.
*   **Logic**: It parses the command using `parseBashCommand`, checks if it's in `alwaysSandbox` or `neverSandbox` lists, or if `isDangerousCommand` flags it.
*   **Docker Check**: If sandboxing is recommended, it verifies `isDockerAvailable()` before routing. If Docker is unavailable, it logs a warning and falls back to direct execution.
*   **Configuration**: Configurable via `AutoSandboxConfig` (environment variables or runtime flags).
*   **Usage**: Accessed via the `getAutoSandboxRouter()` singleton.

### `src/sandbox/docker-sandbox.ts`
The `DockerSandbox` class executes commands within isolated Docker containers.
*   **Isolation**: Provides filesystem isolation, network restrictions, and resource limits (memory, CPU).
*   **Execution Modes**: Supports both one-shot `execute()` and streaming `executeStreaming()` for real-time output.
*   **Lifecycle Management**: Manages container creation, execution, and cleanup (`kill`, `prune`, `dispose`).
*   **Configuration**: Configurable Docker image, resource limits, network access, and workspace mounts.
*   **Connections**: Implements `SandboxBackendInterface`. Uses `child_process` to interact with the Docker daemon.

### `src/sandbox/e2b-sandbox.ts`
The `E2BSandbox` class provides cloud-based sandboxed execution using E2B Firecracker microVMs.
*   **Full VM Isolation**: Offers a higher level of isolation compared to containers.
*   **Features**: Supports file operations (`writeFile`, `readFile`, `listFiles`), package installation (`installPackages`), and script execution (`runScript`).
*   **Lifecycle**: Manages E2B sandbox creation (`ensureSandbox`) and destruction (`destroy`), including idle timeouts.
*   **SDK Wrapper**: `E2BSDKWrapper` abstracts the E2B API, attempting to use the `@e2b/code-interpreter` SDK if available, or falling back to direct `fetch`-based REST calls.
*   **Connections**: Serves as a `SandboxBackendInterface` (though not explicitly typed as such in the provided code). Relies on `E2B_API_KEY` environment variable. Used by various modules for file operations and script execution (e.g., `src/context/context-files.ts`, `src/skills/skill-manager.ts`).

### `src/sandbox/os-sandbox.ts`
The `OSSandbox` class provides native OS-level sandboxing.
*   **Platform-Specific Backends**:
    *   **Linux**: Supports `landlock` (using `bubblewrap` with `seccomp` BPF filters for strongest isolation) and `bubblewrap` (containerization via user namespaces).
    *   **macOS**: Uses `seatbelt` (`sandbox-exec`).
    *   **Windows**: Currently falls back to Docker or unsandboxed execution.
*   **Capability Detection**: `detectCapabilities()` identifies the best available backend on the host system.
*   **Tiered Access Control**: `createSandboxConfigForMode()` allows configuring sandbox access levels: `read-only`, `workspace-write`, and `danger-full-access`, inspired by Codex CLI. This includes protecting sensitive directories like `.git` and `.codebuddy`.
*   **Command Exclusion**: Allows specific commands to bypass the sandbox.
*   **Connections**: Implements `SandboxBackendInterface`. Uses `child_process`, `fs`, `os` for low-level OS interactions. `sanitizeEnvVars` from `src/security` is used to clean environment variables.

### `src/sandbox/openshell-backend.ts`
The `OpenShellBackend` provides compatibility with NVIDIA OpenShell, supporting two modes:
*   **`mirror`**: Executes commands locally, mirroring a local workspace into the sandbox. This is essentially a local subprocess execution with a configured working directory.
*   **`remote`**: Executes commands via a remote OpenShell API endpoint, requiring `apiUrl` and `apiKey`.
*   **Connections**: Implements `SandboxBackendInterface`. Uses `child_process` for `mirror` mode and `fetch` for `remote` mode.

### `src/sandbox/safe-eval.ts`
The `safe-eval` module offers a secure way to evaluate JavaScript expressions.
*   **Isolation**: Uses Node.js `vm.runInNewContext()` to run code in an isolated V8 context, preventing access to global objects like `process`, `require`, or `fs`.
*   **Timeouts**: Prevents infinite loops with configurable execution timeouts.
*   **Context**: Allows injecting a limited set of safe variables into the evaluation context.
*   **Functions**: Provides `safeEval()` for synchronous evaluation, `safeEvalAsync()` for async code, `safeEvalCondition()` for boolean conditions, and `safeInterpolate()` for template string processing.
*   **Connections**: Used throughout the codebase where dynamic expression evaluation is needed securely, such as in skill definitions or configuration processing.

## Integration Points and Usage

*   **Command Execution**: The primary entry point for executing any shell command is typically through a higher-level abstraction that leverages `ExecPolicy` and `SandboxRegistry`. For example, an agent might call `sandboxExecute()` after policy evaluation.
*   **File Operations**: `E2BSandbox`'s file methods (`readFile`, `writeFile`, `listFiles`) are used by modules like `src/context/context-files.ts`, `src/skills/skill-manager.ts`, and various test utilities to interact with remote sandbox filesystems.
*   **Configuration**: `ExecPolicy` and `AutoSandboxRouter` configurations can be set via environment variables or runtime options, allowing administrators to tailor security policies.
*   **Skill Management**: Custom skills might use `safeEval` or `safeEvalAsync` for secure script execution or `E2BSandbox.runScript` for more complex cloud-based script execution.
*   **Testing**: The `resetSandboxRegistry()`, `resetE2BSandbox()`, and `resetExecPolicy()` functions are crucial for ensuring clean state between unit tests.

## Contribution Guidelines

### Adding a New Sandbox Backend
1.  Create a new file `src/sandbox/your-backend.ts`.
2.  Implement the `SandboxBackendInterface`.
3.  Register your backend in `src/sandbox/sandbox-registry.ts` (or at application startup) with an appropriate priority.
4.  Consider how `AutoSandboxRouter` might interact with your new backend if it offers specific advantages for "dangerous" commands.

### Extending Execution Policies
1.  **Custom Rules**: Developers can add new `PolicyRule` or `PrefixRule` instances via `ExecPolicy.addRule()` or `ExecPolicy.addPrefixRule()`. These can be persisted to a custom rules file.
2.  **Dangerous Patterns**: The `DANGEROUS_PATTERNS` list in `execpolicy.ts` can be extended to detect new types of malicious commands.
3.  **Sandbox Modes**: The `createSandboxConfigForMode()` function in `os-sandbox.ts` can be extended to define new tiers of filesystem access if more nuanced control is required.