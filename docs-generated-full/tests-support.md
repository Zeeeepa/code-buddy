---
title: "tests — support"
module: "tests-support"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:28.024Z"
---
# tests — support

## Module: `tests/support/jest-globals.ts`

This module serves as a foundational component for the project's testing infrastructure, specifically designed to provide a consistent and familiar testing environment, particularly for developers accustomed to Jest. It acts as a re-export layer, making core Vitest testing utilities globally available and offering a Jest-compatible alias.

### Purpose and Context

The primary purpose of `jest-globals.ts` is to:

1.  **Centralize Test Utility Exports:** Provide a single point of truth for common testing functions (like `describe`, `it`, `expect`) that are made available globally in test files.
2.  **Facilitate Jest Compatibility/Migration:** By re-exporting Vitest's utilities and aliasing `vi` to `jest`, it allows test files to be written with a syntax highly similar to Jest, easing potential migrations from Jest to Vitest or maintaining a consistent mental model for developers familiar with Jest.
3.  **Simplify Test File Authoring:** When configured correctly (e.g., via Vitest's `setupFiles` option), developers do not need to explicitly import these common utilities in every test file, leading to cleaner and more concise test code.

### Overview

This module is a straightforward re-export file. It imports a set of standard testing functions and objects directly from the `vitest` library and then exports them. Additionally, it provides an alias for Vitest's mocking utility (`vi`) as `jest`, enhancing compatibility.

### Key Exports

The module exports the following members, all sourced directly from `vitest`:

*   `afterAll`: Runs a function once after all tests in a file or suite have finished.
*   `afterEach`: Runs a function after each test in a file or suite.
*   `beforeAll`: Runs a function once before all tests in a file or suite begin.
*   `beforeEach`: Runs a function before each test in a file or suite.
*   `describe`: Groups related tests together into a test suite.
*   `expect`: Provides assertion utilities for testing values.
*   `it`: Defines an individual test case (alias for `test`).
*   `test`: Defines an individual test case.
*   `vi`: Vitest's built-in mocking utility.
*   `jest`: An alias for `vi`, providing Jest-like access to mocking functionalities.

### How it Works

The implementation is minimal:

```typescript
// tests/support/jest-globals.ts
export {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  test,
  vi,
} from 'vitest';

export { vi as jest } from 'vitest';
```

When this file is included in the Vitest test environment setup (typically via the `setupFiles` or `globals` configuration in `vitest.config.ts`), these exports become globally available within all test files. This means a test file does not need `import { describe, expect, it } from 'vitest';` at the top.

### Usage Example

Given that `jest-globals.ts` is configured to be loaded globally, a typical test file would look like this:

```typescript
// src/my-module.test.ts (example)

describe('MyModule', () => {
  beforeEach(() => {
    // Setup before each test
  });

  it('should perform a specific action', () => {
    const result = someFunction();
    expect(result).toBe('expectedValue');
  });

  it('should mock a dependency using the jest alias', () => {
    const mockFn = jest.fn(() => 'mocked result');
    // ... use mockFn
    expect(mockFn).toHaveBeenCalledTimes(1);
  });
});
```

Notice that `describe`, `beforeEach`, `it`, `expect`, and `jest` are used directly without explicit imports.

### Integration and Best Practices

*   **Test Infrastructure:** This module is a core part of the `tests/support` directory, which typically houses utilities and configurations that support the overall testing strategy.
*   **Configuration:** Its effectiveness relies on proper configuration within `vitest.config.ts`. For example, you might see a configuration similar to this:

    ```typescript
    // vitest.config.ts
    import { defineConfig } from 'vitest/config';

    export default defineConfig({
      test: {
        globals: true, // Makes these globals available
        setupFiles: ['./tests/support/jest-globals.ts'], // Or similar, depending on how globals are exposed
        // ... other Vitest options
      },
    });
    ```

    *Note: Vitest's `globals: true` option often makes its own core utilities globally available. This `jest-globals.ts` module is particularly useful for adding the `jest` alias or for custom global setups.*

*   **Maintainability:** By centralizing these exports, any future changes to the global testing environment (e.g., adding another global utility or changing the source of a utility) can be managed in this single file, rather than modifying numerous test files.