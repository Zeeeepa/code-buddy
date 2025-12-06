/**
 * Embeddings Module
 *
 * Vector embedding generation for semantic search and similarity.
 *
 * Supports:
 * - Local model (@xenova/transformers - all-MiniLM-L6-v2)
 * - OpenAI API (text-embedding-3-small, text-embedding-ada-002)
 * - Grok API (when available)
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
