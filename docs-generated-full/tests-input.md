---
title: "tests — input"
module: "tests-input"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.911Z"
---
# tests — input

This document provides developer-focused documentation for the `src/input/multimodal-input.ts` module, which is responsible for managing multimodal input, primarily images, within the application. The functionality described is inferred from the provided test file `tests/input/multimodal-input.test.ts`.

## Multimodal Input Manager

The `multimodal-input` module provides a robust way to handle various forms of multimodal input, with a strong focus on image management. It allows the application to load, store, retrieve, and prepare images for use with AI models, while also detecting system capabilities related to multimodal interactions.

### Purpose

The primary goals of this module are:

1.  **Image Lifecycle Management**: Provide a centralized mechanism to load images from files, validate them, store them in memory, and prepare them for API consumption.
2.  **Capability Detection**: Determine the system's ability to perform multimodal operations such as taking screenshots, accessing the clipboard, performing OCR, and general image processing.
3.  **Configuration & Isolation**: Allow configuration of image handling parameters (e.g., temporary directory, max size, supported formats) and ensure a clean state for testing or different contexts.
4.  **Event-Driven Updates**: Notify other parts of the application about significant events, such as initialization completion or image loading/removal.
5.  **Singleton Access**: Provide a consistent, globally accessible instance of the manager.

### Key Components

The module exposes a class and two utility functions:

#### `MultimodalInputManager` Class

This is the core class responsible for all multimodal input operations.

*   **Constructor**:
    ```typescript
    new MultimodalInputManager(options: {
      tempDir: string;
      maxImageSize: number;
      supportedFormats: string[];
    });
    ```
    Initializes the manager with configuration options:
    *   `tempDir`: A directory for temporary file operations (e.g., for image processing).
    *   `maxImageSize`: The maximum allowed size for images in bytes.
    *   `supportedFormats`: An array of file extensions (e.g., `".png", ".jpg"`) that the manager will accept.

*   **`initialize(): Promise<Capabilities>`**
    Detects and caches the system's multimodal capabilities. This method should be called once at application startup.
    Returns a `Promise` that resolves with a `Capabilities` object, indicating whether `screenshotAvailable`, `clipboardAvailable`, `ocrAvailable`, and `imageProcessingAvailable` are true or false. Subsequent calls return the cached capabilities.

*   **`loadImageFile(filePath: string): Promise<Image>`**
    Loads an image from the specified file path.
    1.  Performs validation against `maxImageSize` and `supportedFormats`.
    2.  Reads the file, converts it to base64, and stores it internally with a unique ID.
    3.  Emits an `image:loaded` event.
    Throws an error if the file is not found, unsupported, or too large.

*   **`getImage(id: string): Image | undefined`**
    Retrieves a previously loaded image by its unique ID.

*   **`getAllImages(): Image[]`**
    Returns an array of all currently loaded images.

*   **`removeImage(id: string): boolean`**
    Removes a stored image by its ID.
    Emits an `image:removed` event if the image was successfully removed.
    Returns `true` if removed, `false` otherwise.

*   **`clearAll(): void`**
    Removes all currently loaded images from the manager's internal storage.

*   **`prepareForAPI(id: string): Promise<{ base64: string; mimeType: string }>`**
    Prepares a loaded image for submission to an external API. This typically involves retrieving its base64 encoded data and MIME type.
    Throws an error if the image ID is not found.

*   **`formatSummary(): string`**
    Generates a human-readable summary string of the manager's current state, including loaded images and detected capabilities. Useful for debugging or displaying status to the user.

*   **Event Emitter (`on` method)**
    The manager extends an event emitter, allowing other components to subscribe to important lifecycle events:
    *   `initialized`: Emitted after `initialize()` completes.
    *   `image:loaded`: Emitted when an image is successfully loaded via `loadImageFile()`. The event payload includes the `Image` object.
    *   `image:removed`: Emitted when an image is removed via `removeImage()`. The event payload includes the `Image` object that was removed.

#### `getMultimodalInputManager(): MultimodalInputManager`

This function provides access to a singleton instance of the `MultimodalInputManager`. It ensures that only one instance of the manager exists throughout the application, promoting consistent state management.

#### `resetMultimodalInputManager(): void`

This utility function clears the singleton instance, forcing `getMultimodalInputManager()` to create a new instance on its next call. This is primarily useful for testing or scenarios where a fresh, unconfigured manager is required.

### Image Lifecycle Flow

The following diagram illustrates the typical flow of an image through the `MultimodalInputManager`:

```mermaid
graph TD
    A[File Path] --> B{loadImageFile(filePath)}
    B -- Validation --> C{Image Data (base64, mimeType)}
    C --> D[Store Image (ID, metadata)]
    D --> E[Emit 'image:loaded' event]

    D -- Retrieve --> F{getImage(id)}
    D -- Prepare for API --> G{prepareForAPI(id)}
    G --> H[API Payload]

    D -- Remove --> I{removeImage(id)}
    I --> J[Emit 'image:removed' event]
    I --> K[Remove from storage]
```

### Integration and Usage

Other modules should interact with the `MultimodalInputManager` primarily through the `getMultimodalInputManager()` singleton accessor.

```typescript
import { getMultimodalInputManager } from "./multimodal-input";

async function setupMultimodalInput() {
  const manager = getMultimodalInputManager();

  // Configure the manager (typically done once at app startup)
  // Note: In a real app, configuration might come from a global config object
  // or be passed to the initial call of getMultimodalInputManager if it supports it.
  // For now, assume the singleton is initialized elsewhere or has default config.
  // The tests show configuration via constructor, implying the singleton might be
  // initialized with options or configured after creation.
  // For this example, we'll assume it's configured or uses defaults.

  // Initialize capabilities
  const capabilities = await manager.initialize();
  console.log("Multimodal capabilities:", capabilities);

  // Listen for events
  manager.on("image:loaded", (image) => {
    console.log(`Image loaded: ${image.id} (${image.source})`);
    // Update UI, log, etc.
  });

  manager.on("image:removed", (image) => {
    console.log(`Image removed: ${image.id}`);
    // Update UI, log, etc.
  });

  // Load an image from a file
  try {
    const image = await manager.loadImageFile("/path/to/my/image.png");
    console.log("Loaded image ID:", image.id);

    // Get all loaded images
    const allImages = manager.getAllImages();
    console.log("Total images loaded:", allImages.length);

    // Prepare an image for an API call
    const apiPayload = await manager.prepareForAPI(image.id);
    // Send apiPayload.base64 and apiPayload.mimeType to an AI model API

    // Get a summary of the current state
    console.log(manager.formatSummary());

    // Remove an image
    manager.removeImage(image.id);
  } catch (error) {
    console.error("Failed to handle image:", error);
  }
}

setupMultimodalInput();
```

### Configuration Considerations

When using `getMultimodalInputManager()`, it's important to understand how the singleton is initialized. The tests show the `MultimodalInputManager` constructor taking options (`tempDir`, `maxImageSize`, `supportedFormats`). In a production environment, these options would typically be provided once when the singleton is first created, or the singleton might have a `configure()` method. The current test structure implies that the singleton is either initialized with defaults or configured externally before `getMultimodalInputManager()` is first called. Developers should ensure the manager is configured appropriately for their application's needs.