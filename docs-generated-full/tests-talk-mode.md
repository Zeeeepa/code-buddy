---
title: "tests — talk-mode"
module: "tests-talk-mode"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:28.030Z"
---
# tests — talk-mode

This document provides an overview and detailed breakdown of the test suite for the `talk-mode` module, which handles Text-to-Speech (TTS) functionality. These tests ensure the reliability, correctness, and integration of various TTS providers and the core `TTSManager` responsible for orchestrating speech synthesis and playback.

## Overview

The `tests/talk-mode` directory contains unit and integration tests for the `src/talk-mode` components. This includes:
*   Individual TTS provider implementations (e.g., `AudioReaderTTSProvider`, `EdgeTTSProvider`, `OpenAITTSProvider`).
*   The central `TTSManager` class, which manages providers, voice selection, speech synthesis, caching, and audio playback queues.
*   The `MockTTSProvider`, used for internal testing and demonstrating the `ITTSProvider` interface.

The primary goal of these tests is to verify that:
1.  Each TTS provider correctly interacts with its respective external API or local executable.
2.  The `TTSManager` effectively manages multiple providers, handles configuration, queues speech, and controls playback.
3.  Edge cases, error conditions, and specific feature requirements (like voice mapping, speed clamping, caching) are handled as expected.

## Core Components Under Test

The `talk-mode` module revolves around two main concepts:

*   **`ITTSProvider`**: An interface (implemented by concrete classes like `AudioReaderTTSProvider`, `EdgeTTSProvider`, `OpenAITTSProvider`, and `MockTTSProvider`) that defines how to initialize, check availability, list voices, and synthesize speech.
*   **`TTSManager`**: The orchestrator that aggregates `ITTSProvider` instances, manages their lifecycle, handles user configuration, maintains a speech queue, and controls audio playback.

## Testing Strategy

The tests employ a combination of:
*   **Unit Testing**: Isolating individual provider classes and the `TTSManager` to test their specific functionalities.
*   **Mocking**: Using `jest.fn()` to mock external dependencies like `global.fetch` for HTTP requests or `child_process.spawn` for external process execution. This ensures tests are fast, deterministic, and don't rely on actual network calls or external tools being installed.
*   **Lifecycle Hooks**: `beforeEach` and `afterEach` are extensively used to set up and tear down test environments, ensuring a clean state for each test.

## Test Suites

### `audioreader-tts.test.ts`

This suite focuses on the `AudioReaderTTSProvider`, which integrates with a self-hosted AudioReader TTS server.

**Key Areas Tested:**
*   **Initialization and Availability**: Verifies that the provider can be initialized with a `baseURL` and correctly reports its availability by checking a health endpoint (`/api/v2/health`). It tests both successful and failed health checks.
*   **Voice Listing (`listVoices`)**: Ensures the provider can fetch available voices from the AudioReader API (`/api/v2/voices`). It also includes tests for handling different API response formats (object with `voices` array, or a direct array) and falling back to known voices if the API fails.
*   **Speech Synthesis (`synthesize`)**: Tests the core functionality of converting text to audio.
    *   Verifies that the `v1/audio/speech` endpoint is called with the correct `POST` body, including text, voice, and speed.
    *   Checks that the returned audio is a `Buffer` and has the expected format (`wav`).
    *   Tests specific voice selection, including mapping common OpenAI voice names (e.g., 'alloy' to 'af_bella') and stripping the `audioreader-` prefix from voice IDs.
    *   Ensures speed (`rate`) is clamped to a valid range (0.25 to 4.0).
    *   Validates error handling when the API returns a non-OK status.
    *   Confirms that synthesis fails if the provider is not initialized.

**Mocking Strategy**:
*   `global.fetch` is mocked using `jest.fn()` to simulate API responses without making actual network requests.

### `edge-tts.test.ts`

This suite tests the `EdgeTTSProvider`, which leverages the `edge-tts` Python package (either as a CLI tool or a Python module).

**Key Areas Tested:**
*   **Initialization and Availability**:
    *   Verifies that the provider can initialize even if `edge-tts` is not found, reporting itself as unavailable.
    *   Tests the detection of `edge-tts` when it's available, checking both the `edge-tts` CLI and falling back to `python -m edge_tts` if the CLI wrapper is missing.
*   **Voice Listing (`listVoices`)**:
    *   Confirms that the provider returns a set of default voices, even if the `edge-tts` executable isn't found (as a fallback).
    *   Checks that voices cover multiple languages (e.g., `en-US`, `en-GB`, `fr-FR`, `de-DE`).
    *   Verifies that a default voice (`en-US-JennyNeural`) is correctly marked.
    *   Ensures voice metadata (gender, provider, quality) is included.
*   **Speech Synthesis (`synthesize`)**: Tests that `synthesize` throws an error if the `edge-tts` executable is not found, as the actual synthesis relies on it.
*   **Voice Extraction (`extractVoice`)**: Tests the internal utility for extracting the raw voice ID from prefixed IDs (e.g., `edge-en-US-JennyNeural`) or finding a voice by a partial name.
*   **Shutdown**: Verifies that the provider shuts down cleanly.

**Mocking Strategy**:
*   `child_process.spawn` is mocked using `jest.fn()` to simulate the execution of external commands (`edge-tts` or `python -m edge_tts`) and control their `stdout`, `stderr`, and exit codes. A helper function `createSpawnResult` is used to simplify mock setup.

### `openai-tts.test.ts`

This suite covers the `OpenAITTSProvider`, which integrates with the OpenAI TTS API.

**Key Areas Tested:**
*   **Initialization and Availability**:
    *   Verifies that the provider initializes successfully when an API key is provided via configuration (`settings.apiKey`) or environment variable (`OPENAI_API_KEY`).
    *   Tests that initialization fails and throws an error if no API key is available.
*   **Voice Listing (`listVoices`)**:
    *   Confirms that the provider returns the expected set of OpenAI voices (alloy, echo, fable, onyx, nova, shimmer).
    *   Checks that a default voice (`alloy`) is marked.
    *   Ensures voice metadata (gender, provider, quality) is included.
*   **Speech Synthesis (`synthesize`)**:
    *   Tests the conversion of text to audio via the OpenAI API.
    *   Verifies that the `fetch` call includes the correct `Authorization` header and `POST` body (text, voice, model, speed).
    *   Checks that the returned audio is a `Buffer` and the format is `mp3`.
    *   Tests specific voice selection, handling both prefixed (`openai-nova`) and plain voice names (`echo`).
    *   Ensures the `rate` option is respected and clamped to the valid range (0.25 to 4.0).
    *   Confirms that the `tts-1` model is used by default.
    *   Validates error handling when the API returns a non-OK status.
*   **Shutdown**: Verifies that the provider shuts down cleanly.

**Mocking Strategy**:
*   `global.fetch` is mocked using `jest.fn()` to simulate API responses.
*   `process.env` is temporarily modified to test environment variable handling for the API key.

### `tts.test.ts`

This comprehensive suite tests the `TTSManager` and its interaction with `ITTSProvider` implementations, using the `MockTTSProvider` for controlled scenarios.

**Key Areas Tested:**

*   **`MockTTSProvider` Functionality**: Verifies the basic operations of the `MockTTSProvider`, including `isAvailable`, `listVoices`, `synthesize` (returning a `Buffer` and `wordTimings`). This ensures the mock itself behaves as expected for `TTSManager` tests.
*   **Provider Management**:
    *   `listProviders()`: Checks that registered providers are listed.
    *   `getActiveProvider()`: Verifies that an active provider is selected.
    *   `setActiveProvider()`: Tests switching between providers and handling attempts to switch to unavailable providers.
*   **Voice Management**:
    *   `getVoices()`: Retrieves all available voices from active providers.
    *   `getVoicesForLanguage()`: Filters voices by language.
    *   `getVoice()`: Retrieves a specific voice by ID.
    *   `getDefaultVoice()`: Identifies the default voice.
*   **Speech Synthesis**:
    *   `synthesize()`: Tests direct synthesis using the active provider, including specifying a voice.
    *   Error handling when no provider is available.
*   **Caching**:
    *   Tests that `TTSManager` caches synthesis results when `cacheEnabled` is true.
    *   Verifies `clearCache()` functionality and updates to `getStats()`.
*   **Queue Management**:
    *   `speak()`: Adds speech items to the queue.
    *   `getQueue()`: Retrieves the current queue.
    *   `clearQueue()`: Empties the queue.
    *   `removeFromQueue()`: Removes specific items.
    *   `maxSize`: Ensures the queue respects its maximum size limit.
*   **Playback**:
    *   `playNext()`: Initiates playback of the next item in the queue.
    *   `stop()`, `pause()`, `resume()`: Controls playback state.
    *   `isCurrentlyPlaying()`: Reports current playback status.
    *   `getPlaybackState()`: Provides detailed playback status (position, status).
*   **Events**: Verifies that `TTSManager` emits various events:
    *   `synthesis-start`, `synthesis-complete` (especially with `preSynthesize` enabled).
    *   `queue-change` when items are added or removed.
    *   `playback-start`, `playback-complete`, `playback-progress` during audio playback.
*   **Configuration**:
    *   `getConfig()`: Retrieves the current configuration.
    *   `updateConfig()`: Modifies configuration settings.
*   **Statistics**: `getStats()` provides an overview of the manager's state (provider count, voice count, queue length, playback status, cache entries).
*   **Singleton Behavior**: Tests the `getTTSManager()` and `resetTTSManager()` functions to ensure the `TTSManager` instance behaves as a singleton and can be reset.

## Architecture Diagram

The following diagram illustrates the relationship between the test files and the core `talk-mode` components they target.

```mermaid
graph TD
    subgraph Test Files
        A[tts.test.ts] -->|Tests| B(TTSManager)
        C[audioreader-tts.test.ts] -->|Tests| D(AudioReaderTTSProvider)
        E[edge-tts.test.ts] -->|Tests| F(EdgeTTSProvider)
        G[openai-tts.test.ts] -->|Tests| H(OpenAITTSProvider)
    end

    subgraph Source Code (src/talk-mode)
        B -->|Manages| I(ITTSProvider Interface)
        D -->|Implements| I
        F -->|Implements| I
        H -->|Implements| I
        B -->|Uses internally| J(MockTTSProvider)
        J -->|Implements| I
    end

    style A fill:#e0f7fa,stroke:#00796b,stroke-width:2px
    style C fill:#e0f7fa,stroke:#00796b,stroke-width:2px
    style E fill:#e0f7fa,stroke:#00796b,stroke-width:2px
    style G fill:#e0f7fa,stroke:#00796b,stroke-width:2px
    style B fill:#c8e6c9,stroke:#388e3c,stroke-width:2px
    style D fill:#c8e6c9,stroke:#388e3c,stroke-width:2px
    style F fill:#c8e6c9,stroke:#388e3c,stroke-width:2px
    style H fill:#c8e6c9,stroke:#388e3c,stroke-width:2px
    style I fill:#fff9c4,stroke:#fbc02d,stroke-width:2px
    style J fill:#c8e6c9,stroke:#388e3c,stroke-width:2px
```

This diagram highlights that `tts.test.ts` focuses on the `TTSManager` and its interaction with providers (including the `MockTTSProvider`), while the other test files specifically target the individual concrete `ITTSProvider` implementations. All concrete providers adhere to the `ITTSProvider` interface, which is a fundamental contract within the `talk-mode` module.

## Contributing to Tests

When adding new features or fixing bugs in the `talk-mode` module:
*   **New Provider**: Create a new test file `tests/talk-mode/providers/<your-provider>.test.ts` and ensure it covers `initialize`, `isAvailable`, `listVoices`, and `synthesize` with appropriate mocking for its external dependencies.
*   **`TTSManager` Changes**: Add or modify tests in `tests/talk-mode/tts.test.ts` to cover new `TTSManager` functionalities, configuration options, or event emissions.
*   **Mocking**: Follow existing patterns for mocking `fetch` or `child_process.spawn` to keep tests isolated and fast.
*   **Clarity**: Ensure test descriptions (`describe`, `it`) are clear and accurately reflect the behavior being tested.
*   **Cleanup**: Use `beforeEach` and `afterEach` to manage test setup and teardown, especially for resources like `TTSManager` instances or mocked global objects.