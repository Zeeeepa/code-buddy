---
title: "tests — wizard"
module: "tests-wizard"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:28.065Z"
---
# tests — wizard

This document describes the `tests/wizard/onboarding.test.ts` module, which contains unit tests for the core onboarding logic found in `src/wizard/onboarding.ts`. These tests ensure the correct behavior of configuration handling, provider mappings, and default model selections during the initial setup wizard.

## Module: `tests/wizard/onboarding.test.ts`

### Purpose

This module serves as the comprehensive test suite for the `src/wizard/onboarding.ts` module. It verifies that the onboarding process correctly handles provider-specific environment variables, assigns appropriate default models, and accurately writes the `config.json` file without exposing sensitive information.

### Tested Functionality Overview

The tests in this module validate the behavior of the following key components exported by `src/wizard/onboarding.ts`:

1.  **`PROVIDER_ENV_MAP`**: A constant object mapping AI provider names to their corresponding environment variable names for API keys.
2.  **`PROVIDER_DEFAULT_MODEL`**: A constant object mapping AI provider names to their default model identifiers.
3.  **`writeConfig(configPath: string, result: OnboardingResult)`**: A function responsible for writing the `config.json` file to a specified path based on the `OnboardingResult` object.

### Test Suite Structure

The tests are organized using `describe` blocks, mirroring the structure of the `src/wizard/onboarding.ts` module's exports:

```mermaid
graph TD
    A[onboarding.test.ts] --> B{onboarding.js Module}
    B --> C[PROVIDER_ENV_MAP Tests]
    B --> D[PROVIDER_DEFAULT_MODEL Tests]
    B --> E[writeConfig() Tests]
```

### Detailed Test Cases

#### `PROVIDER_ENV_MAP` Tests

This suite verifies the correctness of the `PROVIDER_ENV_MAP` constant.

*   **API Key Mappings**: Tests confirm that specific providers map to their expected environment variable names (e.g., `grok` maps to `GROK_API_KEY`, `claude` to `ANTHROPIC_API_KEY`, `chatgpt` to `OPENAI_API_KEY`).
*   **Local Provider Handling**: Verifies that local providers like `ollama` and `lmstudio` correctly map to an empty string, indicating no external API key is required.

#### `PROVIDER_DEFAULT_MODEL` Tests

This suite ensures that the `PROVIDER_DEFAULT_MODEL` constant provides accurate default model names for each supported AI provider.

*   **Default Model Assignments**: Tests confirm that each provider has a specific default model assigned (e.g., `grok` defaults to `grok-code-fast-1`, `claude` to `claude-sonnet-4-20250514`, `chatgpt` to `gpt-4o`, `gemini` to `gemini-2.5-flash`, `ollama` to `llama3.2`).

#### `writeConfig` Tests

This is the most extensive test suite, validating the critical `writeConfig` function. It uses temporary directories to simulate real-world file system operations without affecting the actual project configuration.

*   **Configuration Content**:
    *   Verifies that the `config.json` file is written with the correct `provider`, `model`, and `ttsEnabled` values from the `OnboardingResult`.
    *   Confirms that `ttsProvider` is included in the `config.json` only when `ttsEnabled` is `true`.
*   **API Key Exclusion**: A crucial test ensures that the `apiKey` provided in the `OnboardingResult` is **not** written into the `config.json` file, maintaining security by preventing sensitive credentials from being stored directly in the configuration.
*   **Directory Creation**: Tests that `writeConfig` can create the necessary directory structure if the target `configPath` does not already exist, ensuring robustness.

### Test Setup and Teardown

The `writeConfig` test suite utilizes `beforeEach` and `afterEach` hooks to manage temporary directories:

*   **`beforeEach`**: Creates a unique temporary directory using `os.tmpdir()` and `Date.now()` for each test case, ensuring isolation and preventing side effects between tests.
*   **`afterEach`**: Attempts to recursively remove the created temporary directory after each test, cleaning up the test environment. Error handling is included to gracefully ignore cleanup failures.

### Dependencies

*   **`src/wizard/onboarding.js`**: The primary module under test, from which `PROVIDER_ENV_MAP`, `PROVIDER_DEFAULT_MODEL`, and `writeConfig` are imported.
*   **Node.js `fs` module**: Used for file system operations within the tests, such as `readFileSync` to verify the content of the written `config.json`, `mkdirSync` (implicitly by `writeConfig`), and `rmSync` for cleanup.
*   **Node.js `path` module**: Used for constructing file paths, particularly `join` for creating paths within the temporary directories.
*   **Node.js `os` module**: Used to determine the system's temporary directory via `tmpdir()`, facilitating isolated test environments.