---
title: "src — integrations"
module: "src-integrations"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.536Z"
---
# src — integrations

The `src/integrations` module serves as the primary interface between Code Buddy and various external systems, platforms, and services. It encapsulates the logic for interacting with version control systems (GitHub, GitLab), continuous integration/continuous deployment (CI/CD) pipelines, browser environments, and automated code review tools.

This module is designed to be modular, allowing Code Buddy to extend its capabilities by plugging into different external ecosystems. Each file within this module typically represents a distinct integration point, providing a specialized API for that external system.

## Module Overview

The `src/integrations` module comprises several key components:

*   **`chrome-bridge.ts`**: A bridge for interacting with a Chrome extension, enabling browser state capture and control.
*   **`ci-autofix-pipeline.ts`**: An automated pipeline for detecting, diagnosing, and fixing CI failures.
*   **`cicd-integration.ts`**: A general CI/CD manager for detecting, creating, and monitoring workflows across different providers.
*   **`code-review.ts`**: An AI-powered static code analysis tool for reviewing staged changes.
*   **`git-platform-integration.ts`**: A generic API client for GitHub and GitLab, providing programmatic access to repositories, PRs, and issues.
*   **`github-action-runner.ts`**: Utilities for running Code Buddy as a GitHub Action, parsing event payloads and formatting outputs.
*   **`github-actions.ts`**: A dedicated manager for GitHub Actions workflows, leveraging the `gh` CLI.
*   **`github-integration.ts`**: A more advanced integration with GitHub/GitLab, primarily using their respective CLIs (`gh`, `glab`) for PR and issue management.

---

## Chrome Bridge (`chrome-bridge.ts`)

The `ChromeBridge` module provides a lightweight, in-memory bridge for integrating with a Chrome extension. It allows Code Buddy to capture browser state (DOM, network, console errors), record user actions, and send commands to control a real browser instance.

### Purpose

*   **Browser State Snapshotting**: Capture the current URL, title, console errors, network requests, and a simplified DOM state.
*   **Action Recording**: Record user interactions (clicks, inputs, navigation, scrolls) for later playback or analysis.
*   **Browser Control**: Send commands to a Chrome extension to perform actions like clicking elements, typing text, navigating, or evaluating JavaScript in the browser's context.

### Key Concepts

*   **`ChromeBridgeConfig`**: Configuration for the bridge, including the port and optional extension ID.
*   **`DOMElementInfo`**: A simplified representation of a DOM element's key properties.
*   **`NetworkRequest`**: Details about a network request made by the browser.
*   **`RecordedAction`**: A user interaction recorded by the extension.
*   **`BrowserAction`**: A command sent *to* the browser extension to perform an action.
*   **`BrowserActionResult`**: The response received after a `BrowserAction` is executed.
*   **`ChromePageSnapshot`**: A comprehensive snapshot of the browser's current state.
*   **`ChromeBridgeMessage`**: The generic message format for bidirectional communication.

### How it Works

The `ChromeBridge` is implemented as a **singleton** (`getInstance`). It maintains an in-memory store of the latest browser state (URL, title, console errors, network requests, DOM state) and recorded actions.

1.  **Connection**: The `connect()` method simulates establishing a connection, setting the `connected` flag.
2.  **Inbound Data (`ingestSnapshot`, `ingestMessage`)**:
    *   `ingestSnapshot(snapshot: ChromePageSnapshot)`: Replaces all current browser state with a new, complete snapshot.
    *   `ingestMessage(message: ChromeBridgeMessage)`: Processes individual updates (console errors, network requests, DOM changes, page info, recorded actions) from the extension.
3.  **Outbound Commands (`sendAction`)**:
    *   `sendAction(action: BrowserAction)`: Sends a command to the browser. It assigns a unique ID, sets up a timeout, and adds the action to an `actionQueue`.
    *   `receiveActionResponse(actionId: string, result: BrowserActionResult)`: Called when the extension sends back a result for a pending action, resolving the promise created by `sendAction`.
    *   `simulateAction(actionId: string, action: BrowserAction)`: A local fallback mechanism that simulates browser actions for testing or when no extension is connected. This allows Code Buddy to operate even without a live browser connection.
4.  **State Retrieval**: Methods like `getConsoleErrors()`, `getDOMState()`, `getNetworkRequests()`, `getRecording()` allow other modules to query the captured browser state.
5.  **Script Execution (`executeScript`)**: Provides a sandboxed `vm.Script` environment to execute JavaScript against the *last captured DOM snapshot*. This is useful for querying elements or data without directly interacting with the live browser. The sandbox includes `document`, `window`, and `console` objects, mimicking a browser environment.

#### Execution Flow: Sending an Action

```mermaid
graph TD
    A[Code Buddy Agent] --> B{ChromeBridge.sendAction(action)};
    B --> C{Generate actionId};
    B --> D{Create Promise & Timeout};
    B --> E{Store Promise/Timeout in pendingActions};
    B --> F{Add {id, action} to actionQueue};
    F --> G{Chrome Extension polls drainActionQueue()};
    G --> H{Extension executes action};
    H --> I{Extension sends result back to Code Buddy};
    I --> J{ChromeBridge.receiveActionResponse(actionId, result)};
    J --> K{Clear Timeout};
    J --> L{Resolve Promise with result};
    L --> M[Agent receives BrowserActionResult];

    subgraph Simulation (Fallback)
        F --> N{ChromeBridge.simulateAction(actionId, action)};
        N --> O{Simulate action locally};
        O --> J;
    end
```

### Usage

The `ChromeBridge` is typically used by agents that need to:
*   **Observe user behavior**: By starting `startRecording()` and retrieving `getRecording()`.
*   **Debug web applications**: By accessing `getConsoleErrors()` and `getNetworkRequests()`.
*   **Automate browser tasks**: By sending `BrowserAction` commands via `sendAction()`, `navigate()`, `click()`, `type()`, `evaluate()`, etc.
*   **Analyze web pages**: By using `getDOMState()` or `executeScript()` against the captured DOM.

---

## CI Auto-Fix Pipeline (`ci-autofix-pipeline.ts`)

The `CIAutoFixPipeline` module is designed to automatically detect, diagnose, and propose fixes for CI failures. It leverages an LLM for root cause analysis and fix generation, and integrates with local development tools to validate proposed changes.

### Purpose

*   **Automated CI Failure Remediation**: Reduce developer toil by automatically attempting to fix common CI failures.
*   **LLM-Powered Analysis**: Use large language models to understand failure logs and suggest code changes.
*   **Local Validation**: Ensure proposed fixes work by running local tests before creating a pull request.

### Key Concepts

*   **`CIFailure`**: Represents a detected CI failure, including provider, run ID, job name, log, branch, and commit.
*   **`FixAttempt`**: Details of a single attempt to fix a CI failure, including root cause, fix description, modified files, and local test results.
*   **`AutoFixResult`**: The overall outcome of the auto-fix process, containing all attempts and the final success status.
*   **`MAX_ATTEMPTS`**: A guard to prevent infinite loops of fix attempts (currently 3).

### How it Works

The `CIAutoFixPipeline` is a **singleton** (`getCIAutoFixPipeline`). It relies on a `BashTool` for executing Git and test commands, and an external LLM via a callback.

1.  **`autoFix(failure: CIFailure)`**: This is the main entry point.
    *   It checks if the `MAX_ATTEMPTS` limit has been reached for a given failure.
    *   It iterates through fix attempts, calling `tryFix` for each.
    *   If `tryFix` succeeds (local tests pass), it attempts to:
        *   Create a new Git branch (`autofix/...`).
        *   Commit the changes with an LLM-generated message.
        *   Push the branch to the remote.
        *   Create a pull request using `gh pr create`.
        *   Switches back to the original branch.
2.  **`tryFix(failure: CIFailure, attempt: number, previousAttempts: FixAttempt[])`**:
    *   **Root Cause Analysis**: Constructs a prompt for the LLM, including the CI log and any previous failed attempts. It expects the LLM to return `ROOT_CAUSE`, `FIX_FILES`, and `FIX_DESCRIPTION`.
    *   **Generate Fix (Conceptual)**: If target files are identified, it generates another LLM prompt to get specific code changes. (Note: The provided code currently only generates the prompt, a full implementation would parse and apply these changes).
    *   **Run Local Tests**: Executes `npm test` (or similar) using `BashTool` to validate the applied fix.
3.  **`fetchGitHubActionsLog(runId: string)`**: A utility to fetch detailed CI failure information from GitHub Actions using the `gh CLI`.

#### Execution Flow: Auto-Fixing a CI Failure

```mermaid
graph TD
    A[CI Failure Detected] --> B{CIAutoFixPipeline.autoFix(failure)};
    B --> C{Check MAX_ATTEMPTS};
    C -- Attempts remaining --> D{Loop for each attempt};
    D --> E{CIAutoFixPipeline.tryFix(failure, attempt)};
    E --> F{LLM: Root Cause Analysis Prompt};
    F --> G[LLM Response: ROOT_CAUSE, FIX_FILES, FIX_DESCRIPTION];
    G --> H{Parse LLM Response};
    H --> I{LLM: Generate Fix Prompt (if files identified)};
    I --> J[LLM Response: Code Changes (conceptual)];
    J --> K{Apply Code Changes (agent/tool-driven)};
    K --> L{BashTool: Run Local Tests (e.g., npm test)};
    L -- Tests Passed --> M{FixAttempt.localTestsPassed = true};
    M --> N{BashTool: Git Checkout new branch};
    N --> O{BashTool: Git Add & Commit};
    O --> P{BashTool: Git Push};
    P --> Q{BashTool: gh pr create};
    Q --> R[PR Created, AutoFixResult.success = true];
    R --> S{BashTool: Git Checkout original branch};
    S --> T[Return AutoFixResult];
    L -- Tests Failed --> U{FixAttempt.localTestsPassed = false};
    U --> D;
    C -- Max attempts reached --> T;
```

### Usage

The `CIAutoFixPipeline` is intended to be integrated into a CI monitoring system. When a CI failure is detected, the `autoFix` method is called. It requires an LLM callback to be set via `setLLMCallback` for its core functionality.

---

## CI/CD Integration Module (`cicd-integration.ts`)

The `CICDManager` provides a high-level, provider-agnostic interface for interacting with CI/CD pipelines. It focuses on detecting existing workflows, creating new ones from templates, validating their syntax, and monitoring their runs.

### Purpose

*   **CI/CD Awareness**: Understand the CI/CD setup of a project.
*   **Workflow Management**: Create, validate, and list CI/CD workflows.
*   **Status Monitoring**: Get information about workflow runs.
*   **Automated Workflow Generation**: Suggest and create workflows based on project type.

### Key Concepts

*   **`CICDProvider`**: Enum for supported CI/CD providers (GitHub Actions, GitLab CI, Jenkins, etc.).
*   **`WorkflowStatus`**: Status of a workflow run (success, failure, running, etc.).
*   **`WorkflowRun`**: Detailed information about a specific workflow execution.
*   **`WorkflowDefinition`**: A parsed representation of a CI/CD workflow file.
*   **`GitHubActionsWorkflow`**: Type definition for GitHub Actions YAML structure.
*   **`CICDConfig`**: Configuration for the manager, including provider, workflow paths, and auto-detection settings.
*   **`WORKFLOW_TEMPLATES`**: Predefined YAML templates for common CI/CD workflows.

### How it Works

The `CICDManager` is a **singleton** (`getCICDManager`) that extends `EventEmitter`. It operates within a specified `workingDirectory`.

1.  **`detectWorkflows()`**: Scans the `workingDirectory` for common CI/CD configuration files (`.github/workflows/`, `.gitlab-ci.yml`, `.circleci/config.yml`) to identify the provider and parse workflow definitions.
    *   `loadGitHubWorkflows()`: Parses `.yml` files in `.github/workflows`.
    *   `loadGitLabWorkflow()`: Parses `.gitlab-ci.yml`.
    *   `loadCircleCIWorkflow()`: Parses `.circleci/config.yml`.
2.  **`getWorkflowRuns(workflowName?: string, limit: number = 5)`**: Uses the `gh` CLI (GitHub CLI) to fetch recent workflow runs for GitHub Actions. It parses the JSON output and maps it to `WorkflowRun` objects.
3.  **`createWorkflow(name: string, template: string)`**: Creates a new workflow file from a predefined `WORKFLOW_TEMPLATES` and writes it to the configured `workflowsPath`.
4.  **`validateWorkflow(content: string)`**: Parses a given YAML content as a GitHub Actions workflow and performs basic structural validation (e.g., presence of `name`, `on`, `jobs`, `runs-on`, `steps`).
5.  **`triggerWorkflow(workflowFile: string, ref: string = "main")`**: Uses the `gh` CLI to manually trigger a GitHub Actions workflow.
6.  **`suggestWorkflow()`**: Analyzes the project's `workingDirectory` (e.g., presence of `package.json`, `requirements.txt`, `Cargo.toml`, `Dockerfile`) to suggest a suitable workflow template.

#### Execution Flow: Workflow Detection

```mermaid
graph TD
    A[CICDManager.constructor] --> B{config.autoDetect is true?};
    B -- Yes --> C{CICDManager.detectWorkflows()};
    C --> D{Check for .github/workflows/};
    D -- Found --> E{loadGitHubWorkflows(path)};
    C --> F{Check for .gitlab-ci.yml};
    F -- Found --> G{loadGitLabWorkflow(path)};
    C --> H{Check for .circleci/config.yml};
    H -- Found --> I{loadCircleCIWorkflow(path)};
    E & G & I --> J[Populate this.workflows array];
    J --> K{Emit "workflows:detected" event};
```

### Usage

The `CICDManager` is used by agents or commands that need to:
*   **Understand project CI/CD**: `getWorkflows()`, `formatStatus()`.
*   **Propose new CI/CD setups**: `suggestWorkflow()`, `getTemplates()`, `createWorkflow()`.
*   **Monitor CI/CD status**: `getWorkflowRuns()`.
*   **Validate CI/CD configurations**: `validateWorkflow()`.

---

## AI Code Review Module (`code-review.ts`)

The `CodeReviewManager` provides automated static code analysis for staged changes in a Git repository. It identifies potential issues like bugs, security vulnerabilities, performance bottlenecks, and code smells based on predefined patterns and heuristics.

### Purpose

*   **Automated Pre-Commit Review**: Catch common issues before code is committed.
*   **Static Analysis**: Identify patterns indicative of bugs, security risks, or poor maintainability.
*   **Git Integration**: Focus review specifically on staged changes.

### Key Concepts

*   **`IssueSeverity`**: Critical, major, minor, info.
*   **`IssueType`**: Bug, security, performance, style, maintainability, etc.
*   **`ReviewIssue`**: Details of a single identified issue (file, line, type, severity, message).
*   **`FileDiff`**: Parsed information about a changed file in the diff.
*   **`DiffHunk`**: A section of changes within a file.
*   **`ReviewResult`**: The comprehensive outcome of a review, including files, issues, summary, and a recommendation.
*   **`CodeReviewConfig`**: Configuration for the review process (enabled checks, max complexity, ignore patterns).
*   **`SECURITY_PATTERNS`, `PERFORMANCE_PATTERNS`, `CODE_SMELL_PATTERNS`**: Regular expressions used to detect specific issues.

### How it Works

The `CodeReviewManager` is a **singleton** (`getCodeReviewManager`) that extends `EventEmitter`. It operates within a `workingDirectory`.

1.  **`reviewStagedChanges()`**: This is the main method.
    *   `getStagedDiff()`: Executes `git diff --staged` to get the changes.
    *   `parseDiff(diff: string)`: Parses the raw Git diff output into `FileDiff` and `DiffHunk` objects, identifying added/modified/deleted files and their changes.
    *   For each `FileDiff`:
        *   `analyzeFile(fileDiff: FileDiff)`: Checks if the file should be ignored. Then, it applies various checks:
            *   `checkPatterns()`: Iterates through `SECURITY_PATTERNS`, `PERFORMANCE_PATTERNS`, and `CODE_SMELL_PATTERNS` to find regex matches in the changed lines.
            *   `calculateNestingLevel()`: A simple heuristic to estimate code complexity.
    *   Aggregates all `ReviewIssue`s and generates a `ReviewResult` with a summary and recommendation.
    *   Emits `review:start` and `review:complete` events.
2.  **`generateReviewPrompt(diff: string)`**: Creates a detailed LLM prompt for a human-like code review, providing the diff and criteria. This is separate from the automated pattern-based review.
3.  **`formatResults(result: ReviewResult)`**: Formats the review results into a human-readable string.

#### Execution Flow: Reviewing Staged Changes

```mermaid
graph TD
    A[Code Buddy Agent/Hook] --> B{CodeReviewManager.reviewStagedChanges()};
    B --> C{Emit "review:start"};
    B --> D{git diff --staged};
    D --> E[Raw Diff Output];
    E --> F{CodeReviewManager.parseDiff(diff)};
    F --> G[List of FileDiff objects];
    G --> H{For each FileDiff};
    H --> I{CodeReviewManager.analyzeFile(fileDiff)};
    I --> J{Check ignorePatterns};
    J -- Not Ignored --> K{checkPatterns(SECURITY_PATTERNS)};
    K --> L{checkPatterns(PERFORMANCE_PATTERNS)};
    L --> M{checkPatterns(CODE_SMELL_PATTERNS)};
    M --> N{calculateNestingLevel()};
    N --> O[Collect ReviewIssue objects];
    H --> P[All ReviewIssues collected];
    P --> Q{Generate ReviewResult & Summary};
    Q --> R{Emit "review:complete"};
    R --> S[Return ReviewResult];
```

### Usage

The `CodeReviewManager` can be used:
*   As a **pre-commit hook** to automatically review changes before they are committed.
*   By **agents** to perform on-demand code quality checks.
*   To **generate prompts** for LLMs to perform more nuanced, contextual code reviews.

---

## Git Platform Integration (`git-platform-integration.ts`)

This module provides a generic, API-driven integration with GitHub and GitLab. It abstracts away the differences between the two platforms, offering a unified interface for common repository operations using direct HTTP `fetch` requests.

### Purpose

*   **Unified Git Platform API**: Interact with GitHub and GitLab using a single API.
*   **Repository Management**: Get repository details.
*   **Pull/Merge Request Operations**: List, get, and create PRs/MRs.
*   **Issue Tracking**: List and create issues.
*   **CI/CD Status**: Retrieve CI status for commits.
*   **Commit History**: Get recent commit information.

### Key Concepts

*   **`GitPlatformConfig`**: Configuration for the integration, including platform type (`github`, `gitlab`, `auto`), API token, and base URL.
*   **`Repository`**: Normalized representation of a repository.
*   **`PullRequest`**: Normalized representation of a pull/merge request.
*   **`Issue`**: Normalized representation of an issue.
*   **`CIStatus`**: Normalized representation of CI status for a commit.
*   **`CommitInfo`**: Normalized representation of a commit.
*   **`*ApiResponse` types**: Specific types for GitHub and GitLab API responses, which are then mapped to the normalized types.

### How it Works

The `GitPlatformIntegration` is a **singleton** (`getGitPlatform`) that extends `EventEmitter`.

1.  **`init()`**:
    *   `detectPlatform()`: Uses `git remote get-url origin` to determine if the repository is hosted on GitHub or GitLab.
    *   `detectRepoInfo()`: Parses the remote URL to extract the owner and repository name.
    *   Sets the `baseUrl` based on the detected platform.
    *   Emits an `initialized` event.
2.  **`apiRequest<T>(method: string, endpoint: string, body?: object)`**: A private helper method that constructs and sends HTTP requests to the appropriate GitHub or GitLab API endpoint. It handles authentication using the provided `token` and parses JSON responses.
3.  **Public Methods**: A suite of methods (`getRepository`, `listPullRequests`, `getPullRequest`, `createPullRequest`, `listIssues`, `createIssue`, `getCIStatus`, `getCommits`, `addComment`) that:
    *   Construct the correct API endpoint based on the detected platform.
    *   Call `apiRequest`.
    *   Parse and normalize the platform-specific API response into the common `Repository`, `PullRequest`, `Issue`, etc., types.

#### Execution Flow: Initialization and API Request

```mermaid
graph TD
    A[GitPlatformIntegration.constructor] --> B{GitPlatformIntegration.init()};
    B --> C{detectPlatform()};
    C --> D{execSync('git remote get-url origin')};
    D --> E[Parse URL to determine 'github' or 'gitlab'];
    B --> F{detectRepoInfo()};
    F --> G{execSync('git remote get-url origin')};
    G --> H[Parse URL to get owner/repo];
    E & H --> I{Set this.detectedPlatform, this.repoInfo, this.config.baseUrl};
    I --> J{Emit "initialized"};

    K[Agent calls listPullRequests()] --> L{Construct platform-specific endpoint};
    L --> M{GitPlatformIntegration.apiRequest('GET', endpoint)};
    M --> N{Build HTTP Request (URL, Headers, Token)};
    N --> O[fetch(url, options)];
    O -- Response.ok --> P[response.json()];
    P --> Q{Parse & Normalize API Response};
    Q --> R[Return PullRequest[]];
    O -- !Response.ok --> S[Throw API Error];
```

### Usage

This integration is ideal for agents or other modules that need programmatic access to Git platform data without relying on local CLI tools. It's suitable for scenarios where direct API interaction is preferred or necessary (e.g., in environments without `gh` or `glab` installed).

---

## GitHub Action Runner (`github-action-runner.ts`)

This module provides utilities specifically for running Code Buddy as a GitHub Action. It helps parse the GitHub event payload, generate structured comments, and format outputs for the GitHub Actions environment.

### Purpose

*   **GitHub Actions Integration**: Enable Code Buddy to function seamlessly within a GitHub Actions workflow.
*   **Event Parsing**: Extract relevant information from GitHub event payloads (PRs, issues, pushes).
*   **Output Formatting**: Generate comments and structured outputs compatible with GitHub Actions.
*   **Action Definition**: Provide the `action.yml` content for the GitHub Action.

### Key Concepts

*   **`GitHubActionConfig`**: Configuration derived from the GitHub event, specifying the event type, repository, PR/issue number, and operation mode (`review`, `triage`, `implement`).

### How it Works

The `GitHubActionRunner` class is not a singleton, as it's typically instantiated once per action run.

1.  **`parseEvent(eventPayload: Record<string, unknown>)`**: This is the core method. It takes the raw GitHub event payload (e.g., from `github.context.payload`) and extracts key information like repository, PR/issue number, and determines the `event` type and `mode` of operation for Code Buddy. It also looks for an `INPUT_MODE` environment variable to override the default mode.
2.  **`generateReviewComment(diff: string, files: string[])`**: Creates a markdown-formatted review comment suitable for a GitHub Pull Request, summarizing changes and providing a placeholder for AI suggestions.
3.  **`generateTriageLabel(title: string, body: string)`**: Analyzes issue title and body text to suggest relevant GitHub labels (e.g., `bug`, `enhancement`, `documentation`, `security`).
4.  **`formatActionOutput(result: Record<string, unknown>)`**: Formats a key-value pair object into the `GITHUB_OUTPUT` format, which allows GitHub Actions to pass data between steps. It handles multiline values using `<<EOF` delimiters.
5.  **`createActionYaml()`**: Returns the YAML content for the `action.yml` file, defining the GitHub Action's metadata, inputs, and entry point.

### Usage

This module is primarily used by the entry point script of the Code Buddy GitHub Action. It helps the action:
*   **Understand its context**: What event triggered it, and what is its intended `mode`.
*   **Produce meaningful outputs**: Generate PR comments or issue labels.
*   **Communicate results**: Output structured data for subsequent workflow steps.

---

## GitHub Actions Integration (`github-actions.ts`)

The `GitHubActionsManager` provides comprehensive management capabilities for GitHub Actions workflows. Unlike `cicd-integration.ts` which is more generic, this module is specifically tailored for GitHub Actions and leverages the `gh` CLI for robust interaction.

### Purpose

*   **GitHub Actions Workflow Management**: Create, list, read, update, and delete GitHub Actions workflow files.
*   **Workflow Templates**: Provide predefined templates for common CI/CD scenarios.
*   **Workflow Validation**: Validate the YAML syntax and structure of GitHub Actions workflows.
*   **Run Management**: Get workflow runs, trigger new runs, view logs, cancel, and rerun.
*   **Optimization Analysis**: Suggest improvements and identify potential issues in workflows.

### Key Concepts

*   **`WorkflowConfig`**: A detailed TypeScript interface representing the structure of a GitHub Actions workflow YAML file.
*   **`WorkflowTrigger`**: Defines the events that trigger a workflow (push, pull\_request, workflow\_dispatch, schedule).
*   **`WorkflowJob`**: Defines a single job within a workflow.
*   **`WorkflowStep`**: Defines a single step within a job.
*   **`WORKFLOW_TEMPLATES`**: A collection of predefined `WorkflowConfig` objects for common use cases (Node.js CI, Python CI, Security Scan, Release, Docker Build, Lint/Format, CodeBuddy AI Review).
*   **`WorkflowRun`**: Normalized information about a GitHub Actions workflow execution.
*   **`GitHubActionsConfig`**: Configuration for the manager, including token, owner, repo, and workflows directory.

### How it Works

The `GitHubActionsManager` is a **singleton** (`getGitHubActionsManager`) that extends `EventEmitter`. It primarily interacts with the GitHub platform via the `gh` command-line interface.

1.  **`initialize()`**: Attempts to detect the GitHub repository owner and name from the Git remote URL using `execGit`. Ensures the workflows directory exists.
2.  **Workflow File Management**:
    *   `getTemplates()`, `getTemplate(name: string)`: Accesses the `WORKFLOW_TEMPLATES`.
    *   `createFromTemplate(templateName: string, fileName?: string)`: Writes a template to a new `.yml` file.
    *   `createWorkflow(config: WorkflowConfig, fileName: string)`: Writes a custom `WorkflowConfig` to a `.yml` file.
    *   `listWorkflows()`: Reads and parses all `.yml` files in the workflows directory.
    *   `readWorkflow(fileName: string)`, `updateWorkflow(fileName: string, config: WorkflowConfig)`, `deleteWorkflow(fileName: string)`: Standard CRUD operations on workflow files.
3.  **`validateWorkflow(config: WorkflowConfig)`**: Performs structural and semantic validation of a `WorkflowConfig` object (e.g., checks for required fields, valid job dependencies, step definitions).
4.  **Workflow Run Interaction (via `gh` CLI)**:
    *   `getWorkflowRuns(workflowName?: string, limit = 10)`: Executes `gh run list` to fetch recent runs.
    *   `triggerWorkflow(workflowName: string, ref = 'main', inputs?: Record<string, string>)`: Executes `gh workflow run` to manually start a workflow.
    *   `getRunLogs(runId: number)`: Executes `gh run view --log` to retrieve logs for a specific run.
    *   `cancelRun(runId: number)`, `rerunWorkflow(runId: number, failedOnly = false)`: Executes `gh run cancel` and `gh run rerun`.
5.  **`analyzeWorkflow(config: WorkflowConfig)`**: Provides suggestions for workflow optimization and security, such as caching, parallelization, pinning action versions, and avoiding shell injection risks.
6.  **`formatSummary()`**: Generates a human-readable summary of detected workflows and available templates.
7.  **`execGit(args: string[])` / `execGh(args: string[])`**: Private helper methods to execute `git` and `gh` CLI commands, respectively, capturing their output and handling errors.

### Usage

The `GitHubActionsManager` is a powerful tool for agents that need to:
*   **Automate CI/CD setup**: Create new workflows based on project needs.
*   **Debug CI failures**: Retrieve logs and rerun workflows.
*   **Improve CI/CD quality**: Validate and analyze workflows for best practices.
*   **Interact with GitHub Actions**: Trigger runs, monitor status.

---

## Advanced GitHub/GitLab Integration (`github-integration.ts`)

This module provides a comprehensive, CLI-driven integration with GitHub and GitLab, focusing on Pull Request (PR) and Issue management. It uses the `gh` (GitHub CLI) and `glab` (GitLab CLI) tools via the `BashTool` to perform operations.

### Purpose

*   **CLI-Driven Git Platform Interaction**: Leverage the power and authentication of `gh` and `glab` CLIs for robust operations.
*   **PR/MR Management**: Create, get details, diff, comment on, and review pull/merge requests.
*   **Repository Detection**: Automatically identify the Git provider and repository details.

### Key Concepts

*   **`GitProvider`**: Defines the type of Git platform (`github` or `gitlab`), host, and API URL.
*   **`PullRequest`**: Normalized representation of a pull/merge request.
*   **`Issue`**: Normalized representation of an issue.
*   **`ReviewComment`**: Details of a comment on a PR.
*   **`PRReviewResult`**: The outcome of a PR review, including approval status and comments.
*   **`GitHubConfig`**: Configuration for the integration, including provider details, default branch, and review settings.

### How it Works

The `GitHubIntegration` is a **singleton** (`getGitHubIntegration`) that extends `EventEmitter`. It uses `BashTool` to execute external CLI commands.

1.  **`initialize()`**:
    *   Executes `git remote get-url origin` via `BashTool`.
    *   `parseRemoteUrl(url: string)`: Extracts owner and repository name from the remote URL.
    *   `detectProvider(url: string)`: Determines if the URL points to GitHub or GitLab.
    *   Sets `repoInfo` and `config.provider`.
    *   Emits an `initialized` event.
2.  **`createPullRequest(options: ...)`**:
    *   Determines the current branch if `sourceBranch` is not provided.
    *   Ensures the branch is pushed.
    *   Delegates to `createGitHubPR` (using `gh pr create`) or `createGitLabMR` (using `glab mr create`) based on the detected provider.
    *   Parses the CLI output to extract the PR/MR URL and number.
3.  **`getPRDiff(prNumber: number)`**: Executes `gh pr diff` or `glab mr diff`.
4.  **`getPRDetails(prNumber: number)`**: Executes `gh pr view --json` to fetch detailed PR information and parses the JSON output. (GitLab equivalent is not fully implemented in the provided code snippet).
5.  **`addPRComment(prNumber: number, body: string)`**: Executes `gh pr comment` or `glab mr comment`.
6.  **`addPRReview(prNumber: number, review: { event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT'; body: string })`**: Executes `gh pr review` with appropriate flags. (GitLab equivalent is not implemented).
7.  **`listOpenPRs()`**: Executes `gh pr list --json` to get a list of open PRs.

### Usage

This module is suitable for agents that need to perform Git platform operations that are well-supported by the `gh` or `glab` CLIs. It's often preferred when:
*   **Authentication is handled by the CLI**: Users are already logged in via `gh auth login` or `glab auth login`.
*   **Complex CLI features are needed**: Such as rich output formatting or specific flags not easily replicated via direct API calls.
*   **Local Git context is important**: Operations often rely on the current working directory's Git repository.

---

## Relationships and Dependencies

The `src/integrations` module components frequently interact with:

*   **`src/utils/logger.js`**: For logging debug, info, warn, and error messages across all integrations.
*   **`src/tools/bash/index.js` (`BashTool`)**: Used by `ci-autofix-pipeline`, `cicd-integration`, `github-actions`, and `github-integration` to execute shell commands (e.g., `git`, `gh`, `glab`, `npm test`).
*   **`events` (`EventEmitter`)**: Many integration managers (`CICDManager`, `CodeReviewManager`, `GitPlatformIntegration`, `GitHubActionsManager`, `GitHubIntegration`) extend `EventEmitter` to signal important lifecycle events or results to other parts of the system.
*   **`child_process` (`spawn`, `execSync`)**: Used directly by `cicd-integration`, `code-review`, `git-platform-integration`, and `github-actions` for running external processes.
*   **`fs` and `path`**: Used by `cicd-integration` and `github-actions` for reading and writing workflow files.
*   **`js-yaml`**: Used by `cicd-integration` and `github-actions` for parsing and dumping YAML workflow configurations.
*   **LLM Callbacks**: `ci-autofix-pipeline` explicitly depends on an external LLM callback for its core analysis and fix generation.

### Distinctions between Git/CI Integrations

It's important to note the different approaches to Git platform and CI/CD integration:

*   **`git-platform-integration.ts`**: Provides a *generic, API-driven* (using `fetch`) interface for GitHub and GitLab. It's good for programmatic access where CLI tools might not be available or direct API control is desired.
*   **`github-integration.ts`**: Provides a *CLI-driven* (using `gh`/`glab` via `BashTool`) interface for GitHub and GitLab, focusing on PR/MR and issue management. It leverages existing CLI authentication and features.
*   **`github-actions.ts`**: Specifically manages *GitHub Actions workflows* using the `gh` CLI. It's focused on the CI/CD aspect of GitHub.
*   **`cicd-integration.ts`**: A *higher-level, more abstract* CI/CD manager that can *detect* various providers but primarily uses the `gh` CLI for run monitoring. It also provides workflow templates and validation.
*   **`ci-autofix-pipeline.ts`**: Focuses on the *problem-solving* aspect of CI, using LLMs and local tools to fix failures, potentially interacting with `github-integration` or `github-actions` to create PRs.

These modules are designed to be complementary, allowing Code Buddy to choose the most appropriate integration method based on the specific task and environment.