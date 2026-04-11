---
title: "src — embeddings"
module: "src-embeddings"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.484Z"
---
# src — embeddings

The `src/embeddings` module is responsible for generating vector embeddings for various types of content, primarily text and multimodal (text + image). These embeddings are crucial for enabling semantic search, similarity comparisons, and Retrieval-Augmented Generation (RAG) within the application.

The module offers two main providers:
1.  **`EmbeddingProvider`**: For text-only embeddings, supporting local models, OpenAI, Grok, and mock implementations.
2.  **`MultimodalEmbeddingProvider`**: For embeddings that combine text and image inputs into a shared vector space, powered by Google's Gemini API.

## Core Concepts

**Vector Embeddings**: Numerical representations of text or other data, where semantically similar items are closer in the vector space.
**Providers**: Different services or models that generate these embeddings. The module abstracts away the specifics of each provider.
**Dimensions**: The length of the embedding vector. Different models produce embeddings of different dimensions.
**Cosine Similarity**: A common metric used to measure the similarity between two embedding vectors.

## Text Embedding Provider (`EmbeddingProvider`)

The `EmbeddingProvider` class is the primary interface for generating text embeddings. It supports multiple backend services, prioritizing local execution for privacy and cost efficiency.

### Overview

The `EmbeddingProvider` is an `EventEmitter` that manages the lifecycle and delegation of text embedding requests. It can be configured to use a local model (via `@xenova/transformers`), OpenAI's API, Grok's API, or a mock implementation for testing and fallback.

### Configuration (`EmbeddingConfig`)

The provider is configured using an `EmbeddingConfig` object, which allows specifying the desired provider, model, API keys, cache directories, and batch sizes.

```typescript
export type EmbeddingProviderType = 'local' | 'openai' | 'grok' | 'mock';

export interface EmbeddingConfig {
  provider: EmbeddingProviderType;
  modelName?: string; // e.g., 'Xenova/all-MiniLM-L6-v2', 'text-embedding-3-small'
  apiKey?: string;
  apiEndpoint?: string; // For custom API endpoints
  cacheDir?: string; // For local models
  batchSize?: number; // For local batch processing
}
```

A `DEFAULT_CONFIG` is provided, setting `local` as the default provider with the `Xenova/all-MiniLM-L6-v2` model.

### Initialization

The `EmbeddingProvider` requires explicit asynchronous initialization, especially when using local models.

-   **`initialize(): Promise<void>`**: This method ensures the provider is ready to generate embeddings. It's idempotent and handles concurrent initialization requests.
-   **`private doInitialize(): Promise<void>`**: The internal logic for initialization.
    -   If `provider` is `'local'`, it calls `initializeLocalModel()`.
    -   If `initializeLocalModel()` fails, the provider automatically falls back to the `'mock'` provider and logs a warning.
-   **`private initializeLocalModel(): Promise<void>`**:
    -   Creates the `cacheDir` if it doesn't exist.
    -   Dynamically imports `@xenova/transformers`.
    -   Sets `process.env.TRANSFORMERS_CACHE` to the configured `cacheDir`.
    -   Loads the `feature-extraction` pipeline with the specified `modelName` (default: `Xenova/all-MiniLM-L6-v2`).
    -   Throws an error if `@xenova/transformers` is not installed, providing a helpful installation message.

### Embedding Methods

-   **`embed(text: string): Promise<EmbeddingResult>`**: Generates an embedding for a single text string. It first ensures the provider is initialized, then delegates the request to the appropriate private method based on the configured `provider` type.
-   **`embedBatch(texts: string[]): Promise<BatchEmbeddingResult>`**: Generates embeddings for an array of text strings. Similar to `embed`, it initializes and delegates to the batch-specific private method. Local batch processing is optimized to run individual embeddings in parallel within configured `batchSize` chunks.

### Supported Providers

The `EmbeddingProvider` encapsulates the logic for interacting with different embedding sources:

-   **Local (`embedLocal`, `embedBatchLocal`)**:
    -   Uses the `@xenova/transformers` library to run models directly on the user's machine.
    -   Requires the `pipeline` to be initialized.
    -   Emits `batch:progress` events during batch processing.
-   **OpenAI (`embedOpenAI`, `embedBatchOpenAI`)**:
    -   Makes HTTP POST requests to the OpenAI embeddings API (`https://api.openai.com/v1/embeddings`).
    -   Requires an `apiKey` in the configuration.
    -   Supports models like `text-embedding-3-small`.
-   **Grok (`embedGrok`, `embedBatchGrok`)**:
    -   Makes HTTP POST requests to the Grok embeddings API (default: `https://api.x.ai/v1/embeddings`).
    -   Requires an `apiKey` (or `process.env.GROK_API_KEY`).
    -   Supports models like `grok-embedding`.
-   **Mock (`embedMock`, `embedBatchMock`)**:
    -   Generates deterministic, pseudo-random embeddings based on a hash of the input text.
    -   Useful for testing or as a fallback when other providers fail.

### Utility Methods

-   **`getDimensions(): number`**: Returns the expected dimensionality of the embeddings for the current model.
-   **`isReady(): boolean`**: Indicates whether the provider has been successfully initialized.
-   **`getProviderType(): EmbeddingProviderType`**: Returns the currently active embedding provider type.
-   **`cosineSimilarity(a: Float32Array, b: Float32Array): number`**: A static utility function to calculate the cosine similarity between two embedding vectors.

### Singleton Access

The module provides singleton functions to ensure a single instance of `EmbeddingProvider` is used throughout the application:

-   **`getEmbeddingProvider(config?: Partial<EmbeddingConfig>): EmbeddingProvider`**: Returns the singleton instance, creating it if it doesn't exist.
-   **`initializeEmbeddingProvider(config?: Partial<EmbeddingConfig>): Promise<EmbeddingProvider>`**: Gets the singleton and calls its `initialize()` method. This is the recommended way to get a ready-to-use provider.
-   **`resetEmbeddingProvider(): void`**: Resets the singleton instance (primarily for testing).

## Multimodal Embedding Provider (`MultimodalEmbeddingProvider`)

The `MultimodalEmbeddingProvider` class is designed for generating embeddings from both text and image inputs, placing them into a shared vector space. This enables powerful cross-modal search capabilities.

### Overview

This provider leverages Google's Gemini API (`gemini-embedding-2-preview`) to create multimodal embeddings. It takes base64-encoded images and text strings as input.

### Configuration (`MultimodalEmbeddingConfig`)

The `MultimodalEmbeddingProvider` is configured with an API key and optional model/dimensions:

```typescript
export interface MultimodalEmbeddingConfig {
  apiKey: string;
  model?: string; // Default: 'gemini-embedding-2-preview'
  dimensions?: number; // Default: 768
  baseUrl?: string; // Default: 'https://generativelanguage.googleapis.com/v1beta'
}
```

### Embedding Methods

-   **`embed(inputs: EmbeddingInput[]): Promise<MultimodalEmbeddingResult[]>`**: The core method for multimodal embeddings. It takes an array of `EmbeddingInput` objects (each specifying `type: 'text' | 'image'` and `content`) and sends them to the Gemini API's `batchEmbedContents` endpoint.
-   **`embedText(text: string): Promise<number[]>`**: A convenience method to embed a single text string.
-   **`embedImage(base64Data: string, mimeType: string = 'image/png'): Promise<number[]>`**: A convenience method to embed a single base64-encoded image.
-   **`getDimensions(): number`**: Returns the configured output dimensionality.
-   **`getModel(): string`**: Returns the configured Gemini model name.

### Singleton Access

-   **`getMultimodalEmbeddingProvider(): MultimodalEmbeddingProvider | null`**: Returns the singleton instance. It checks for `process.env.GEMINI_API_KEY` or `process.env.GOOGLE_API_KEY`. If no API key is found, it returns `null`, indicating that multimodal embeddings are unavailable.
-   **`resetMultimodalEmbeddingProvider(): void`**: Resets the singleton instance (primarily for testing).

## Module Exports (`index.ts`)

The `src/embeddings/index.ts` file serves as the public API for the module, re-exporting all essential classes, types, and singleton functions from both `embedding-provider.ts` and `multimodal-embedding-provider.ts`.

## Integration with the Codebase

This module is a foundational component for any feature requiring semantic understanding or similarity comparisons.

### How to Use

1.  **For Text Embeddings:**
    ```typescript
    import { initializeEmbeddingProvider } from './embeddings';

    async function getTextEmbedding(text: string) {
      const provider = await initializeEmbeddingProvider({ provider: 'openai', apiKey: process.env.OPENAI_API_KEY });
      const result = await provider.embed(text);
      console.log('Text embedding:', result.embedding);
    }
    ```
2.  **For Multimodal Embeddings:**
    ```typescript
    import { getMultimodalEmbeddingProvider } from './embeddings';

    async function getMultimodalEmbedding(text: string, imageData: string) {
      const provider = getMultimodalEmbeddingProvider();
      if (!provider) {
        console.warn('Multimodal embeddings not available (API key missing).');
        return;
      }
      const results = await provider.embed([
        { type: 'text', content: text },
        { type: 'image', content: imageData, mimeType: 'image/jpeg' }
      ]);
      console.log('Multimodal embeddings:', results);
    }
    ```

### Key Integrations

-   **`src/database/integration.ts`**: Used for indexing code chunks and memories, and for performing semantic searches against them.
-   **`src/memory/enhanced-memory.ts`**: Integrates `EmbeddingProvider` to generate embeddings for user memories, enabling semantic recall.
-   **`src/memory/ocr-memory-pipeline.ts`**: Utilizes both `EmbeddingProvider` (for text) and `MultimodalEmbeddingProvider` (for images) to process and embed content extracted from OCR.
-   **`src/memory/cross-modal-search.ts`**: Leverages `MultimodalEmbeddingProvider` to perform searches across different modalities (e.g., finding images based on text queries).
-   **`context/codebase-rag/codebase-rag.ts`**: Uses `EmbeddingProvider` to embed code files for RAG purposes.
-   **`src/services/prompt-builder.ts`**: Indirectly uses embeddings via `enhanced-memory` to retrieve relevant context for LLM prompts.

## Architecture Overview

The following diagram illustrates the high-level architecture of the embeddings module, showing how client code interacts with the two main providers and their underlying mechanisms.

```mermaid
graph TD
    subgraph Text Embeddings
        EP[EmbeddingProvider] --> EP_INIT(initialize);
        EP --> EP_EMBED(embed/embedBatch);
        EP_EMBED --> EP_LOCAL(embedLocal/Batch);
        EP_EMBED --> EP_OPENAI(embedOpenAI/Batch);
        EP_EMBED --> EP_GROK(embedGrok/Batch);
        EP_EMBED --> EP_MOCK(embedMock/Batch);
        EP_LOCAL -- uses --> TRANSFORMERS[@xenova/transformers];
        EP_OPENAI -- calls --> OPENAI_API[OpenAI API];
        EP_GROK -- calls --> GROK_API[Grok API];
    end

    subgraph Multimodal Embeddings
        MEP[MultimodalEmbeddingProvider] --> MEP_EMBED(embed);
        MEP_EMBED -- calls --> GEMINI_API[Gemini API];
    end

    Client[Client Code] --> EP;
    Client --> MEP;
```