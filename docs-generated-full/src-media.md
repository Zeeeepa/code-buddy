---
title: "src — media"
module: "src-media"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.573Z"
---
# src — media

The `src/media/media-pipeline.ts` module provides a robust and configurable pipeline for handling temporary media files within the application. Its primary purpose is to safely ingest, store, manage, and process various media types, ensuring adherence to size limits and offering automatic cleanup mechanisms.

This module is crucial for features that involve receiving or generating media (e.g., images, audio, video, documents) that need temporary storage and potential processing before being used or discarded.

## Core Concepts

The module revolves around a few key interfaces and the central `MediaPipeline` class:

*   **`MediaFile`**: Represents an ingested media file. It stores metadata like its unique `id`, `originalPath`, `tempPath` (where it's stored in the pipeline's temporary directory), `type`, `mimeType`, `sizeBytes`, `createdAt` timestamp, and a generic `metadata` object for additional information.
*   **`MediaType`**: A union type (`'image' | 'audio' | 'video' | 'document' | 'unknown'`) used to classify media files based on their extension.
*   **`MediaPipelineConfig`**: Defines the operational parameters for the pipeline, including:
    *   `tempDir`: The directory for storing temporary media files.
    *   `maxFileSizeMb`: Maximum allowed size for a single ingested file.
    *   `maxTotalSizeMb`: Maximum cumulative size of all files managed by the pipeline.
    *   `autoCleanupMs`: How long a file persists before being automatically removed.
    *   `allowedTypes`: A whitelist of `MediaType`s that the pipeline will accept.
*   **`TranscriptionHook`**: An interface for extending the pipeline's processing capabilities. Hooks can be registered to perform specific actions (e.g., transcription, analysis) on certain `MediaType`s.

## The `MediaPipeline` Class

The `MediaPipeline` class is the central component, extending Node.js's `EventEmitter` to signal important lifecycle events.

### 1. Initialization and Configuration

The `MediaPipeline` is initialized with an optional configuration object. If not provided, `DEFAULT_CONFIG` is used.

```typescript
const pipeline = new MediaPipeline({
  tempDir: './my-app-media-cache',
  maxFileSizeMb: 50,
  allowedTypes: ['image', 'audio'],
});
```

Upon instantiation:
*   It ensures the `tempDir` exists, creating it recursively if necessary.
*   It sets up an internal `setInterval` timer to periodically call the `cleanup()` method based on `autoCleanupMs`.

### 2. Media Ingestion

The `ingest(filePath: string)` method is the primary way to add files to the pipeline.

```typescript
graph TD
    A[External File Path] --> B{MediaPipeline.ingest()};
    B --> C{File Exists?};
    C -- No --> E[Return Error: Not Found];
    C -- Yes --> D{Size & Total Size Limits?};
    D -- Exceeded --> E;
    D -- OK --> F{Detect Type & Allowed?};
    F -- Not Allowed --> E;
    F -- Allowed --> G[Generate UUID & Temp Path];
    G --> H[Copy File to Temp Dir];
    H --> I[Create MediaFile Object];
    I --> J[Store MediaFile & Update Total Size];
    J --> K[Emit 'ingested' Event];
    K --> L[Return MediaFile];
```

**Ingestion Flow:**
1.  **Validation**: Checks if the `filePath` exists, if its size exceeds `maxFileSizeMb`, and if adding it would exceed `maxTotalSizeMb`.
2.  **Type Detection**: Uses `MediaPipeline.detectType()` to determine the `MediaType` based on the file extension and verifies it against `allowedTypes`.
3.  **Temporary Storage**: Generates a unique ID (`randomUUID`) and a temporary path within `tempDir`. The file is then copied to this temporary location.
4.  **`MediaFile` Creation**: A `MediaFile` object is created, storing all relevant information.
5.  **Internal Tracking**: The `MediaFile` is stored in an internal `Map` keyed by its `id`, and the `totalSize` is updated.
6.  **Event Emission**: An `ingested` event is emitted with the `MediaFile` object.

### 3. Media Retrieval and Management

*   **`get(id: string)`**: Retrieves a `MediaFile` object by its unique ID.
*   **`list(type?: MediaType)`**: Returns an array of all `MediaFile` objects currently in the pipeline. Optionally filters by `MediaType`.
*   **`remove(id: string)`**: Deletes a `MediaFile` from the pipeline. This involves:
    *   Deleting the temporary file from the filesystem.
    *   Updating the `totalSize`.
    *   Removing the `MediaFile` from the internal map.
    *   Emitting a `removed` event with the `id`.

### 4. Extending Functionality with Hooks

The pipeline supports custom processing logic through `TranscriptionHook`s.

*   **`registerHook(hook: TranscriptionHook)`**: Adds a hook to the pipeline. Hooks are simple objects with a `name`, an array of `mediaTypes` they apply to, and an asynchronous `process` function.
*   **`processHooks(id: string)`**: Executes all registered hooks that are relevant to the `MediaType` of the specified `MediaFile`. The `process` function of each matching hook is called with the `MediaFile` object, and its string result (if any) is collected.

```typescript
interface MyTranscriptionHook extends TranscriptionHook {
  name: 'audio-transcriber';
  mediaTypes: ['audio'];
  process: async (file: MediaFile) => {
    // Call an external transcription service
    const transcription = await transcribeAudio(file.tempPath);
    return transcription;
  };
}

pipeline.registerHook(new MyTranscriptionHook());
const results = await pipeline.processHooks(audioFile.id);
// results might contain the transcription string
```

### 5. Automatic Cleanup and Disposal

*   **`cleanup()`**: This method is called periodically by the internal timer. It iterates through all stored `MediaFile`s and removes any that are older than `autoCleanupMs`. It emits a `cleanup` event with the number of files removed.
*   **`dispose()`**: Shuts down the pipeline gracefully. It clears the cleanup timer, deletes all remaining temporary files, clears the internal file map, and removes all event listeners. This should be called when the pipeline is no longer needed to prevent resource leaks.

### 6. Event Emitter

`MediaPipeline` extends `EventEmitter` and emits the following events:

*   **`ingested`**: Fired when a new `MediaFile` has been successfully added to the pipeline.
    *   Payload: `MediaFile`
*   **`removed`**: Fired when a `MediaFile` has been explicitly removed.
    *   Payload: `string` (the ID of the removed file)
*   **`cleanup`**: Fired after the `cleanup()` method has removed one or more files.
    *   Payload: `number` (the count of files removed during the cleanup cycle)

## Static Utility Methods

The `MediaPipeline` class provides two static helper methods for type detection:

*   **`static detectType(filePath: string): MediaType`**: Determines the `MediaType` of a file based on its extension, using the `EXTENSION_TYPE_MAP`. Returns `'unknown'` if the extension is not recognized.
*   **`static detectMimeType(filePath: string): string`**: Determines the MIME type of a file based on its extension, using the `EXTENSION_MIME_MAP`. Returns `'application/octet-stream'` if the extension is not recognized.

## Internal Mappings

The module uses two internal constant maps for efficient type and MIME type detection:

*   **`EXTENSION_TYPE_MAP`**: Maps common file extensions (e.g., `.png`, `.mp3`, `.pdf`) to their corresponding `MediaType`.
*   **`EXTENSION_MIME_MAP`**: Maps common file extensions to their standard MIME types (e.g., `image/png`, `audio/mpeg`, `application/pdf`).

## Integration with the System

Based on the call graph, the `MediaPipeline` module is integrated as follows:

*   **Incoming Calls**:
    *   **`protocols/acp/acp-server.ts`**: This is a significant integration point. The `createACPServerRoutes` function calls `pipeline.ingest()`, indicating that the Agent Communication Protocol (ACP) server uses this pipeline to handle incoming media files, likely from agents or other services.
    *   **`tests/media/media-pipeline.test.ts`**: As expected, the test suite extensively interacts with all public methods of `MediaPipeline` to ensure its correctness.

*   **Outgoing Calls**:
    The `MediaPipeline` module does not make explicit outgoing calls to other application modules. Its interactions are primarily internal (e.g., `ingest` calling `detectType`) and through its `EventEmitter` interface, allowing other parts of the system to react to media lifecycle events. This design promotes loose coupling, where the pipeline manages media, and other modules subscribe to its events for further processing or UI updates.