---
title: "Root — is-even.ts"
module: "root-is-even-ts"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.233Z"
---
# Root — is-even.ts

## Module: `is-even.ts`

### Overview

The `is-even.ts` module provides a single, focused utility function designed to determine if a given numeric input is an even number. It encapsulates a fundamental mathematical check, promoting code clarity and reusability across the codebase wherever such a determination is needed.

### Key Component: `isEven` Function

#### Purpose
The `isEven` function serves as the primary export of this module, offering a straightforward way to check the evenness of a number.

#### Signature
```typescript
export const isEven = (n: number): boolean => { /* ... */ };
```

#### Parameters
*   `n`: `number` - The number to be evaluated for evenness.

#### Return Value
*   `boolean` - Returns `true` if `n` is an even number, and `false` otherwise.

#### Implementation Details
The function's logic relies on the JavaScript modulo operator (`%`). An integer `n` is considered even if the remainder of its division by 2 is exactly 0.

```typescript
export const isEven = (n: number) => n % 2 === 0;
```

This implementation correctly handles positive, negative, and zero integers. For non-integer numbers, the modulo operator's behavior in JavaScript will determine the outcome (e.g., `2.5 % 2` is `0.5`, resulting in `false`). For `NaN` or `Infinity`, `n % 2` evaluates to `NaN`, which is not strictly equal to `0`, thus returning `false`. This behavior is generally robust for typical use cases.

### Usage

To incorporate the `isEven` utility into another module, simply import it and invoke the function with the number you wish to check:

```typescript
import { isEven } from './is-even'; // Adjust the import path as necessary

const value1 = 6;
const value2 = 11;
const value3 = 0;
const value4 = -8;

console.log(`${value1} is even:`, isEven(value1)); // Output: 6 is even: true
console.log(`${value2} is even:`, isEven(value2)); // Output: 11 is even: false
console.log(`${value3} is even:`, isEven(value3)); // Output: 0 is even: true
console.log(`${value4} is even:`, isEven(value4)); // Output: -8 is even: true
```

### Integration and Dependencies

Based on the provided call graph and execution flow data:
*   **Internal calls**: None
*   **Outgoing calls**: None
*   **Incoming calls**: None

This module is entirely self-contained, having no internal dependencies on other modules and making no calls to external functions or modules. While the call graph indicates no *current* incoming calls, its design as an `export const` utility means its primary purpose is to be imported and utilized by other modules that require an evenness check. It acts as a foundational, independent utility that other parts of the application can depend on.

### Contributing and Testing

Given the simplicity and clarity of the `isEven` function, contributions would typically focus on:

*   **Robustness for Edge Cases**: While the current implementation is standard, if specific project requirements demand different handling for `NaN`, `Infinity`, or very large numbers (e.g., `Number.MAX_SAFE_INTEGER + 1`), the logic could be extended. However, for most practical purposes, the current behavior is sufficient.
*   **Performance**: For extremely performance-critical scenarios, bitwise operations (`(n & 1) === 0`) can sometimes offer a marginal speed improvement over the modulo operator. However, `n % 2 === 0` is highly readable and typically well-optimized by modern JavaScript engines, making it the preferred choice for maintainability.

To ensure the module's correctness, unit tests should cover various inputs:

```typescript
// Example unit test structure (using a hypothetical test framework like Jest)
import { isEven } from '../src/is-even'; // Adjust path to the module

describe('isEven', () => {
  it('should return true for positive even integers', () => {
    expect(isEven(2)).toBe(true);
    expect(isEven(100)).toBe(true);
  });

  it('should return true for zero', () => {
    expect(isEven(0)).toBe(true);
  });

  it('should return true for negative even integers', () => {
    expect(isEven(-4)).toBe(true);
    expect(isEven(-98)).toBe(true);
  });

  it('should return false for positive odd integers', () => {
    expect(isEven(1)).toBe(false);
    expect(isEven(99)).toBe(false);
  });

  it('should return false for negative odd integers', () => {
    expect(isEven(-3)).toBe(false);
    expect(isEven(-97)).toBe(false);
  });

  it('should handle non-integer numbers based on JS modulo behavior', () => {
    expect(isEven(2.0)).toBe(true);  // 2.0 % 2 === 0
    expect(isEven(2.5)).toBe(false); // 2.5 % 2 === 0.5
    expect(isEven(-1.5)).toBe(false); // -1.5 % 2 === -1.5
  });

  it('should return false for NaN and Infinity', () => {
    expect(isEven(NaN)).toBe(false);       // NaN % 2 === NaN
    expect(isEven(Infinity)).toBe(false);  // Infinity % 2 === NaN
    expect(isEven(-Infinity)).toBe(false); // -Infinity % 2 === NaN
  });
});
```