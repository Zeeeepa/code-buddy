---
title: "tests — plugins"
module: "tests-plugins"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.950Z"
---
# tests — plugins

This document provides an overview of the unit tests for the plugin system, focusing on the `tests/plugins` module. It covers the purpose of these tests, the key components they validate, and how they ensure the robustness and correctness of the plugin architecture and bundled providers.

## 1. Introduction

The `tests/plugins` module contains a comprehensive suite of unit tests designed to validate the core plugin management system, the plugin SDK, and all bundled provider plugins. These tests are crucial for ensuring that:

*   Plugins can be discovered, loaded, activated, and deactivated correctly.
*   Providers (LLM, embedding, search) can be registered, managed, and retrieved by the `PluginManager`.
*   Bundled providers correctly integrate with their respective external APIs (AWS Bedrock, Azure OpenAI, Groq, Together AI, Fireworks AI, Ollama, vLLM) and handle authentication, model discovery, and API calls.
*   The GitNexus integration functions as expected, interacting with the GitNexus CLI and its Micro-service Control Plane (MCP).
*   The plugin SDK provides stable and correctly functioning interfaces for channel plugins.

By isolating and testing individual components, this module helps maintain a high level of confidence in the extensibility and functionality of the application's plugin ecosystem.

## 2. Testing Philosophy

The tests in this module adhere to a unit testing philosophy, characterized by:

*   **Isolation**: Each test focuses on a specific function, method, or component, minimizing dependencies on other parts of the system.
*   **Mocking**: External dependencies such as network requests (`fetch`), file system operations (`fs`), child process execution (`child_process`), and logging (`logger`) are extensively mocked. This ensures that tests run quickly, deterministically, and without requiring actual external service calls or file system changes.
*   **Environment Variable Control**: Many providers rely on environment variables for configuration and authentication. Tests meticulously set and reset `process.env` to simulate various deployment scenarios.
*   **Lifecycle Validation**: Tests cover the full lifecycle of plugins and providers, from initialization and activation to shutdown and deactivation.
*   **Error Handling**: Robust error handling is validated for API failures, network issues, malformed configurations, and invalid inputs.

## 3. Core Plugin Management Tests (`plugin-manager.test.ts`)

This file tests the central `PluginManager` class, which is responsible for the entire lifecycle and management of plugins and their registered providers.

### 3.1. Plugin Discovery and Lifecycle

*   **`discover()`**: Validates that the plugin directory is created if it doesn't exist and that the manager correctly scans for plugin folders (containing `manifest.json`).
*   **`activatePlugin(pluginId)`**: Tests the activation flow, ensuring that a plugin's `activate()` method is called with a `PluginContext` and its status is updated to `active`.
*   **`deactivatePlugin(pluginId)`**: Verifies that an active plugin's `deactivate()` method is called and its status is updated to `disabled`.

### 3.2. Provider Registration and Retrieval

The `PluginManager` acts as a registry for various types of providers (LLM, embedding, search) that plugins can offer.

*   **`registerProvider(provider, pluginId?)`**:
    *   Ensures that providers are validated for essential properties (ID, name, type, required methods like `initialize()`).
    *   Verifies that the provider's `initialize()` method is called upon registration.
    *   Tests for rejection of invalid or duplicate providers.
    *   Confirms that `plugin:provider-registered` events are emitted.
*   **`unregisterProvider(providerId)`**:
    *   Validates that a registered provider is removed from the manager.
    *   Ensures the provider's `shutdown()` method is called.
    *   Confirms that `plugin:provider-unregistered` events are emitted.
*   **Retrieval Methods**:
    *   `getProvider(id)`: Retrieves a specific provider by its ID.
    *   `getProvidersByType(type)`: Returns all providers of a given type, sorted by `priority` (highest first).
    *   `getAllProviders()`: Returns all registered providers.
    *   `getPrimaryProvider(type)`: Returns the highest priority provider for a given type.

### 3.3. Plugin Configuration

Plugins can define default configurations and allow users to override them.

*   **`loadPluginConfig(manifest)`**:
    *   Tests loading `defaultConfig` from a plugin's `manifest.json`.
    *   Verifies that user-specific `config.json` (located in `~/.codebuddy/plugins/<pluginId>/config.json`) correctly merges with and overrides default settings.
    *   Handles scenarios with missing or malformed user configuration files.
    *   Validates configuration against an optional `configSchema` in the manifest and emits `plugin:config-validation-failed` events for errors.
*   **`getPluginConfig(pluginId)`**: Ensures that loaded configurations are cached and can be retrieved.

### 3.4. Mocking Strategy

`plugin-manager.test.ts` heavily mocks file system operations (`fs-extra`), the `ToolManager`, `SlashCommandManager`, and `IsolatedPluginRunner` to focus solely on the `PluginManager`'s internal logic.

## 4. Provider Onboarding & Lifecycle Tests (`provider-onboarding.test.ts`)

This file tests the `runProviderOnboarding` utility function, which orchestrates the multi-step onboarding process for providers, and includes specific tests for the bundled Ollama and vLLM LLM providers.

### 4.1. `runProviderOnboarding` Utility

The `runProviderOnboarding` function guides a user through setting up a provider, including authentication, configuration, and model selection.

```mermaid
graph TD
    A[Start runProviderOnboarding] --> B{Provider has onboarding hooks?};
    B -- No --> Z[Return success: skipped];
    B -- Yes --> C{Auth hook defined?};
    C -- Yes --> D[Call onboarding.auth()];
    D -- Valid: false / Error --> E[Return failure: Auth failed];
    D -- Valid: true --> F{Wizard onboarding hook defined?};
    F -- Yes --> G[Call onboarding.wizard.onboarding()];
    G -- Returns config --> H{Discovery hook defined?};
    H -- Yes --> I[Call onboarding.discovery.run()];
    I -- Error --> J[Return failure: Discovery error];
    I -- Returns models --> K{Models found?};
    K -- No --> L[Skip modelPicker];
    K -- Yes --> M{Model picker hook defined?};
    M -- Yes --> N[Call onboarding.wizard.modelPicker(models)];
    N -- Returns selectedModelId --> O{onModelSelected hook defined?};
    O -- Yes --> P[Call onboarding.onModelSelected(selectedModelId)];
    P -- No / Done --> Q[Return success: Onboarding complete];
    L --> Q;
    M -- No --> Q;
    F -- No --> H;
```

*   **Phase Execution Order**: Tests confirm that the phases (`auth`, `wizard.onboarding`, `discovery.run`, `wizard.modelPicker`, `onModelSelected`) are executed sequentially.
*   **Short-Circuiting**: Validates that the process stops immediately if authentication fails or any phase throws an error.
*   **Graceful Skipping**: Ensures that undefined or irrelevant phases (e.g., `wizard.modelPicker` if no models are discovered) are skipped without error.
*   **Configuration Accumulation**: Tests that configuration returned by `wizard.onboarding` and `selectedModel` from `wizard.modelPicker` are correctly aggregated in the final result.

### 4.2. Ollama Provider Tests

*   **Activation**: Tests that `createOllamaProvider()` returns a provider instance only when `OLLAMA_HOST` is set.
*   **Authentication**: Validates `onboarding.auth()` by mocking a ping to the Ollama host, checking for successful connection or specific HTTP/network errors.
*   **Model Discovery**: Tests `onboarding.discovery.run()` by mocking responses from Ollama's `/api/tags` endpoint. It verifies:
    *   Correct parsing of model IDs, names, and capabilities.
    *   Accurate inference of `contextWindow` for known models (e.g., Llama, Mistral).
    *   Fallback to a default `contextWindow` for unknown models.

### 4.3. vLLM Provider Tests

*   **Activation**: Tests that `createVllmProvider()` returns a provider instance only when `VLLM_BASE_URL` is set.
*   **Authentication**: Validates `onboarding.auth()` by mocking a ping to the vLLM `/v1/models` endpoint, checking for successful connection or network errors.
*   **Model Discovery**: Tests `onboarding.discovery.run()` by mocking responses from the OpenAI-compatible `/v1/models` endpoint. It verifies:
    *   Correct parsing of model IDs and `owned_by` information.
    *   Extraction of `contextWindow` from `max_model_len` if available.
    *   Fallback to a default `contextWindow` when `max_model_len` is absent.

### 4.4. Mocking Strategy

Both `runProviderOnboarding` and the specific provider tests heavily mock `global.fetch` to simulate API responses and network conditions, and `logger` for output.

## 5. Bundled LLM Provider Tests

These files test the integration of various cloud and local LLM providers.

### 5.1. Cloud Providers (`cloud-providers.test.ts`)

This file focuses on AWS Bedrock and Azure OpenAI.

*   **AWS Bedrock Provider**:
    *   **Activation**: Tests `createBedrockProvider()` based on `AWS_BEDROCK_REGION` and `AWS_REGION` environment variables, including fallback and precedence rules.
    *   **Configuration**: Verifies correct `baseUrl` and `region` in the provider's config.
    *   **Authentication**: Tests `onboarding.auth()` with and without `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`, handling successful validation, 403 errors, and connection issues.
    *   **Model Discovery**: Mocks Bedrock's `ListFoundationModels` API to test `onboarding.discovery.run()`. It validates:
        *   Filtering out image-only models and `LEGACY` status models.
        *   Correct parsing of model IDs, names, and `contextWindow` (with specific values for known models like Claude and Titan).
        *   Fallback to known models when API discovery fails.
    *   **Model Picking**: Tests `onboarding.wizard.modelPicker()` to ensure preferred models (e.g., Claude 3.5 Sonnet) are selected.
*   **Azure OpenAI Provider**:
    *   **Activation**: Tests `createAzureProvider()` based on `AZURE_OPENAI_ENDPOINT`, including stripping trailing slashes.
    *   **Configuration**: Verifies `baseUrl` and `apiVersion` (including custom `AZURE_OPENAI_API_VERSION`).
    *   **Authentication**: Tests `onboarding.auth()` with `AZURE_OPENAI_API_KEY` or `AZURE_OPENAI_AD_TOKEN`, verifying correct headers and handling 401/403 errors and connection issues.
    *   **Model Discovery**: Mocks Azure's deployments API to test `onboarding.discovery.run()`. It validates:
        *   Filtering out `deleting` deployments.
        *   Correct parsing of deployment IDs, model names, `contextWindow`, and capabilities.
        *   Fallback to known models when API discovery fails or returns an empty list.
    *   **Model Picking**: Tests `onboarding.wizard.modelPicker()` to ensure preferred models (e.g., `gpt-4o`, then `gpt-4`) are selected.
    *   **Chat Calls**: Verifies that `AZURE_OPENAI_DEPLOYMENT` environment variable is used for chat endpoint construction.
*   **Cross-Provider Gating**: Tests that both providers activate independently based on their respective environment variables.
*   **Mocking Strategy**: `global.fetch` is extensively mocked for API interactions, `crypto.subtle` for AWS signing, and `logger` for output.

### 5.2. Extra Providers (`extra-providers.test.ts`)

This file covers Groq, Together AI, and Fireworks AI.

*   **Provider Creation**: For each provider, tests ensure that `create*Provider()` returns an instance only when the corresponding API key environment variable (`GROQ_API_KEY`, `TOGETHER_API_KEY`, `FIREWORKS_API_KEY`) is set.
*   **Metadata**: Validates `id`, `name`, `type` (`llm`), and `config.baseUrl` for each provider.
*   **Core LLM Methods**:
    *   **`chat()`**: Tests that `chat()` makes correct `POST` requests to the respective API endpoints, including `Authorization` headers and `Content-Type`. It also verifies successful response parsing and error handling for API failures.
    *   **`complete()`**: Ensures `complete()` correctly delegates to `chat()` with a user message.
*   **Onboarding Hooks**:
    *   **`auth()`**: Validates API key authentication by mocking a simple API call and checking for `ok: true` or appropriate error responses (HTTP errors, network errors).
    *   **`discovery.run()`**: Mocks the `/models` API endpoint for each provider to verify:
        *   Correct parsing of model IDs, `owned_by`, and `context_length`/`contextWindow`.
        *   Fallback to default `contextWindow` if not provided by the API.
        *   Error handling for discovery failures.
    *   **`wizard.modelPicker()`**: Tests model preference logic (e.g., Llama 3.3 70B for Groq).
*   **Cross-Provider Consistency**: A dedicated test suite ensures that all three providers have unique IDs, implement `chat`, `complete`, `initialize`, and `shutdown` methods, and are of type `llm`.
*   **Mocking Strategy**: `global.fetch` is mocked for all API interactions.

## 6. GitNexus Integration Tests (`gitnexus.test.ts`)

This file tests the `GitNexusManager` and `GitNexusMCPClient` classes, which facilitate interaction with the GitNexus CLI and its Micro-service Control Plane (MCP).

### 6.1. `GitNexusManager`

*   **`isInstalled()`**: Verifies that the manager correctly checks for the `gitnexus` CLI's availability by executing `npx gitnexus --version`.
*   **`isRepoIndexed()`**: Tests that the presence of the `.gitnexus` directory is correctly detected.
*   **`getStats()`**:
    *   Validates parsing of repository statistics (symbols, relations, processes, clusters, stale status) from the `.gitnexus/meta.json` file.
    *   Handles cases where `meta.json` is missing, malformed, or contains invalid data, returning default values gracefully.
*   **`analyze()`**:
    *   Tests that `npx gitnexus analyze` is spawned with the correct arguments and `cwd`.
    *   Verifies that `--force` and `--with-skills` flags are passed when requested.
    *   Ensures that the promise rejects if the `analyze` command exits with a non-zero code.
*   **`getGitNexusManager()` (Singleton)**: Tests the singleton pattern, ensuring that the same `GitNexusManager` instance is returned for the same repository path.

### 6.2. `GitNexusMCPClient`

The `GitNexusMCPClient` is designed to interact with a running GitNexus MCP server. In these unit tests, it operates in a "stub mode" as no actual MCP server is started.

*   **Connection Lifecycle**:
    *   `connect()` and `disconnect()`: Tests that the client can transition between connected and disconnected states (in stub mode).
    *   `isConnected()`: Verifies the connection status.
    *   `getRepoName()`: Confirms the repository name is exposed.
*   **Tool Methods (Stub Mode)**: Tests that methods like `query()`, `context()`, `impact()`, and `cypher()` return empty or default stub results when connected in stub mode.
*   **Resource Methods (Stub Mode)**: Tests that methods like `getClusters()`, `getProcesses()`, `getRepoContext()`, and `getArchitectureMap()` return empty or default stub results.
*   **Error Handling**: Ensures that calling any tool or resource method without first calling `connect()` results in an error.

### 6.3. Mocking Strategy

`gitnexus.test.ts` heavily mocks `child_process` (`execSync`, `spawn`) to control CLI execution, `fs` (`existsSync`, `readFileSync`) for file system interactions, and `logger` for output.

## 7. Plugin SDK Channel Tests (`plugin-sdk-channel.test.ts`)

This file tests the `defineChannel` function from the plugin SDK, specifically focusing on its ability to define a `describeMessageTool` method for channel plugins.

*   **`defineChannel` with `describeMessageTool`**: Verifies that when `describeMessageTool` is provided in the channel configuration, the resulting `ChannelPlugin` instance correctly exposes this method and returns a valid `ChannelMessageToolDescription`.
*   **Backward Compatibility**: Ensures that `defineChannel` still works correctly even if `describeMessageTool` is *not* provided, maintaining compatibility with older channel definitions.
*   **`this` Binding**: Tests that the `this` context within `describeMessageTool` correctly refers to the channel instance, allowing access to properties like `this.type`.
*   **Interface Compliance**: Confirms that the created channel object satisfies the `ChannelPlugin` interface, including the optional `describeMessageTool` property.

### 7.1. Mocking Strategy

This test file focuses on the pure functional aspects of `defineChannel` and does not require any external mocks.