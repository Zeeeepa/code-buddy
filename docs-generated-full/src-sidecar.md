---
title: "src-sidecar"
module: "src-sidecar"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.716Z"
---
# src-sidecar

The `codebuddy-sidecar` module is a native Rust application designed to extend the capabilities of a client application (e.g., a web application or desktop client) by providing local, high-performance functionalities that are typically difficult or inefficient to implement directly in the client. It acts as a bridge, communicating via a simple JSON-RPC protocol over standard input/output.

Its primary functions are:
1.  **Local Speech-to-Text (STT):** Leveraging `whisper-rs` for efficient, offline transcription using pre-trained Whisper models.
2.  **Desktop Automation:** Interacting with the operating system's clipboard and simulating keyboard input using `arboard` and `enigo`.

## Architecture Overview

The `codebuddy-sidecar` operates as a standalone process, communicating with a parent "Client Application" (e.g., a web app, Electron app, or another native process) via newline-delimited JSON-RPC messages over `stdin` and `stdout`.

```mermaid
graph TD
    A[Client Application] -->|JSON-RPC Request (stdin)| B(codebuddy-sidecar)
    B -->|JSON-RPC Response (stdout)| A
    B --&gt;|Desktop Automation (enigo, arboard)| C[Operating System / Hardware]
    B --&gt;|STT (whisper-rs)| D[Whisper Model Files]
```

This design allows the client application to offload computationally intensive tasks (like STT) or privileged operations (like desktop automation) to a robust native process, receiving structured JSON responses.

## Communication Protocol (JSON-RPC)

The sidecar implements a simplified JSON-RPC protocol. Each request and response is a single JSON object, terminated by a newline character.

### Request Format

Requests are sent by the client application to the sidecar's `stdin`.

```json
{
    "id": 1,
    "method": "stt.transcribe",
    "params": {
        "audio_b64": "...",
        "language": "en"
    }
}
```

*   `id`: A unique identifier for the request. This ID is echoed in the response.
*   `method`: A string indicating the method to call (e.g., `"stt.transcribe"`, `"desktop.paste"`).
*   `params`: A JSON object containing method-specific parameters.

### Response Format

Responses are sent by the sidecar to the client application's `stdout`.

**Success Response:**
```json
{
    "id": 1,
    "result": {
        "text": "Hello world",
        "duration_secs": 1.2,
        "model_used": "base.en"
    }
}
```

*   `id`: The ID from the corresponding request.
*   `result`: A JSON object containing the method's return value.

**Error Response:**
```json
{
    "id": 1,
    "error": "Model file not found: /path/to/model.bin"
}
```

*   `id`: The ID from the corresponding request.
*   `error`: A string describing the error that occurred.

## Modules

The `codebuddy-sidecar` is organized into two primary modules: `stt` for Speech-to-Text and `desktop` for desktop automation. The `main` module handles the JSON-RPC communication and dispatches requests.

### `src/main.rs` - Main Entry Point

The `main` function in `src/main.rs` is the entry point of the sidecar. It continuously reads lines from `stdin`, parses them as `Request` objects, dispatches the calls to the appropriate module functions, and writes the `Response` (either `result` or `error`) to `stdout`.

It initializes a shared `stt::SttState` instance to manage Whisper model contexts across requests.

**Supported Meta Methods:**

*   `ping`: Returns `{"pong": true}`. Useful for checking if the sidecar is alive.
*   `version`: Returns information about the sidecar, including its name, version, and supported features.

### `src/stt.rs` - Speech-to-Text Module

This module provides local Speech-to-Text capabilities using the `whisper-rs` Rust bindings for OpenAI's Whisper model. It implements a dual-model strategy to optimize for both speed and accuracy based on audio duration.

#### `SttState`

The `SttState` struct manages the loaded Whisper models. It holds two `WhisperContext` instances, `fast_ctx` and `accurate_ctx`, protected by `Mutex`es for thread-safe access. This allows for loading and switching between different models (e.g., a smaller, faster model for short phrases and a larger, more accurate model for longer dictations).

```mermaid
graph TD
    A[SttState] --> B{fast_ctx: Mutex<Option<WhisperContext>>}
    A --> C{accurate_ctx: Mutex<Option<WhisperContext>>}
    B --> D[WhisperContext (e.g., base.en)]
    C --> E[WhisperContext (e.g., large-v3)]
```

#### Methods

All `stt` methods are called on the `SttState` instance.

##### `stt.load_model`

Loads a Whisper model from a specified path into either the "fast" or "accurate" slot.

*   **Parameters (`LoadModelParams`):**
    *   `path` (String, required): The file path to the Whisper model (`.bin` file).
    *   `slot` (String, optional): `"fast"` or `"accurate"`. If omitted, the slot is inferred from the model filename (e.g., "base" or "small" implies "fast", otherwise "accurate").
*   **Returns:** `{"loaded": "model_name", "slot": "fast"}`
*   **Example:**
    ```json
    {"id": 1, "method": "stt.load_model", "params": {"path": "/path/to/whisper-base.en.bin", "slot": "fast"}}
    ```

##### `stt.transcribe`

Transcribes base64-encoded WAV audio data. It automatically selects between the "fast" and "accurate" models based on the audio duration and a configurable threshold.

*   **Parameters (`TranscribeParams`):**
    *   `audio_b64` (String, required): Base64-encoded WAV audio data. The audio must be 16kHz, 16-bit PCM.
    *   `language` (String, optional): The language code (e.g., `"en"`, `"fr"`). Use `"auto"` or omit for auto-detection.
    *   `duration_threshold` (f32, optional): Audio duration in seconds. If the audio is longer than this, the "accurate" model is preferred. Defaults to `20.0`.
*   **Returns:**
    ```json
    {
        "text": "The transcribed text.",
        "segments": [
            {"text": "The", "start": 0.0, "end": 0.2},
            {"text": "transcribed", "start": 0.2, "end": 0.8},
            {"text": "text.", "start": 0.8, "end": 1.2}
        ],
        "duration_secs": 1.2,
        "processing_ms": 150,
        "model_used": "base.en",
        "model_slot": "fast"
    }
    ```
*   **Example:**
    ```json
    {"id": 2, "method": "stt.transcribe", "params": {"audio_b64": "UklGRiQAAABXQVZFZm10IBAA...", "language": "en"}}
    ```

##### `stt.list_models`

Returns the names of the models currently loaded in the "fast" and "accurate" slots.

*   **Returns:** `{"fast": "base.en", "accurate": "large-v3"}` (or `null` if a slot is empty).
*   **Example:**
    ```json
    {"id": 3, "method": "stt.list_models", "params": {}}
    ```

##### `stt.status`

Checks if models are loaded and if the STT system is ready for transcription.

*   **Returns:** `{"fast_loaded": true, "accurate_loaded": false, "ready": true}`
*   **Example:**
    ```json
    {"id": 4, "method": "stt.status", "params": {}}
    ```

#### Helper Functions

*   `base64_decode(input: &str) -> Result<Vec<u8>, String>`: A simple, internal base64 decoder used for audio data.
*   `decode_wav_to_pcm(wav_data: &[u8]) -> Result<Vec<f32>, String>`: Decodes WAV audio bytes into a vector of `f32` PCM samples, converting stereo to mono if necessary. Uses the `hound` crate.
*   `get_n_threads() -> i32`: Determines the number of threads to use for Whisper transcription, based on available parallelism.

### `src/desktop.rs` - Desktop Automation Module

This module provides cross-platform desktop automation functionalities, including clipboard manipulation and keyboard input simulation. It uses the `arboard` crate for clipboard access and `enigo` for keyboard events.

#### Methods

All `desktop` methods are standalone public functions.

##### `desktop.paste`

Pastes text into the currently focused application. It can use the system clipboard (Ctrl+V) or simulate typing.

*   **Parameters (`PasteParams`):**
    *   `text` (String, required): The text to paste.
    *   `method` (String, optional): `"clipboard"` (default, uses Ctrl+V), `"type"` (simulates typing), or `"none"` (sets clipboard but does not paste).
    *   `auto_submit` (bool, optional): If `true`, presses Enter after pasting. Defaults to `false`.
*   **Returns:** `{"pasted": true, "method": "clipboard"}`
*   **Example:**
    ```json
    {"id": 5, "method": "desktop.paste", "params": {"text": "Hello from Code Buddy!", "auto_submit": true}}
    ```

##### `desktop.type_text`

Types text directly by simulating individual key presses. This method is slower than `paste` but can be useful in contexts where clipboard pasting is not reliable.

*   **Parameters (`TypeTextParams`):**
    *   `text` (String, required): The text to type.
*   **Returns:** `{"typed": true, "length": 22}`
*   **Example:**
    ```json
    {"id": 6, "method": "desktop.type_text", "params": {"text": "This is typed."}}
    ```

##### `desktop.key_press`

Simulates pressing a specific key or a key combination (e.g., Ctrl+C).

*   **Parameters (`KeyPressParams`):**
    *   `key` (String, required): The main key to press (e.g., `"enter"`, `"c"`, `"f5"`).
    *   `modifiers` (Array<String>, optional): A list of modifier keys (e.g., `"ctrl"`, `"shift"`, `"alt"`, `"meta"`).
*   **Returns:** `{"pressed": true, "key": "c"}`
*   **Example:**
    ```json
    {"id": 7, "method": "desktop.key_press", "params": {"key": "c", "modifiers": ["ctrl"]}}
    ```

##### `desktop.clipboard_get`

Retrieves the current content of the system clipboard.

*   **Returns:** `{"text": "Clipboard content"}`
*   **Example:**
    ```json
    {"id": 8, "method": "desktop.clipboard_get", "params": {}}
    ```

##### `desktop.clipboard_set`

Sets the content of the system clipboard.

*   **Parameters (`ClipboardSetParams`):**
    *   `text` (String, required): The text to place on the clipboard.
*   **Returns:** `{"set": true}`
*   **Example:**
    ```json
    {"id": 9, "method": "desktop.clipboard_set", "params": {"text": "New clipboard text"}}
    ```

#### Helper Functions

*   `parse_modifier(name: &str) -> Result<enigo::Key, String>`: Converts a string modifier name (e.g., "ctrl", "shift") into an `enigo::Key` enum variant.
*   `parse_key(name: &str) -> Result<enigo::Key, String>`: Converts a string key name (e.g., "enter", "a") into an `enigo::Key` enum variant.

## Building and Running

The `codebuddy-sidecar` is a standard Rust binary.

To build the release version:
```bash
cargo build --release
```
The executable will be located at `target/release/codebuddy-sidecar`.

To run and test it manually (e.g., with a single request):
```bash
echo '{"id": 1, "method": "ping", "params": {}}' | target/release/codebuddy-sidecar
```
Or, for continuous interaction:
```bash
target/release/codebuddy-sidecar
# Then type JSON requests followed by a newline, e.g.:
# {"id": 1, "method": "version", "params": {}}
# {"id": 2, "method": "stt.load_model", "params": {"path": "/path/to/whisper-base.en.bin"}}
```

## Contribution Guidelines

When contributing to `codebuddy-sidecar`:

*   **Adhere to JSON-RPC:** Ensure all new methods follow the `{"id": N, "method": "module.action", "params": {...}}` request and `{"id": N, "result": {...}}` or `{"id": N, "error": "..."}` response structure.
*   **Error Handling:** Use Rust's `Result<T, String>` for all public API functions to propagate errors as descriptive strings back to the client.
*   **Concurrency:** Be mindful of shared state, especially within the `stt` module. `Mutex`es are used for `WhisperContext` instances to ensure thread safety.
*   **Dependencies:** Prefer minimal and well-maintained crates.
*   **Cross-Platform:** Ensure any new desktop automation features are tested and function correctly across Windows, macOS, and Linux, as `enigo` and `arboard` aim for cross-platform compatibility.