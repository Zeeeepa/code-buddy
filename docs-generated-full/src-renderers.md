---
title: "src — renderers"
module: "src-renderers"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.651Z"
---
# src — renderers

The `src/renderers` module is a core component responsible for transforming various structured data types into human-readable, terminal-friendly output. It provides a flexible and extensible system for displaying complex information, such as code analysis, test results, diffs, tables, and even SVG charts, directly within a terminal environment.

The module supports two primary display modes:
*   **`plain`**: Minimalist output, suitable for scripting, logging, or environments without rich terminal capabilities.
*   **`fancy`**: Rich, visually enhanced output leveraging ANSI colors, emojis, and box-drawing characters for improved readability and user experience in interactive terminals.

## Architecture Overview

The rendering system is built around a central `RenderManager` that acts as an orchestrator. When data needs to be displayed, the `RenderManager` attempts to find a specialized `Renderer` capable of handling that specific data type. If a specialized renderer is found, it takes over the formatting. Otherwise, the `RenderManager` falls back to a generic rendering mechanism for basic data structures (strings, numbers, arrays, objects).

This design promotes modularity, allowing new data types and their corresponding display logic to be added without modifying the core rendering pipeline.

```mermaid
graph TD
    A[Data (unknown type)] --> B{RenderManager.render(data)};
    B --1. Find matching renderer--> C{Renderer.canRender(data)};
    C -- Yes --> D[Specialized Renderer.render(data, ctx)];
    C -- No --> E[RenderManager.renderGeneric(data, ctx)];
    D --> F[Formatted Terminal Output];
    E --> F;
```

## Core Components

### `RenderManager` (`src/renderers/render-manager.ts`)

The `RenderManager` is a singleton class that manages the lifecycle and dispatch of renderers.

*   **`getRenderManager()`**: Retrieves the singleton instance of the `RenderManager`.
*   **`register<T>(renderer: Renderer<T>)`**: Adds a new `Renderer` to the manager. Renderers are sorted by `priority` (higher values first) to ensure the most specific renderer is chosen when multiple might apply.
*   **`setContext(updates: Partial<RenderContext>)`**: Updates the global rendering context, affecting how all subsequent renders behave (e.g., enabling/disabling colors, setting terminal width).
*   **`render(data: unknown, contextOverrides?: Partial<RenderContext>)`**: The primary method for rendering data. It first calls `findRenderer(data)` to locate a suitable specialized renderer. If found, it delegates rendering to that renderer; otherwise, it uses `renderGeneric`.
*   **`findRenderer(data: unknown)`**: Iterates through registered renderers, calling their `canRender` method to find the first one that can handle the given data.
*   **`renderGeneric(data: unknown, ctx: RenderContext)`**: A fallback mechanism for data types not handled by specialized renderers. It provides basic formatting for strings, numbers, booleans, arrays, and objects. This method further delegates to `renderArray` and `renderObject` for structured generic data.
*   **`renderResponse(data: unknown, ctx?: Partial<RenderContext>)`**: A convenience function that calls `getRenderManager().render()`.
*   **`configureRenderContext(options: { plain?: boolean; noColor?: boolean; noEmoji?: boolean; width?: number; })`**: A utility function to easily configure the global `RenderContext` based on common CLI options.

### `Renderer` Interface (`src/renderers/types.ts`)

All specialized renderers must implement the `Renderer` interface:

```typescript
export interface Renderer<T = unknown> {
  readonly id: string;
  readonly name: string;
  readonly priority?: number; // Higher priority renderers are checked first
  canRender(data: unknown): data is T; // Type guard to check data compatibility
  render(data: T, ctx: RenderContext): string; // Renders the data
}
```

### `RenderContext` (`src/renderers/types.ts`)

The `RenderContext` object provides runtime configuration to renderers, allowing them to adapt their output.

```typescript
export interface RenderContext {
  mode: DisplayMode; // 'plain' or 'fancy'
  color: boolean;    // Whether ANSI colors should be used
  emoji: boolean;    // Whether emojis should be used
  width: number;     // Terminal width for layout adjustments
  height: number;    // Terminal height
  piped: boolean;    // True if output is being piped (non-interactive)
}
```

The `getDefaultRenderContext()` function determines initial context values based on the current terminal environment (e.g., `process.stdout.isTTY`, `process.stdout.columns`).

### Data Types (`src/renderers/types.ts`)

This file defines the structured data interfaces that specialized renderers are designed to handle. Each interface includes a `type` literal property (e.g., `type: 'diff'`) which is used by the `is*Data` type guards (e.g., `isDiffData`) to identify the data's structure.

Key data types include:
*   `DiffData`: For representing code differences.
*   `TestResultsData`: For displaying test execution summaries and individual test cases.
*   `CodeStructureData`: For outlining the structure of a code file (imports, exports, classes, functions, variables).
*   `WeatherData`: For presenting current weather and forecast information.
*   `TableData`: For rendering tabular data with headers and rows.
*   `TreeData`: For visualizing file system or code structure trees.
*   `JsonData`: A generic wrapper for arbitrary JSON data.

## Specialized Renderers

The `renderers` module includes several built-in specialized renderers, each designed for a specific data type:

*   **`codeStructureRenderer` (`src/renderers/code-structure-renderer.ts`)**:
    *   Renders `CodeStructureData`.
    *   Displays imports, exports, classes (with methods/properties), functions, and variables in a hierarchical, tree-like format.
    *   Supports both plain and fancy modes, with fancy mode using icons and optional colors.
*   **`diffRenderer` (`src/renderers/diff-renderer.ts`)**:
    *   Renders `DiffData`.
    *   Presents git-style diffs, highlighting additions (green), deletions (red), and context lines (dimmed).
    *   Uses `cli-highlight` for syntax highlighting of code within context lines.
*   **`tableRenderer` (`src/renderers/table-renderer.ts`)**:
    *   Renders `TableData`.
    *   Formats tabular data with headers, aligned columns, and box-drawing borders in fancy mode.
    *   Uses `string-width` for accurate character width calculation, especially with ANSI escape codes.
*   **`testResultsRenderer` (`src/renderers/test-results-renderer.ts`)**:
    *   Renders `TestResultsData`.
    *   Provides a summary of passed, failed, and skipped tests, followed by a detailed list of test cases.
    *   Fancy mode includes status icons (✅, ❌), colors for failed tests, and duration.
*   **`treeRenderer` (`src/renderers/tree-renderer.ts`)**:
    *   Renders `TreeData`.
    *   Visualizes hierarchical data (like file systems) using tree characters (├─, └─).
    *   Fancy mode includes directory/file icons (📁, 📄) and human-readable file sizes.
*   **`weatherRenderer` (`src/renderers/weather-renderer.ts`)**:
    *   Renders `WeatherData`.
    *   Displays current weather conditions and an optional forecast.
    *   Fancy mode features ASCII art weather icons or emojis, temperature, and other details.

## Charts Sub-module (`src/renderers/charts/`)

This sub-module is dedicated to generating SVG charts and converting them into terminal-displayable images. It leverages `D3Node` for SVG creation, `@resvg/resvg-js` for efficient SVG-to-PNG conversion, and `terminal-image` for rendering PNGs in the terminal.

### Chart Types (`src/renderers/charts/types.ts`)

Defines data structures and options specific to charts:
*   `ChartOptions`: Common configuration for charts (width, height, colors, padding, title, etc.).
*   `LineChartData`, `BarChartData`, `GaugeData`, `CandlestickData`, `PieChartData`: Data structures for different chart types.
*   `DisplayOptions`: Options for `terminal-image` conversion (e.g., output width/height).
*   `DEFAULT_CHART_OPTIONS`: Provides sensible defaults for chart rendering.
*   `formatNumber`: A utility for formatting numbers for display on charts (e.g., `1.2M`, `500K`).

### Chart Generators

Each generator function takes chart-specific data and `ChartOptions` to produce an SVG string:
*   **`generateLineChartSVG` (`src/renderers/charts/line-chart.ts`)**: Creates SVG line charts with optional area fill, grid, and labels.
*   **`generateBarChartSVG` (`src/renderers/charts/bar-chart.ts`)**: Generates SVG bar charts with customizable colors for each bar and value/label text.
*   **`generateTemperatureGaugeSVG` (`src/renderers/charts/gauge-charts.ts`)**: Produces a thermometer-style temperature gauge with a colored mercury fill and marks.
*   **`generateGaugeChartSVG` (`src/renderers/charts/gauge-charts.ts`)**: Creates an arc-style general gauge chart with a needle, colored segments, and min/max labels.
*   **`generateSparklineSVG` (`src/renderers/charts/sparkline.ts`)**: Generates compact, minimalist line charts suitable for inline display, often indicating trends.
*   **`generatePieChartSVG` (`src/renderers/charts/special-charts.ts`)**: Creates SVG pie charts with slices, percentages, and a legend.
*   **`generateCandlestickChartSVG` (`src/renderers/charts/special-charts.ts`)**: Generates financial candlestick charts showing open, high, low, and close prices over time.
*   **`generateWeatherIconSVG` (`src/renderers/charts/special-charts.ts`)**: Creates simple SVG weather icons based on a condition string (e.g., 'sunny', 'rain', 'cloudy').

### Rendering Utilities (`src/renderers/charts/render-utils.ts`)

*   **`svgToTerminalImage(svgString: string, options: DisplayOptions)`**: This crucial utility function takes an SVG string, converts it to a PNG buffer using `Resvg` (from `@resvg/resvg-js`), and then transforms that PNG into a string suitable for terminal image display using `terminal-image`. It includes a fallback for terminals that don't support graphics.
*   **`renderLineChart`, `renderBarChart`, `renderTemperatureGauge`, `renderWeatherIcon`, `renderSparkline`, `renderCandlestickChart`, `renderPieChart`, `renderGaugeChart`**: These are convenience asynchronous functions that combine a chart generator (e.g., `generateLineChartSVG`) with `svgToTerminalImage` to provide a one-step process for rendering charts directly to the terminal.

## Integration and Usage

The `src/renderers/index.ts` file serves as the main entry point for the module, re-exporting all public components.

*   **`initializeRenderers()`**: This function, typically called once at application startup (e.g., from `src/index.ts`), registers all built-in specialized renderers with the global `RenderManager`.
*   **`areRenderersInitialized()`**: Checks if any renderers have been registered.

The rendering system is utilized by UI components (e.g., `ui/components/StructuredOutput.tsx`, `ui/components/ChatHistory.tsx`) to display structured data received from various sources. These components call `getRenderManager()` and then `render()` or `canRender()` to dynamically format data for the terminal.

## Contributing to Renderers

To add a new specialized renderer:
1.  **Define a new data interface** in `src/renderers/types.ts` (e.g., `MyNewData`). Ensure it has a unique `type` literal property.
2.  **Create a new renderer file** (e.g., `src/renderers/my-new-renderer.ts`).
3.  **Implement the `Renderer<MyNewData>` interface**:
    *   Provide a unique `id` and `name`.
    *   Implement `canRender(data: unknown): data is MyNewData` using the `hasType` helper and your new data interface.
    *   Implement `render(data: MyNewData, ctx: RenderContext): string`, providing both `plain` and `fancy` mode implementations.
    *   Consider external dependencies like `string-width` for accurate text measurement if complex layouts are involved.
4.  **Export your new renderer** from its file.
5.  **Register your renderer** by importing it into `src/renderers/index.ts` and adding it to the `initializeRenderers()` function. Assign a `priority` if it needs to be checked before or after other renderers.

To add a new chart type:
1.  **Define new data interfaces** in `src/renderers/charts/types.ts` if needed.
2.  **Create a new chart generator file** (e.g., `src/renderers/charts/my-new-chart.ts`).
3.  **Implement a `generateMyNewChartSVG(data: MyNewChartData, options: ChartOptions): string` function** using `D3Node` to construct the SVG.
4.  **Export the generator** from its file.
5.  **Optionally, create a convenience `renderMyNewChart` function** in `src/renderers/charts/render-utils.ts` that wraps your generator and `svgToTerminalImage`.
6.  **Re-export your new chart generator and render utility** from `src/renderers/charts/index.ts` and `src/renderers/svg-charts.ts`.