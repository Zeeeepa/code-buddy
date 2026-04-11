---
title: "tests — reasoning"
module: "tests-reasoning"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.975Z"
---
# tests — reasoning

The `reasoning` module provides sophisticated problem-solving capabilities to the agent, leveraging various AI reasoning techniques like Chain-of-Thought (CoT) and Tree-of-Thought (ToT)/MCTS. It offers both automated complexity detection and user-controlled modes to guide the agent's thinking process.

This module is composed of three main parts:

1.  **`ReasoningFacade`**: The core interface for executing different reasoning strategies and managing their lifecycle.
2.  **`ReasoningMiddleware`**: Integrates reasoning capabilities into the agent's message processing pipeline by detecting problem complexity and injecting guidance.
3.  **`Think Command Handlers`**: Provides user-facing commands (`/think`) to control reasoning modes and initiate problem-solving.

## Core Concepts

The module supports several reasoning modes, each offering a different trade-off between computational cost, latency, and problem-solving depth:

*   **`shallow` (Chain-of-Thought - CoT)**: A quick, single-pass reasoning approach where the LLM generates a sequence of thoughts leading to a final answer. It's suitable for simpler problems or when a fast, approximate solution is acceptable.
*   **`medium` (Tree-of-Thought - ToT)**: Explores a limited search space, generating multiple thought paths and evaluating them to find a better solution. This mode is more robust than `shallow` for moderately complex problems.
*   **`deep` (Monte Carlo Tree Search - MCTS)**: Employs a more extensive search strategy, building a tree of possibilities and using MCTS to navigate it. Ideal for complex problems requiring deeper exploration.
*   **`exhaustive` (MCTS)**: The most thorough search mode, designed for highly challenging problems where maximum effort is justified. It typically involves higher computational cost and latency.

Beyond explicit mode selection, the module also features:

*   **Auto-Selection**: The system can automatically choose a reasoning mode based on the perceived complexity of a problem description.
*   **Auto-Escalation**: If an initial `shallow` reasoning attempt yields low confidence, the system can automatically re-attempt the problem with a more robust mode (e.g., `medium`) to improve the solution quality.
*   **Usage Tracking**: Monitors API calls, estimated tokens, and total time spent across all reasoning operations.

## Architecture Overview

The following diagram illustrates how the different components of the reasoning module interact:

```mermaid
graph TD
    subgraph User Interaction
        User -->|/think command| ThinkHandlers
    end

    subgraph Agent Core
        AgentLoop -->|User Message| ReasoningMiddleware
    end

    subgraph Reasoning Logic
        ThinkHandlers -->|setActiveThinkingMode| GlobalThinkingMode
        ReasoningMiddleware -->|getActiveThinkingMode| GlobalThinkingMode
        ReasoningMiddleware -->|detectComplexity| ReasoningMiddleware
        ReasoningMiddleware -->|injects <reasoning_guidance>| LLMInput
        LLMInput --> LLM(LLM Model)

        ThinkHandlers -->|calls solve()| ReasoningFacade
        ReasoningFacade -->|dispatches to| TreeOfThoughtReasoner
        ReasoningFacade -->|dispatches to| ChainOfThoughtReasoner
        ReasoningFacade -->|tracks usage| UsageStats
    end
```

## Components

### `ReasoningFacade` (`src/agent/reasoning/reasoning-facade.ts`)

The `ReasoningFacade` acts as the primary interface for interacting with the underlying reasoning engines (Chain-of-Thought, Tree-of-Thought). It abstracts away the specifics of different reasoning algorithms, providing a unified `solve()` method. It also handles API key management, usage tracking, result formatting, and the heuristics for auto-selecting reasoning modes and auto-escalation.

**Key Responsibilities:**

*   **Initialization**: Configured with an API key and an optional base URL for the LLM.
*   **Unified `solve()` Method**: The core entry point for initiating a reasoning process. It takes a `Problem` object (containing `description`, `constraints`, `examples`) and `ReasoningOptions` (specifying `mode`, `autoEscalate`, etc.).
*   **Mode Dispatch**: Based on the selected or auto-detected mode, `solve()` intelligently dispatches the problem to either the `ChainOfThoughtReasoner` (for `shallow` mode) or the `TreeOfThoughtReasoner` (for `medium`, `deep`, `exhaustive` modes).
*   **Auto-Selection Logic**: If no explicit `mode` is provided in `ReasoningOptions`, `solve()` uses heuristics based on the problem's `description` length, presence of `constraints`, and `examples` to determine an appropriate default reasoning mode.
*   **Auto-Escalation**: If `options.autoEscalate` is `true` and an initial `shallow` reasoning attempt yields low confidence (e.g., < 0.5), `solve()` will automatically re-attempt the problem using a `medium` reasoning mode to improve the solution quality.
*   **Usage Tracking**: Provides `getUsage()` to retrieve statistics on reasoning calls (CoT, ToT, MCTS), total time, and estimated tokens. `resetUsage()` clears these statistics.
*   **Result Formatting**: `formatResult()` takes the raw output from either a `CoTResult` or `ReasoningResult` and formats it into a human-readable string for display.
*   **Singleton Management**: `getReasoningFacade()` and `resetReasoningFacade()` manage a singleton instance of `ReasoningFacade`, ensuring consistent API key usage and usage tracking across the application.

### `ReasoningMiddleware` (`src/agent/middleware/reasoning-middleware.ts`)

The `ReasoningMiddleware` integrates the reasoning capabilities into the agent's message processing pipeline. Its primary role is to detect the complexity of user prompts and, if appropriate, inject a system message (`<reasoning_guidance>`) to encourage the LLM to engage in more structured or advanced reasoning.

**Key Responsibilities:**

*   **Complexity Detection**: The `detectComplexity(message: string)` function analyzes a given string (typically the user's last message) for keywords and length to assign a complexity `score` and `level` (`none`, `cot`, `tot`, `mcts`). Signals include action verbs, constraint language, exploration language, multi-step indicators, and a length bonus.
*   **Guidance Injection (`beforeTurn`)**:
    *   During the `beforeTurn` phase of the agent loop, the middleware checks the currently active thinking mode (via `getActiveThinkingMode`).
    *   **Explicit Mode**: If an explicit mode is set (e.g., via `/think deep`), it *always* injects `<reasoning_guidance>` into the system messages, instructing the LLM to use that specific reasoning mode.
    *   **Auto-Detect Mode**: If no explicit mode is set and auto-detection is enabled, it calls `detectComplexity()` on the last user message. If the detected complexity level is `tot` or `mcts`, it injects `<reasoning_guidance>` to prompt the LLM for more advanced reasoning.
    *   **Prevention of Double Injection**: Ensures that reasoning guidance is not injected multiple times into the message history.
*   **Auto-Detection Toggle**: `setAutoDetect(enabled: boolean)` allows enabling or disabling the automatic complexity detection and guidance injection.
*   **Factory Function**: `createReasoningMiddleware()` provides a convenient way to instantiate the middleware with optional configurations.

### `Think Command Handlers` (`src/commands/handlers/think-handlers.ts`)

The `think-handlers` module provides user-facing commands (`/think`) to control the agent's reasoning behavior. Users can manually set reasoning modes, check status, and directly initiate reasoning for specific problems.

**Key Responsibilities:**

*   **Command Parsing (`handleThink`)**: The main command handler for `/think` parses various arguments:
    *   **No arguments**: Displays help text, including the current reasoning mode and available options.
    *   **`off`**: Disables the active reasoning mode, setting it to `null`.
    *   **`status`**: Shows the current reasoning mode and configuration details (e.g., max iterations, depth) for the active mode. It also indicates if no reasoning runs have occurred yet.
    *   **`<mode>` (e.g., `shallow`, `medium`, `deep`, `exhaustive`)**: Sets the global active reasoning mode. This mode is then used by `ReasoningMiddleware` to decide whether to inject guidance.
    *   **`<problem_text>`**: If an API key (`GROK_API_KEY`) is available, it initiates a reasoning run for the provided problem using the currently active mode (or auto-selected if none).
    *   **`<mode> <problem_text>`**: Sets the specified mode and then initiates a reasoning run for the problem.
*   **Global Mode Management**: `getActiveThinkingMode()` returns the currently active reasoning mode (`'shallow'`, `'medium'`, `'deep'`, `'exhaustive'`, or `null`). `setActiveThinkingMode(mode: ThinkingMode | null)` sets this global state.
*   **API Key Requirement**: For any actual problem-solving initiated via `/think <problem>`, the `GROK_API_KEY` environment variable must be set. If not, an error message is returned.
*   **Error Handling**: Gracefully handles errors during reasoning attempts (e.g., LLM API timeouts), reporting them to the user.

## How it Works

### User-Initiated Reasoning via `/think`

1.  A user types a command like `/think deep "How do I refactor this complex module?"`.
2.  The `handleThink` function in `think-handlers.ts` parses the command.
3.  It calls `setActiveThinkingMode('deep')` to update the global reasoning mode.
4.  It then constructs a `Problem` object from the problem description and calls `ReasoningFacade.solve()` with the problem and the specified mode.
5.  `ReasoningFacade.solve()` executes the appropriate reasoning strategy (in this case, `TreeOfThoughtReasoner` for `deep` mode).
6.  The raw result from the reasoner is then formatted by `ReasoningFacade.formatResult()` into a human-readable string.
7.  `handleThink` returns this formatted result, which is displayed to the user.

### Agent-Initiated Reasoning via `ReasoningMiddleware`

1.  A user sends a message to the agent, e.g., "Please design a robust, scalable architecture for a new microservice, considering trade-offs between latency and cost."
2.  As part of the agent's message processing loop, `ReasoningMiddleware.beforeTurn()` is invoked.
3.  The middleware first checks `getActiveThinkingMode()`.
    *   If the user has explicitly set a mode (e.g., `/think medium`), the middleware will inject `<reasoning_guidance>` into the system messages, instructing the LLM to use that specific reasoning mode.
    *   If no explicit mode is set (and auto-detection is enabled), `detectComplexity()` analyzes the user's message. For the example message above, it would likely detect a `tot` or `mcts` complexity level due to keywords like "design," "robust," "scalable," "trade-offs."
4.  Based on the detected complexity or explicit mode, the middleware injects a system message containing `<reasoning_guidance>` into the message history. This guidance is a prompt engineering technique designed to steer the LLM towards using its internal reasoning capabilities more effectively.
5.  The LLM receives the augmented message history, including the reasoning guidance. It is then expected to perform the reasoning based on this guidance, potentially leading to a more structured and higher-quality response.
    *   **Important Note**: The `ReasoningMiddleware` *guides* the LLM; it does not directly call `ReasoningFacade.solve()`. The LLM itself is expected to perform the reasoning based on the guidance provided in the system message.

## Configuration and Usage

### API Key

All reasoning operations that involve external LLM calls (i.e., anything beyond local complexity detection) require an API key. This is typically configured via an environment variable:

```bash
export GROK_API_KEY="your_grok_api_key_here"
```

### `/think` Command

The `/think` command provides direct control over the agent's reasoning behavior:

*   **`/think`**: Displays help text, including the current reasoning mode.
*   **`/think off`**: Disables any active explicit reasoning mode.
*   **`/think status`**: Shows the current reasoning mode and its detailed configuration (e.g., max iterations, max depth, expansion strategy). Also displays accumulated usage statistics if any reasoning runs have occurred.
*   **`/think shallow|medium|deep|exhaustive`**: Sets the global explicit reasoning mode. This mode will then be used by the `ReasoningMiddleware` to inject guidance for subsequent user prompts.
*   **`/think <problem description>`**: Initiates a reasoning run for the provided problem description using the currently active reasoning mode (or auto-selected if no mode is explicitly set).
*   **`/think deep <problem description>`**: Sets the reasoning mode to `deep` for this specific command and then initiates a reasoning run for the problem. The mode will remain `deep` for subsequent interactions until changed.

### `ReasoningMiddleware` Auto-Detection

The automatic complexity detection and guidance injection by `ReasoningMiddleware` can be toggled programmatically:

```typescript
import { createReasoningMiddleware } from '../../src/agent/middleware/reasoning-middleware.js';

const middleware = createReasoningMiddleware(); // Auto-detect is true by default
middleware.setAutoDetect(false); // Disable auto-detection
// ... later ...
middleware.setAutoDetect(true); // Re-enable auto-detection
```