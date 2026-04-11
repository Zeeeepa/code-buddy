---
title: "src — browser-automation"
module: "src-browser-automation"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.383Z"
---
# src — browser-automation

The `src/browser-automation` module provides a robust, AI-agent-friendly interface for controlling web browsers. Inspired by the Native Engine project, it aims to offer a unified and powerful set of tools for web interaction, data extraction, and environment manipulation.

## Purpose and Overview

This module serves as the primary interface for AI agents to interact with web content. It abstracts away the complexities of browser automation frameworks, offering a high-level, action-oriented API. Key capabilities include:

*   **Browser Lifecycle Management**: Launching, connecting to, and closing browser instances.
*   **Tab Management**: Creating, switching, and closing browser tabs.
*   **Smart Snapshot**: Generating a structured, AI-readable representation of the current web page, including interactive elements with unique numeric references (`ref` IDs).
*   **Navigation & Interaction**: Navigating to URLs, clicking elements, typing text, filling forms, scrolling, and handling various user inputs.
*   **Media Capture**: Taking screenshots (with optional element annotations) and generating PDFs.
*   **Network Control**: Managing cookies, setting headers, enabling offline mode, and intercepting network requests.
*   **Device Emulation**: Simulating different devices, viewports, geolocation, timezones, and locales.
*   **JavaScript Execution**: Running arbitrary JavaScript within the page context.
*   **Profile Persistence**: Saving and loading browser state (cookies, local/session storage) for consistent sessions.
*   **Chrome Discovery**: Automatically detecting and connecting to running Chrome instances.

The module is built on [Playwright](https://playwright.dev/), leveraging its capabilities for reliable cross-browser automation and Chrome DevTools Protocol (CDP) control.

## Architecture

The module's architecture is designed with a clear separation of concerns:

1.  **`BrowserManager`**: The core engine that directly interacts with the Playwright API. It manages browser instances, contexts, pages, and implements all the low-level automation logic. It also acts as an `EventEmitter` to broadcast browser-related events.
2.  **`BrowserTool`**: A facade that provides a simplified, action-based interface for AI agents. It translates high-level `BrowserAction` inputs into calls to `BrowserManager` methods, handles input validation, and formats results into a standard `ToolResult` structure.
3.  **Supporting Subsystems**: Specialized modules for tasks like profile management, route interception, screenshot annotation, and Chrome discovery, which `BrowserManager` or `BrowserTool` integrate as needed.

```mermaid
graph TD
    A[AI Agent / Client] --> B{BrowserTool.execute(action)}
    B --> C[BrowserManager]
    C --> D[Playwright API]
    C --&gt; E[BrowserProfileManager]
    C --&gt; F[RouteInterceptor]
    C --&gt; G[ScreenshotAnnotator]
    B --&gt; H[Chrome Discovery]
    B --&gt; I[Built-in Profiles]
    C --&gt; J[EventEmitter]
    J --&gt; A
```

## Key Components

### `BrowserManager` (`browser-manager.ts`)

This class is the heart of the browser automation. It encapsulates the Playwright browser instance (`Browser`), context (`BrowserContext`), and manages multiple pages (`Page`) as tabs.

**Core Responsibilities:**

*   **Lifecycle**: `launch()`, `connect(cdpUrl)`, `close()`. It lazy-loads Playwright only when needed.
*   **Tab Management**: `getTabs()`, `newTab(url?)`, `focusTab(tabId)`, `closeTab(tabId)`. It maintains a map of active pages and the `currentPageId`.
*   **Smart Snapshot (`takeSnapshot`)**:
    *   Generates a `WebSnapshot` containing `WebElement` objects.
    *   Elements are assigned unique `ref` (reference) numbers, which AI agents use for interaction.
    *   Prioritizes extracting elements using Playwright's accessibility tree (`page.accessibility.snapshot`) for semantic understanding.
    *   Falls back to DOM-based extraction (`extractElementsViaDOM`) if the accessibility API is unavailable (e.g., Playwright versions 1.48+ where `page.accessibility` was removed).
    *   Includes methods like `getElement(ref)` and `toTextRepresentation()` for AI consumption.
*   **Interactions**: `click(ref)`, `type(ref, text)`, `fill(fields)`, `scroll()`, `select(ref, options)`, `press(key, modifiers?)`, `hover(ref)`, `drag(sourceRef, targetRef)`, `uploadFiles(ref, files)`. These methods translate `ref` IDs into Playwright actions.
*   **Navigation**: `navigate(options)`, `goBack()`, `goForward()`, `reload()`, `waitForNavigation()`.
*   **Media Capture**: `screenshot(options)` (can include `ref` labels via `screenshot-annotator.ts`), `pdf(options)`.
*   **Network & Storage**: `getCookies()`, `setCookies()`, `clearCookies()`, `setHeaders()`, `setOffline()`, `getLocalStorage()`, `setLocalStorage()`, `getSessionStorage()`, `setSessionStorage()`.
*   **Device Emulation**: `emulateDevice(device)`, `setGeolocation(geo)`, `setTimezone(timezoneId)`, `setLocale(locale)`, `setColorScheme(colorScheme)`, `grantPermissions(permissions)`, `emulateDeviceExtended(device)`.
*   **JavaScript Execution**: `evaluate(expression, args?)`, `getContent()`, `getTitle()`, `getUrl()`.
*   **Event Emitter**: Extends `EventEmitter` to emit events like `page-load`, `page-error`, `dialog`, `console`, `network-request`, `network-response`. This allows external systems to react to browser activity.
*   **Lazy-loaded Subsystems**: Integrates `RouteInterceptor` and `BrowserProfileManager` on demand.

### `BrowserTool` (`browser-tool.ts`)

This class acts as the public API for AI agents. It exposes a single `execute` method that takes a `BrowserAction` and its associated parameters.

**Core Responsibilities:**

*   **Action Dispatch**: The `execute(input: BrowserToolInput)` method uses a `switch` statement to map `BrowserAction` strings (e.g., `'launch'`, `'navigate'`, `'click'`) to corresponding private methods.
*   **Input Validation**: Ensures that required parameters for each action are present.
*   **Result Formatting**: Wraps the results from `BrowserManager` calls into a standardized `ToolResult` object, including `success`, `output` (human-readable summary), `error`, and `data` (structured payload).
*   **Batch Execution (`batch`)**: Allows multiple browser actions to be executed sequentially within a single tool call, with an option to stop on the first error.
*   **Chrome Attachment (`attach`)**: Provides a high-level action to connect to a running Chrome instance, leveraging `chrome-discovery.ts` and `builtin-profiles.ts`.
*   **Security**: Incorporates an SSRF (Server-Side Request Forgery) guard (`assertSafeUrl`) for navigation actions to prevent malicious URL access.
*   **Singleton**: `getBrowserTool()` ensures only one instance of `BrowserTool` exists, which in turn uses the singleton `BrowserManager`.

### `BrowserProfileManager` (`profile-manager.ts`)

Manages the persistence of browser state to disk.

**Core Responsibilities:**

*   **`save(name, data)`**: Stores cookies, localStorage, and sessionStorage for a given profile name in a JSON file within `~/.codebuddy/browser-profiles`.
*   **`load(name)`**: Retrieves a saved profile's data.
*   **`list()`**: Lists all available profile names.
*   **`delete(name)`**: Removes a saved profile.

### `RouteInterceptor` (`route-interceptor.ts`)

Provides fine-grained control over network requests made by the browser.

**Core Responsibilities:**

*   **`addRule(page, rule)`**: Registers a new interception rule with Playwright's `page.route()`.
*   **`removeRule(page, ruleId)`**: Deregisters an existing rule.
*   **`listRules()`**: Returns currently active rules.
*   **`clearRules(page)`**: Removes all active rules.
*   **Rule Actions**: Supports `block`, `mock` (with custom response), `modify` (headers), and `log` actions for matching URL patterns.

### `ScreenshotAnnotator` (`screenshot-annotator.ts`)

A utility for enhancing screenshots.

**Core Responsibilities:**

*   **`annotateScreenshot(buffer, elements, options?)`**: Takes a raw screenshot buffer and a list of `WebElement`s, then overlays numeric badges (matching the `ref` IDs) onto the screenshot.
*   **Dependency**: Lazily imports `sharp` for image manipulation. If `sharp` is not available, it gracefully falls back to returning the raw screenshot.

### `Chrome Discovery & Built-in Profiles` (`chrome-discovery.ts`, `builtin-profiles.ts`)

These modules facilitate connecting to existing browser instances.

*   **`builtin-profiles.ts`**: Defines standard browser profiles like `user` (connects to Chrome on port 9222) and `chrome-relay` (launches a managed Chromium instance with persistent user data).
*   **`chrome-discovery.ts`**:
    *   **`findRunningChrome()`**: Uses OS-specific commands (`lsof`, `netstat`, `ss`) to detect running Chrome instances with remote debugging enabled on common CDP ports (9222-9229).
    *   **`isCDPEndpoint()`**: Verifies if a detected port is indeed a Chrome DevTools Protocol endpoint by fetching `/json/version`.
    *   **`discoverChromeEndpoint()`**: Provides a prioritized CDP URL, checking `CDP_URL` environment variable first, then auto-discovery.

### `Types` (`types.ts`)

This file defines all the interfaces and types used across the browser automation module, ensuring consistency and type safety. This includes:

*   `BrowserTab`, `BrowserProfile`
*   `WebElement`, `WebSnapshot`, `SnapshotOptions`
*   Various action options (e.g., `ClickOptions`, `NavigateOptions`, `ScreenshotOptions`)
*   `Cookie`, `HeadersConfig`, `DeviceConfig`, `GeolocationConfig`
*   `NetworkRequest`, `NetworkResponse`
*   `EvaluateOptions`, `EvaluateResult`
*   `DialogInfo`, `DialogAction`
*   `FileUploadOptions`
*   `BrowserConfig`, `DEFAULT_BROWSER_CONFIG`
*   `ConsoleEntry`
*   `RouteRule`
*   `BrowserProfileData`
*   `ExtendedDeviceConfig`
*   `BrowserEvents`

## Integration Points

The browser automation module integrates with several other parts of the codebase and external libraries:

*   **`playwright`**: The fundamental external dependency for all browser control. It's lazy-loaded to keep the initial bundle size small.
*   **`sharp`**: An optional external dependency for advanced image processing, specifically for screenshot annotation. Also lazy-loaded.
*   **`../utils/logger.js`**: Used extensively throughout the module for logging debug, info, warn, and error messages.
*   **`../types/index.js` (`ToolResult`)**: The `BrowserTool` returns results in this standardized format, allowing seamless integration with the agent's tool execution pipeline.
*   **`fs`, `path`, `os`**: Node.js built-in modules used for file system operations (e.g., saving profiles, screenshots) and determining user home directory.
*   **`child_process`**: Used by `chrome-discovery.ts` to execute OS-specific commands for process and network port detection.
*   **`../security/ssrf-guard.js`**: The `BrowserTool` calls `assertSafeUrl` from this module to prevent Server-Side Request Forgery attacks when navigating to URLs.
*   **`EventEmitter`**: `BrowserManager` extends this to emit events, allowing other parts of the system to subscribe to browser activity (e.g., page loads, console messages, network requests).

## Usage Considerations

*   **Singleton Pattern**: Both `BrowserManager` and `BrowserTool` are implemented as singletons (`getBrowserManager()`, `getBrowserTool()`). This ensures that only one browser instance (or connection) is managed at a time, simplifying state management for the agent.
*   **Snapshot-driven Interaction**: Most interaction methods (`click`, `type`, `scroll`, `hover`, `drag`, `uploadFiles`) rely on `ref` IDs obtained from a `WebSnapshot`. Agents are expected to `takeSnapshot()` first, then use the `ref` IDs from the snapshot for subsequent actions.
*   **Error Handling**: All public methods in `BrowserTool` return a `ToolResult` object, which clearly indicates success or failure and provides an error message if an operation fails.
*   **Asynchronous Operations**: Almost all browser interactions are asynchronous and return Promises, reflecting the nature of browser automation.
*   **Performance**: Lazy loading of Playwright and Sharp helps optimize startup time and resource usage when these features are not immediately required.