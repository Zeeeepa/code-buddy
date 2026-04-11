---
title: "Root — vitest.setup.ts"
module: "root-vitest-setup-ts"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.308Z"
---
# Root — vitest.setup.ts

## `vitest.setup.ts` Module Documentation

This document details the `vitest.setup.ts` module, which serves as a crucial compatibility layer for projects migrating from Jest to Vitest.

### Module Overview

The primary purpose of `vitest.setup.ts` is to provide a global `jest` object within the Vitest test environment. This object mimics the API surface of Jest's global functions, allowing test files written with Jest's `jest.fn()`, `jest.spyOn()`, and other utilities to run seamlessly under Vitest with minimal or no modifications.

This setup file is automatically executed by Vitest before any test files are run, ensuring that the `globalThis.jest` object is available throughout the test suite.

### Implementation Details

The module achieves its goal by importing the `vi` object from `vitest` and then constructing a `jestMock` object that maps common Jest global functions to their Vitest equivalents.

#### The `jestMock` Object

The core of this module is the `jestMock` object. It's an object literal that directly assigns methods from Vitest's `vi` utility to properties named after their Jest counterparts.

```typescript
const jestMock = {
  fn: vi.fn,
  mock: vi.mock,
  // ... many more mappings ...
  spyOn: vi.spyOn,
  clearAllMocks: vi.clearAllMocks,
  // ...
};
```

This object provides a comprehensive set of mappings for common mocking, spying, and timer control functions.

#### Global Assignment

After constructing `jestMock`, the module assigns it to `globalThis.jest`:

```typescript
// @ts-expect-error: Mocking globalThis.jest for compatibility
globalThis.jest = jestMock;
```

The `@ts-expect-error` comment is necessary because `globalThis.jest` is not a standard TypeScript global property, and this assignment explicitly adds it for runtime compatibility.

#### Specific Mappings and Customizations

While most mappings are direct assignments, a few warrant specific mention:

*   **`jest.setTimeout(timeout: number)`**: This function is custom-implemented to configure Vitest's test timeout:
    ```typescript
    setTimeout: (timeout: number) => vi.setConfig({ testTimeout: timeout }),
    ```
    This ensures that calls to `jest.setTimeout` in existing test files correctly adjust the timeout for individual tests or suites within Vitest.
*   **`jest.requireActual`**: This is mapped to Vitest's `vi.importActual`:
    ```typescript
    requireActual: vi.importActual,
    ```
    This handles dynamic imports of actual module implementations, bypassing mocks, which is a common pattern in Jest tests.

### Developer Impact

For developers, this module significantly simplifies the process of migrating tests from Jest to Vitest.

*   **Reduced Migration Effort**: Test files that rely on `jest.fn()`, `jest.spyOn()`, `jest.useFakeTimers()`, etc., can often be run directly under Vitest without needing to refactor these calls to `vi.fn()`, `vi.spyOn()`, etc.
*   **Familiar API**: Developers accustomed to Jest's global API can continue to use it, making the transition smoother and reducing the learning curve for Vitest-specific utilities.
*   **Consistency**: It ensures a consistent testing environment across the codebase, even if some tests were originally written for Jest.

### Relationship to the Test Environment

This module acts as a foundational setup for the entire Vitest test suite.

*   **Execution Flow**: As a `vitest.setup.ts` file, it is executed once at the very beginning of the test run, before any test files (`.test.ts`, `.spec.ts`, etc.) are loaded or executed.
*   **Global Scope**: Its effect is global, making the `jest` object available in every test file without explicit imports.
*   **No Direct Dependencies**: Based on the provided call graph, this module does not have any internal calls, outgoing calls, or incoming calls from other application code. Its interaction is solely with the Vitest runtime environment to configure the global scope.

In essence, `vitest.setup.ts` is a compatibility shim that bridges the API differences between Jest and Vitest, enabling a smoother migration path and allowing developers to leverage existing Jest-style test code within a Vitest-powered environment.