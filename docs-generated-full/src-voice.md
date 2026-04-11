---
title: "src — voice"
module: "src-voice"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.796Z"
---
# src — voice

The `src/voice` module provides the foundational capabilities for voice interaction within the application, encompassing wake word detection, speech-to-text (STT) recognition, voice activity detection (VAD), and a high-level pipeline for voice-to-code functionality. It is designed to be modular, allowing different providers and detection methods to be swapped or configured.

## Core Concepts

The module is built around several key voice interaction concepts:

*   **Wake Word Detection (WWD)**: Identifies specific trigger phrases (e.g., "Hey Buddy") to activate the system.
*   **Speech Recognition (STT)**: Converts spoken audio into text. This module supports various cloud and local providers.
*   **Voice Activity Detection (VAD)**: Determines when speech is present in an audio stream, allowing the system to intelligently start and stop recording for STT.
*   **Voice-to-Code Pipeline**: An orchestration layer that uses STT to transcribe speech, then analyzes the transcription to determine if it's a command or code dictation.

## Module Structure

The `src/voice` directory is organized as follows:

*   `index.ts`: The main entry point, exporting all public interfaces, classes, and factory functions from the sub-modules.
*   `types.ts`: Centralized type definitions and default configurations for all voice-related features.
*   `wake-word.ts`: Implements the `WakeWordDetector` for wake word detection.
*   `speech-recognition.ts`: Implements the `SpeechRecognizer` for speech-to-text conversion.
*   `voice-activity.ts`: Implements the `VoiceActivityDetector` for identifying speech segments.
*   `voice-to-code.ts`: Provides the `VoiceToCodePipeline` for higher-level voice command and dictation processing.

## Key Components

### `WakeWordDetector` (`src/voice/wake-word.ts`)

The `WakeWordDetector` is responsible for identifying predefined wake words in an incoming audio stream. It prioritizes using the Picovoice Porcupine engine for robust, local wake word detection, but gracefully falls back to a text-matching approach if a Picovoice access key is not provided or if Porcupine initialization fails.

**Key Features:**

*   **Engine Selection**: Automatically attempts to initialize Porcupine if `PICOVOICE_ACCESS_KEY` is available, otherwise defaults to `text-match`. The `engine` can also be explicitly configured.
*   **Porcupine Integration**: Dynamically imports `@picovoice/porcupine-node` to process raw `Int16Array` audio frames. It maps configured wake words to Porcupine's built-in keywords or uses custom `.ppn` files.
*   **Text-Match Fallback**: In `text-match` mode, it relies on transcribed text (from a `SpeechRecognizer`) to detect wake words by checking for substring matches.
*   **Cooldown Mechanism**: Prevents rapid, repeated detections of the same wake word within a short period.
*   **Configuration**: Managed via `WakeWordConfig`, allowing customization of wake words, sensitivity, and engine.

**Usage:**

```typescript
import { createWakeWordDetector, DEFAULT_WAKE_WORD_CONFIG } from './voice/index.js';

const detector = createWakeWordDetector({
  wakeWords: ['hey buddy'],
  accessKey: process.env.PICOVOICE_ACCESS_KEY,
});

detector.on('detected', (detection) => {
  console.log(`Wake word detected: ${detection.wakeWord} at ${detection.timestamp}`);
});

await detector.start();
// In Porcupine mode, feed raw audio frames:
// detector.processFrame(audioFrameInt16Array);
// In text-match mode, feed transcribed text:
// detector.detectWakeWordText("hey buddy, how are you?");
```

### `SpeechRecognizer` (`src/voice/speech-recognition.ts`)

The `SpeechRecognizer` converts spoken audio into text using various backend providers. It acts as an `EventEmitter`, emitting `transcript` events when speech is recognized.

**Key Features:**

*   **Multi-Provider Support**: Configurable to use `whisper` (OpenAI API or local CLI), `google`, `azure`, or `deepgram` for transcription.
*   **Local Whisper Integration**:
    *   Can execute the `whisper` CLI tool locally (requires `whisper` to be installed and in `PATH`).
    *   Implements a **dual-model strategy** (`dualModel` config) to select between a fast, smaller model (e.g., `base`) for short utterances and a more accurate, larger model (e.g., `medium` or `large`) for longer recordings, optimizing for both speed and accuracy.
    *   Falls back to the OpenAI Whisper API if the local CLI fails or is not preferred, and an `apiKey` is provided.
*   **Audio Buffering**: Collects audio chunks between `startListening()` and `stopListening()` calls, then transcribes the accumulated audio.
*   **Configuration**: Managed via `SpeechRecognitionConfig`, including provider, language, API keys, vocabulary hints, and duration limits.
*   **Events**: Emits `listening-started`, `listening-stopped`, `transcript` (with `TranscriptResult`), `error`, and `processing-complete`.

**Usage:**

```typescript
import { createSpeechRecognizer, DEFAULT_SPEECH_RECOGNITION_CONFIG } from './voice/index.js';

const recognizer = createSpeechRecognizer({
  provider: 'whisper',
  language: 'en-US',
  apiKey: process.env.OPENAI_API_KEY,
  dualModel: {
    enabled: true,
    durationThreshold: 20, // seconds
    fastModel: 'base',
    accurateModel: 'medium',
  },
});

recognizer.on('transcript', (result) => {
  if (result.isFinal) {
    console.log(`Final transcript: ${result.text}`);
  }
});

recognizer.on('error', (error) => {
  console.error('Speech recognition error:', error);
});

await recognizer.startListening();
// Feed audio chunks (e.g., from a microphone stream)
// recognizer.processAudio(audioBuffer);
// ...
await recognizer.stopListening(); // Triggers transcription of buffered audio
```

#### Speech Recognition Call Flow

The `transcribe` method is central to the `SpeechRecognizer`, dispatching to the appropriate provider. The `transcribeLocal` method further illustrates the dual-model strategy and fallback logic.

```mermaid
graph TD
    A[SpeechRecognizer.transcribe(audio)] --> B{config.provider?};
    B -- whisper --> C[transcribeWithWhisper(audio)];
    B -- google --> D[transcribeWithGoogle(audio)];
    B -- azure --> E[transcribeWithAzure(audio)];
    B -- deepgram --> F[transcribeWithDeepgram(audio)];
    B -- local/default --> G[transcribeLocal(audio)];

    G --> H{isLikelyWav(audio)?};
    H -- Yes --> I[transcribeWithLocalWhisperCli(audio)];
    I -- Success --> J[Return TranscriptResult];
    I -- Failure --> K{config.apiKey?};
    K -- Yes --> C;
    K -- No --> L[Return empty TranscriptResult];
    H -- No --> K;

    I --> M[selectModelForDuration(audio.length)];
```

### `VoiceActivityDetector` (`src/voice/voice-activity.ts`)

The `VoiceActivityDetector` analyzes incoming audio frames to determine if speech is present. It uses an energy-based detection method with adaptive thresholding to distinguish speech from background noise.

**Key Features:**

*   **Energy-Based Detection**: Calculates the Root Mean Square (RMS) energy of audio frames.
*   **Adaptive Thresholding**: Maintains a history of audio energy to dynamically adjust `noiseFloor` and `speechThreshold`, making it more resilient to varying noise environments.
*   **Speech State Management**: Tracks `speechStartTime` and `silenceStartTime` to confirm speech start and end events based on configured thresholds and durations (`minSpeechDuration`, `maxSilenceDuration`).
*   **Events**: Emits `speech-start` and `speech-end` events when voice activity changes.
*   **Configuration**: Managed via `VADConfig`, allowing fine-tuning of thresholds, padding, and durations.

**Note**: The current implementation uses a basic energy-based approach. For production-grade accuracy, integrating more advanced VAD libraries like WebRTC VAD or Silero VAD would be beneficial.

**Usage:**

```typescript
import { createVADDetector, DEFAULT_VAD_CONFIG } from './voice/index.js';

const vad = createVADDetector({
  enabled: true,
  speechStartThreshold: 0.6,
  maxSilenceDuration: 1000,
});

vad.on('speech-start', (event) => {
  console.log(`Speech started at ${event.positionMs}ms`);
});

vad.on('speech-end', (event) => {
  console.log(`Speech ended at ${event.positionMs}ms`);
});

// In a real scenario, audio frames would come from a microphone
// For example, a 16kHz, 16-bit mono audio frame
// vad.processFrame(audioFrameBuffer);
```

### `VoiceToCodePipeline` (`src/voice/voice-to-code.ts`)

The `VoiceToCodePipeline` orchestrates the speech recognition process and adds an intent detection layer. It listens for transcriptions, then classifies them as either a "command" (e.g., "run tests") or "dictation" (e.g., code snippets).

**Key Features:**

*   **STT Orchestration**: Dynamically imports and configures a `SpeechRecognizer` based on its own `sttProvider` setting.
*   **Intent Detection**: Uses a set of `COMMAND_PATTERNS` (regular expressions) to classify transcribed text.
*   **Graceful Degradation**: If the underlying STT modules (e.g., local Whisper CLI, Picovoice) are not available or fail to initialize, it emits an `error` event with helpful setup instructions.
*   **Events**: Emits `transcription` (raw text), `command` (for detected commands), `dictation` (for code dictation), `error`, and `status`.
*   **Configuration**: Managed via `VoiceCodeConfig`, including `sttProvider`, `language`, and `autoExecute`.

**Usage:**

```typescript
import { createVoiceToCodePipeline } from './voice/index.js';

const pipeline = createVoiceToCodePipeline({
  sttProvider: 'whisper',
  language: 'en-US',
  autoExecute: false,
});

pipeline.on('transcription', (text) => {
  console.log(`Raw transcription: "${text}"`);
});

pipeline.on('command', (commandText) => {
  console.log(`Detected command: "${commandText}" - Executing...`);
  // Logic to execute the command
});

pipeline.on('dictation', (dictationText) => {
  console.log(`Detected dictation: "${dictationText}" - Inserting into editor...`);
  // Logic to insert dictation into code editor
});

pipeline.on('error', (error) => {
  console.error('Voice-to-Code Pipeline Error:', error.message);
});

await pipeline.start();
// The pipeline internally manages the SpeechRecognizer and its audio input.
// You would typically feed audio to the underlying SpeechRecognizer instance
// or a higher-level audio input module that connects to it.
// For example, if a microphone stream is active, the SpeechRecognizer
// would receive audio and emit transcripts.
```

#### Voice-to-Code Pipeline Flow

```mermaid
graph TD
    A[VoiceToCodePipeline.start()] --> B{Dynamic Import SpeechRecognizer};
    B -- Success --> C[SpeechRecognizer.startListening()];
    C --> D[SpeechRecognizer.on('transcript')];
    D --> E{isFinal?};
    E -- Yes --> F[emit 'transcription'];
    F --> G[detectIntent(text)];
    G -- 'command' --> H[emit 'command'];
    G -- 'dictation' --> I[emit 'dictation'];
    B -- Failure --> J[getSetupInstructions()];
    J --> K[emit 'error'];
```

## Integration & Usage

The components in the `src/voice` module are designed to be integrated into a larger voice control system. For example, `src/input/voice-control.ts` and `src/input/voice-input.ts` are known consumers of these modules.

A typical integration flow might look like this:

1.  **Audio Input**: An audio input module (e.g., from `src/input/`) captures raw microphone audio.
2.  **VAD**: The `VoiceActivityDetector` processes audio frames to identify speech segments.
3.  **Wake Word**: The `WakeWordDetector` (in Porcupine mode) continuously processes audio frames to detect a wake word. If in `text-match` mode, it would receive transcripts from the `SpeechRecognizer`.
4.  **Speech Recognition**: When a wake word is detected, or a push-to-talk button is pressed, or VAD indicates speech, the `SpeechRecognizer` is activated to transcribe the audio.
5.  **Voice-to-Code Pipeline**: The `VoiceToCodePipeline` consumes the `SpeechRecognizer`'s output, classifies the intent, and triggers appropriate actions (e.g., executing a command, inserting code).

## Configuration (`src/voice/types.ts`)

The `types.ts` file defines all configuration interfaces and their default values, ensuring consistency and ease of customization across the voice module.

Key configuration interfaces include:

*   `WakeWordConfig`: For `WakeWordDetector`.
*   `SpeechRecognitionConfig`: For `SpeechRecognizer`.
*   `VADConfig`: For `VoiceActivityDetector`.
*   `VoiceSessionConfig`: A higher-level configuration that bundles the above for a complete voice session.
*   `AudioStreamConfig`: Defines parameters for audio input streams.

Developers should refer to `types.ts` for a complete list of configurable options and their default values.

## Error Handling & Fallbacks

The module is designed with robustness in mind:

*   **Dynamic Imports**: Native dependencies like `@picovoice/porcupine-node` are dynamically imported, allowing the module to load even if these dependencies are not installed, and then provide specific error messages.
*   **Provider Fallbacks**: `WakeWordDetector` falls back to `text-match` if Porcupine fails. `SpeechRecognizer`'s `local` provider falls back to OpenAI API if the local Whisper CLI is unavailable.
*   **Setup Instructions**: The `VoiceToCodePipeline` provides detailed setup instructions via its `error` event if required STT components are missing, guiding developers on how to resolve common issues.