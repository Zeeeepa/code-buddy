---
title: "tests — doctor"
module: "tests-doctor"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.883Z"
---
# tests — doctor

This document describes the `tests/doctor/doctor.test.ts` module, which is responsible for verifying the functionality and output of the core `doctor` health check system.

## Module: `tests/doctor/doctor.test.ts`

### Purpose

The `doctor.test.ts` module serves as the primary test suite for the `src/doctor` module. Its main goal is to ensure that the `runDoctorChecks` function correctly identifies system health issues, reports accurate statuses (`ok`, `warn`, `error`), and provides meaningful messages for various environmental checks.

This test suite is crucial for maintaining the reliability of the `doctor` command, ensuring it provides consistent and actionable feedback to developers about their local environment setup.

### Overview

The test suite operates by executing the `runDoctorChecks` function once before all tests. The results, an array of `DoctorCheck` objects, are then used across multiple individual test cases (`it` blocks) to assert specific properties and outcomes. This approach ensures efficiency by avoiding redundant execution of the potentially resource-intensive `doctor` checks.

### Test Setup (`beforeAll`)

Before any individual test case runs, the `beforeAll` hook is used to invoke the `runDoctorChecks` function. This function is called with `process.cwd()`, meaning the doctor checks are performed against the current working directory where the tests are executed. The returned array of `DoctorCheck` objects is stored in a `checks` variable, making it accessible to all subsequent `it` blocks within the `describe` suite.

```mermaid
graph TD
    A[describe('Doctor')] --> B(beforeAll);
    B --> C{runDoctorChecks(process.cwd())};
    C --> D[checks = DoctorCheck[]];
    D --> E[it('should return array')];
    D --> F[it('should have valid status')];
    D --> G[it('should pass Node.js')];
    D --> H[it('should detect git')];
    D --> I[it('should check API keys')];
    D --> J[it('should check disk space')];
```

### Test Cases

The `doctor.test.ts` module includes several specific test cases to validate different aspects of the `doctor` module's output.

#### 1. General Result Structure

```typescript
it('should return an array of checks', () => { /* ... */ });
it('should have valid status values for all checks', () => { /* ... */ });
```

These tests verify the fundamental structure and content of the `runDoctorChecks` output:
*   It asserts that `checks` is indeed an array and contains at least one check.
*   It iterates through all returned `DoctorCheck` objects, ensuring each has a `status` property that is one of `'ok'`, `'warn'`, or `'error'`.
*   It also verifies that `name` and `message` properties are truthy for all checks, indicating that each check provides a clear identifier and a descriptive message.

#### 2. Node.js Version Check

```typescript
it('should pass Node.js version check', () => { /* ... */ });
```

This test specifically targets the "Node.js version" check. It expects this check to exist within the results and to have an `'ok'` status, assuming the test environment's Node.js version meets the requirements.

#### 3. Git Repository Check

```typescript
it('should detect git in a git repo', () => { /* ... */ });
```

This test verifies the "Git" check. It expects the check to be present and its status to be either `'ok'` or `'warn'`.
*   If the status is `'ok'`, it asserts that the message indicates being "inside a git repo".
*   If the status is `'warn'`, it asserts that the message indicates "not inside a git repo".
This conditional assertion accounts for the fact that the test environment itself might or might not be a Git repository.

#### 4. API Key Checks

```typescript
it('should check API keys', () => { /* ... */ });
```

This test focuses on the API key checks. It filters the results for checks whose names start with "API key:" and asserts that exactly four such checks are found. This ensures that all expected API key checks (e.g., for different services) are being performed and reported.

#### 5. Disk Space Check

```typescript
it('should check disk space', () => { /* ... */ });
```

This test verifies the "Disk space" check. It expects this check to be present and its status to be either `'ok'` or `'warn'`, reflecting the current disk space availability of the test environment.

### Key Takeaways for Developers

*   **Robustness of `doctor` output**: These tests ensure that the `DoctorCheck` interface is consistently implemented and that `runDoctorChecks` always returns well-formed, predictable data.
*   **Environmental Sensitivity**: Many tests (e.g., Git, Disk space) are designed to pass even if the test environment isn't perfectly configured, by checking for both 'ok' and 'warn' statuses. This makes the tests resilient while still verifying the logic.
*   **Adding New Checks**: If you add a new check to the `src/doctor` module, you should add a corresponding `it` block here to verify its presence, status, and message.

### Related Modules

*   **`src/doctor/index.ts`**: This is the core module being tested. It exports `runDoctorChecks` and the `DoctorCheck` interface.
*   **`src/doctor/checks/*.ts`**: Individual check implementations that `runDoctorChecks` aggregates.