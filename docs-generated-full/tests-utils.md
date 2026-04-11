---
title: "tests — utils"
module: "tests-utils"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:28.054Z"
---
# tests — utils

This document provides an overview of the core utility modules within the `src/utils` directory. These modules offer foundational, reusable functionalities that support various aspects of the application, from data management and validation to error handling and user interaction.

The documentation for each utility is derived from its comprehensive test suite, highlighting its purpose, key components, and how its API is intended to be used.

---

## Core Utility Modules

### 1. Cache (`src/utils/cache.ts`)

The `Cache` module provides a simple, in-memory key-value store with optional Time-To-Live (TTL) functionality. It's designed for caching frequently accessed data to improve performance.

**Purpose:**
To store and retrieve data efficiently, with support for automatic expiration and on-demand computation of missing values.

**Key Components:**

*   **`Cache<T>` Class**: A generic class that implements the caching logic.
*   **`createCacheKey(...args: (string | number | boolean | null | undefined)[]): string`**: A helper function to generate a consistent string key from multiple input values, useful for complex cache keys.

**API & Functionality:**

*   **`constructor(defaultTtlMs?: number)`**: Initializes a new cache instance. An optional `defaultTtlMs` can be provided for entries without a custom TTL.
*   **`set(key: string, value: T, ttlMs?: number)`**: Stores a `value` under a `key`. An optional `ttlMs` can override the cache's default TTL for this specific entry.
*   **`get(key: string): T | undefined`**: Retrieves the value associated with `key`. Returns `undefined` if the key does not exist or the entry has expired.
*   **`has(key: string): boolean`**: Checks if a `key` exists and is not expired in the cache.
*   **`delete(key: string): boolean`**: Removes an entry from the cache. Returns `true` if the entry was found and deleted, `false` otherwise.
*   **`clear()`**: Removes all entries from the cache.
*   **`size: number`**: A getter that returns the current number of non-expired entries in the cache.
*   **`cleanup()`**: Manually removes all expired entries from the cache. This is typically handled implicitly by `get` and `set` operations but can be useful for explicit memory management.
*   **`getOrCompute(key: string, computeFn: () => Promise<T>, ttlMs?: number): Promise<T>`**: Asynchronously retrieves a value. If the value is not in the cache or has expired, `computeFn` is called to generate it, and the result is stored before being returned.
*   **`getOrComputeSync(key: string, computeFn: () => T, ttlMs?: number): T`**: Synchronous version of `getOrCompute`.

**Usage Example:**

```typescript
import { Cache, createCacheKey } from './src/utils/cache';

const myCache = new Cache<string>(5000); // Default TTL of 5 seconds

// Basic operations
myCache.set('user:1', 'Alice');
console.log(myCache.get('user:1')); // 'Alice'

// Custom TTL
myCache.set('temp_data', 'some_value', 100); // Expires in 100ms

// Asynchronous computation
async function fetchUserData(userId: string) {
  return myCache.getOrCompute(`user_data:${userId}`, async () => {
    console.log(`Fetching data for ${userId}...`);
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate API call
    return `Data for ${userId}`;
  });
}

(async () => {
  console.log(await fetchUserData('2')); // Fetches and caches
  console.log(await fetchUserData('2')); // Returns from cache, no computation
})();

// Creating complex keys
const key = createCacheKey('report', 2023, 'Q4', true); // "report:2023:Q4:true"
```

---

### 2. Confirmation Service (`src/utils/confirmation-service.ts`)

The `ConfirmationService` manages user confirmation states for sensitive operations and provides a dry-run mode for previewing actions without execution.

**Purpose:**
To centralize the logic for user confirmations, manage a dry-run mode, and log actions performed in dry-run. It acts as a single point of control for interactive operations.

**Key Components:**

*   **`ConfirmationService` Class**: A singleton class that manages confirmation states and dry-run logs. It extends `EventEmitter` to allow other parts of the application to subscribe to confirmation events.

**API & Functionality:**

*   **`static getInstance(): ConfirmationService`**: Returns the singleton instance of the service.
*   **`dispose()`**: Cleans up the service, typically by clearing any pending states and event listeners.
*   **`isDryRunMode(): boolean`**: Checks if the service is currently in dry-run mode.
*   **`setDryRunMode(enabled: boolean)`**: Enables or disables dry-run mode.
*   **`getDryRunLog(): string[]`**: Returns an array of strings representing actions logged during dry-run mode.
*   **`clearDryRunLog()`**: Clears the dry-run log.
*   **`formatDryRunLog(): string`**: Returns a formatted string representation of the dry-run log.
*   **`isPending(): boolean`**: Checks if there is an operation currently awaiting user confirmation.
*   **`resetSession()`**: Resets the current confirmation session, clearing any pending states or "don't ask again" flags.
*   **`getSessionFlags(): SessionFlags`**: Returns an object containing the current session flags (e.g., `fileOperations`, `bashCommands`, `allOperations`) which indicate user-granted permissions for certain types of actions.
*   **`setSessionFlag(flag: keyof SessionFlags, value: boolean)`**: Sets a specific session flag.
*   **`confirmOperation(confirmed: boolean, dontAskAgain?: boolean)`**: Responds to a pending confirmation request. `confirmed` indicates user's decision, `dontAskAgain` updates session flags.
*   **`rejectOperation(feedback?: string)`**: Rejects a pending operation, optionally with feedback.
*   **`on(event: string, listener: (...args: any[]) => void)`**: Inherited from `EventEmitter`, allows listening for service events (e.g., `confirmationRequired`, `operationConfirmed`, `operationRejected`).
*   **`emit(event: string, ...args: any[])`**: Inherited from `EventEmitter`, used internally to emit events.

**Usage Example:**

```typescript
import { ConfirmationService } from './src/utils/confirmation-service';

const service = ConfirmationService.getInstance();

service.on('confirmationRequired', (message, type) => {
  console.log(`Confirmation needed for ${type}: ${message}`);
  // In a real UI, this would prompt the user
  service.confirmOperation(true, true); // Auto-confirm for example
});

service.setDryRunMode(true);
// Simulate an operation that would normally require confirmation
// In dry-run mode, it would log instead of prompting
// service.requestConfirmation('Delete sensitive file?', 'fileOperations');
// console.log(service.getDryRunLog());

service.setDryRunMode(false);
service.setSessionFlag('fileOperations', true); // User agreed to all file ops
// Now, file operations might proceed without explicit prompt
```

---

### 3. Disposable System (`src/utils/disposable.ts`)

The Disposable system provides a robust mechanism for managing resources that need explicit cleanup, ensuring they are disposed of correctly, especially in a Last-In, First-Out (LIFO) order.

**Purpose:**
To prevent resource leaks by centralizing the registration and disposal of objects that implement the `Disposable` interface. It's particularly useful for managing subscriptions, file handles, or other resources that require explicit release.

**Key Components:**

*   **`Disposable` Interface**: Defines a single `dispose()` method that objects must implement for cleanup.
*   **`DisposableManager` Class**: Manages a collection of `Disposable` objects, calling their `dispose()` methods when `disposeAll()` is invoked.
*   **`getDisposableManager(): DisposableManager`**: Returns the singleton instance of the global `DisposableManager`.
*   **`registerDisposable(disposable: Disposable)`**: A global helper function to register a `Disposable` with the global manager.
*   **`unregisterDisposable(disposable: Disposable)`**: A global helper function to unregister a `Disposable`.
*   **`disposeAll(): Promise<void>`**: A global helper function to trigger disposal of all registered `Disposable` objects.

**API & Functionality:**

**`DisposableManager` Class:**

*   **`register(disposable: Disposable)`**: Adds a `Disposable` object to the manager.
*   **`unregister(disposable: Disposable)`**: Removes a `Disposable` object from the manager.
*   **`disposeAll(): Promise<void>`**: Iterates through all registered disposables in reverse order of registration (LIFO) and calls their `dispose()` method. It handles both synchronous and asynchronous `dispose` methods and continues even if some disposals throw errors.
*   **`getCount(): number`**: Returns the number of currently registered disposables.
*   **`isDisposed(): boolean`**: Indicates if the manager itself has been disposed (i.e., `disposeAll` has been called).
*   **`reset()`**: Clears all registered disposables and resets the disposed state. Primarily used for testing.

**Global Helper Functions:**

*   **`getDisposableManager()`**: Accesses the global singleton `DisposableManager`.
*   **`registerDisposable(disposable: Disposable)`**: Convenience wrapper for `getDisposableManager().register(disposable)`.
*   **`unregisterDisposable(disposable: Disposable)`**: Convenience wrapper for `getDisposableManager().unregister(disposable)`.
*   **`disposeAll()`**: Convenience wrapper for `getDisposableManager().disposeAll()`.

**Usage Example:**

```typescript
import { registerDisposable, disposeAll, Disposable } from './src/utils/disposable';

class MyResource implements Disposable {
  private id: number;
  constructor(id: number) {
    this.id = id;
    console.log(`Resource ${this.id} created.`);
    registerDisposable(this); // Register itself for automatic cleanup
  }

  async dispose() {
    console.log(`Disposing Resource ${this.id}...`);
    await new Promise(resolve => setTimeout(resolve, 10)); // Simulate async cleanup
    console.log(`Resource ${this.id} disposed.`);
  }
}

function setupApplication() {
  new MyResource(1);
  new MyResource(2);
  // ... more resources
}

async function shutdownApplication() {
  console.log('Shutting down application, disposing resources...');
  await disposeAll(); // This will call dispose on MyResource(2) then MyResource(1)
  console.log('Application shutdown complete.');
}

setupApplication();
shutdownApplication();
```

---

### 4. Error Utilities (`src/utils/errors.ts`)

This module defines a set of custom error classes for specific application scenarios and provides utility functions for robust error handling, including retries and timeouts for asynchronous operations.

**Purpose:**
To provide a structured and categorized error system, making error identification and handling more consistent. It also offers practical utilities for managing common asynchronous failure patterns.

**Key Components:**

**Custom Error Classes (all extend `CodeBuddyError`):**

*   **`CodeBuddyError`**: The base class for all custom application errors. Includes `code` and `details` properties for structured error information.
    *   `toJSON()`: Serializes the error to a plain object for logging or API responses.
*   **`APIError`**: For errors originating from API calls, includes `statusCode` and `response`.
*   **`FileError`**: For file system related errors, includes `filePath` and `operation`.
*   **`FileNotFoundError`**: A specific `FileError` for when a file is not found.
*   **`TimeoutError`**: For operations that exceed a time limit, includes `timeoutMs`.
*   **`InvalidCommandError`**: For attempts to execute blocked or invalid commands, includes `command`.
*   **`ValidationError`**: For input validation failures, includes `field` and `value`.

**Utility Functions:**

*   **`isCodeBuddyError(error: unknown): error is CodeBuddyError`**: Type guard to check if an error is an instance of `CodeBuddyError` or one of its subclasses.
*   **`getErrorMessage(error: unknown): string`**: Extracts a user-friendly message from various error types (Error objects, strings, or unknown values).
*   **`withTimeout<T>(promise: Promise<T>, timeoutMs: number, message?: string): Promise<T>`**: Wraps a promise, rejecting with a `TimeoutError` if the promise does not resolve within `timeoutMs`.
*   **`withRetry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T>`**: Retries an asynchronous function `fn` a specified number of times with exponential backoff, useful for transient failures.

**Usage Example:**

```typescript
import {
  CodeBuddyError,
  APIError,
  FileNotFoundError,
  withTimeout,
  withRetry,
  getErrorMessage,
} from './src/utils/errors';

// Custom Error Usage
try {
  throw new APIError('Failed to fetch user data', 500, { reason: 'server_error' });
} catch (e) {
  if (e instanceof APIError) {
    console.error(`API Error (${e.statusCode}): ${e.message} - Details: ${JSON.stringify(e.response)}`);
  }
}

// withTimeout Usage
async function fetchDataWithTimeout() {
  const slowPromise = new Promise(resolve => setTimeout(() => resolve('data'), 500));
  try {
    const result = await withTimeout(slowPromise, 100, 'Data fetch took too long!');
    console.log(result);
  } catch (e) {
    console.error(getErrorMessage(e)); // "Data fetch took too long!"
  }
}
fetchDataWithTimeout();

// withRetry Usage
let attemptCount = 0;
async function flakyOperation() {
  attemptCount++;
  console.log(`Attempt ${attemptCount} to perform flaky operation...`);
  if (attemptCount < 3) {
    throw new Error('Transient network issue');
  }
  return 'Operation successful!';
}

(async () => {
  try {
    const result = await withRetry(flakyOperation, { maxRetries: 2, initialDelay: 50 });
    console.log(result); // "Operation successful!" after 3 attempts
  } catch (e) {
    console.error(`Failed after retries: ${getErrorMessage(e)}`);
  }
})();
```

---

### 5. Exit Codes (`src/utils/exit-codes.ts`)

This module defines a standardized set of exit codes for the application and provides utilities to manage the application's exit behavior, including mapping errors to appropriate exit codes.

**Purpose:**
To ensure consistent and meaningful exit codes, allowing external scripts or CI/CD pipelines to interpret the application's termination status reliably. It also centralizes fatal error handling.

**Key Components:**

*   **`EXIT_CODES` Object**: A collection of numeric constants representing standard exit codes (e.g., `SUCCESS`, `GENERAL_ERROR`, `API_ERROR`, `FILE_NOT_FOUND`).

**API & Functionality:**

*   **`EXIT_CODES`**:
    *   `SUCCESS = 0`
    *   `GENERAL_ERROR = 1`
    *   `INVALID_USAGE = 2`
    *   `API_ERROR`
    *   `AUTHENTICATION_ERROR`
    *   `TIMEOUT`
    *   `FILE_NOT_FOUND`
    *   `PERMISSION_DENIED`
    *   `NETWORK_ERROR`
    *   `USER_CANCELLED = 130` (standard for Ctrl+C)
    *   ... and other specific error codes.
*   **`getExitCodeDescription(code: number): string`**: Returns a human-readable description for a given `EXIT_CODES` value.
*   **`exitWithCode(code: number, message?: string)`**: Terminates the application with the specified `code`. If a `message` is provided, it's logged to `console.log` for success codes or `console.error` for error codes.
*   **`errorToExitCode(error: Error | unknown): number`**: Attempts to map a given `Error` object (or unknown value) to the most appropriate `EXIT_CODES` value based on its message or type.
*   **`handleFatalError(error: Error | unknown)`**: A high-level function to process a fatal error. It logs the error, determines the appropriate exit code using `errorToExitCode`, and then calls `exitWithCode` to terminate the application.

**Usage Example:**

```typescript
import {
  EXIT_CODES,
  exitWithCode,
  errorToExitCode,
  handleFatalError,
} from './src/utils/exit-codes';
import { APIError, FileNotFoundError } from './src/utils/errors'; // Assuming custom errors

function performOperation(shouldFail: boolean, errorType?: string) {
  try {
    if (shouldFail) {
      if (errorType === 'api') {
        throw new APIError('Service unavailable', 503);
      } else if (errorType === 'file') {
        throw new FileNotFoundError('/non/existent/file.txt');
      } else if (errorType === 'auth') {
        throw new Error('Invalid API key'); // errorToExitCode will map this
      } else {
        throw new Error('An unexpected error occurred.');
      }
    }
    exitWithCode(EXIT_CODES.SUCCESS, 'Operation completed successfully.');
  } catch (e) {
    handleFatalError(e); // This will log the error and exit with the mapped code
  }
}

// Example calls (these would typically terminate the process)
// performOperation(false); // Exits with SUCCESS
// performOperation(true, 'api'); // Exits with API_ERROR
// performOperation(true, 'file'); // Exits with FILE_NOT_FOUND
// performOperation(true, 'auth'); // Exits with AUTHENTICATION_ERROR
// performOperation(true); // Exits with GENERAL_ERROR
```

---

### 6. Glob Matcher (`src/utils/glob-matcher.ts`)

This module provides utilities for matching strings against glob patterns, commonly used for filtering lists of items like files, tools, or configurations.

**Purpose:**
To offer flexible pattern matching capabilities, similar to shell globs, for filtering and selection logic within the application.

**Key Components:**

*   **`ToolFilterConfig` Interface**: Defines the structure for tool filtering, including `enabledTools` and `disabledTools` arrays of glob patterns.

**API & Functionality:**

*   **`globToRegex(glob: string): RegExp`**: Converts a glob pattern string into a regular expression object. Supports `*` (any non-`/`), `**` (any character including `/`), `?` (single character), `[abc]` (character sets), and `{a,b}` (brace expansion).
*   **`matchGlob(text: string, pattern: string): boolean`**: Checks if a `text` string matches a single `pattern`.
*   **`matchAnyGlob(text: string, patterns: string[]): boolean`**: Returns `true` if `text` matches *any* of the provided `patterns`.
*   **`matchAllGlobs(text: string, patterns: string[]): boolean`**: Returns `true` if `text` matches *all* of the provided `patterns`.
*   **`filterByGlob<T>(items: T[], patterns: string[], accessor?: (item: T) => string): T[]`**: Filters an array of `items`, returning only those that match *any* of the `patterns`. An optional `accessor` function can be provided to extract the string to be matched from each item.
*   **`excludeByGlob<T>(items: T[], patterns: string[], accessor?: (item: T) => string): T[]`**: Filters an array of `items`, returning only those that *do not* match *any* of the `patterns`.
*   **`filterTools(tools: string[], config: ToolFilterConfig): string[]`**: Filters a list of tool names based on an `enabledTools` (whitelist) and `disabledTools` (blacklist) configuration. Blacklist takes precedence.
*   **`isToolEnabled(toolName: string, config: ToolFilterConfig): boolean`**: Checks if a single tool is enabled according to the provided `ToolFilterConfig`.

**Usage Example:**

```typescript
import {
  matchGlob,
  filterByGlob,
  filterTools,
  isToolEnabled,
} from './src/utils/glob-matcher';

// Basic matching
console.log(matchGlob('my_file.txt', '*.txt')); // true
console.log(matchGlob('src/components/button.ts', 'src/**')); // true

// Filtering arrays
const files = ['index.js', 'src/main.ts', 'src/utils/helper.js', 'test/test.js'];
const jsFiles = filterByGlob(files, ['*.js']);
console.log(jsFiles); // ['index.js', 'src/utils/helper.js', 'test/test.js']

// Tool filtering
const allTools = ['bash', 'git', 'npm', 'web_search', 'view_file', 'mcp__filesystem__read'];
const toolConfig = {
  enabledTools: ['*', 'mcp__*'], // Enable all, but then disable specific ones
  disabledTools: ['web_*', 'mcp__filesystem__read'],
};

const availableTools = filterTools(allTools, toolConfig);
console.log(availableTools); // ['bash', 'git', 'npm', 'view_file']

console.log(isToolEnabled('bash', toolConfig)); // true
console.log(isToolEnabled('web_search', toolConfig)); // false
console.log(isToolEnabled('mcp__filesystem__read', toolConfig)); // false
```

---

### 7. Input Validator (`src/utils/input-validator.ts`)

This module provides a comprehensive set of functions for validating various input types and structures, returning detailed validation results or throwing assertion errors.

**Purpose:**
To ensure data integrity and correctness by providing a consistent and extensible way to validate user input, configuration values, or API payloads.

**Key Components:**

*   **`ValidationResult<T>` Type**: `{ valid: true, value: T } | { valid: false, error: string }`. All `validate*` functions return this type.
*   **Numerous `validate*` Functions**: Each designed for a specific type or format (e.g., `validateString`, `validateNumber`, `validateArray`, `validateObject`, `validateUrl`, `validateEmail`, `validateSchema`).
*   **`assert*` Functions**: Convenience functions that throw an error if validation fails, useful when a valid input is strictly expected.

**API & Functionality (Highlights):**

**Basic Type Validators:**

*   **`validateString(value: unknown, options?: StringValidationOptions)`**: Validates if `value` is a non-empty string. Options include `allowEmpty`, `fieldName`, `customError`.
*   **`validateStringLength(value: string, min: number, max: number, options?: ValidationOptions)`**: Validates string length.
*   **`validatePattern(value: string, pattern: RegExp, options?: PatternValidationOptions)`**: Validates string against a regex pattern.
*   **`validateNumber(value: unknown, options?: ValidationOptions)`**: Validates if `value` is a number or a numeric string.
*   **`validateNumberRange(value: number, min: number, max: number, options?: ValidationOptions)`**: Validates if a number is within a specified range.
*   **`validatePositiveInteger(value: unknown, options?: ValidationOptions)`**: Validates if `value` is a positive integer.
*   **`validateBoolean(value: unknown, options?: ValidationOptions)`**: Validates if `value` is a boolean or can be parsed as one (e.g., "true", "false", 1, 0).
*   **`validateArray(value: unknown, options?: ArrayValidationOptions)`**: Validates if `value` is an array. Options include `minLength`, `maxLength`.
*   **`validateObject(value: unknown, options?: ValidationOptions)`**: Validates if `value` is a plain object.
*   **`validateChoice<T extends string>(value: unknown, choices: readonly T[], options?: ValidationOptions)`**: Validates if `value` is one of the predefined `choices`.

**Specialized Format Validators:**

*   **`validateUrl(value: unknown, options?: UrlValidationOptions)`**: Validates if `value` is a valid URL. Options for `protocols`.
*   **`validateEmail(value: unknown, options?: ValidationOptions)`**: Validates if `value` is a valid email address.
*   **`validateFilePath(value: unknown, options?: FilePathValidationOptions)`**: Validates if `value` is a valid file path. Options for `mustBeAbsolute`.

**Composite Validators:**

*   **`validateOptional<T>(value: unknown, validator: (val: unknown, opts?: any) => ValidationResult<T>, options?: ValidationOptions)`**: Makes any validator optional. If `value` is `undefined` or `null`, it's considered valid and returns `undefined`. Otherwise, it applies the `validator`.
*   **`validateWithDefault<T>(value: unknown, defaultValue: T, validator: (val: unknown, opts?: any) => ValidationResult<T>, options?: ValidationOptions)`**: Provides a `defaultValue` if `value` is `undefined` or `null`. Otherwise, it applies the `validator` to `value`.

**Schema Validation:**

*   **`validateSchema<T extends Record<string, any>>(data: unknown, schema: SchemaDefinition<T>, options?: SchemaValidationOptions)`**: Validates an object against a defined schema. Each schema property specifies a `validator`, `required` status, and an optional `default` value. `strict` mode can reject unknown fields.

**Assertion Helpers:**

*   **`assertValid<T>(result: ValidationResult<T>, context?: string): T`**: Throws a `ValidationError` if `result.valid` is `false`, otherwise returns `result.value`.
*   **`assertString(value: unknown, options?: StringValidationOptions): string`**: Combines `validateString` and `assertValid`.
*   **`assertNumber(value: unknown, options?: ValidationOptions): number`**: Combines `validateNumber` and `assertValid`.

**Usage Example:**

```typescript
import {
  validateString,
  validatePositiveInteger,
  validateEmail,
  validateSchema,
  assertValid,
  ValidationError,
} from './src/utils/input-validator';

// Basic validation
const nameResult = validateString('Alice', { fieldName: 'User Name' });
if (nameResult.valid) {
  console.log(`Name: ${nameResult.value}`);
}

const ageResult = validatePositiveInteger(30);
if (!ageResult.valid) {
  console.error(`Age error: ${ageResult.error}`);
}

// Schema validation
const userSchema = {
  username: { validator: validateString, required: true, fieldName: 'Username' },
  age: { validator: validatePositiveInteger, required: true, fieldName: 'Age' },
  email: { validator: validateEmail, required: false },
  role: { validator: validateString, default: 'guest' },
};

const userData = {
  username: 'john_doe',
  age: 25,
  email: 'john@example.com',
};

try {
  const validatedUser = assertValid(validateSchema(userData, userSchema));
  console.log('Validated User:', validatedUser);
  // Output: { username: 'john_doe', age: 25, email: 'john@example.com', role: 'guest' }

  // Example with missing required field
  const invalidUserData = { username: 'jane_doe' };
  assertValid(validateSchema(invalidUserData, userSchema));
} catch (e) {
  if (e instanceof ValidationError) {
    console.error(`Validation Error: ${e.message}`); // Contains 'age is required'
  }
}
```

---

### 8. LRU Cache (`src/utils/lru-cache.ts`)

This module provides a robust Least Recently Used (LRU) cache implementation with optional Time-To-Live (TTL) expiration, detailed statistics, and factory functions for common cache configurations.

**Purpose:**
To efficiently manage a fixed-size cache, automatically evicting the least recently used items when capacity is reached, and supporting time-based expiration for cached data.

**Key Components:**

*   **`LRUCache<K, V>` Class**: The primary LRU cache implementation. It extends `EventEmitter` to emit cache-related events.
*   **`LRUMap<K, V>` Class**: A specialized `LRUCache` that behaves more like a standard `Map` but with LRU eviction and optional key serialization.
*   **`CACHE_SIZES` Object**: Constants for common cache size configurations (e.g., `SMALL`, `MEDIUM`, `LARGE`, `XLARGE`, `CHECKPOINT`, `CHUNK_STORE`, `MEMORY`, `ANALYSIS`).
*   **`CACHE_TTL` Object**: Constants for common TTL durations (e.g., `SHORT`, `MEDIUM`, `LONG`, `HOUR`, `DAY`).
*   **Factory Functions**: `createCheckpointCache`, `createChunkStoreCache`, `createMemoryCache`, `createAnalysisCache` provide pre-configured `LRUCache` instances.

**API & Functionality:**

**`LRUCache<K, V>` Class:**

*   **`constructor(options: LRUCacheOptions<K, V>)`**: Initializes the cache with `maxSize`, optional `ttlMs`, and `onEvict` callback.
*   **`set(key: K, value: V, ttlMs?: number)`**: Adds or updates an entry. If `maxSize` is exceeded, the LRU entry is evicted. Emits `set` event.
*   **`get(key: K): V | undefined`**: Retrieves a value. Marks the entry as most recently used. Returns `undefined` if not found or expired. Tracks hits/misses.
*   **`has(key: K): boolean`**: Checks for the existence of a non-expired key.
*   **`delete(key: K): boolean`**: Removes an entry. Emits `delete` event.
*   **`clear()`**: Empties the cache. Emits `clear` event.
*   **`size: number`**: Getter for the current number of non-expired entries.
*   **`keys(): K[]`**: Returns an array of all non-expired keys.
*   **`values(): V[]`**: Returns an array of all non-expired values.
*   **`entries(): [K, V][]`**: Returns an array of all non-expired key-value pairs.
*   **`forEach(callback: (value: V, key: K, cache: this) => void, thisArg?: any)`**: Iterates over non-expired entries.
*   **`[Symbol.iterator]()`**: Makes the cache iterable (e.g., `for (const [key, value] of cache)`).
*   **`toObject(): Record<string, V>`**: Converts the cache to a plain JavaScript object (keys are stringified).
*   **`fromObject(obj: Record<string, V> | Map<K, V>)`**: Populates the cache from a plain object or Map.
*   **`getStats(): CacheStats`**: Returns an object with cache statistics (hits, misses, hitRate, evictions, size, maxSize).
*   **`resetStats()`**: Resets hit/miss/eviction counters.
*   **`prune(): number`**: Manually removes all expired entries. Returns the number of entries pruned.
*   **`setMaxSize(newSize: number)`**: Adjusts the maximum size of the cache, potentially triggering evictions.
*   **`dispose()`**: Clears the cache and removes all event listeners.
*   **Events**: Emits `set`, `delete`, `evict`, `clear` events.

**`LRUMap<K, V>` Class:**

*   Extends `LRUCache` and provides a `keyToString` option in its constructor for custom key serialization, allowing complex objects to be used as keys.

**Factory Functions:**

*   `createCheckpointCache<V>()`: Creates an `LRUCache` with `CACHE_SIZES.CHECKPOINT`.
*   `createChunkStoreCache<V>()`: Creates an `LRUCache` with `CACHE_SIZES.CHUNK_STORE`.
*   `createMemoryCache<V>()`: Creates an `LRUCache` with `CACHE_SIZES.MEMORY`.
*   `createAnalysisCache<V>()`: Creates an `LRUCache` with `CACHE_SIZES.ANALYSIS`.

**Usage Example:**

```typescript
import { LRUCache, CACHE_SIZES, CACHE_TTL, createMemoryCache } from './src/utils/lru-cache';

// Create a cache with a specific size and default TTL
const userCache = new LRUCache<string, { name: string }>({
  maxSize: CACHE_SIZES.MEDIUM, // 500 entries
  ttlMs: CACHE_TTL.HOUR, // 1 hour
  onEvict: (key, value) => console.log(`Evicted user: ${value.name} (${key})`),
});

userCache.set('user:1', { name: 'Alice' });
userCache.set('user:2', { name: 'Bob' });

console.log(userCache.get('user:1')); // { name: 'Alice' }
console.log(userCache.getStats()); // { hits: 1, misses: 0, ... }

// Accessing 'user:1' makes it most recently used
userCache.get('user:1');

// Fill up and evict
for (let i = 3; i <= CACHE_SIZES.MEDIUM + 1; i++) {
  userCache.set(`user:${i}`, { name: `User ${i}` });
}
// 'user:2' should be evicted as it was LRU before 'user:1' was accessed

console.log(userCache.has('user:2')); // false

// Using a factory function
const analysisCache = createMemoryCache<string>();
analysisCache.set('report:summary', '...');
```

---

### 9. Model Utilities (`src/utils/model-utils.ts`)

This module provides a centralized way to manage and query information about the various AI models supported by the application, including their providers, capabilities, and default selections.

**Purpose:**
To abstract away the details of different AI models and providers, offering a consistent interface for model selection, validation, and information retrieval.

**Key Components:**

*   A hidden internal registry of supported models and their properties (max tokens, provider, etc.).

**API & Functionality:**

*   **`isSupportedModel(modelName: string): boolean`**: Checks if a given `modelName` is recognized and supported by the application.
*   **`getModelInfo(modelName: string): ModelInfo`**: Returns an object containing detailed information about a model, such as `isSupported`, `maxTokens`, and `provider`. Provides default values for unsupported models.
*   **`validateModel(modelName: string, strict: boolean): void`**: Validates a `modelName`. In `strict` mode, it throws a `ValidationError` if the model is not supported. In non-strict mode, it only checks for non-empty strings.
*   **`getDefaultModel(provider: ModelProvider): string`**: Returns the default model name for a given `ModelProvider` (e.g., 'xai', 'anthropic', 'openai', 'google', 'lmstudio').
*   **`getSupportedModels(): string[]`**: Returns an array of all currently supported model names.
*   **`getModelsByProvider(provider: ModelProvider): string[]`**: Returns an array of model names associated with a specific `ModelProvider`.
*   **`suggestModel(partialName: string): string[]`**: Provides a list of supported model names that match or partially match the `partialName` (case-insensitive).
*   **`formatModelInfo(modelName: string): string`**: Returns a human-readable, formatted string containing the details of a given model.

**Usage Example:**

```typescript
import {
  isSupportedModel,
  getModelInfo,
  validateModel,
  getDefaultModel,
  getSupportedModels,
  getModelsByProvider,
  suggestModel,
  formatModelInfo,
} from './src/utils/model-utils';
import { ValidationError } from './src/utils/errors';

// Check model support
console.log(isSupportedModel('grok-4-latest')); // true
console.log(isSupportedModel('unknown-model')); // false

// Get model information
const grokInfo = getModelInfo('grok-4-latest');
console.log(`Grok Max Tokens: ${grokInfo.maxTokens}, Provider: ${grokInfo.provider}`);

// Validate model
try {
  validateModel('claude-opus-4-6', true); // OK in strict mode
  validateModel('non-existent-model', true); // Throws ValidationError
} catch (e) {
  if (e instanceof ValidationError) {
    console.error(`Model validation failed: ${e.message}`);
  }
}

// Get defaults and lists
console.log(`Default OpenAI model: ${getDefaultModel('openai')}`);
console.log(`All supported models: ${getSupportedModels().join(', ')}`);
console.log(`Google models: ${getModelsByProvider('google').join(', ')}`);

// Suggest models
console.log(`Suggestions for 'grok': ${suggestModel('grok').join(', ')}`);

// Format info
console.log(formatModelInfo('gpt-4o'));
```

---

### 10. Path Validator (`src/utils/path-validator.ts`)

The `PathValidator` module provides robust security checks for file paths, ensuring that operations are confined to allowed directories and preventing path traversal vulnerabilities.

**Purpose:**
To safeguard against malicious path inputs by validating that all file system operations occur within a defined base directory or explicitly allowed paths, and to resolve paths safely.

**Key Components:**

*   **`PathValidator` Class**: The core class responsible for path validation logic.
*   **`getPathValidator(): PathValidator`**: Returns the singleton instance of the global `PathValidator`.
*   **`initializePathValidator(options?: PathValidatorOptions): PathValidator`**: Initializes or re-initializes the global `PathValidator` with specific options.
*   **`validatePath(inputPath: string, options?: PathValidationOptions): PathValidationResult`**: A global helper to validate a single path using the global validator.
*   **`isPathSafe(inputPath: string, options?: PathValidationOptions): boolean`**: A global helper to quickly check if a path is safe.

**API & Functionality:**

**`PathValidator` Class:**

*   **`constructor(options?: PathValidatorOptions)`**: Initializes the validator. Options include `baseDirectory` (defaults to `process.cwd()`), `checkSymlinks` (defaults to `true`), `additionalAllowedPaths`, and `allowOutsideBase`.
*   **`setBaseDirectory(dir: string)`**: Updates the base directory for validation.
*   **`getBaseDirectory(): string`**: Returns the currently configured base directory.
*   **`validate(inputPath: string, options?: PathValidationOptions): PathValidationResult`**: The primary validation method. It normalizes the path, checks for emptiness, ensures it's within the `baseDirectory` (or `additionalAllowedPaths`), and optionally resolves symlinks to their real paths to prevent escapes. Returns a `PathValidationResult` object (`{ valid: boolean, resolved?: string, error?: string }`).
*   **`validateMany(paths: string[], options?: PathValidationOptions): MultiPathValidationResult`**: Validates an array of paths, collecting all results and errors.
*   **`isSafe(inputPath: string, options?: PathValidationOptions): boolean`**: A convenience method that returns `true` if `validate` returns `valid: true`, `false` otherwise.
*   **`resolveOrThrow(inputPath: string, options?: PathValidationOptions): string`**: Validates a path and returns its resolved absolute path if valid. Throws an error if validation fails.

**Global Helper Functions:**

*   **`getPathValidator()`**: Accesses the global singleton `PathValidator`.
*   **`initializePathValidator(options?: PathValidatorOptions)`**: Sets up the global `PathValidator` instance. This should typically be called once at application startup.
*   **`validatePath(inputPath: string, options?: PathValidationOptions)`**: Uses the global validator to validate a path.
*   **`isPathSafe(inputPath: string, options?: PathValidationOptions)`**: Uses the global validator for a quick safety check.

**Usage Example:**

```typescript
import * as path from 'path';
import * as os from 'os';
import {
  initializePathValidator,
  getPathValidator,
  validatePath,
  isPathSafe,
} from './src/utils/path-validator';

// Initialize the global validator with the current working directory as base
initializePathValidator({ baseDirectory: process.cwd() });
const validator = getPathValidator();

const safePath = path.join(process.cwd(), 'my_project', 'file.txt');
const unsafePath = '/etc/passwd';
const traversalPath = path.join(process.cwd(), '..', 'sibling_dir', 'secret.txt');

// Using the instance
console.log(`Is "${safePath}" safe? ${validator.isSafe(safePath)}`); // true
console.log(`Is "${unsafePath}" safe? ${validator.isSafe(unsafePath)}`); // false

const result = validator.validate(traversalPath);
if (!result.valid) {
  console.error(`Validation error for "${traversalPath}": ${result.error}`);
}

// Using global helpers
const globalSafeResult = validatePath(safePath);
if (globalSafeResult.valid) {
  console.log(`Global check: "${globalSafeResult.resolved}" is valid.`);
}

// Example with additional allowed paths
initializePathValidator({
  baseDirectory: process.cwd(),
  additionalAllowedPaths: [os.tmpdir()],
});
const tmpFile = path.join(os.tmpdir(), 'temp_log.txt');
console.log(`Is "${tmpFile}" safe with additional allowed path? ${isPathSafe(tmpFile)}`); // true
```

---

### 11. Semantic Truncation (`src/utils/head-tail-truncation.ts`)

This module provides intelligent text truncation capabilities, designed to shorten long outputs while preserving critical information such as error messages, JSON structure, or custom patterns.

**Purpose:**
To make verbose text outputs more manageable for display or processing, without losing essential context that might be buried in the middle of the text.

**Key Components:**

*   **`TruncationResult` Type**: `{ output: string, truncated: boolean, omittedLines: number }`.
*   **`SemanticTruncationOptions` Interface**: Configures truncation behavior (head/tail lines, preserve errors/JSON/custom patterns).

**API & Functionality:**

*   **`needsTruncation(text: string, maxLines?: number): boolean`**: Checks if the given `text` exceeds a `maxLines` threshold (defaults to 200) and thus requires truncation.
*   **`headTailTruncate(text: string, options?: { headLines?: number; tailLines?: number }): TruncationResult`**: A basic truncation function that keeps a specified number of lines from the beginning (`headLines`) and end (`tailLines`) of the text, inserting an omission message in between.
*   **`semanticTruncate(text: string, options?: SemanticTruncationOptions): TruncationResult`**: The main intelligent truncation function. It combines head/tail truncation with logic to preserve:
    *   Error lines (if `preserveErrors` is true).
    *   JSON structure (if `preserveJson` is true, attempts to keep opening/closing braces and array/object structures).
    *   Lines matching custom regular expressions (if `preservePatterns` is provided).
    It inserts a message indicating the number of omitted lines and any preserved important lines.

**Usage Example:**

```typescript
import {
  semanticTruncate,
  needsTruncation,
} from './src/utils/head-tail-truncation';

const longLog = `Line 1: Start of log
Line 2: Some normal output
... (many lines) ...
Line 100: Error: Failed to connect to database
Line 101:   at connectDB (/app/src/db.ts:20:15)
Line 102:   at main (/app/src/index.ts:5:3)
... (many more lines) ...
Line 200: End of log`;

const jsonOutput = `{
  "data": [
    {"id": 1, "value": "A"},
    {"id": 2, "value": "B"},
    // ... 100s of entries ...
    {"id": 999, "value": "Y"},
    {"id": 1000, "value": "Z"}
  ],
  "metadata": {
    "count": 1000,
    "status": "complete"
  }
}`;

// Check if truncation is needed
console.log(`Needs truncation? ${needsTruncation(longLog, 50)}`); // true

// Semantic truncation preserving errors
const truncatedLog = semanticTruncate(longLog, {
  headLines: 5,
  tailLines: 5,
  preserveErrors: true,
});
console.log('--- Truncated Log (Errors Preserved) ---');
console.log(truncatedLog.output);
console.log(`Omitted lines: ${truncatedLog.omittedLines}`);

// Semantic truncation preserving JSON structure
const truncatedJson = semanticTruncate(jsonOutput, {
  headLines: 5,
  tailLines: 5,
  preserveJson: true,
});
console.log('\n--- Truncated JSON (Structure Preserved) ---');
console.log(truncatedJson.output);

// Custom patterns
const customLog = `Header line 1
Important: User ID 123 processed.
Some other line.
Another line.
Important: Transaction ABC completed.
Footer line 1`;

const truncatedCustom = semanticTruncate(customLog, {
  headLines: 1,
  tailLines: 1,
  preservePatterns: [/Important:/],
});
console.log('\n--- Truncated Custom (Patterns Preserved) ---');
console.log(truncatedCustom.output);
```

---

### 12. Settings Manager (`src/utils/settings-manager.ts`)

The `SettingsManager` module provides a centralized and hierarchical system for managing application settings, including user-specific and project-specific configurations. It handles persistence to JSON files and provides access to various configuration values.

**Purpose:**
To offer a consistent and robust way to store, retrieve, and update application settings, prioritizing project-level configurations over user-level defaults.

**Key Components:**

*   **`SettingsManager` Class**: A singleton class that encapsulates all settings management logic.

**API & Functionality:**

*   **`static getSettingsManager(): SettingsManager`**: Returns the singleton instance of the service.
*   **`loadUserSettings(): UserSettings`**: Loads user-specific settings from a configuration file (e.g., `~/.codebuddy/settings.json`) and merges them with default values.
*   **`saveUserSettings(settings: UserSettings)`**: Persists the provided `UserSettings` to the user's configuration file.
*   **`updateUserSetting<K extends keyof UserSettings>(key: K, value: UserSettings[K])`**: Updates a single user setting and saves the changes.
*   **`getUserSetting<K extends keyof UserSettings>(key: K): UserSettings[K]`**: Retrieves a specific user setting.
*   **`loadProjectSettings(): ProjectSettings`**: Loads project-specific settings from a configuration file (e.g., `.codebuddy/config.json` in the current project directory) and merges them with default values.
*   **`saveProjectSettings(settings: ProjectSettings)`**: Persists the provided `ProjectSettings` to the project's configuration file.
*   **`updateProjectSetting<K extends keyof ProjectSettings>(key: K, value: ProjectSettings[K])`**: Updates a single project setting and saves the changes.
*   **`getProjectSetting<K extends keyof ProjectSettings>(key: K): ProjectSettings[K] | undefined`**: Retrieves a specific project setting.
*   **`getCurrentModel(): string`**: Determines the active AI model, prioritizing project settings over user settings, and falling back to a hardcoded default.
*   **`setCurrentModel(model: string)`**: Sets the current model, typically by updating the user settings.
*   **`getAvailableModels(): string[]`**: Returns a list of all AI models available for use, usually by delegating to `model-utils`.
*   **`getApiKey(): string | undefined`**: Retrieves the API key, typically from environment variables or user settings.
*   **`getBaseURL(): string`**: Retrieves the base URL for API calls, prioritizing project settings, then user settings, then a default.

**Settings Hierarchy:**
The `SettingsManager` follows a clear hierarchy for resolving settings:
1.  **Project Settings**: Settings defined in the project's `.codebuddy/config.json` take highest precedence.
2.  **User Settings**: Settings defined in the user's global `~/.codebuddy/settings.json` come next.
3.  **Application Defaults**: Hardcoded default values are used if no other setting is found.

**Usage Example:**

```typescript
import { getSettingsManager } from './src/utils/settings-manager';

const settingsManager = getSettingsManager();

// Get the current active model
const currentModel = settingsManager.getCurrentModel();
console.log(`Current AI Model: ${currentModel}`);

// Update a user setting
settingsManager.updateUserSetting('defaultModel', 'grok-3-latest');
console.log(`Updated default model to: ${settingsManager.getUserSetting('defaultModel')}`);

// Get the API key (might be undefined if not set)
const apiKey = settingsManager.getApiKey();
if (apiKey) {
  console.log('API Key is set.');
} else {
  console.log('API Key is not set.');
}

// Load and inspect project settings
const projectSettings = settingsManager.loadProjectSettings();
console.log('Project Settings:', projectSettings);

// Example of how settings are resolved (conceptual, as mocks prevent direct testing here)
// If projectSettings.model is 'gpt-4', it will override userSettings.defaultModel
// If projectSettings.model is undefined, userSettings.defaultModel will be used
// If both are undefined, a hardcoded default will be used.
```

---

### 13. Text Utilities (`src/utils/text-utils.ts`)

This module provides a collection of basic text manipulation functions, primarily focused on cursor-based editing operations within a string.

**Purpose:**
To offer fundamental building blocks for implementing text editor-like functionalities, such as deleting characters/words and moving the cursor.

**Key Components:**

*   A set of pure functions that take a string and a cursor position, returning a new string and the updated cursor position.

**API & Functionality:**

All functions return an object `{ text: string, position: number }`.

*   **`deleteCharBefore(text: string, position: number)`**: Deletes the character immediately before the `position`.
*   **`deleteCharAfter(text: string, position: number)`**: Deletes the character immediately after the `position`.
*   **`deleteWordBefore(text: string, position: number)`**: Deletes the word (and any preceding whitespace) before the `position`.
*   **`deleteWordAfter(text: string, position: number)`**: Deletes the word (and any trailing whitespace) after the `position`.
*   **`insertText(text: string, position: number, newText: string)`**: Inserts `newText` at the specified `position`.
*   **`moveToLineStart(text: string, position: number)`**: Moves the `position` to the beginning of the current line.
*   **`moveToLineEnd(text: string, position: number)`**: Moves the `position` to the end of the current line.
*   **`moveToPreviousWord(text: string, position: number)`**: Moves the `position` to the beginning of the previous word.
*   **`moveToNextWord(text: string, position: number)`**: Moves the `position` to the beginning of the next word.

**Usage Example:**

```typescript
import {
  deleteCharBefore,
  deleteWordAfter,
  insertText,
  moveToLineStart,
  moveToNextWord,
} from './src/utils/text-utils';

let currentText = 'hello world';
let cursor = currentText.length; // At the end

// Delete character before
let result = deleteCharBefore(currentText, cursor);
currentText = result.text; // 'hello worl'
cursor = result.position; // 10

// Insert text
result = insertText(currentText, cursor, 'd!');
currentText = result.text; // 'hello world!'
cursor = result.position; // 12

// Move to start of next word and delete it
currentText = 'first second third';
cursor = 0;
result = moveToNextWord(currentText, cursor); // cursor moves to ' second third'
cursor = result.position; // 6
result = deleteWordAfter(currentText, cursor); // deletes 'second '
currentText = result.text; // 'first third'
cursor = result.position; // 6 (still at start of 'third')

// Move to line start
currentText = 'Line 1\n  Line 2 part 1\nLine 3';
cursor = 18; // In "part 1" of Line 2
cursor = moveToLineStart(currentText, cursor); // Moves to start of "  Line 2 part 1"
console.log(`Cursor at: ${cursor}`); // 7 (index of ' ')
```

---

### 14. Update Notifier (`src/utils/update-notifier.ts`)

The `UpdateNotifier` module provides functionality to check for new versions of the application and notify the user when an update is available.

**Purpose:**
To keep users informed about new releases, encouraging them to update to the latest version for new features, bug fixes, and security improvements.

**Key Components:**

*   **`UpdateNotifier` Class**: Manages the update checking process and notification formatting.
*   **`compareVersions(a: string, b: string): -1 | 0 | 1`**: A utility function for semantically comparing two version strings.

**API & Functionality:**

*   **`compareVersions(a: string, b: string): -1 | 0 | 1`**:
    *   Returns `0` if versions `a` and `b` are equal.
    *   Returns `-1` if version `a` is older than version `b`.
    *   Returns `1` if version `a` is newer than version `b`.
    *   Handles `v` prefixes (e.g., `v1.0.0` is equal to `1.0.0`).
*   **`UpdateNotifier` Class:**
    *   **`constructor(config?: UpdateNotifierConfig)`**: Initializes the notifier. `config` can specify `enabled` (default `true`) and `checkIntervalHours` (default `24`).
    *   **`check(): Promise<UpdateInfo | null>`**: Asynchronously checks for updates. It respects the `checkIntervalHours` to avoid frequent checks. Returns `UpdateInfo` if an update is available, `null` otherwise.
    *   **`getUpdateInfo(): UpdateInfo | null`**: Returns the last known update information without performing a new check.
    *   **`formatNotification(): string | null`**: Returns a formatted string message suitable for display if an update is available, otherwise `null`.

**Usage Example:**

```typescript
import { UpdateNotifier, compareVersions } from './src/utils/update-notifier';

// Version comparison
console.log(`1.0.0 vs 1.0.1: ${compareVersions('1.0.0', '1.0.1')}`); // -1
console.log(`v2.0.0 vs 2.0.0: ${compareVersions('v2.0.0', '2.0.0')}`); // 0

// Initialize notifier
const notifier = new UpdateNotifier({
  enabled: true,
  checkIntervalHours: 1, // Check every hour
});

async function checkForUpdatesAndNotify() {
  console.log('Checking for updates...');
  const updateInfo = await notifier.check();

  if (updateInfo && updateInfo.updateAvailable) {
    const notificationMessage = notifier.formatNotification();
    if (notificationMessage) {
      console.log('\n--- UPDATE AVAILABLE ---');
      console.log(notificationMessage);
      console.log('------------------------\n');
    }
  } else {
    console.log('No updates available or check skipped.');
  }
}

// In a real application, this would run periodically or on startup
// checkForUpdatesAndNotify();
```