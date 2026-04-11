---
title: "tests — ui"
module: "tests-ui"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:28.051Z"
---
# tests — ui

The `tests/ui` module contains a comprehensive suite of unit and integration tests for the user interface components and utilities located in `src/ui`. Its primary purpose is to ensure the correctness, reliability, and accessibility of the application's interactive elements and underlying UI logic.

These tests are crucial for maintaining the quality of the user experience, especially given the terminal-based nature of the UI, which often involves complex state management, keyboard interactions, and rendering logic.

## Testing Philosophy

The tests in this module generally follow these principles:

*   **Pure Logic First**: Where possible, pure functions and utility logic (e.g., accessibility calculations, diff parsing, shortcut management) are tested in isolation without UI rendering.
*   **Component Isolation**: UI components (especially `ink` components) are tested in isolation using mocks for their dependencies and rendering environments.
*   **Persistence Verification**: Modules that manage configuration or data persistence (e.g., `ShortcutManager`, `ThemeManager`, `MetricsDashboard`) are tested to ensure data is correctly saved and loaded.
*   **Snapshot Testing**: For `ink` components, snapshot tests are used to guard against unintended rendering changes.

## Module Breakdown

Each test file targets a specific UI component or utility, ensuring its functionality meets expectations.

### `accessibility.test.ts`

This file tests the pure logic utilities found in `src/ui/utils/accessibility.ts`. These functions are critical for ensuring the application meets accessibility standards, particularly concerning color contrast and ARIA attributes.

**Key Functions Tested:**

*   `calculateContrastRatio(color1: string, color2: string)`: Verifies the accurate calculation of WCAG contrast ratios, including edge cases like identical colors or invalid inputs.
*   `checkContrast(color1: string, color2: string, isLargeText?: boolean)`: Assesses if a color pair meets WCAG AA and AAA contrast requirements for normal and large text.
*   `getHighContrastColor(color: string, background: string, targetRatio?: number)`: Tests the logic for adjusting a color to meet a minimum contrast ratio against a given background.
*   `generateAriaLabel(label: string, context?: AriaLabelContext)`: Ensures correct construction of ARIA labels by combining a base label with optional role, index, total, and state information.
*   `getAnimationDuration(defaultDuration: number, reducedMotion: boolean)`: Verifies that animation durations are correctly returned, respecting the `reducedMotion` preference.

**Testing Patterns:**
These tests focus purely on input/output of functions, using `toBeCloseTo` for floating-point comparisons and checking boolean flags for contrast results.

### `chat-interface.test.tsx`

This file contains UI component tests for `ink`-based components related to the chat interface. It uses a custom mock for `ink-testing-library` to extract rendered text content from React elements, allowing for assertion against the visible output.

**Key Components Tested:**

*   `MockChatMessage`: A simplified representation of a chat message component, testing how user and assistant messages are rendered, including role and content.
*   `MockProgressBar`: A simplified progress bar component, verifying its visual representation based on a `progress` prop.

**Testing Patterns:**
*   **`ink-testing-library` Mocking**: A custom `vi.mock('ink-testing-library', ...)` is implemented to provide a lightweight `render` function that recursively extracts text from React elements. This avoids the overhead of a full `ink` rendering environment while still allowing content assertions.
*   **`ink` Component Mocking**: `Text` and `Box` components from `ink` are mocked to simply render their children, further simplifying the test environment.
*   **Snapshot Testing**: `toMatchSnapshot()` is used to capture the rendered output of `MockChatMessage` and `MockProgressBar`, ensuring consistent UI rendering over time.

### `diff-renderer-logic.test.ts`

This file focuses on the parsing logic for displaying code differences, specifically the `parseDiffWithLineNumbers` function from `src/ui/components/DiffRenderer.ts`. This function is responsible for transforming raw diff strings into a structured format suitable for rendering.

**Key Function Tested:**

*   `parseDiffWithLineNumbers(diff: string)`: Verifies that various diff formats (additions, deletions, context lines, mixed changes, git headers, "No newline at end of file" markers) are correctly parsed into an array of structured line objects, including line numbers and types.

**Testing Patterns:**
Tests provide various diff string inputs and assert the structure and content of the returned array, ensuring accurate interpretation of diff syntax.

### `keyboard-shortcuts.test.ts`

This file tests the `ShortcutManager` class, which handles the definition, management, and persistence of keyboard shortcuts within the application. It's crucial for customizable and accessible keyboard navigation.

**Key Class Tested:**

*   `ShortcutManager`:
    *   **Defaults**: Ensures all `DEFAULT_SHORTCUTS` are loaded and `currentBinding` matches `defaultBinding` initially.
    *   **Retrieval**: Tests `getAction(id)` and `getActionForKey(key, modifiers)` for correct action lookup.
    *   **Binding Management**: Verifies `setBinding(id, newBinding)` for rebinding actions, including conflict detection.
    *   **Resetting**: Tests `resetBinding(id)` and `resetAllBindings()` to restore default bindings.
    *   **Enabling/Disabling**: Checks `setEnabled(id, enabled)` to control action availability.
    *   **Formatting**: Tests `formatBinding(binding)` for human-readable key combinations and `formatShortcutsList()` for generating a comprehensive list.
    *   **Persistence**: Ensures custom bindings and enabled/disabled states are correctly saved to and loaded from a JSON file.

**Testing Patterns:**
*   **Temporary Directory (`tmpDir`)**: `fs-extra` and `os.tmpdir()` are used to create and clean up temporary directories for `shortcuts.json` files, preventing test-induced side effects on the actual user configuration.
*   **State Management**: Tests verify the internal state of the `ShortcutManager` after various operations (setting, resetting, enabling).

### `metrics-dashboard.test.ts`

This file tests the `MetricsDashboard` class, responsible for collecting, aggregating, and presenting usage metrics (sessions, messages, tokens, tool calls, costs). This data is vital for understanding application usage and performance.

**Key Class Tested:**

*   `MetricsDashboard`:
    *   **Session Tracking**: Verifies `startSession(id)` and `endSession(id)` correctly track session counts and durations.
    *   **Message Tracking**: Tests `recordMessage(sessionId, tokens, cost)` for accumulating message counts, token usage, and costs.
    *   **Tool Call Tracking**: Ensures `recordToolCall(sessionId, toolName, success, duration)` accurately records tool usage, success/failure rates, and average durations.
    *   **Data Aggregation**: Tests `getDashboardData()` for correctly calculating summary statistics (e.g., `avgSessionDuration`, `avgMessagesPerSession`), daily metrics, and tool usage breakdowns.
    *   **Trends**: Checks the logic for determining usage and error trends.
    *   **Formatting**: Verifies `formatDashboard()` generates a readable text representation of the metrics.
    *   **Persistence**: Ensures all collected metrics are correctly saved to and loaded from a JSON file.
    *   **Clearing**: Tests `clear()` to reset all metrics.

**Testing Patterns:**
*   **Temporary Directory (`tmpDir`)**: Similar to `ShortcutManager`, `fs-extra` is used to manage a temporary `metrics.json` file for persistence tests.
*   **Time Manipulation**: Manual setting of `startTime` and `endTime` for sessions is used to ensure predictable duration calculations.
*   **Data Structure Assertions**: Tests extensively assert the structure and values within the `DashboardData` object returned by `getDashboardData()`.

### `status-line.test.ts`

This file tests the `StatusLineManager` class, which controls the dynamic status line displayed in the UI. This component provides real-time information like the current model, Git branch, token usage, and custom messages.

**Key Class Tested:**

*   `StatusLineManager`:
    *   **Configuration**: Tests constructor options, `enable()`, `disable()`, and `getConfig()` for managing the status line's behavior.
    *   **Data Management**: Verifies `updateData(newData)` correctly merges and updates internal status data, and `getData()` returns a safe copy.
    *   **Rendering**: Tests `render()` to ensure the status line output correctly reflects the current data, including model name, Git branch, uncommitted changes, and custom content.
    *   **Token Formatting**: Specifically checks the human-readable formatting of token usage (e.g., "18K/40K", "45%").
    *   **Custom Templates**: Verifies that a custom `template` string is correctly parsed and placeholders are replaced with dynamic data.
    *   **Script Execution**: Tests `executeScript()` for running external commands and incorporating their output into the status line.
    *   **Refresh Cycle**: Verifies `startRefresh()`, `stopRefresh()`, and `isRefreshing()` correctly manage the periodic update timer.
    *   **Lifecycle**: Tests `dispose()` for proper cleanup and stopping timers.

**Testing Patterns:**
*   **`jest.mock`**: `child_process` (`execSync`) and `../../src/utils/logger.js` are mocked to control external command execution and suppress logging during tests.
*   **Fake Timers**: `jest.useFakeTimers()` is employed to precisely control the `setInterval` calls for the refresh cycle, allowing for deterministic testing of timed operations.
*   **String Assertions**: `toContain()` is heavily used to check for the presence of specific formatted data within the rendered status line string.

### `tabbed-question.test.ts`

This file tests the core logic for the `TabbedQuestion` component, which likely presents a list of options where users can navigate using keyboard input. The tests focus on the selection cycling and option handling.

**Key Logic Tested:**

*   **Option Management**: Verifies that an "Other" option is correctly appended to a list of choices.
*   **Selection Cycling**: Tests the modulo arithmetic used for cycling through options with "Tab" (forward) and "Up Arrow" (backward) keys, including wrap-around behavior.
*   **"Other" Index**: Confirms that the "Other" option is correctly identified as the last index.

**Testing Patterns:**
These are simple, pure logic tests directly manipulating indices and array lengths to simulate user interaction and verify the underlying navigation logic.

### `themes.test.ts`

This file tests the `ThemeManager` class, which manages the application's visual themes, including built-in options and user-defined custom themes. It's essential for providing a customizable and visually consistent experience.

**Key Class Tested:**

*   `ThemeManager`:
    *   **Built-in Themes**: Ensures `BUILTIN_THEMES` are correctly loaded, include expected themes (dark, light, high-contrast), and have all required color keys.
    *   **Theme Selection**: Tests `getTheme()`, `setTheme(id)`, `getColor(key)`, and `getColors()` for selecting and retrieving theme data.
    *   **Custom Themes**: Verifies `addTheme()`, `removeTheme()`, and `getThemeById()` for managing user-defined themes, including handling removal of the currently active theme.
    *   **Theme Creation**: Tests `createFromBase(baseId, newId, newName, overrides)` for generating new themes based on existing ones with specific color overrides.
    *   **Listing**: Ensures `getAllThemes()` returns both built-in and custom themes.
    *   **Formatting**: Tests `formatThemeList()` and `formatThemePreview(id)` for generating human-readable theme information.
    *   **Persistence**: Ensures the active theme preference and any custom themes are correctly saved to and loaded from a JSON file.

**Testing Patterns:**
*   **Temporary Directory (`tmpDir`)**: `fs-extra` is used to manage a temporary `theme.json` file for persistence tests, similar to `ShortcutManager` and `MetricsDashboard`.
*   **Data Structure Assertions**: Tests extensively check the properties of `Theme` and `ThemeColors` objects.

### `tool-stream-output.test.ts`

This file tests the logic for the `ToolStreamOutput` component, which is responsible for displaying potentially long streams of output from tools. The key aspect tested here is the line limiting behavior.

**Key Logic Tested:**

*   **Line Limiting**: Verifies that when the output exceeds a `maxLines` threshold, only the most recent lines are displayed, and the correct number of hidden lines is calculated.
*   **Edge Cases**: Handles scenarios with output shorter than `maxLines` and empty output.

**Testing Patterns:**
These are pure logic tests that simulate tool output strings and assert the `slice` and `Math.max` operations used to manage the displayed lines.

## Common Testing Patterns

### Mocking `ink-testing-library` and `ink`

For `chat-interface.test.tsx`, a custom mock for `ink-testing-library` is implemented. This mock provides a simplified `render` function that recursively traverses the React element tree and extracts plain text. This allows tests to assert against the visible content of `ink` components without needing a full `ink` runtime environment, making tests faster and more focused on the component's output. Similarly, `ink`'s `Text` and `Box` components are mocked to simply render their children.

```mermaid
graph TD
    A[chat-interface.test.tsx] --> B{vi.mock('ink-testing-library')}
    B --> C[render(component)]
    C --> D[extractText(element)]
    D -- Recursively calls --> D
    D -- Returns string --> C
    C -- Provides lastFrame(), rerender() --> A
    A --> E{vi.mock('ink')}
    E --> F[Text / Box components]
    F -- Simply render children --> A
```

### Using `tmpDir` for Persistence Tests

Several modules (`keyboard-shortcuts`, `metrics-dashboard`, `themes`) manage persistent configuration or data. To test their persistence logic without affecting the actual user's configuration files, tests create and clean up temporary directories using `os.tmpdir()` and `fs-extra`. This ensures tests are isolated and repeatable.

```typescript
// Example from keyboard-shortcuts.test.ts
let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'shortcut-test-'));
});

afterEach(async () => {
  await fs.remove(tmpDir);
});

function createManager(): ShortcutManager {
  return new ShortcutManager(path.join(tmpDir, 'shortcuts.json'));
}
```

### Mocking `child_process`

In `status-line.test.ts`, the `child_process` module's `execSync` function is mocked using `jest.mock`. This allows tests to control the output of external commands that the `StatusLineManager` might execute (e.g., to get Git branch information), ensuring deterministic test results and preventing actual system calls during testing.

## Contributing to UI Tests

When contributing to the UI, consider the following:

*   **New Components/Utilities**: Add new test files following the patterns established in this module.
*   **Pure Logic**: If a new utility or a component's internal logic can be tested independently of rendering, create a dedicated test file for its pure functions.
*   **`ink` Components**: For `ink` components, use the `ink-testing-library` mock (or extend it if necessary) and consider snapshot tests for visual consistency.
*   **Persistence**: If your module introduces persistent data, use `tmpDir` for isolated persistence tests.
*   **Accessibility**: Ensure any new UI elements or interactions are tested for accessibility considerations, leveraging the `accessibility` utilities where appropriate.
*   **Keyboard Interaction**: For interactive components, test keyboard navigation and shortcut handling thoroughly.