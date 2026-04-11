---
title: "tests — screen-capture"
module: "tests-screen-capture"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.996Z"
---
# tests — screen-capture

This document describes the `tests/screen-capture/capture.test.ts` module, which serves as the comprehensive test suite for the `CaptureManager` class and related utilities found in `src/screen-capture/index.js`. Its primary purpose is to ensure the robustness, correctness, and expected behavior of the screen capture functionalities.

## Module Purpose

The `capture.test.ts` module is a suite of unit and integration tests designed to validate every aspect of the `CaptureManager` API. It covers:

*   Discovery of displays and windows.
*   Taking single and multiple screenshots with various options.
*   Starting, stopping, pausing, resuming, and canceling screen recordings.
*   Retrieving configuration and statistics.
*   Ensuring the singleton pattern for `CaptureManager` works as expected.
*   Verifying event emission for key operations.

By exercising the `CaptureManager` through a wide range of scenarios, this test suite helps maintain the quality and reliability of the screen capture features.

## Test Structure and Setup

The tests are organized using `describe` blocks, mirroring the functional areas of the `CaptureManager`. Each `describe` block contains multiple `it` blocks, each testing a specific scenario or method behavior.

### Test Hooks

*   **`beforeEach`**: Before each test, a new `CaptureManager` instance is created after calling `resetCaptureManager()`. This ensures that each test starts with a clean, isolated manager instance, preventing state leakage between tests.
*   **`afterEach`**: After each test, it checks if a recording is in progress (`manager.isRecording()`). If so, it calls `manager.cancelRecording()` to clean up any active recording processes. Finally, `resetCaptureManager()` is called again to ensure the singleton instance is cleared for subsequent tests.

```mermaid
graph TD
    A[Test Suite] --> B{beforeEach}
    B --> C[resetCaptureManager()]
    B --> D[manager = new CaptureManager()]
    A --> E{afterEach}
    E --> F{manager.isRecording()?}
    F -- Yes --> G[manager.cancelRecording()]
    G --> H[resetCaptureManager()]
    F -- No --> H
```

## Key Functionalities Tested

The test suite rigorously examines the following areas of the `CaptureManager`:

### Display Discovery

Tests ensure that `CaptureManager` can correctly identify and retrieve information about connected displays.

*   `manager.getDisplays()`: Verifies that a list of displays is returned, each with an `id` and `bounds`.
*   `manager.getPrimaryDisplay()`: Confirms the identification of the primary display.
*   `manager.getDisplay(id)`: Checks if a specific display can be retrieved by its ID.

### Window Discovery

This section validates the ability to discover and query information about open application windows.

*   `manager.getWindows()`: Asserts that a list of windows is returned, each with a `title`.
*   `manager.getWindow(id)`: Confirms retrieval of a specific window by its ID.
*   `manager.findWindows(title)`: Tests finding windows by exact title match.
*   `manager.findWindows(/regex/i)`: Tests finding windows using regular expressions.

### Screenshot

A comprehensive set of tests for the screenshot capabilities, covering various options and scenarios.

*   `manager.takeScreenshot()`: Basic screenshot, verifying `Buffer` data, dimensions, and default `png` format.
*   `manager.takeScreenshot({ format: 'jpeg', quality: 80 })`: Custom format and quality.
*   `manager.takeScreenshot({ region })`: Capturing a specific screen region.
*   `manager.takeScreenshot({ source: 'window', windowId })`: Capturing a specific window.
*   `manager.takeScreenshot({ source: 'display', displayId })`: Capturing a specific display.
*   `manager.takeScreenshot({ delayMs })`: Verifies the delay before capture.
*   `manager.takeScreenshots(count, interval)`: Capturing multiple screenshots in sequence.
*   **Event Emission**: Tests `screenshot-start` and `screenshot-complete` events.

### Recording

This is a critical section, testing the full lifecycle of screen recording.

*   `manager.startRecording({ path })` and `manager.stopRecording()`: Basic start/stop, verifying output path, format, frame count, and duration.
*   **Concurrency**: Ensures `startRecording()` throws an error if a recording is already in progress.
*   `manager.pauseRecording()` and `manager.resumeRecording()`: Tests pausing and resuming, verifying `isPaused()` state.
*   **Error Handling**: Checks for errors when pausing/resuming without an active recording or when resuming a non-paused recording.
*   `manager.cancelRecording()`: Verifies that an ongoing recording can be canceled.
*   `manager.getRecordingStatus()`: Checks the current state, duration, and frame count of a recording.
*   **Event Emission**: Tests `recording-start`, `recording-progress`, `recording-stop`, `recording-complete`, `recording-pause`, and `recording-resume` events.
*   `manager.startRecording({ source: 'window', windowId })`: Recording a specific window.
*   `manager.startRecording({ source: 'region', region })`: Recording a specific screen region.
*   **Idle Status**: Verifies `getRecordingStatus()` returns an 'idle' state when no recording is active.

### Configuration

Tests for managing the `CaptureManager`'s configuration.

*   `manager.getConfig()`: Verifies default configuration properties.
*   `manager.updateConfig(newConfig)`: Ensures configuration can be updated and changes are reflected.

### Statistics

Validation of the `CaptureManager`'s ability to provide runtime statistics.

*   `manager.getStats()`: Checks initial stats (e.g., number of displays/windows, recording status).
*   **Dynamic Stats**: Verifies that `getStats()` accurately reports `isRecording` and `recordingDuration` during an active recording.

### Singleton Behavior

This dedicated `describe` block outside the main `CaptureManager` tests focuses on the singleton pattern implementation.

*   `getCaptureManager()`: Ensures that calling this function multiple times returns the exact same instance.
*   `resetCaptureManager()`: Verifies that calling `resetCaptureManager()` followed by `getCaptureManager()` returns a *new* instance, effectively resetting the singleton.

```mermaid
graph TD
    subgraph Singleton Tests
        A[capture.test.ts]
    end

    subgraph src/screen-capture
        B(CaptureManager Class)
        C(getCaptureManager())
        D(resetCaptureManager())
        E[Singleton Instance]
    end

    A -- Calls --> C
    A -- Calls --> D
    C -- Returns/Creates --> E
    D -- Clears --> E
    A -- Expects same instance --> C
    A -- Expects different instance after reset --> D
```

## Connection to the Codebase

This test module directly interacts with the `CaptureManager` class and its associated functions (`getCaptureManager`, `resetCaptureManager`) from `../../src/screen-capture/index.js`. It serves as the primary validation layer for the entire screen capture subsystem, ensuring that any changes or additions to `CaptureManager` maintain expected behavior and do not introduce regressions.