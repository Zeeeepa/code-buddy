---
title: "tests — auth"
module: "tests-auth"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.827Z"
---
# tests — auth

This document details the `auth` testing module, which validates the core authentication and profile management components within the application's `src/auth` directory. It covers the `OAuthManager`, `ModelProfileManager`, and `AuthProfileManager`, explaining their purpose, key functionalities, and how the provided tests ensure their correctness and robustness.

## 1. Introduction to Auth Module Testing

The `tests/auth` module is crucial for ensuring the reliability and security of the application's authentication and AI model profile management systems. It comprises several test suites, each focusing on a specific manager responsible for different aspects of authentication and resource selection. These tests validate:

*   Correct configuration and setup of authentication providers.
*   Proper execution of authentication flows (e.g., OAuth).
*   Intelligent selection of AI model profiles based on various criteria (priority, model support, health).
*   Robust failure handling mechanisms, including circuit breakers and exponential backoff.
*   Session management and profile stickiness.
*   Persistence and singleton patterns where applicable.

By examining these tests, developers can gain a deep understanding of the expected behavior and internal workings of the `src/auth` components.

## 2. OAuthManager Tests (`oauth/manager.test.ts`)

The `OAuthManager` is responsible for orchestrating OAuth 2.0 authentication flows with various third-party providers. The tests in `oauth/manager.test.ts` validate its ability to configure providers, generate authorization URLs, manage credentials, and report its status.

### 2.1. Purpose

The `OAuthManager` provides a standardized way to integrate with different OAuth providers (e.g., OpenAI, Anthropic, Google, GitHub). It handles the complexities of the OAuth flow, including PKCE (Proof Key for Code Exchange) where required, to secure the authorization process.

### 2.2. Key Functionalities and Validation

The tests cover the following critical aspects of `OAuthManager`:

*   **Provider Configuration**:
    *   `configureProvider(providerId, clientId, clientSecret, redirectUri?)`: Tests ensure that providers can be configured with client details and that custom or default redirect URIs are correctly applied. It also verifies that attempting to configure an unknown provider throws an error.
    *   `getProviderConfig(providerId)`: Validates that configuration details can be retrieved accurately.
    *   `getConfiguredProviders()`: Confirms that the manager can list all currently configured providers.
*   **Authorization Flow**:
    *   `getAuthorizationUrl(providerId)`: This is a core function. Tests verify that the generated URL contains the correct provider-specific authorization endpoint, client ID, response type, and a `state` parameter. Crucially, it checks for the inclusion of `code_challenge` and `code_challenge_method=S256` when PKCE is required (e.g., for OpenAI).
    *   **Event Emission**: The manager emits an `auth:started` event when an authorization URL is generated, which is validated by the tests.
*   **Code Exchange**:
    *   `exchangeCode(providerId, code, state)`: While the full exchange is complex to test without live mocks, tests specifically validate that an `Invalid state` error is thrown if the provided state does not match the expected state, ensuring a critical security measure is in place.
*   **Credential Management**:
    *   `getCredential(credentialId)` and `getCredentialForProvider(providerId)`: Tests confirm that these methods return `undefined` for unknown credentials or unconfigured providers, indicating proper handling of missing data.
*   **Statistics**:
    *   `getStats()`: Verifies that the manager accurately reports the number of `configuredProviders`, `storedCredentials`, and `pendingAuthorizations`.
*   **Shutdown**:
    *   `shutdown()`: Tests ensure that the manager can shut down cleanly without errors, which is important for resource management.

### 2.3. `OAUTH_PROVIDERS` Constants

The `oauth/manager.test.ts` also includes tests for the `OAUTH_PROVIDERS` constant, ensuring that predefined provider configurations (like `anthropic`, `openai`, `google`, `github`) have the expected properties, such as `name`, `pkceRequired`, `scopes`, and `refreshSupported`.

## 3. ModelProfileManager Tests (`oauth/model-profiles.test.ts`)

The `ModelProfileManager` is designed to manage a collection of AI model profiles, enabling intelligent selection based on various criteria and implementing a circuit breaker pattern for resilience.

### 3.1. Purpose

This manager provides a layer of abstraction over individual AI model providers and their authentication methods. It allows defining multiple profiles for different models or providers, each with its own priority, authentication type (API key or OAuth), and supported models. It then intelligently selects the best available profile for a given request, incorporating health checks and failover logic.

### 3.2. Key Functionalities and Validation

The tests in `oauth/model-profiles.test.ts` validate the following:

*   **Profile Management (CRUD)**:
    *   `addProfile()`: Verifies that custom profiles can be added and retrieved.
    *   `removeProfile()`: Ensures profiles can be removed and are no longer accessible.
    *   `enableProfile()` / `disableProfile()`: Confirms that profiles can be toggled between enabled/disabled states.
    *   `getProfile()` / `getAllProfiles()`: Validates retrieval of individual and all profiles.
*   **Default Profiles**: Tests confirm that the manager initializes with a set of predefined default profiles (e.g., Grok, OpenAI, Anthropic, Google, Ollama).
*   **Profile Selection (`selectProfile`)**:
    *   **Priority**: Ensures that the highest priority *ready* profile is selected.
    *   **Model Matching**: Validates that profiles supporting a specific requested model (including wildcard matches like `gpt-4*`) are prioritized.
    *   **Circuit Breaker Integration**: Confirms that profiles with an `open` circuit state are skipped during selection.
    *   **Event Emission**: Emits a `profile:selected` event upon successful selection.
    *   **No Profile Available**: Tests that `null` is returned if no suitable, ready, and enabled profile can be found.
*   **Failure Tracking and Circuit Breaker**:
    *   `recordFailure(profileId)`: Tests that this increments `failureCount` and updates `lastFailureAt`. It also verifies that the profile's `circuitState` transitions to `open` after a configurable `circuitBreakerThreshold` of failures.
    *   `recordSuccess(profileId)`: Ensures that `failureCount` is reset on success. If a profile was in a `half-open` state, success transitions it back to `closed`.
    *   **Circuit Breaker States**: The tests implicitly validate the state transitions:
        ```mermaid
        stateDiagram
            direction LR
            [*] --> Closed: Initial state
            Closed --> Open: Failures >= Threshold
            Open --> HalfOpen: Cooldown period expires
            HalfOpen --> Closed: Successful request
            HalfOpen --> Open: Failed request
        ```
*   **Failover (`getNextAvailableProfile`)**:
    *   Tests that if a primary profile is unavailable (e.g., due to failure), the manager can select the next highest priority *available* profile.
    *   Verifies that calling this method records a failure for the original profile.
    *   Emits a `profile:failover` event.
*   **Authentication Readiness (`isProfileReady`)**:
    *   Tests confirm that API key profiles are considered ready if an `apiKey` is present.
    *   OAuth profiles are considered ready only if an associated `OAuthManager` (not directly mocked in this test, but implied) can provide valid credentials.
*   **Statistics (`getStats`)**:
    *   Verifies that the manager provides accurate statistics on `totalProfiles`, `enabledProfiles`, and `openCircuits`.
*   **Model Matching**: Explicitly tests both exact model name matches and wildcard matches (e.g., `gpt-4*` matching `gpt-4-turbo-preview`).

## 4. AuthProfileManager Tests (`profile-manager.test.ts`)

The `AuthProfileManager` is a more generic authentication profile manager, focusing on load balancing, session stickiness, and robust failure handling with exponential backoff.

### 4.1. Purpose

This manager is designed to select the most appropriate authentication profile from a pool of available options, considering various strategies (round-robin, priority, random), session affinity, and dynamic health checks. It implements sophisticated cooldown and recovery mechanisms to ensure that failing profiles are temporarily taken out of rotation and gradually brought back online.

### 4.2. Key Functionalities and Validation

The tests in `profile-manager.test.ts` validate the following:

*   **Profile Management (CRUD)**:
    *   `addProfile()`, `removeProfile()`, `getProfile()`, `getAllProfiles()`: Basic CRUD operations are tested to ensure profiles can be managed effectively.
*   **Selection Strategies (`getNextProfile`)**:
    *   **Round-Robin Rotation**: When profiles have equal priority and session stickiness is off, tests confirm that `getNextProfile()` cycles through profiles in order.
    *   **Priority Strategy**: When configured, tests ensure that the manager consistently selects the profile with the highest priority. It also validates that `oauth` type profiles are prioritized over `api-key` profiles at the same priority level.
    *   **Random Strategy**: Tests confirm that a valid profile is returned randomly when this strategy is enabled.
    *   **Cooldown Skipping**: Profiles currently in cooldown are correctly skipped during selection.
*   **Session Stickiness**:
    *   `sessionSticky` configuration: Tests verify that when enabled, `getNextProfile(sessionId)` consistently returns the same profile for a given session ID.
    *   `getProfileForSession(sessionId)`: Validates retrieval of the currently bound profile.
    *   `releaseSession(sessionId)`: Ensures that session bindings can be explicitly released.
    *   **Unbinding on Failure**: If a session-bound profile fails and enters cooldown, tests confirm that the session is unbound, and a new healthy profile is selected for subsequent requests from that session.
*   **Exponential Backoff Cooldowns**:
    *   `markFailed(profileId, error, isBillingFailure?)`:
        *   **Normal Failures**: Tests confirm that profiles are put into cooldown. The cooldown duration escalates exponentially (5x multiplier) with successive failures, up to a configurable maximum (`maxCooldownMs`).
        *   **Billing Failures**: A separate `billingCooldownMs` and a 2x multiplier are used for failures explicitly marked as billing-related, also capped by `maxCooldownMs`.
    *   **Event Emission**: `profile:failed` and `profile:cooldown` events are emitted and validated.
*   **Profile Recovery**:
    *   `markSuccess(profileId)`: Tests ensure that calling this method resets the failure count and immediately makes the profile healthy again.
    *   **Automatic Recovery**: Profiles automatically recover from cooldown after their cooldown period expires. Tests use short cooldowns and busy-waits to validate this behavior.
    *   **Failure Count Persistence**: The failure count persists across cooldowns (unless `markSuccess` is called), ensuring that the exponential backoff continues to escalate on subsequent failures.
*   **Status and Diagnostics (`getStatus`)**:
    *   Tests verify that `getStatus()` provides comprehensive health information for all profiles, including `healthy` status, `inCooldown` flag, `failureCount`, `lastError`, and `cooldownRemainingMs`.
*   **Singleton Pattern**:
    *   `getAuthProfileManager()`: Tests confirm that this function consistently returns the same instance of the manager.
    *   `resetAuthProfileManager()`: Validates that calling this function clears the singleton, allowing a new instance to be created.
*   **Edge Cases**: Tests cover scenarios like no profiles registered, all profiles in cooldown, unknown session IDs, unknown profiles, and idempotent shutdown.

## 5. Relationship and Interaction

While the tests for `OAuthManager`, `ModelProfileManager`, and `AuthProfileManager` are distinct, they collectively form the authentication and profile management backbone.

*   The `OAuthManager` is a specialized component for handling OAuth 2.0 flows, providing credentials.
*   The `ModelProfileManager` focuses on selecting the best AI model profile, which might involve using credentials obtained via `OAuthManager` (as implied by `isProfileReady` checking for `oauth` type profiles). It implements a circuit breaker pattern specific to model usage.
*   The `AuthProfileManager` appears to be a more generic, robust profile selector that can manage any type of authentication profile, offering advanced load balancing, session stickiness, and exponential backoff for general failure handling. It's possible that `ModelProfileManager` could internally leverage `AuthProfileManager` for its underlying authentication profile selection, or they might serve different layers of the application's profile management needs. The current tests do not explicitly show direct interaction between `ModelProfileManager` and `AuthProfileManager`.

## 6. Contributing to Auth Modules

When contributing to the `src/auth` modules, keep the following in mind:

*   **Understand the Manager's Scope**: Each manager has a distinct responsibility. Ensure changes align with its core purpose.
*   **Test-Driven Development**: The existing tests provide a clear specification of expected behavior. Write new tests or extend existing ones to cover any new functionality or edge cases introduced.
*   **Failure Handling**: Pay close attention to how failures are handled. Ensure that new error conditions are correctly reported and trigger appropriate cooldowns or circuit breaker states.
*   **Performance**: Consider the performance implications of profile selection and status checks, especially in high-throughput scenarios.
*   **Security**: For OAuth-related changes, always prioritize security best practices, such as state validation and PKCE.
*   **Event Emission**: If new significant state changes or actions occur, consider emitting relevant events to allow other parts of the system to react.