---
title: "src — input"
module: "src-input"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.532Z"
---
# src — input

The `src/input` module is a critical part of the system, responsible for handling various forms of user input beyond simple text. This includes parsing special `@mentions` for context injection, providing file path autocompletion, managing multimodal inputs like images and screenshots, and enabling sophisticated voice control and text-to-speech capabilities.

This module aims to enrich the user's interaction by allowing them to easily reference external information, provide visual context, and interact hands-free.

## Module Overview

The `src/input` module is composed of several distinct sub-modules, each addressing a specific input modality or enhancement:

*   **`context-mentions.ts`**: Parses special `@mentions` in user prompts (e.g., `@file:`, `@url:`, `@git:`, `@web`, `@terminal`) to fetch and inject relevant context into the AI's understanding.
*   **`file-autocomplete.ts`**: Provides intelligent file path autocompletion, particularly useful for `@file:` mentions, respecting `.gitignore` rules.
*   **`multimodal-input.ts`**: Manages image-based inputs, including capturing screenshots, loading images from files or URLs, handling clipboard images, and performing OCR.
*   **`text-to-speech.ts`**: Offers text-to-speech functionality, allowing the system to audibly respond to the user using various TTS providers.
*   **`voice-control.ts`**: Implements an advanced voice command system with wake word detection, continuous listening, voice activity detection (VAD), and a framework for processing voice commands.
*   **`voice-input-enhanced.ts`**: Provides a general-purpose voice-to-text recording and transcription manager, supporting local and API-based Whisper transcription.
*   **`voice-input.ts`**: An older/alternative voice-to-text recording and transcription manager. `voice-input-enhanced.ts` is generally preferred for new development due to its more robust features.

## Key Components

### 1. Context Mentions (`src/input/context-mentions.ts`)

This module is responsible for identifying and resolving special `@mentions` within a user's input message. These mentions allow users to easily pull in external information (like file contents, web pages, git status, or terminal history) directly into their prompt, providing rich context for the AI.

**Core Functionality:**

*   **`ContextMentionParser` Class**: The central class for parsing and resolving mentions. It defines a set of regex patterns for different mention types.
*   **`expandMentions(input: string): Promise<ExpandedInput>`**: The primary method that scans the input string for all defined mention patterns. For each detected mention, it attempts to resolve its content.
    *   It prioritizes "new-style" mentions (`@web`, `@git <subcommand>`, `@terminal`) before "legacy-style" mentions (`@file:`, `@url:`, `@git:`).
    *   Mentions are replaced with a placeholder in the `cleanedMessage` if content is successfully retrieved.
*   **`resolveMention(type, value, original)`**: A private dispatcher that calls the appropriate resolver function based on the mention type.
*   **Specific Resolvers**:
    *   **`resolveFile(filePath)`**: Reads the content of a local file. Handles directories by listing contents and enforces a `maxFileSize` limit.
    *   **`resolveUrl(url)`**: Fetches content from a given URL. Includes basic HTML text extraction and enforces a `maxUrlSize` limit.
    *   **`resolveImage(imagePath)`**: Reads an image file, converts it to base64, and determines its MIME type for multimodal AI input.
    *   **`resolveGit(command)`**: Executes predefined `git` commands (e.g., `status`, `diff`, `log`) and captures their output.
    *   **`resolveGitExtended(subcommand, args)`**: Allows more flexible `git` commands with custom arguments (e.g., `@git log --since=1week`). Includes basic sanitization for arguments.
    *   **`resolveWeb(query)`**: Performs a web search (using Brave Search API if `BRAVE_API_KEY` is set, otherwise DuckDuckGo API) and injects the top results.
    *   **`resolveTerminal()`**: Attempts to capture recent terminal output, first from `.codebuddy/tool-results/` files, then falling back to shell history.
    *   **`resolveSymbol(symbol)`**: Searches the codebase for a given symbol (class, function, etc.) using `ripgrep` and extracts its definition from the first matching file.
    *   **`resolveSearch(query)`**: Performs a codebase search using `ripgrep` for a given query and returns matching lines with context.
*   **`formatContexts(contexts)`**: Takes a list of resolved `MentionContext` objects and formats them into a single string suitable for injecting into a prompt.
*   **`getHelp()`**: Provides a formatted string explaining all available `@mentions` and their usage.
*   **`processMentions(message: string): Promise<MentionResult>`**: A convenience function that uses the `ContextMentionParser` singleton to expand mentions and return a `cleanedMessage` and `contextBlocks`.

**Data Structures:**

*   **`MentionContext`**: Describes a single resolved mention, including its type, original string, resolved value, content, and any errors.
*   **`ExpandedInput`**: The result of `expandMentions`, containing the `text` with mentions replaced and a list of `contexts`.
*   **`MentionResult`**: The result of `processMentions`, providing the `cleanedMessage` and an array of structured `contextBlocks`.

**Execution Flow for `expandMentions`:**

```mermaid
graph TD
    A[User Input String] --> B{ContextMentionParser.expandMentions}
    B -- Calls --> C{processNewMentions}
    C -- Processes @web, @git extended, @terminal --> D[Resolve New Mentions]
    D -- Resolved Contexts --> E[Append to Contexts List]
    C -- Returns Cleaned Text --> F{Loop through Legacy Patterns}
    F -- For each @file:, @url:, @git:, @symbol:, @search:, @image: --> G{resolveMention}
    G -- Calls specific resolver (e.g., resolveFile, resolveUrl) --> H[Fetch Content / Execute Command]
    H -- Success --> I[Create MentionContext]
    I --> E
    H -- Error --> J[Create Error MentionContext]
    J --> E
    E --> K[Return ExpandedInput {text, contexts}]
    K --> L[processMentions (convenience function)]
    L --> M[Filter & Format Contexts]
    M --> N[Return MentionResult {cleanedMessage, contextBlocks}]
```

**Integration:**

The `processMentions` function is a key integration point, called by `agent/execution/agent-executor.ts` (`processUserMessage` and `processUserMessageStream`) to enrich the AI's understanding of user requests before they are processed.

### 2. File Autocomplete (`src/input/file-autocomplete.ts`)

This module provides intelligent file path completion, primarily for `@file:` references, enhancing the user experience by suggesting relevant files and directories.

**Core Functionality:**

*   **`FileAutocomplete` Class**: Manages the autocompletion logic.
*   **`loadGitignore(workDir)`**: Reads the `.gitignore` file in the current working directory to filter out ignored paths from suggestions.
*   **`isIgnored(relativePath)`**: Checks if a given path matches any loaded `.gitignore` pattern.
*   **`complete(partial: string, workDir: string): FileCompletion[]`**: The main method for generating completion suggestions. It takes a partial path, resolves it, scans the relevant directory, filters by prefix and `.gitignore` rules, and returns a list of `FileCompletion` objects. It also handles optional line range suffixes (e.g., `file.ts:10-20`).
*   **`parseAtReference(input: string): AtReference | null`**: Parses an `@-reference` string (e.g., `@src/index.ts:10-20`) into its path and optional line range components.

**Data Structures:**

*   **`FileCompletion`**: Represents a single completion suggestion, including the full path, display string, whether it's a directory, and any line range.
*   **`AtReference`**: Represents a parsed `@-reference` with its `path`, `lineStart`, and `lineEnd`.

**Integration:**

This module is typically used by the CLI or UI components to provide real-time suggestions as the user types `@file:` mentions.

### 3. Multimodal Input (`src/input/multimodal-input.ts`)

This module enables the system to handle various image inputs, providing visual context to AI models.

**Core Functionality:**

*   **`MultimodalInputManager` Class**: Manages image inputs and related operations.
*   **`initialize()`**: Detects system capabilities for screenshots, clipboard access, OCR (Tesseract), and image processing (ImageMagick).
*   **`captureScreenshot(options)`**: Captures a screenshot (fullscreen, selection, or window) using platform-specific commands (`screencapture` on macOS, `scrot`/`gnome-screenshot`/`import` on Linux, PowerShell on Windows).
*   **`loadImageFile(filePath)`**: Loads an image from a local file, performs size and format checks, and converts it to base64.
*   **`loadImageFromURL(url)`**: Downloads an image from a URL using `curl` and then processes it as a local file.
*   **`loadFromClipboard()`**: Retrieves an image from the system clipboard using platform-specific commands (`osascript` on macOS, `xclip`/`wl-paste` on Linux).
*   **`performOCR(imageId)`**: Extracts text from a loaded image using Tesseract OCR.
*   **`prepareForAPI(imageId)`**: Prepares an image for API submission, including optional auto-resizing if it exceeds `maxDimension`.
*   **`formatSummary()`**: Generates a human-readable summary of currently loaded images and system capabilities.
*   **Private Helper Methods**: `execCommand` (for spawning external processes), `getImageDimensions`, `resizeImage`, `getMimeType`, `getExtensionFromURL`, `checkCommand`.

**Data Structures:**

*   **`ImageInput`**: Represents a loaded image with its ID, source, paths, MIME type, base64 data, dimensions, and size.
*   **`ScreenshotOptions`**: Configures screenshot capture mode, delay, format, etc.
*   **`OCRResult`**: Stores the text extracted by OCR.
*   **`MultimodalConfig`**: Configuration for the manager (temp directory, max sizes, OCR settings, auto-resize).
*   **`MultimodalCapabilities`**: Reports which multimodal features are available on the current system.

**Integration:**

The `MultimodalInputManager` is used by commands (e.g., `/image load`, `/image screenshot`) to acquire image data. The `prepareForAPI` method is crucial for formatting images before sending them to AI models that accept multimodal input.

### 4. Text-to-Speech (`src/input/text-to-speech.ts`)

This module provides text-to-speech (TTS) functionality, allowing the system to speak responses to the user.

**Core Functionality:**

*   **`TextToSpeechManager` Class**: Manages TTS operations.
*   **`isAvailable()`**: Checks if the configured TTS provider (e.g., `edge-tts`, `espeak`, `say`, `piper`, `audioreader`) is installed and accessible. For `audioreader`, it checks the health endpoint of the local API.
*   **`speak(text: string, language: string)`**: The main method to speak text. It adds text to a queue if already speaking and dispatches to the appropriate provider's `speakWith...` method.
*   **Provider-Specific `speakWith...` Methods**:
    *   `speakWithEdgeTTS`: Uses the `edge-tts` Python package for high-quality Microsoft voices. Generates an MP3 and then plays it.
    *   `speakWithEspeak`: Uses the `espeak` command-line tool.
    *   `speakWithSay`: Uses the built-in `say` command on macOS.
    *   `speakWithPiper`: Uses the `piper` command-line tool.
    *   `speakWithAudioReader`: Interacts with a local `AudioReader` HTTP API for TTS.
*   **`playAudio(audioFile)`**: Plays a generated audio file using available system players (`ffplay`, `mpv`, `aplay`, `paplay`, `play`).
*   **`stop()`**: Immediately stops any ongoing speech and clears the queue.
*   **`enable()` / `disable()` / `setAutoSpeak()`**: Controls the TTS system's overall state and auto-speak behavior.
*   **`listVoices()`**: Lists available voices for `edge-tts`.
*   **`formatStatus()`**: Provides a formatted string showing the current TTS configuration and status.
*   **Configuration Persistence**: Loads and saves configuration to `~/.codebuddy/tts-config.json`.

**Data Structures:**

*   **`TTSConfig`**: Configuration for the TTS manager (enabled, provider, voice, rate, volume, pitch, auto-speak).
*   **`TTSState`**: Current state of the TTS manager (is speaking, queue, current text).

**Integration:**

The `TextToSpeechManager` is typically used by command handlers (e.g., `handleTTS`) or other parts of the system that need to provide audible feedback or responses to the user.

### 5. Voice Control (`src/input/voice-control.ts`)

This module implements an advanced voice command system, enabling hands-free interaction with the application.

**Core Functionality:**

*   **`VoiceControl` Class**: The central class for managing voice commands.
*   **`initialize()`**: Sets up the temporary directory and loads configuration.
*   **`isAvailable()`**: Checks for the presence of required system tools (`sox`, `arecord`, `whisper`, `vosk`, `ffmpeg`) and API keys for transcription providers.
*   **`startListening()`**: Initiates voice input. Depending on `continuousListening` config, it calls `startContinuousListening` or `startSingleRecording`.
*   **`startContinuousListening()`**: Uses `sox` with silence detection (VAD) to continuously capture audio. Integrates with `WakeWordDetector` (Porcupine or text-match) to activate command processing.
*   **`startSingleRecording()`**: Records a single audio segment using `sox` with VAD to automatically stop on silence.
*   **`processAudioBuffer()` / `processAudioFile()`**: Handles the raw audio data, converts it to a WAV file, and then passes it to the `transcribe` method.
*   **`writeWavFile()`**: Helper to convert raw audio buffer to a WAV file.
*   **`transcribe(audioFile)`**: Dispatches to the configured transcription provider:
    *   `transcribeWithWhisperLocal`: Uses the local `whisper` command-line tool.
    *   `transcribeWithWhisperAPI`: Uses the OpenAI Whisper API.
    *   `transcribeWithVosk`: Uses the local `vosk` Python library.
    *   `transcribeWithSystem`: A fallback/placeholder for system-level transcription.
*   **`detectWakeWord(text)`**: Checks if a wake word is present in the transcribed text (used for text-match engine or as a fallback).
*   **`processCommand(text, confidence)`**: Matches the transcribed text against registered `VoiceCommand` patterns and executes the corresponding handler.
*   **`registerCommand(command)`**: Allows external modules to register custom voice commands.
*   **`playFeedbackSound(type)`**: Plays short audio cues for events like listening start/stop, wake word detection, etc.
*   **`stopListening()` / `toggleListening()`**: Controls the listening state.
*   **`formatStatus()` / `formatCommandsHelp()`**: Provides formatted output for status and available commands.
*   **Configuration Persistence**: Loads and saves configuration to `~/.codebuddy/voice-control.json`.

**Data Structures:**

*   **`VoiceControlConfig`**: Configuration for the voice control system (enabled, wake word, continuous listening, language, VAD settings, provider, API keys, command timeout, feedback sounds).
*   **`VoiceControlState`**: Current state of the voice control system (listening, processing, wake word active, command history, error counts).
*   **`VoiceCommand`**: Defines a voice command with its name, aliases, description, regex pattern, and handler function.
*   **`VoiceCommandContext`**: Contextual information passed to command handlers (transcription, confidence, current file, selection, workspace root).
*   **`VoiceCommandResult`**: The result of a command execution (success, action, response, data, error).
*   **`TranscriptionResult`**: The result of an audio transcription (success, text, confidence, language, duration, error).

**Integration:**

The `VoiceControl` singleton is accessed via `getVoiceControl()` and is used by command handlers (e.g., `handleVoice`) to enable and manage voice interaction. It integrates with external `WakeWordDetector` and `VoiceActivityDetector` modules for advanced audio processing.

### 6. Voice Input Enhanced (`src/input/voice-input-enhanced.ts`)

This module provides a more general and robust voice-to-text recording and transcription manager, often used for push-to-talk or single-utterance transcription.

**Core Functionality:**

*   **`VoiceInputManager` Class**: Manages recording and transcription.
*   **`isAvailable()`**: Checks for required system tools (`sox`, `ffmpeg`, `whisper`) and API keys.
*   **`startRecording()`**: Starts recording audio using `sox` with silence detection for automatic stopping. Emits `audio-level` events for visual feedback.
*   **`stopRecording()`**: Manually stops the recording.
*   **`toggleRecording()`**: Toggles between recording and stopped states.
*   **`processAudio(audioFile)`**: Transcribes the recorded audio file using the configured provider.
*   **`transcribeWithWhisperLocal(audioFile)`**: Uses the local `whisper` command-line tool.
*   **`transcribeWithWhisperAPI(audioFile)`**: Uses the OpenAI Whisper API.
*   **`transcribeWithSystem(audioFile)`**: A placeholder for system-level speech recognition (currently limited on macOS).
*   **`enable()` / `disable()` / `setConfig()`**: Manages the module's configuration and state.
*   **`formatStatus()`**: Provides a formatted string showing the current voice input configuration and status.
*   **Configuration Persistence**: Loads and saves configuration to `~/.codebuddy/voice-config.json`.

**Data Structures:**

*   **`VoiceInputConfig`**: Configuration for the voice input manager (enabled, provider, language, model, API key, hotkey, auto-send, silence thresholds).
*   **`VoiceInputState`**: Current state (is recording, is processing, last transcription, error count).
*   **`TranscriptionResult`**: The result of an audio transcription.

**Integration:**

The `VoiceInputManager` singleton is accessed via `getVoiceInputManager()` and is used by command handlers (e.g., `handleVoice`) for general voice input. It's designed for scenarios where a user might press a hotkey, speak, and have their utterance transcribed.

### 7. Voice Input (Legacy) (`src/input/voice-input.ts`)

This module provides basic voice recording and transcription capabilities. While functional, `voice-input-enhanced.ts` (`VoiceInputManager`) offers a more feature-rich and actively developed alternative.

**Core Functionality:**

*   **`VoiceInput` Class**: Manages recording and transcription.
*   **`isAvailable()`**: Checks for basic recording tools (`sox`, `arecord`).
*   **`startRecording()`**: Starts recording audio. It also attempts to initialize `WakeWordDetector` and `VoiceActivityDetector` if environment variables are set, but this integration is less direct than in `voice-control.ts`.
*   **`stopRecording()`**: Stops the recording.
*   **`transcribe(audioFile)`**: Dispatches to configured transcription providers:
    *   `transcribeWithWhisper`: Uses OpenAI Whisper API.
    *   `transcribeWithDeepgram`: Uses Deepgram API.
    *   `transcribeWithSystem`: Attempts to use local `whisper.cpp`.
*   **`recordAndTranscribe(maxDuration)`**: A convenience method to start recording, wait for a stop (either manual or timeout), and then transcribe.
*   **`cleanup()`**: Removes temporary audio files.

**Data Structures:**

*   **`VoiceConfig`**: Configuration for the voice input (provider, API key, language, model).
*   **`TranscriptionResult`**: The result of an audio transcription.

**Integration:**

This module might be used in specific contexts where a simpler voice input mechanism is preferred, or for compatibility with older integrations. For new features requiring voice input, `VoiceInputManager` (from `voice-input-enhanced.ts`) is recommended.

## Integration and Usage

The `src/input` module's components are integrated throughout the application to provide a rich and flexible user experience:

*   **Agent Execution**: `agent/execution/agent-executor.ts` uses `processMentions` to expand user prompts with contextual information before sending them to the AI.
*   **Command Handlers**: `commands/handlers/voice-handlers.ts` interacts with `TextToSpeechManager`, `VoiceControl`, and `VoiceInputManager` to enable and manage voice-related commands (e.g., `/speak`, `/voice`).
*   **Autocomplete**: The `FileAutocomplete` is intended for use in CLI or UI components to provide interactive suggestions.
*   **Multimodal AI**: `MultimodalInputManager` prepares images for submission to AI models that support visual input.

## Configuration

Most components in the `src/input` module manage their own configuration, typically loaded from `~/.codebuddy/<component>-config.json` files and allowing overrides via environment variables or constructor parameters.

Common configuration aspects include:

*   **Enabled/Disabled State**: Toggling features like TTS or voice control.
*   **Providers**: Selecting between different backend services or local tools (e.g., Whisper API vs. local Whisper, Edge TTS vs. espeak).
*   **API Keys**: For external services like OpenAI Whisper, Deepgram, or Brave Search.
*   **Language/Model**: For transcription and TTS.
*   **Temporary Directories**: For storing audio files, screenshots, etc.

## Error Handling

Each component handles errors internally, often emitting `error` events or returning `MentionContext` objects with an `error` field. This prevents unhandled rejections and allows the calling code to gracefully handle failures (e.g., informing the user that a mention could not be resolved or that a voice command failed). The `getErrorMessage` utility from `src/types/index.js` is frequently used to standardize error messages.

## Contribution Guidelines

When contributing to the `src/input` module:

*   **New Mention Types**: If adding a new `@mention`, define a new regex pattern in `ContextMentionParser.patterns`, implement a `resolve<Type>` method, and add it to the `resolveMention` switch statement. Update `getHelp()` accordingly.
*   **New TTS/Voice Providers**: If adding a new TTS or voice transcription provider, implement a new `speakWith...` or `transcribeWith...` method, update the `isAvailable` check, and add it to the respective `switch` statement. Ensure proper error handling and cleanup of temporary files.
*   **Platform Compatibility**: Be mindful of platform-specific commands (macOS, Linux, Windows) when dealing with system interactions (screenshots, audio recording, clipboard). Use `os.platform()` and `spawn` with appropriate arguments.
*   **Resource Management**: Ensure that temporary files (audio recordings, screenshots) are properly cleaned up using `fs.remove` or `fs.unlinkSync` to prevent disk space issues.
*   **Configuration**: Follow the existing pattern of loading/saving configuration to `~/.codebuddy/` and allowing overrides.
*   **Testing**: Write unit tests for new functionality, especially for parsing logic, external command interactions, and error scenarios. Refer to existing tests in `tests/unit/context-mentions.test.ts`, `tests/input/multimodal-input.test.ts`, etc.