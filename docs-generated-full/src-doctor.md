---
title: "src — doctor"
module: "src-doctor"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.446Z"
---
# src — doctor

The `src/doctor` module is the diagnostic and self-healing component of the application. Its primary purpose is to inspect the current environment, system dependencies, and application configuration to identify potential issues that might hinder functionality. It provides a structured way to report these issues and, for many of them, offers automated fixes.

This module is crucial for ensuring a smooth user experience by proactively identifying and resolving common setup problems, making the application more robust and user-friendly.

## Core Concepts

The module operates around two key interfaces:

### `DoctorCheck`

Represents the result of a single diagnostic check.

```typescript
export interface DoctorCheck {
  name: string;      // A human-readable name for the check (e.g., "Node.js version")
  status: 'ok' | 'warn' | 'error'; // The severity of the check result
  message: string;   // A detailed message explaining the status
  fixable?: boolean; // True if an automated fix is available
  fix?: () => Promise<FixResult>; // An optional async function to apply the fix
}
```

### `FixResult`

Represents the outcome of an attempted fix operation.

```typescript
export interface FixResult {
  success: boolean; // True if the fix was applied successfully
  message: string;  // A message describing the outcome of the fix
  action: string;   // A short identifier for the action performed (e.g., "create-codebuddy-dir")
}
```

## How it Works: The Doctor Process

The diagnostic process involves two main stages, exposed through the module's public API:

1.  **Running Checks**: The `runDoctorChecks` function orchestrates all individual diagnostic checks. It gathers their results into an array of `DoctorCheck` objects.
2.  **Applying Fixes**: The `runFixes` function takes an array of `DoctorCheck` results (typically from `runDoctorChecks`) and iterates through them. For any check marked as `fixable` with an associated `fix` function, it attempts to execute that fix.

```mermaid
graph TD
    A[CLI Command] --> B{runDoctorChecks(cwd)}
    B --> C(checkNodeVersion)
    B --> D(checkDependencies)
    B --> E(checkApiKeys)
    B --> F(checkConfigFiles)
    B --> G(checkStaleLockFiles)
    B --> H(checkTtsProviders)
    B --> I(checkDiskSpace)
    B --> J(checkGit)
    B -- Returns DoctorCheck[] --> K{Display Checks to User}
    K -- User chooses to fix --> L{runFixes(DoctorCheck[])}
    L --> M{For each fixable check}
    M --> N(Call check.fix())
    N -- Returns FixResult --> O{Display Fix Results}
```

## Key Checks Explained

The module performs a comprehensive set of checks, categorized below:

### System Environment Checks

These functions verify the presence and version of external tools and system resources.

*   **`checkNodeVersion()`**: Ensures the Node.js runtime meets the minimum version requirement (>= 18).
*   **`checkDependencies()`**: Checks for essential command-line tools like `ripgrep (rg)`, `sox`, `RTK`, `ICM`, and common audio players (`ffplay`, `aplay`, `mpv`). These are often optional but highly recommended for full functionality.
*   **`checkTtsProviders()`**: Verifies the availability of Text-to-Speech (TTS) providers like `edge-tts` or `espeak`.
*   **`checkDiskSpace(cwd: string)`**: Reports on the available disk space in the current working directory, warning if it falls below 1 GB.
*   **`checkGit(cwd: string)`**: Confirms `git` is installed and whether the current working directory is part of a Git repository.

**Helper**:
*   **`commandExists(cmd: string)`**: A utility function used by many checks to determine if a given command-line tool is available in the system's PATH.

### Configuration Checks

These functions validate the application's internal configuration and directory structure.

*   **`checkApiKeys()`**: Inspects environment variables for required API keys (`GROK_API_KEY`, `OPENAI_API_KEY`, etc.), which are crucial for interacting with AI models.
*   **`checkConfigFiles(cwd: string)`**:
    *   Verifies the existence of the `.codebuddy` directory.
    *   Checks for the `config.json` file within `.codebuddy`.
    *   Examines `settings.json` for JSON corruption and schema migration needs (e.g., missing `model`, `maxToolRounds`, `theme` fields).

**Helpers**:
*   **`isJsonCorrupted(filePath: string)`**: Determines if a given file contains valid JSON.
*   **`checkSettingsMigration(filePath: string)`**: Checks if `settings.json` is missing required fields, indicating a need for schema migration.

### Runtime State Checks

These functions look for artifacts from previous runs that might indicate an issue.

*   **`checkStaleLockFiles(cwd: string)`**: Scans common directories (`.codebuddy`, `.codebuddy/daemon`, `.codebuddy/sessions`) for `.lock` or `.pid` files older than one hour, which might indicate a crashed process or improper shutdown.

**Helper**:
*   **`findStaleLockFiles(cwd: string)`**: Locates `.lock` and `.pid` files older than one hour within specified directories.

## Fixing Issues

For many identified problems, the `doctor` module provides automated `fix` functions. These functions are designed to be idempotent where possible and log their actions using the `logger`.

*   **`fixMissingCodebuddyDir(cwd: string)`**: Creates the `.codebuddy` directory if it's missing.
*   **`fixCorruptedSettings(cwd: string)`**: Recreates `settings.json` with default values if it's found to be corrupted (invalid JSON).
*   **`fixSettingsMigration(filePath: string)`**: Merges missing default settings (like `model`, `maxToolRounds`, `theme`) into an existing `settings.json` file.
*   **`fixStaleLockFiles(lockFiles: string[])`**: Deletes the specified list of stale lock files.

## Module Architecture and Dependencies

The `src/doctor/index.ts` module is a self-contained unit for diagnostics and fixes.

*   **Internal Structure**: It consists of a collection of `check*` functions, `fix*` functions, and several helper utilities. The `runDoctorChecks` and `runFixes` functions serve as the public API.
*   **External Dependencies**:
    *   `child_process`: Used for executing system commands (`execSync`) to check for command existence or Git status.
    *   `fs`: Heavily used for file system operations (`existsSync`, `mkdirSync`, `readFileSync`, `readdirSync`, `statSync`, `statfsSync`, `unlinkSync`, `writeFileSync`) to inspect directories, read/write configuration, and manage lock files.
    *   `path`: Used for path manipulation (`join`) to construct file and directory paths correctly.
    *   `../utils/logger.js`: For logging informational messages and errors during fix operations.
*   **Integration Points**:
    *   **Incoming Calls**: The primary consumer of this module is the CLI, specifically the `registerUtilityCommands` in `commands/cli/utility-commands.ts`, which exposes `doctor` and `doctor --fix` commands. It's also used extensively in unit and integration tests (`doctor-fix.test.ts`, `doctor.test.ts`).
    *   **Outgoing Calls**: Beyond standard Node.js modules, it calls `logger.info` for reporting.

## Usage

Developers can integrate the doctor module into various parts of the application, typically for pre-flight checks or maintenance tasks.

```typescript
import { runDoctorChecks, runFixes, DoctorCheck, FixResult } from './src/doctor/index.js';

async function performDiagnosticsAndFixes() {
  console.log('Running diagnostic checks...');
  const checks: DoctorCheck[] = await runDoctorChecks();

  console.log('\n--- Doctor Report ---');
  checks.forEach(check => {
    console.log(`[${check.status.toUpperCase()}] ${check.name}: ${check.message}`);
  });

  const fixableChecks = checks.filter(check => check.fixable && check.status !== 'ok');

  if (fixableChecks.length > 0) {
    console.log(`\nFound ${fixableChecks.length} fixable issues. Attempting to fix...`);
    const fixResults: FixResult[] = await runFixes(fixableChecks);

    console.log('\n--- Fix Results ---');
    fixResults.forEach(result => {
      console.log(`[${result.success ? 'SUCCESS' : 'FAILURE'}] ${result.action}: ${result.message}`);
    });
  } else {
    console.log('\nNo fixable issues found.');
  }
}

performDiagnosticsAndFixes();
```

## Contributing

To add a new diagnostic check or fix:

1.  **Implement a `check*` function**:
    *   Create a new function (e.g., `checkNewFeatureDependency`) that returns a `DoctorCheck` or `DoctorCheck[]`.
    *   Determine its `status` (`ok`, `warn`, `error`) and `message`.
    *   If it's fixable, set `fixable: true` and provide an `async fix` function.
2.  **Implement a `fix*` function (if applicable)**:
    *   Create an `async` function (e.g., `fixNewFeatureDependency`) that performs the necessary corrective action.
    *   It should return a `FixResult` indicating success or failure and a descriptive message.
    *   Use `logger.info` for successful actions and handle errors gracefully.
3.  **Integrate into `runDoctorChecks`**:
    *   Add your new `check*` function to the array returned by `runDoctorChecks`. Ensure it's placed logically with related checks.
4.  **Test**: Write unit tests to cover both the diagnostic check and the fix logic, ensuring it correctly identifies issues and applies fixes as expected.