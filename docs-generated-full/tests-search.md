---
title: "tests — search"
module: "tests-search"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.998Z"
---
# tests — search

This document provides an overview of the test suite for the search functionalities within the codebase, located in the `tests/search` directory. This module is crucial for ensuring the correctness, performance, and reliability of both lexical (BM25) and vector (USearch) search implementations.

The tests are organized into two primary files, each focusing on a distinct search paradigm:

*   `hybrid-search.test.ts`: Covers the BM25 lexical search index.
*   `usearch-index.test.ts`: Covers the USearch vector similarity index.

## BM25 Search Tests (`hybrid-search.test.ts`)

This test file validates the `BM25Index` class and its associated utility functions, which together provide a robust lexical search capability. It ensures that text processing (tokenization, stemming) and document indexing/retrieval work as expected.

### Overview

The tests in `hybrid-search.test.ts` interact directly with the `BM25Index` class and several helper functions imported from `src/search/bm25.js`. They cover the entire lifecycle of a BM25 index, from text preprocessing to document management and search queries.

### Core Functionality Tests

These tests focus on the fundamental operations of the BM25 search:

1.  **Tokenization**:
    *   `tokenize(text: string)`: Verifies that text is correctly broken down into words, converted to lowercase, and that common stopwords (e.g., "this", "is", "a") and short tokens (e.g., "b", "c") are removed.
    *   Handles edge cases like empty input strings.
2.  **Stemming**:
    *   `stem(word: string)`: Checks that words are reduced to their root forms (e.g., "running" -> "runn", "tests" -> "test").
3.  **Combined Tokenization and Stemming**:
    *   `tokenizeAndStem(text: string)`: Ensures the sequential application of tokenization and stemming produces the expected output.
4.  **`BM25Index` Operations**:
    *   **`addDocument(doc: BM25Document)` / `addDocuments(docs: BM25Document[])`**: Tests the ability to add single or multiple documents to the index. It also verifies that adding a document with an existing ID correctly updates its content without increasing the total document count.
    *   **`removeDocument(id: string)`**: Confirms that documents can be removed by their ID and that attempting to remove a non-existent document returns `false`.
    *   **`search(query: string, limit?: number)`**: This is the core search functionality.
        *   It verifies that relevant documents are found for a given query.
        *   It checks that more relevant documents are ranked higher.
        *   It handles cases with no matches or empty queries.
        *   It tests the `limit` parameter to restrict the number of results.
    *   **`getStats()`**: Ensures that the index accurately reports statistics such as `totalDocuments`, `avgDocLength`, and `uniqueTerms`.
    *   **`BM25Index.normalizeScores(results: BM25SearchResult[])`**: Tests the static utility method for normalizing search scores to a 0-1 range.

### Index Management Tests

This section validates the singleton pattern and lifecycle management for BM25 indexes:

*   **`getBM25Index(name: string)`**: Verifies that calling this function with the same name returns the same `BM25Index` instance, effectively managing named indexes as singletons.
*   **`removeBM25Index(name: string)`**: Tests the ability to remove a named index, ensuring that subsequent calls to `getBM25Index` for the same name return a new, empty index.
*   **`clearAllBM25Indexes()`**: Confirms that all managed BM25 indexes can be cleared, resetting their state.

## USearch Vector Index Tests (`usearch-index.test.ts`)

This test file is dedicated to validating the `USearchVectorIndex` class, which provides approximate nearest neighbor (ANN) search capabilities using the USearch library. It covers vector operations, persistence, and index management.

### Overview

The tests in `usearch-index.test.ts` interact with the `USearchVectorIndex` class and related functions from `src/search/usearch-index.js`. They ensure the correct behavior of vector indexing, similarity search, and the persistence mechanisms. The tests also verify event emission for various operations.

### Configuration and Initialization

*   **`DEFAULT_USEARCH_CONFIG`**: Verifies that the default configuration for USearch (dimensions, metric, dtype, connectivity, etc.) is as expected.
*   **`USearchVectorIndex` Constructor**: Tests the creation of an index with custom configuration parameters (e.g., `dimensions`, `metric`, `connectivity`).
*   **`initialize()`**: Ensures that the index can be initialized correctly and that subsequent calls to `initialize()` do not cause issues.

### Vector Operations (Add, Search, Remove)

These tests cover the core functionality of managing and querying vectors:

1.  **Adding Vectors**:
    *   **`add(vector: USearchVector)`**: Tests adding a single vector, including associated metadata. It verifies the index size and the presence of the vector.
    *   **`addBatch(vectors: USearchVector[])`**: Confirms the ability to add multiple vectors efficiently.
    *   Accepts both `number[]` and `Float32Array` for embeddings.
    *   **Event Emission**: Verifies that the `vectors:added` event is emitted with correct data after adding vectors.
2.  **Searching Vectors**:
    *   **`search(query: number[] | Float32Array, k: number)`**: Tests the similarity search functionality.
        *   Verifies finding exact matches and returning the `k` nearest neighbors.
        *   Ensures that more similar vectors are ranked higher.
        *   Confirms that metadata associated with vectors is included in search results.
    *   **`searchBatch(queries: (number[] | Float32Array)[], k: number)`**: Tests performing multiple searches in a single batch operation.
    *   **Event Emission**: Verifies that the `search:completed` event is emitted with relevant statistics after a search operation.
3.  **Removing Vectors**:
    *   **`remove(id: string)`**: Tests the removal of vectors by their ID and handles attempts to remove non-existent IDs.
    *   **Event Emission**: Verifies that the `vectors:removed` event is emitted after removing vectors.
4.  **Utility Methods**:
    *   **`has(id: string)`**: Checks if a vector with a given ID exists in the index.
    *   **`size()`**: Returns the current number of vectors in the index.
    *   **`getStats()`**: Provides detailed statistics about the index, including `size`, `dimensions`, `connectivity`, and `memoryUsage`.

### Persistence and Lifecycle

*   **`save(path?: string)`**: Tests the ability to save the index to disk, including its associated ID-to-key mappings. It also verifies error handling for missing paths.
*   **`load(path: string)`**: Tests loading an index from disk. Note that the current fallback implementation primarily loads mappings, while full vector restoration requires the native USearch library. It verifies error handling for non-existent files.
*   **Event Emission**: Verifies `index:saved` and `index:loaded` events.
*   **`clear()`**: Tests clearing all vectors from the index, resetting its state.
*   **`dispose()`**: Ensures proper cleanup and resource release when the index is no longer needed.

### Different Metrics

The tests confirm that `USearchVectorIndex` correctly operates with different similarity metrics:

*   **`'l2sq'` (L2 Squared Distance)**: Verifies that vectors closer in Euclidean space are ranked higher.
*   **`'ip'` (Inner Product)**: Verifies that vectors with a higher inner product are ranked higher.
*   **`'cos'` (Cosine Similarity)**: This is the default and is implicitly tested in many search scenarios.

### Singleton Management

Similar to BM25, USearch indexes can be managed as singletons:

*   **`getUSearchIndex(name: string, config?: USearchConfig)`**: Ensures that named USearch indexes are managed as singletons, returning the same instance for the same name. It also tests error handling when requesting a non-existent index without providing configuration.
*   **`removeUSearchIndex(name: string)`**: Verifies the removal of a named index.
*   **`clearAllUSearchIndexes()`**: Confirms that all managed USearch indexes can be cleared.

### Edge Cases

The tests cover various edge cases to ensure robustness:

*   Handling zero vectors.
*   Correctly processing negative embedding values.
*   Updating existing vectors when duplicate IDs are added.
*   Handling search queries where `k` (number of results) is larger than the total index size.

## Conclusion

The `tests/search` module provides comprehensive validation for both lexical and vector search capabilities. By thoroughly testing `BM25Index` and `USearchVectorIndex`, it ensures that these critical components of the search system are reliable, performant, and correctly integrated, covering everything from low-level text processing and vector operations to high-level index management and persistence. Developers contributing to the search functionality should refer to these tests to understand expected behavior and to add new tests for any new features or bug fixes.