---
title: "src — wizard"
module: "src-wizard"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.801Z"
---
# src — wizard

The `src/wizard` module provides interactive command-line interfaces to guide users through the initial setup and configuration of Code Buddy, particularly concerning AI provider integration and API key validation. It's designed to be user-friendly, ensuring that developers can quickly get started with the tool.

This module is split into two main files, each serving a distinct but related purpose:

*   **`onboarding.ts`**: Handles the initial, high-level setup of Code Buddy, including selecting a primary AI provider, model, and text-to-speech (TTS) options. It generates the core `config.json` file.
*   **`provider-onboarding.ts`**: Focuses on more detailed, provider-specific setup, primarily validating API keys and guiding users on how to set up environment variables for various AI services.

---

## `src/wizard/onboarding.ts`: Initial Setup Wizard

This file contains the primary onboarding wizard that new users encounter when first setting up Code Buddy. Its goal is to collect essential configuration details and persist them to a local configuration file.

### Purpose

The `runOnboarding` function orchestrates a series of interactive prompts to gather information such as:

*   The user's preferred AI provider (e.g., Grok, Claude, ChatGPT).
*   The specific model to use with that provider.
*   Whether text-to-speech (TTS) should be enabled and, if so, which TTS provider.
*   Optionally, an API key for the chosen provider, though it primarily advises on environment variables.

The collected information is then saved into a `config.json` file within the `.codebuddy` directory in the current working directory.

### How it Works

The `runOnboarding` function guides the user through a step-by-step process:

1.  **Welcome Message**: Displays a friendly welcome banner.
2.  **Provider Selection**: Uses `askChoice` to present a list of supported AI providers (`PROVIDERS`) and allows the user to select one.
3.  **API Key Guidance**: Based on the selected provider, it checks `PROVIDER_ENV_MAP` to identify the relevant environment variable for the API key. It prompts the user to enter the key or reminds them to set the environment variable later.
4.  **Model Selection**: Uses `PROVIDER_DEFAULT_MODEL` to suggest a default model for the chosen provider and allows the user to override it via `ask`.
5.  **TTS Configuration**: Asks if TTS should be enabled and, if yes, prompts for a TTS provider using `askChoice`.
6.  **Configuration Persistence**: Calls `writeConfig` to create or update the `.codebuddy/config.json` file with the collected settings.
7.  **Summary**: Prints a summary of the configured settings and any remaining actions (like setting environment variables).

#### Execution Flow

```mermaid
graph TD
    A[Start runOnboarding] --> B{Display Welcome};
    B --> C{Ask for AI Provider};
    C --> D{Ask for API Key (if applicable)};
    D --> E{Ask for Model};
    E --> F{Ask for TTS Enablement};
    F -- TTS Enabled --> G{Ask for TTS Provider};
    F -- TTS Disabled --> H[Construct OnboardingResult];
    G --> H;
    H --> I[Call writeConfig];
    I --> J{Display Summary};
    J --> K[End runOnboarding];
```

### Key Components

*   **`OnboardingResult` interface**: Defines the structure of the configuration data collected by the wizard.
    ```typescript
    export interface OnboardingResult {
      provider: string;
      apiKey: string; // Note: This is collected but not saved to config.json directly
      model: string;
      ttsEnabled: boolean;
      ttsProvider?: string;
    }
    ```
*   **`PROVIDER_ENV_MAP`**: A mapping from provider IDs (e.g., `grok`, `chatgpt`) to their corresponding environment variable names (e.g., `GROK_API_KEY`, `OPENAI_API_KEY`). This helps guide the user on where to store their API keys.
*   **`PROVIDER_DEFAULT_MODEL`**: Maps provider IDs to their recommended default model, sourced from `MODEL_DEFAULTS`.
*   **`ask(rl, question, defaultValue)`**: A utility function to prompt the user for a free-form text input.
*   **`askChoice(rl, question, choices, defaultIdx)`**: A utility function to prompt the user to select from a list of numbered choices.
*   **`writeConfig(configDir, result)`**: Creates the `.codebuddy` directory if it doesn't exist and writes the `OnboardingResult` (excluding the `apiKey`) to `config.json`.

### Configuration Output

The `writeConfig` function generates a `config.json` file similar to this:

```json
// .codebuddy/config.json
{
  "provider": "chatgpt",
  "model": "gpt-4o",
  "ttsEnabled": true,
  "ttsProvider": "edge-tts"
}
```

### Usage

The `runOnboarding` function is typically invoked as part of the CLI's initial setup command.

**Example Call (from CLI):**

```typescript
// commands/cli/utility-commands.ts
import { runOnboarding } from '../src/wizard/onboarding.js';

// ...
registerUtilityCommands(program) {
  program
    .command('setup')
    .description('Run the initial setup wizard for Code Buddy')
    .action(async () => {
      await runOnboarding();
    });
}
```

---

## `src/wizard/provider-onboarding.ts`: Advanced Provider Configuration

This file provides a more granular and robust onboarding experience for individual AI providers, focusing on API key validation and environment variable setup. It's designed to ensure that a user's API key is functional before they proceed.

### Purpose

The primary goals of this module are:

*   **Guided API Key Setup**: Walk the user through obtaining and entering API keys for various AI providers.
*   **API Key Validation**: Programmatically test the entered API key against the provider's API to confirm its validity and connectivity.
*   **Model Discovery**: Attempt to list available models from the provider's API, giving the user immediate feedback on what they can use.
*   **Environment Variable Guidance**: Instruct the user on how to persist their API key using environment variables.
*   **Local Provider Connectivity**: For local providers like Ollama or LM Studio, it checks if the local server is running and accessible.

### How it Works (High-Level)

The module defines a set of `PROVIDER_CONFIGS` that contain all necessary information for each AI provider (API endpoints, environment variable names, instructions). The interactive functions (`runProviderOnboarding`, `runFullProviderOnboarding`) use these configs to guide the user, while `validateProviderKey` performs the actual API key verification.

### Core Logic: `validateProviderKey`

This asynchronous function is the heart of the provider onboarding. It attempts to make a `GET` request to a provider-specific validation endpoint using the provided API key.

1.  **URL & Headers Construction**:
    *   It constructs the full validation URL using `config.baseUrl` and `config.validateEndpoint`.
    *   It dynamically builds HTTP headers, handling different authentication schemes (e.g., `Authorization: Bearer` for OpenAI, `x-api-key` for Anthropic, query parameters for Google Gemini, or no auth for local providers).
2.  **`fetch` Request**: It performs a `fetch` request to the constructed URL with a 15-second timeout.
3.  **Error Handling**:
    *   Catches network errors (e.g., connection refused, timeout).
    *   Checks HTTP status codes:
        *   `401` or `403` typically indicate an invalid API key.
        *   Other non-`2xx` codes are reported as API errors.
4.  **Model Extraction**: If the request is successful (`response.ok`), it calls `extractModels` to parse the response body and identify available models.
5.  **Result**: Returns a `ProviderValidationResult` indicating `valid: true/false` and optionally `models` or an `error` message.

### Provider Configurations (`PROVIDER_CONFIGS`)

This array holds detailed configuration objects for each supported AI provider. Each `ProviderOnboardingConfig` includes:

*   `id`: Unique identifier (e.g., `grok`, `openai`).
*   `name`: Human-readable name (e.g., `Grok (xAI)`).
*   `envKey`: The environment variable name for the API key (e.g., `GROK_API_KEY`).
*   `baseUrl`: The base URL for the provider's API.
*   `validateEndpoint`: A relative path to an endpoint that can be used to test API key validity (e.g., `/v1/models`).
*   `instructions`: User-facing guidance on where to obtain an API key.
*   `oauthFlow` (optional): Placeholder for future OAuth integration.

This centralized configuration makes it easy to add or update provider details.

### Interactive Flows

#### `runProviderOnboarding(providerId)`

This function provides an interactive wizard for a *specific* provider.

1.  **Find Config**: Retrieves the `ProviderOnboardingConfig` for the given `providerId`.
2.  **Existing Key Check**: Checks `process.env` for an existing API key. If found, it offers to re-validate it.
3.  **Local Provider Handling**: For `ollama` and `lmstudio`, it performs a connectivity check to their default local host (`http://localhost:11434` or `http://localhost:1234`) instead of prompting for an API key.
4.  **API Key Prompt**: Prompts the user to enter their API key.
5.  **Validation**: Calls `validateProviderKey` with the entered key.
6.  **Feedback & Persistence**: Reports the validation result. If valid, it sets `process.env[config.envKey]` for the current session and provides instructions for persisting the key in the user's shell profile.

#### `runFullProviderOnboarding()`

This function allows the user to *choose* which provider they want to onboard.

1.  **Provider Selection**: Uses an `askChoice` prompt to list all providers from `PROVIDER_CONFIGS`.
2.  **Delegate**: Once a provider is chosen, it delegates to `runProviderOnboarding` for the actual setup process.

### Utility Functions

*   **`getProviderConfig(providerId)`**: Retrieves a `ProviderOnboardingConfig` object by its ID.
*   **`listConfiguredProviders()`**: Returns an array of `ProviderOnboardingConfig` objects for providers that either have their environment variable set or are local providers (Ollama, LM Studio).

### Integration and Extension

#### CLI Integration

Both `runOnboarding` and `runFullProviderOnboarding` are designed to be called from CLI commands. `runOnboarding` is typically for the initial `setup` command, while `runFullProviderOnboarding` could be used for a `provider-setup` or `configure` command.

#### Adding New Providers

To add support for a new AI provider:

1.  **Update `PROVIDER_CONFIGS`**: Add a new `ProviderOnboardingConfig` object to the `PROVIDER_CONFIGS` array in `src/wizard/provider-onboarding.ts`. Ensure all fields are correctly populated, especially `baseUrl`, `validateEndpoint`, and `envKey`.
2.  **Update `extractModels` (if needed)**: If the new provider's `/v1/models` (or equivalent) endpoint returns a model list in a non-standard format (i.e., not `data: [{ id: "model-name" }]`), you'll need to add a specific parsing logic within the `extractModels` function.
3.  **Update `validateProviderKey` (if needed)**: If the new provider uses a unique authentication header or query parameter scheme not covered by existing logic, add a specific condition to the `headers` or `finalUrl` construction in `validateProviderKey`.
4.  **Update `onboarding.ts` (optional)**: If this new provider should be part of the *initial* `runOnboarding` wizard, add its `id` to the `PROVIDERS` array and define its `PROVIDER_DEFAULT_MODEL` and `PROVIDER_ENV_MAP` entries in `src/wizard/onboarding.ts`.

#### Testing

The module relies heavily on `readline` for interactive prompts and `fetch` for network requests. When testing, these dependencies are typically mocked to ensure deterministic behavior and avoid actual network calls or user interaction. For example, `readline.createInterface` and `fetch` would be mocked to return predefined inputs or responses.