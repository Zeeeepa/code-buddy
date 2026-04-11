---
title: "src — talk-mode"
module: "src-talk-mode"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.744Z"
---
# src — talk-mode

The `src/talk-mode` module provides a robust and extensible Text-to-Speech (TTS) system, designed to integrate various TTS providers and manage speech synthesis, caching, and queued playback. It acts as a central hub for all voice output functionality within the application.

## Module Purpose

The primary goals of the `talk-mode` module are:

1.  **Abstract TTS Providers**: Offer a unified interface for interacting with different TTS services (e.g., OpenAI, ElevenLabs, Edge TTS, local engines).
2.  **Manage Voices**: Discover and manage available voices across all integrated providers.
3.  **Efficient Synthesis**: Provide mechanisms for caching synthesized audio to reduce API calls and latency.
4.  **Queued Playback**: Handle a queue of speech requests, allowing for prioritized and sequential playback.
5.  **Configurability**: Allow flexible configuration of providers, default voices, synthesis options, and queue behavior.

## Architecture Overview

The `talk-mode` module follows a provider-based architecture, centered around the `TTSManager` class.

```mermaid
graph TD
    A[Application Code] --> B(getTTSManager())
    B --> C(TTSManager)
    C -- "Delegates synthesis & voice listing" --> D{ITTSProvider Interface}
    D --> E(OpenAITTSProvider)
    D --> F(ElevenLabsProvider)
    D --> G(EdgeTTSProvider)
    D --> H(AudioReaderTTSProvider)
    D --> I(MockTTSProvider)

    C -- "Manages queue, cache, config" --> C
    C -- "Emits events (synthesis, playback, queue)" --> A
    C -- "Uses types from" --> J(types.ts)
```

1.  **`TTSManager`**: The core class that orchestrates all TTS operations. It manages the lifecycle of TTS providers, selects the active provider, handles voice discovery, performs speech synthesis (including caching), and manages the playback queue. It also emits events for various stages of synthesis and playback.
2.  **`ITTSProvider`**: An interface that defines the contract for any TTS service integration. Each concrete TTS provider must implement this interface.
3.  **Concrete TTS Providers**: Classes like `OpenAITTSProvider`, `ElevenLabsProvider`, `EdgeTTSProvider`, and `AudioReaderTTSProvider` implement the `ITTSProvider` interface, providing specific logic to interact with their respective TTS APIs or local binaries. A `MockTTSProvider` is also included for testing and development.
4.  **`types.ts`**: This file centralizes all type definitions, configurations, and default values used throughout the module, ensuring consistency and clarity.

## Key Components

### `TTSManager` (src/talk-mode/tts-manager.ts)

The `TTSManager` is the central component of the `talk-mode` module. It extends `EventEmitter` to provide a rich set of events for monitoring its state and operations.

**Initialization and Lifecycle:**

*   **`constructor(config?: Partial<TalkModeConfig>)`**: Initializes the manager with a given configuration, merging with `DEFAULT_TALK_MODE_CONFIG`.
*   **`initialize()`**:
    *   Registers a `MockTTSProvider` by default if no other providers are explicitly registered.
    *   Initializes all configured and enabled providers by calling their `initialize()` method.
    *   Calls `selectBestProvider()` to determine which provider will be used for synthesis.
    *   Calls `loadVoices()` to fetch and cache voices from the active provider.
*   **`shutdown()`**: Stops any ongoing playback, clears the queue and cache, and calls `shutdown()` on all registered providers to release resources.

**Provider Management:**

*   **`registerProvider(provider: ITTSProvider)`**: Adds a new TTS provider to the manager.
*   **`selectBestProvider()`**: Automatically selects an active provider based on its availability and configured `priority`.
*   **`getActiveProvider(): ITTSProvider | null`**: Returns the currently active provider.
*   **`setActiveProvider(providerId: TTSProvider)`**: Manually sets the active provider if it's available. This will trigger a `loadVoices()` call and emit a `provider-change` event.
*   **`listProviders(): Array<{ id: TTSProvider; available: boolean }>`**: Returns a list of all registered providers and their availability status.

**Voice Management:**

*   **`loadVoices()`**: Fetches voices from the `activeProvider` and caches them internally.
*   **`getVoices(): Voice[]`**: Returns all voices loaded from the active provider.
*   **`getVoicesForLanguage(language: string): Voice[]`**: Filters voices by language.
*   **`getVoice(id: string): Voice | undefined`**: Retrieves a specific voice by its ID.
*   **`getDefaultVoice(): Voice | undefined`**: Returns the configured default voice or the first voice marked as default by the provider.

**Speech Synthesis:**

*   **`synthesize(text: string, options?: SynthesisOptions): Promise<SynthesisResult>`**:
    *   Delegates the actual synthesis to the `activeProvider`.
    *   **Caching**: If `config.cacheEnabled` is true, it first checks an internal cache. If a cached result exists and is within `cacheTTLMs`, it's returned immediately. Otherwise, it performs synthesis and caches the result (evicting old entries if `cacheMaxBytes` is exceeded).
    *   Uses `crypto.createHash` to generate cache keys based on text and options.
*   **`clearCache()`**: Empties the synthesis cache.

**Playback Queue Management:**

*   **`speak(text: string, options?: SynthesisOptions): Promise<SpeechItem>`**:
    *   Creates a `SpeechItem` and adds it to the internal queue.
    *   If `config.queueConfig.preSynthesize` is enabled, it attempts to synthesize the audio in the background.
    *   If `config.queueConfig.autoPlay` is enabled and nothing is currently playing, it triggers `playNext()`.
    *   Emits a `queue-change` event.
*   **`addToQueue(item: SpeechItem)`**: Manages adding items to the queue, respecting `maxSize` and `priority`.
*   **`preSynthesize(item: SpeechItem)`**: Asynchronously synthesizes audio for a queue item, updating its status and emitting `synthesis-start`, `synthesis-complete`, or `synthesis-error` events.
*   **`getQueue(): SpeechItem[]`**: Returns a copy of the current speech queue.
*   **`clearQueue()`**: Empties the queue.
*   **`removeFromQueue(id: string)`**: Removes a specific item from the queue.

**Playback (Simulated):**

*   **`playNext()`**:
    *   Dequeues the next `SpeechItem`.
    *   Ensures the item's audio is synthesized (calling `preSynthesize` if needed).
    *   **Simulates playback**: Uses `setTimeout` to advance `positionMs` and emit `playback-progress` events.
    *   Emits `playback-start`, `playback-progress`, `playback-complete`, or `playback-error` events.
    *   Includes a configurable `gapMs` between items.
    *   Automatically plays the next item if `autoPlay` is enabled.
*   **`stop()`**: Halts current playback, sets the item status back to 'pending', and re-adds it to the front of the queue.
*   **`pause()`**: Pauses current playback.
*   **`resume()`**: Resumes paused playback.
*   **`getPlaybackState(): PlaybackState`**: Returns the current playback status, position, duration, etc.
*   **`getCurrentItem(): SpeechItem | null`**: Returns the item currently being played.
*   **`isCurrentlyPlaying(): boolean`**: Checks if audio is actively playing.

**Configuration and Stats:**

*   **`getConfig(): TalkModeConfig`**: Returns the current configuration.
*   **`updateConfig(config: Partial<TalkModeConfig>)`**: Updates the manager's configuration.
*   **`getStats()`**: Provides statistics like provider count, voice count, queue length, and cache size.

### `ITTSProvider` Interface (src/talk-mode/tts-manager.ts)

This interface defines the contract that all TTS provider implementations must adhere to.

*   **`readonly id: TTSProvider`**: A unique identifier for the provider (e.g., 'openai', 'edge').
*   **`isAvailable(): Promise<boolean>`**: Checks if the provider is operational and accessible (e.g., API key valid, local binary found, service reachable).
*   **`listVoices(): Promise<Voice[]>`**: Retrieves a list of available voices from the provider.
*   **`synthesize(text: string, options?: SynthesisOptions): Promise<SynthesisResult>`**: Performs the core text-to-speech synthesis, returning audio data and metadata.
*   **`initialize(config: TTSProviderConfig): Promise<void>`**: Sets up the provider with its specific configuration.
*   **`shutdown(): Promise<void>`**: Cleans up any resources held by the provider.

### Concrete TTS Providers (src/talk-mode/providers/)

The module includes several concrete implementations of `ITTSProvider`:

*   **`OpenAITTSProvider` (openai-tts.ts)**:
    *   Integrates with the OpenAI TTS API (`https://api.openai.com/v1/audio/speech`).
    *   Requires an `apiKey` (can be provided via config or `process.env.OPENAI_API_KEY`).
    *   Supports OpenAI's predefined voices (`alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer`) and models (`tts-1`, `tts-1-hd`).
    *   Handles `speed` and `response_format` options.
*   **`ElevenLabsProvider` (elevenlabs.ts)**:
    *   Integrates with the ElevenLabs API (`https://api.elevenlabs.io/v1`).
    *   Requires an `apiKey` (can be provided via config or `process.env.ELEVENLABS_API_KEY`).
    *   Supports advanced features like `stability`, `similarityBoost`, `style`, and `useSpeakerBoost`.
    *   Includes methods for `cloneVoice()` and `deleteVoice()` for managing custom voices.
    *   Attempts to detect language and gender from ElevenLabs voice labels.
*   **`EdgeTTSProvider` (edge-tts.ts)**:
    *   Leverages the `edge-tts` Python CLI tool.
    *   **Dependency**: Requires `edge-tts` to be installed (e.g., `pip install edge-tts`).
    *   **Detection**: `detectEdgeTTSCommand()` attempts to find the `edge-tts` executable or `python -m edge_tts`.
    *   Uses `child_process.spawn` to execute the CLI for voice listing and synthesis.
    *   Supports `rate`, `volume`, and `pitch` adjustments via CLI arguments.
*   **`AudioReaderTTSProvider` (audioreader-tts.ts)**:
    *   Connects to a local AudioReader API (e.g., Kokoro-82M engine) that exposes an OpenAI-compatible REST API.
    *   Configurable `baseURL`, `model`, `defaultVoice`, `speed`, and `format`.
    *   Includes a mapping for known Kokoro voices and OpenAI voice names for compatibility.
*   **`MockTTSProvider` (tts-manager.ts)**:
    *   A simple, in-memory provider for testing and development.
    *   Simulates synthesis with a configurable delay and generates dummy audio buffers.
    *   Provides mock word timings.

### `types.ts` (src/talk-mode/types.ts)

This file defines all the essential data structures and interfaces:

*   **`TTSProvider`**: Union type for all supported provider IDs.
*   **`TTSProviderConfig`**: Base configuration for any provider, including `enabled` status and `priority`.
*   **Specific Provider Configs**: Interfaces like `OpenAITTSConfig`, `ElevenLabsConfig`, `EdgeTTSConfig`, `AudioReaderTTSConfig`, `PiperConfig`, `CoquiConfig`, `ESpeakConfig`, `SystemTTSConfig` define provider-specific settings.
*   **`Voice`**: Describes a TTS voice, including `id`, `name`, `language`, `gender`, `provider`, `providerId`, `quality`, and `sampleRate`.
*   **`SynthesisOptions`**: Parameters for a synthesis request (e.g., `voice`, `rate`, `format`).
*   **`SynthesisResult`**: The output of a synthesis operation, containing `audio` data (as `Buffer`), `format`, `durationMs`, and optional `wordTimings`.
*   **`SpeechItem`**: Represents an item in the playback queue, including its `text`, `options`, `status`, and `audio` (once synthesized).
*   **`QueueConfig`**: Configuration for the speech queue (e.g., `maxSize`, `preSynthesize`, `autoPlay`, `gapMs`).
*   **`PlaybackState`**: Describes the current state of audio playback.
*   **`TalkModeConfig`**: The top-level configuration for the entire `TTSManager`, encompassing provider configs, default options, queue config, and caching settings.
*   **`TalkModeEvents`**: Defines the event signatures emitted by `TTSManager`, allowing external components to subscribe to synthesis, playback, and queue updates.
*   **Default Configurations**: `DEFAULT_QUEUE_CONFIG` and `DEFAULT_TALK_MODE_CONFIG` provide sensible defaults.

## Integration with the Codebase

The `talk-mode` module is designed to be a core utility for any part of the application requiring spoken output.

**Incoming Calls:**

*   **`commands/cli/speak-command.ts`**: A CLI command likely uses `getTTSManager()` to obtain the TTS instance and then calls `speak()` to vocalize text provided by the user. It might also register specific providers like `AudioReaderTTSProvider` or `OpenAITTSProvider` if they are not part of the default configuration.
*   **`tests/talk-mode/tts.test.ts`**: This module is heavily tested, with unit tests covering `TTSManager`'s functionality, provider interactions, caching, queue management, and playback simulation.
*   **`tests/features/plugins-commands-summarize.test.ts`**: Feature tests might interact with `listProviders()` to ensure TTS capabilities are correctly reported.

**Outgoing Calls:**

*   **External APIs**: Providers make HTTP requests to services like OpenAI and ElevenLabs using `fetch`.
*   **Local Processes**: `EdgeTTSProvider` uses `child_process.spawn` to interact with the `edge-tts` Python CLI.
*   **Node.js Core Modules**:
    *   `events` (`EventEmitter`) for internal eventing.
    *   `crypto` for generating cache keys.
    *   `Buffer` for handling raw audio data.
*   **`console.warn`**: Used by `EdgeTTSProvider` to inform developers if the `edge-tts` executable is not found.

This module provides a comprehensive and flexible foundation for integrating various text-to-speech capabilities into the application, abstracting away the complexities of individual providers and offering robust management of speech synthesis and playback.