---
title: "tests — sandbox"
module: "tests-sandbox"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.978Z"
---
# tests — sandbox

The `sandbox` module provides a robust framework for safely executing untrusted code and commands within the system. It encompasses various levels of sandboxing, from OS-level process isolation to containerization and secure JavaScript evaluation. The primary goal is to prevent malicious or erroneous code from impacting the host system or accessing sensitive resources.

This documentation covers the key components, their responsibilities, and how they interact to provide a layered security approach.

## Core Concepts

The `sandbox` module employs several core concepts to achieve its goals:

*   **Execution Policy (`ExecPolicy`)**: A rule-based system that determines the allowed action for a given command (e.g., `allow`, `deny`, `ask`, `sandbox`).
*   **Sandbox Backends**: Specific implementations for isolating processes, such as Docker containers or OS-level tools like Bubblewrap/Seatbelt/Landlock.
*   **Sandbox Registry**: A centralized mechanism to register, discover, and select the most appropriate available sandbox backend based on priority and system capabilities.
*   **Auto-Routing**: A high-level component that integrates the execution policy with available sandbox backends to automatically decide how a command should be handled.
*   **Safe Evaluation**: A specialized sandbox for JavaScript code snippets, preventing access to sensitive Node.js globals and modules.

## Architecture Overview

The following diagram illustrates the high-level interaction between the main components when a command needs to be executed:

```mermaid
graph TD
    A[AutoSandboxRouter] -->|1. shouldSandbox(cmd)| B{ExecPolicy};
    B -->|PolicyAction (allow/deny/ask/sandbox)| A;
    A -->|2. route(cmd) if sandbox needed| C{SandboxRegistry};
    C -->|3. getActiveSandboxBackend()| D{Available Backends};
    D -->|Selects by Priority & Availability| E[OSSandbox];
    D -->|Selects by Priority & Availability| F[DockerSandbox];
    C -->|4. sandboxExecute(cmd)| E;
    C -->|4. sandboxExecute(cmd)| F;
    E -->|Executes via| G[Bubblewrap/Seatbelt/Landlock];
    F -->|Executes via| H[Docker CLI];

    subgraph Safe JS Evaluation
        I[safeEval/safeEvalAsync/safeEvalCondition/safeInterpolate]
    end
```

1.  The `AutoSandboxRouter` is the entry point for deciding how to handle a command.
2.  It consults the `ExecPolicy` to determine the recommended action.
3.  If the policy dictates sandboxing, the `AutoSandboxRouter` delegates to the `SandboxRegistry`.
4.  The `SandboxRegistry` identifies the best available sandbox backend (either `OSSandbox` or `DockerSandbox`).
5.  The chosen backend then executes the command using its underlying isolation mechanism.
6.  Separately, the `safe-eval` functions provide a dedicated environment for secure JavaScript execution.

## Key Components

### `ExecPolicy`

The `ExecPolicy` class (`src/sandbox/execpolicy.ts`) is responsible for defining and evaluating rules that govern command execution. It acts as a gatekeeper, determining whether a command should be allowed, denied, sandboxed, or require user confirmation.

**Purpose:**
To provide a flexible, rule-based system for enforcing security policies on external command execution.

**Key Features:**

*   **Rule-based Evaluation**: Commands are matched against a set of rules, each specifying a pattern, an action (`allow`, `deny`, `ask`, `sandbox`), and a priority.
*   **Built-in Rules**: Includes predefined rules for common safe commands (e.g., `ls`, `cat`), dangerous commands (e.g., `rm -rf /`, fork bombs), package managers (`npm`, `pip`), and shell interpreters (`bash`, `sh`).
*   **Dangerous Pattern Detection**: Actively scans command arguments for known dangerous patterns (e.g., `curl | bash`).
*   **Configurable Default Action**: Specifies the action to take if no rule matches.
*   **Audit Log**: Records all command evaluations for review.
*   **Custom Rules**: Allows adding, updating, and removing custom rules dynamically.
*   **Singleton Pattern**: Ensures a single, globally accessible instance of the policy (`getExecPolicy()`).

**Usage:**

```typescript
import { ExecPolicy, PolicyAction, getExecPolicy, initializeExecPolicy } from '../../src/sandbox/execpolicy';

// Get the singleton instance (or initialize it)
const policy = await initializeExecPolicy();

// Evaluate a command
const evaluation = policy.evaluate('npm', ['install', 'express']);
console.log(`Command 'npm install express' action: ${evaluation.action}`); // 'ask' or 'sandbox'

// Check if a command is generally allowed
if (policy.isAllowed('ls')) {
  console.log('ls is allowed');
}

// Add a custom rule
policy.addRule({
  name: 'Allow My Custom Script',
  pattern: '^my-script\\.sh$',
  isRegex: true,
  action: 'allow',
  priority: 150,
  enabled: true,
});
```

### `OSSandbox`

The `OSSandbox` class (`src/sandbox/os-sandbox.ts`) provides OS-level process isolation using platform-specific tools. It aims to run commands with minimal privileges and restricted access to the filesystem and network.

**Purpose:**
To execute commands in a lightweight, isolated environment directly on the host OS, leveraging native sandboxing capabilities.

**Key Features:**

*   **Platform Agnostic Interface**: Provides a unified `exec` interface regardless of the underlying OS.
*   **Capability Detection**: Automatically detects available sandboxing tools on the system:
    *   **Linux**: `bubblewrap` (bwrap), `Landlock` (kernel feature with `bwrap` integration), `Seccomp` (kernel feature with `bwrap` integration).
    *   **macOS**: `sandbox-exec` (Seatbelt).
    *   **Windows**: Currently falls back to `none` (direct execution).
*   **Configurable Isolation**: Allows specifying a working directory, network access, read-only/read-write paths, and execution timeout.
*   **Landlock/Seccomp Integration**: On Linux, if Landlock is available (kernel >= 5.13 or `/proc/sys/kernel/unprivileged_landlock_restrict`), it attempts to use `bwrap` with Landlock and a generated Seccomp BPF filter for enhanced syscall restriction.
*   **Fallback Mechanism**: If a requested backend (e.g., `landlock`) or its dependencies fail, it gracefully falls back to other available backends (e.g., `bubblewrap` without seccomp) or `none`.
*   **Singleton Pattern**: Accessible via `getOSSandbox()`.

**Usage:**

```typescript
import { OSSandbox, getOSSandbox } from '../../src/sandbox/os-sandbox';

const sandbox = getOSSandbox();

// Initialize the sandbox (detects capabilities and selects backend)
await sandbox.initialize();

if (await sandbox.isAvailable()) {
  console.log(`OS Sandbox backend: ${sandbox.getBackend()}`);

  // Execute a command with network disabled and a specific work directory
  const result = await sandbox.exec('npm', ['install'], {
    workDir: '/tmp/my-project',
    allowNetwork: false,
    timeout: 60000,
  });

  if (result.success) {
    console.log('Command output:', result.stdout);
  } else {
    console.error('Command failed:', result.stderr || result.error);
  }
} else {
  console.warn('OS Sandbox not available on this system.');
}
```

**Landlock/Seccomp Specifics:**
The `checkLandlockSupport()` function determines Landlock availability based on kernel version or `/proc` entry. `generateSeccompFilter()` creates a BPF filter that blocks specific dangerous syscalls (e.g., `reboot`, `kexec_file_load`). When `OSSandbox` uses the `landlock` backend, it writes this filter to a temporary file and passes it to `bwrap` using the `--seccomp` flag.

### `DockerSandbox`

The `DockerSandbox` class (`src/sandbox/docker-sandbox.ts`) provides container-based isolation using Docker. This offers a higher level of isolation compared to OS-level sandboxing, as commands run within a separate container environment.

**Purpose:**
To execute commands within isolated Docker containers, providing strong resource limits and environment control.

**Key Features:**

*   **Docker Integration**: Builds and executes `docker run` commands with various isolation parameters.
*   **Resource Limits**: Configurable memory (`-m`), CPU (`--cpus`), and network (`--network none`) restrictions.
*   **Filesystem Control**: Supports read-only containers (`--read-only`) and mounting host directories as a workspace (`-v`, `-w`).
*   **Execution Timeout**: Automatically kills containers if execution exceeds a specified duration.
*   **Container Management**: Tracks active containers and provides methods to `kill` specific containers or `prune` old ones.
*   **Availability Check**: `isAvailable()` checks if the Docker daemon is running and accessible.

**Usage:**

```typescript
import { DockerSandbox } from '../../src/sandbox/docker-sandbox';

const dockerSandbox = new DockerSandbox({
  image: 'node:22-slim',
  memoryLimit: '512m',
  cpuLimit: '0.5',
  networkEnabled: false,
  workspaceMount: '/path/to/host/project',
  timeout: 30000,
});

if (await DockerSandbox.isAvailable()) {
  const result = await dockerSandbox.execute('npm test');

  if (result.success) {
    console.log('Docker command output:', result.output);
  } else {
    console.error('Docker command failed:', result.error);
  }
} else {
  console.warn('Docker is not available.');
}
```

### `SandboxRegistry`

The `SandboxRegistry` (`src/sandbox/sandbox-registry.ts`) acts as a central hub for managing and selecting available sandbox backends. It allows different sandbox implementations (like `OSSandbox` and `DockerSandbox`) to register themselves and be chosen based on priority and availability.

**Purpose:**
To abstract away the complexity of choosing the "best" sandbox backend, providing a unified `sandboxExecute` interface.

**Key Features:**

*   **Backend Registration**: Backends register themselves with a name, an implementation, and a priority.
*   **Priority-based Selection**: `getActiveSandboxBackend()` selects the highest-priority backend that reports itself as `isAvailable()`.
*   **Caching**: Caches the active backend to avoid repeated availability checks.
*   **Unified Execution**: `sandboxExecute(command)` uses the currently active backend to run the command.
*   **Listing Backends**: `listSandboxBackends()` provides an overview of all registered backends and their availability.

**Usage:**

```typescript
import {
  registerSandboxBackend,
  getActiveSandboxBackend,
  sandboxExecute,
  listSandboxBackends,
} from '../../src/sandbox/sandbox-registry';
import { OSSandbox } from '../../src/sandbox/os-sandbox';
import { DockerSandbox } from '../../src/sandbox/docker-sandbox';

// Register backends (typically done during module initialization)
registerSandboxBackend(new OSSandbox(), 100); // Higher priority
registerSandboxBackend(new DockerSandbox(), 50); // Lower priority

// Get the active backend
const activeBackend = await getActiveSandboxBackend();
if (activeBackend) {
  console.log(`Active sandbox backend: ${activeBackend.name}`);
}

// Execute a command using the active backend
const result = await sandboxExecute('echo "Hello from sandbox!"');
console.log(result.output);

// List all registered backends
const backends = await listSandboxBackends();
console.log('Registered backends:', backends);
```

### `AutoSandboxRouter`

The `AutoSandboxRouter` (`src/sandbox/auto-sandbox.ts`) is the top-level component that orchestrates the decision-making process for command execution. It combines the `ExecPolicy` with the `SandboxRegistry` to automatically route commands to either direct execution or a suitable sandbox.

**Purpose:**
To provide an intelligent, automated routing mechanism for commands, applying sandboxing only when necessary and feasible.

**Key Features:**

*   **Policy Integration**: Uses `ExecPolicy.evaluate()` to determine if a command should be sandboxed.
*   **Sandbox Registry Integration**: If sandboxing is required, it delegates to `SandboxRegistry.sandboxExecute()`.
*   **Configurable**: Can be enabled/disabled globally.
*   **`shouldSandbox()`**: A synchronous check to quickly determine if a command *would* be sandboxed based on policy.
*   **`route()`**: The main asynchronous method that executes the command, either directly or via a sandbox, returning the execution mode (`direct` or `sandbox`).

**Usage:**

```typescript
import { AutoSandboxRouter } from '../../src/sandbox/auto-sandbox';

const router = new AutoSandboxRouter({ enabled: true });

// Check if a command should be sandboxed
const checkResult = router.shouldSandbox('npm install');
console.log(`'npm install' should sandbox: ${checkResult.sandbox} (Reason: ${checkResult.reason})`);

// Route and execute a command
const routeResult = await router.route('ls -la');
console.log(`'ls -la' executed in mode: ${routeResult.mode}`); // 'direct'

const npmRouteResult = await router.route('npm install');
console.log(`'npm install' executed in mode: ${npmRouteResult.mode}`); // 'sandbox' or 'direct' (if no backend)

// Disable the router
router.setEnabled(false);
const disabledCheck = router.shouldSandbox('npm install');
console.log(`After disabling, 'npm install' should sandbox: ${disabledCheck.sandbox}`); // false
```

### Safe JavaScript Evaluation (`safe-eval.ts`)

The `safe-eval.ts` module provides functions for securely evaluating JavaScript code snippets within a restricted environment. This is crucial for scenarios where user-provided or untrusted JavaScript needs to be executed without granting access to the full Node.js runtime.

**Purpose:**
To safely execute JavaScript expressions and template strings, preventing access to sensitive global objects and modules.

**Key Functions:**

*   **`safeEval(code, options)`**: Evaluates a synchronous JavaScript expression.
*   **`safeEvalAsync(code, options)`**: Evaluates an asynchronous JavaScript expression (supports `await`).
*   **`safeEvalCondition(code, context)`**: Evaluates a JavaScript expression as a boolean condition, returning `false` on errors.
*   **`safeInterpolate(template, context)`**: Interpolates values from a context into a template string containing `{{...}}` expressions.

**Key Features:**

*   **Global Scope Restriction**: Blocks access to `process`, `require`, and other sensitive Node.js globals. `globalThis.process` will be `undefined`.
*   **Context Variables**: Allows injecting specific variables into the evaluation scope.
*   **Timeout**: Prevents infinite loops or long-running scripts from blocking the application.
*   **Error Handling**: Catches syntax errors and runtime exceptions, preventing crashes.

**Usage:**

```typescript
import { safeEval, safeEvalAsync, safeEvalCondition, safeInterpolate } from '../../src/sandbox/safe-eval';

// Synchronous evaluation
const sum = safeEval('x + y', { context: { x: 10, y: 20 } });
console.log('Sum:', sum); // 30

// Asynchronous evaluation
async function runAsyncEval() {
  const result = await safeEvalAsync('const p = Promise.resolve(100); return await p + val;', { context: { val: 1 } });
  console.log('Async result:', result); // 101
}
runAsyncEval();

// Conditional evaluation
const isAllowed = safeEvalCondition('user.role === "admin" && item.price < 100', {
  user: { role: 'admin' },
  item: { price: 50 },
});
console.log('Is allowed:', isAllowed); // true

// Template interpolation
const message = safeInterpolate('Hello {{user.name}}, your total is ${{order.total.toFixed(2)}}.', {
  user: { name: 'Alice' },
  order: { total: 123.456 },
});
console.log('Message:', message); // "Hello Alice, your total is $123.46."

// Attempting unsafe operations will throw
try {
  safeEval('process.exit(1)');
} catch (e) {
  console.error('Caught unsafe eval attempt:', e.message);
}
```

## Developer Notes

*   **Testing Sandboxes**: Due to the nature of sandboxing, many tests (especially for `DockerSandbox` and `OSSandbox`) heavily rely on mocking `child_process` functions (`execSync`, `spawn`, `spawnSync`) to simulate external command execution without actually running Docker or `bwrap`. When contributing, ensure mocks are correctly set up and cleaned up.
*   **Adding New Sandbox Backends**: To add a new sandbox backend, implement the `SandboxBackendInterface` (`src/sandbox/sandbox-backend.ts`) and register it with the `SandboxRegistry` using `registerSandboxBackend()`. Remember to consider its priority relative to existing backends.
*   **Extending `ExecPolicy`**: New rules can be added to `ExecPolicy` to handle specific commands or patterns. When adding rules, consider their priority and potential interactions with existing rules. Dangerous patterns should always have a high priority and result in a `deny` action.
*   **Platform-Specific Logic**: Be mindful of platform differences when working with `OSSandbox`. Capabilities and recommended backends vary significantly between Linux, macOS, and Windows.
*   **Security Considerations**: Always prioritize security. When modifying sandbox logic or adding new features, consider potential bypasses or vulnerabilities. The goal is to minimize the attack surface for untrusted code.