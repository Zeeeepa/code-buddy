---
title: "src — benchmarks"
module: "src-benchmarks"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.381Z"
---
# src — benchmarks

The `src/benchmarks/performance-benchmarks.ts` module provides a robust framework for defining, running, and analyzing performance benchmarks within the codebase. Its primary goal is to enable automated measurement and tracking of key performance indicators such as execution latency, memory usage, and throughput for various operations. This helps identify performance regressions and ensures the application remains performant as it evolves.

## Purpose

This module serves as the central hub for performance testing. It allows developers to:

*   **Define benchmarks**: Easily create new benchmarks for specific code paths or functionalities.
*   **Execute benchmarks**: Run individual benchmarks or collections of benchmarks (suites) with configurable options like iterations and memory collection.
*   **Collect system information**: Automatically gather details about the execution environment (OS, CPU, memory, Node.js version).
*   **Persist results**: Save benchmark outcomes to JSON files for historical tracking and analysis.
*   **Format and display results**: Generate human-readable reports in the console.
*   **Compare with baselines**: Analyze performance changes against previous benchmark runs.

## Core Concepts

The module defines several interfaces to structure benchmark data:

*   **`BenchmarkOptions`**: Configures how a benchmark or suite runs (e.g., `iterations`, `warmupIterations`, `collectMemory`, `outputDir`).
*   **`BenchmarkResult`**: Stores the outcome of a single benchmark run, including average time, min/max times, standard deviation, operations per second, and memory usage.
*   **`SystemInfo`**: Captures details about the system where benchmarks were executed (platform, architecture, CPU count, memory, Node.js version).
*   **`BenchmarkSuite`**: Aggregates multiple `BenchmarkResult` objects, along with overall duration and `SystemInfo`, representing a complete benchmark run.

## The `BenchmarkRunner` Class

The `BenchmarkRunner` is the central orchestrator for executing and managing benchmarks.

```mermaid
graph TD
    A[BenchmarkRunner] --> B{constructor(options?)}
    B --> C[benchmark(name, fn, options?)]
    B --> D[runSuite(name, benchmarks)]
    B --> E[saveResults(suite)]
    B --> F[formatResults(suite)]
    B --> G[compareWithBaseline(suite, baselinePath)]

    D --> C
    D --> H[getSystemInfo()]
    E -- uses --> I[fs-extra.ensureDir]
    E -- uses --> I[fs-extra.writeJson]
    G -- uses --> I[fs-extra.readJson]
```

### `constructor(options?: BenchmarkOptions)`

Initializes the runner with default or provided options. These options dictate global behavior for benchmarks run by this instance, such as the number of iterations or whether to collect memory statistics.

### `benchmark(name: string, fn: () => Promise<void> | void, options?: Partial<BenchmarkOptions>): Promise<BenchmarkResult>`

This is the core method for running a single benchmark. It executes the provided function `fn` multiple times, measures its execution time, and calculates various statistics.

**Execution Flow:**
1.  **Warmup**: `fn` is executed a few times without measurement to allow JIT compilers to optimize the code.
2.  **Garbage Collection**: If `global.gc` is available (requires `--expose-gc` Node.js flag), a garbage collection cycle is forced to ensure consistent memory measurements.
3.  **Measurement**: `fn` is executed for the specified number of `iterations`, and `performance.now()` is used to record the duration of each run.
4.  **Memory Collection**: If `collectMemory` is enabled, `process.memoryUsage().heapUsed` is captured before and after iterations to estimate memory consumption.
5.  **Statistical Analysis**: Calculates total time, average time, min/max times, standard deviation, and operations per second.
6.  **Result**: Returns a `BenchmarkResult` object.

### `runSuite(name: string, benchmarks: Array<{ name: string; fn: () => Promise<void> | void }>): Promise<BenchmarkSuite>`

Orchestrates the execution of multiple individual benchmarks as a named suite. It iterates through the provided array of benchmark definitions, calling `this.benchmark` for each. It logs progress and aggregates all results into a `BenchmarkSuite` object.

### `private getSystemInfo(): SystemInfo`

A private helper method that gathers system-level information using Node.js's `os` and `process` modules. This data is included in the `BenchmarkSuite` to provide context for the results.

### `saveResults(suite: BenchmarkSuite): Promise<string>`

Persists the entire `BenchmarkSuite` object to a JSON file. The file is named based on the suite's name and a timestamp, and stored in the `outputDir` specified in the runner's options (defaulting to `.benchmarks`). It uses `fs-extra` for file system operations.

### `formatResults(suite: BenchmarkSuite): string`

Generates a human-readable, formatted string representation of the benchmark suite's results. This includes system information, a table of individual benchmark results (Avg, Min, Max, Ops/s), and a summary.

### `compareWithBaseline(suite: BenchmarkSuite, baselinePath: string): Promise<string>`

Compares the current `BenchmarkSuite`'s results against a previously saved baseline JSON file. It generates a report showing the percentage change for each benchmark, highlighting significant deviations.

## Benchmark Utilities (`benchmarks` object)

The `benchmarks` export provides a collection of helper functions useful for writing benchmark functions:

*   **`measureAsync<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }>`**: A generic utility to measure the execution time of an asynchronous function.
*   **`measureSync<T>(fn: () => T): { result: T; duration: number }`**: A generic utility to measure the execution time of a synchronous function.
*   **`createString(sizeInKB: number): string`**: Generates a string of a specified size in kilobytes, useful for testing string manipulation or I/O with varying data sizes.
*   **`createTestFile(filePath: string, sizeInKB: number): Promise<void>`**: Creates a temporary file with content of a specified size, used for file I/O benchmarks.
*   **`cleanup(dir: string): Promise<void>`**: Removes a directory and its contents, typically used to clean up temporary files created during benchmarks.

## Pre-defined Benchmark Suites

The module also includes functions to run pre-configured benchmark suites:

### `runCoreEngineBenchmarks(runner: BenchmarkRunner): Promise<BenchmarkSuite>`

This function defines and runs a suite of benchmarks focused on core engine operations. It includes tests for:
*   JSON parsing (various sizes)
*   String manipulations
*   Regular expression matching
*   Array operations
*   Map operations
*   File read/write operations (various sizes)

It creates a temporary directory for file I/O tests and cleans it up afterwards.

### `runAllBenchmarks(options?: BenchmarkOptions): Promise<BenchmarkSuite[]>`

This is the main entry point for executing all defined benchmark suites. It initializes a `BenchmarkRunner` and then calls `runCoreEngineBenchmarks` (and potentially other suites if added in the future). It returns an array of `BenchmarkSuite` objects.

## Usage and Integration

To run benchmarks, you would typically import `runAllBenchmarks` and execute it:

```typescript
import { runAllBenchmarks, BenchmarkRunner } from './src/benchmarks/performance-benchmarks.js';
import { logger } from './src/utils/logger.js';

async function main() {
  const runner = new BenchmarkRunner({
    iterations: 50,
    collectMemory: true,
    outputDir: './benchmark-results',
  });

  logger.info('Starting all benchmarks...');
  const suites = await runAllBenchmarks(runner.options); // Pass options to runAllBenchmarks

  for (const suite of suites) {
    const formattedResults = runner.formatResults(suite);
    logger.info(formattedResults);

    const filepath = await runner.saveResults(suite);
    logger.info(`Results saved to: ${filepath}`);

    // Example: Compare with a baseline
    // try {
    //   const baselinePath = './benchmark-results/benchmark-core-engine-1678888888888.json';
    //   const comparison = await runner.compareWithBaseline(suite, baselinePath);
    //   logger.info(comparison);
    // } catch (error) {
    //   logger.warn('Could not compare with baseline:', error.message);
    // }
  }
  logger.info('All benchmarks completed.');
}

main().catch(console.error);
```

This module is primarily consumed by `tests/unit/performance-benchmarks.test.ts` for automated testing and validation of the benchmarking framework itself, ensuring its accuracy and functionality. It's also intended for direct execution to gather performance metrics.