/**
 * Embeddings Module
 *
 * Vector embedding generation for semantic search and similarity.
 *
 * Supports:
 * - Local model (@xenova/transformers - all-MiniLM-L6-v2)
 * - OpenAI API (text-embedding-3-small, text-embedding-ada-002)
 * - CodeBuddy API (when available)
 * - Mock embeddings (for testing)
 */

export {
  EmbeddingProvider,
  EmbeddingProviderType,
  EmbeddingConfig,
  EmbeddingResult,
  BatchEmbeddingResult,
  getEmbeddingProvider,
  initializeEmbeddingProvider,
  resetEmbeddingProvider,
} from './embedding-provider.js';

// Multimodal Embeddings (Gemini — text + image in shared vector space)
export {
  MultimodalEmbeddingProvider,
  getMultimodalEmbeddingProvider,
  resetMultimodalEmbeddingProvider,
  type EmbeddingInput,
  type EmbeddingResult as MultimodalEmbeddingResult,
  type MultimodalEmbeddingConfig,
} from './multimodal-embedding-provider.js';
