---
title: "Root — stryker.conf.json"
module: "root-stryker-conf-json"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.287Z"
---
# Root — stryker.conf.json

This document details the `stryker.conf.json` file, which serves as the primary configuration for Stryker Mutator within this project.

## `stryker.conf.json`: Stryker Mutator Configuration

The `stryker.conf.json` file is a crucial part of our quality assurance pipeline, defining how mutation testing is performed on the codebase. It dictates which files are mutated, how tests are run against those mutations, and how results are reported.

### Purpose

The main purpose of `stryker.conf.json` is to configure the Stryker Mutator tool. Stryker introduces small, controlled changes (mutations) to the source code and then runs the project's tests against these mutated versions. If a test suite passes against a mutated version of the code, it indicates that the tests are not robust enough to "kill" that mutation, suggesting a potential gap in test coverage or logic.

This configuration file ensures:
*   **Targeted Mutation**: Only relevant source files are mutated, excluding tests, type definitions, and external dependencies.
*   **Correct Test Execution**: Stryker uses the project's existing test runner (Jest) with the correct configuration.
*   **Meaningful Reporting**: Results are presented in various formats (HTML, console, dashboard) and evaluated against defined thresholds.
*   **Optimized Performance**: Settings for concurrency, timeouts, and incremental runs help manage the resource-intensive nature of mutation testing.

### How it Works

When the `stryker` CLI command is executed (e.g., `stryker run`), it reads this `stryker.conf.json` file to determine its operational parameters. It then:
1.  Identifies the files to mutate based on the `mutate` patterns.
2.  Sets up the specified `testRunner` (Jest) using the provided `jest.configFile`.
3.  Applies various performance and reporting settings.
4.  Executes the mutation testing process, generating reports as configured.

This file is static and is consumed directly by the Stryker application; it does not contain executable code or define any internal execution flows within our project's runtime.

### Key Configuration Sections

The `stryker.conf.json` is structured into several logical sections, each controlling a specific aspect of the mutation testing process.

#### 1. General Settings

These settings define the overall environment and basic behavior of Stryker.

*   `$schema`: Points to the official Stryker schema for JSON validation, aiding in configuration correctness and IDE autocompletion.
*   `packageManager`: Specifies the package manager used by the project (`npm`).
*   `reporters`: An array of reporters to use for outputting results.
    ```json
    "reporters": ["html", "clear-text", "progress", "dashboard"]
    ```
    *   `html`: Generates a detailed HTML report.
    *   `clear-text`: Outputs a summary to the console.
    *   `progress`: Shows a progress bar during execution.
    *   `dashboard`: Sends results to the Stryker Dashboard for historical tracking and visualization.
*   `logLevel`: Controls the verbosity of Stryker's console output (`info`).

#### 2. Test Runner Integration

This section configures how Stryker interacts with our testing framework.

*   `testRunner`: Specifies the test runner to integrate with (`jest`).
*   `jest`: An object containing Jest-specific configuration.
    ```json
    "jest": {
      "projectType": "custom",
      "configFile": "jest.config.js",
      "enableFindRelatedTests": true
    }
    ```
    *   `projectType`: Set to `custom` to indicate we're providing our own `configFile`.
    *   `configFile`: Points to our project's main Jest configuration file, ensuring Stryker uses the same test setup.
    *   `enableFindRelatedTests`: Optimizes test execution by only running tests related to the mutated file, significantly speeding up the process.
*   `coverageAnalysis`: Determines how test coverage information is used.
    ```json
    "coverageAnalysis": "perTest"
    ```
    `perTest` means Stryker will analyze which tests cover which parts of the code, allowing it to run only relevant tests for each mutation, further optimizing performance.

#### 3. Mutation Scope

These patterns define which files are considered for mutation and which are explicitly ignored.

*   `mutate`: An array of glob patterns specifying files to include (`src/**/*.ts`) and exclude (`!src/**/*.test.ts`, `!src/**/*.spec.ts`, `!src/**/*.d.ts`, `!src/types/**/*.ts`, `!src/index.ts`). This ensures only application logic is mutated, not tests, type definitions, or entry points.
*   `ignorePatterns`: An array of glob patterns for directories and files that Stryker should completely ignore, regardless of `mutate` patterns. This typically includes build outputs, dependencies, and test-related directories.
    ```json
    "ignorePatterns": [
      "node_modules",
      "dist",
      "coverage",
      "tests"
    ]
    ```
*   `mutator.excludedMutations`: An array of specific mutation types to exclude.
    ```json
    "mutator": {
      "excludedMutations": [
        "StringLiteral",
        "ObjectLiteral"
      ]
    }
    ```
    Excluding `StringLiteral` and `ObjectLiteral` mutations can reduce noise from mutations that are often trivial or lead to non-deterministic test failures, allowing focus on more critical logic mutations.

#### 4. Performance & Resources

Settings to control the execution speed and resource consumption of Stryker.

*   `timeoutMS`: The maximum time (in milliseconds) a single test run is allowed before being considered a timeout.
    ```json
    "timeoutMS": 60000 // 60 seconds
    ```
*   `timeoutFactor`: A multiplier applied to the baseline test run duration to determine the actual timeout for a mutated test run. This accounts for potential performance degradation due to mutations.
    ```json
    "timeoutFactor": 2
    ```
*   `concurrency`: The number of parallel test runner processes Stryker will spawn. This should be tuned based on available CPU cores to balance speed and resource usage.
    ```json
    "concurrency": 4
    ```

#### 5. Reporting & Thresholds

Configuration for how mutation results are presented and evaluated.

*   `htmlReporter`: Specific settings for the HTML report.
    ```json
    "htmlReporter": {
      "fileName": "reports/mutation/mutation.html"
    }
    ```
    This specifies the output path for the generated HTML report.
*   `dashboard`: Configuration for sending results to the Stryker Dashboard.
    ```json
    "dashboard": {
      "project": "github.com/phuetz/code-buddy",
      "version": "main",
      "module": "code-buddy"
    }
    ```
    These parameters identify the project, branch (`version`), and specific module for dashboard reporting, enabling historical tracking and comparison of mutation scores.
*   `thresholds`: Defines acceptable mutation score percentages.
    ```json
    "thresholds": {
      "high": 80,
      "low": 60,
      "break": 50
    }
    ```
    *   `high`: Score above this is considered excellent.
    *   `low`: Score below this indicates a warning.
    *   `break`: Score below this will cause the Stryker process to exit with a non-zero code, failing CI/CD builds.

#### 6. Type Checking & Incremental Runs

Advanced settings for type checking and optimizing subsequent runs.

*   `disableTypeChecks`: A glob pattern for files where type checking should be disabled during mutation. This can speed up runs but should be used carefully.
    ```json
    "disableTypeChecks": "{src/**/*.ts,src/**/*.tsx}"
    ```
*   `checkers`: An array of checkers to use. `typescript` ensures that mutations are type-checked before running tests, preventing invalid code from being tested.
*   `tsconfigFile`: Points to the project's TypeScript configuration file.
*   `incremental`: Enables incremental mutation testing. If `true`, Stryker will only re-mutate and re-test files that have changed since the last run.
*   `incrementalFile`: The path to the file where Stryker stores its incremental cache.
*   `cleanTempDir`: If `true`, Stryker will clean up its temporary directory after each run.
*   `tempDirName`: The name of the temporary directory Stryker uses.

### How it Connects to the Project

`stryker.conf.json` is integral to our project's quality assurance strategy:

*   **Development Workflow**: Developers can run Stryker locally to assess the quality of their tests and identify areas needing better coverage or more specific assertions.
*   **CI/CD Pipeline**: This configuration is used in our continuous integration pipeline to enforce mutation score thresholds. If the mutation score falls below the `break` threshold, the build will fail, preventing regressions in test quality from being merged.
*   **Code Health Monitoring**: The `dashboard` reporter pushes results to the Stryker Dashboard, providing a historical view of our mutation score and helping track the evolution of our test suite's effectiveness over time.

### Contributing and Modifying

When modifying `stryker.conf.json`, consider the following:

*   **Impact on Performance**: Changes to `concurrency`, `timeoutMS`, `timeoutFactor`, `coverageAnalysis`, and `enableFindRelatedTests` can significantly affect the execution time of mutation tests.
*   **Mutation Scope**: Carefully adjust `mutate` and `ignorePatterns` to ensure all relevant code is tested without wasting resources on irrelevant files.
*   **Thresholds**: Adjust `thresholds` as the project matures or specific modules require stricter (or more lenient) quality gates.
*   **New Features**: If new testing frameworks or build tools are introduced, the `testRunner` and related configurations may need updates.
*   **Schema Validation**: Leverage the `$schema` definition for IDE assistance to ensure your configuration remains valid.