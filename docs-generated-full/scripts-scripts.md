---
title: "scripts — scripts"
module: "scripts-scripts"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.338Z"
---
# scripts — scripts

The `scripts` directory serves as the automation hub for the project, encompassing build processes, testing, maintenance, and utility tasks. Understanding these scripts is crucial for developers to contribute effectively, run local builds, and ensure code quality.

This document details the purpose, usage, and internal workings of the key scripts within this module.

---

## 1. Documentation & Book Generation

This set of scripts is responsible for compiling the project's documentation, particularly the "LLM Agents: Du Concept à la Production" book, into various formats and generating supporting assets.

### `scripts/build-book.sh`

This is the primary script for generating the complete book in PDF, EPUB, and HTML formats. It orchestrates the entire build process, including prerequisite checks, content validation, file preparation, and format-specific generation.

**Purpose:** To provide a single entry point for building the book, ensuring consistency across different output formats.

**Usage:**

```bash
./scripts/build-book.sh           # Build PDF + EPUB + HTML (default)
./scripts/build-book.sh pdf       # Build PDF only
./scripts/build-book.sh epub      # Build EPUB only
./scripts/build-book.sh html      # Build HTML only
./scripts/build-book.sh validate  # Run validation checks without building
./scripts/build-book.sh clean     # Remove generated output files
./scripts/build-book.sh help      # Show usage instructions
```

**Prerequisites:**

*   `pandoc` (version >= 2.19)
*   `xelatex` (for PDF generation, part of `texlive-xetex` and `texlive-fonts-extra` packages)
*   DejaVu fonts (for emoji support in PDF)

**Execution Flow:**

The `main` function dispatches to various helper functions based on the command-line argument.

1.  **`check_prerequisites()`**: Verifies `pandoc` and `xelatex` installations.
2.  **`validate_book()`**: Performs checks on the source Markdown files:
    *   Ensures all numbered chapters (00-19) are present.
    *   Verifies the existence of annexes (`annexe-a-transformers.md`, `annexe-b-projet-final.md`, `glossaire.md`, `bibliographie.md`).
    *   Counts SVG images.
    *   Provides word and estimated page counts.
3.  **`prepare_files()`**:
    *   Creates the `docs/livre/output` directory.
    *   Combines all individual Markdown chapter files into a single `output/book-combined.md` file, inserting `\pagebreak` directives between chapters for PDF formatting. The order of chapters is hardcoded within the script.
4.  **`build_pdf()`**: Uses `pandoc` with `xelatex` as the PDF engine to convert `book-combined.md` to `llm-agents-book.pdf`. It includes metadata (title, author, date), table of contents, section numbering, and custom fonts. It attempts a fallback build without custom fonts if the first attempt fails.
5.  **`build_epub()`**: Uses `pandoc` to convert `book-combined.md` to `llm-agents-book.epub`, applying `styles/epub.css` if available.
6.  **`build_html()`**: Uses `pandoc` to convert `book-combined.md` to `llm-agents-book.html`, applying `templates/html.template` if available.
7.  **`cleanup()`**: Removes temporary LaTeX files (`.aux`, `.log`, `.out`).

```mermaid
graph TD
    A[main "$@"] --> B{Command?}
    B -- validate --> C[check_prerequisites]
    C --> D[validate_book]
    B -- pdf/epub/html/all --> C
    D --> E[prepare_files]
    E -- pdf --> F[build_pdf]
    E -- epub --> G[build_epub]
    E -- html --> H[build_html]
    F --> I[cleanup]
    G --> I
    H --> I
    B -- clean --> J[Remove output/]
    B -- help --> K[show_help]
```

### `scripts/generate-pdf.sh`, `scripts/generate-epub.sh`

These are older, standalone scripts for generating PDF and EPUB formats, respectively. They are largely superseded by `build-book.sh` but remain for historical context or specific needs. They directly call `pandoc` with hardcoded chapter lists and metadata.

### `scripts/generate-html.js`

This Node.js script generates a single HTML file for the book. Unlike `build-book.sh` which uses `pandoc` for HTML, this script uses `marked` to convert Markdown to HTML and embeds custom CSS.

**Purpose:** To provide a simple, self-contained HTML version of the book, potentially for quick previews or environments where `pandoc` is not readily available.

**Execution Flow:**
1.  Reads a hardcoded list of Markdown chapter files from `docs/livre`.
2.  Uses `marked.parse()` to convert each chapter's content to HTML.
3.  Combines the HTML with embedded CSS into a single `livre-grok-cli.html` file.

### `scripts/nanobanana.ts`

This TypeScript script is a custom diagram generator. It takes a list of diagram specifications and renders them as SVG files, which are then used in the book.

**Purpose:** To programmatically create consistent and stylized SVG diagrams (e.g., pyramids, flowcharts, box diagrams) based on structured data, avoiding manual SVG creation.

**Execution Flow:**
1.  Defines an array of `DiagramSpec` objects, each containing a name, type (e.g., `box`, `pyramid`, `flow`), title, and specific data for the diagram.
2.  The `generateSVG()` function takes a `DiagramSpec` and renders it into an SVG string using hardcoded logic for each diagram type.
3.  Writes the generated SVG strings to files in `docs/livre/images`.

## 2. Testing & Validation

These scripts are vital for maintaining code quality, detecting issues early, and running comprehensive test suites.

### `scripts/check-circular-deps.ts`

This script uses `madge` to detect circular dependencies within the TypeScript source code.

**Purpose:** To prevent architectural issues and maintain a clean dependency graph, which is crucial for code maintainability and understanding.

**Execution Flow:**
1.  Uses `madge` to analyze the `src` directory for `.ts` and `.tsx` files, respecting `tsconfig.json`.
2.  Retrieves a list of all circular dependencies.
3.  Filters out "known cycles" defined in `KNOWN_CYCLES`. These are intentional or currently accepted cycles.
4.  If new circular dependencies are found, it prints them and exits with code `1`; otherwise, it exits with `0`.

### `scripts/run-all-tests.ts`

This is an "Ultra-Complete Real-Conditions Test Runner" designed to execute a vast array of test categories, including extended and advanced scenarios, against the Gemini API.

**Purpose:** To provide a comprehensive integration and end-to-end testing suite that simulates real-world conditions, ensuring the robustness and correctness of the Code Buddy agent and its components.

**Usage:**

```bash
npx tsx scripts/run-all-tests.ts
npx tsx scripts/run-all-tests.ts --extended-only # Run only categories 26-125
```

**Prerequisites:**

*   `GOOGLE_API_KEY` or `GEMINI_API_KEY` environment variable.
*   `tsx` for running TypeScript files directly.

**Execution Flow:**
1.  Initializes `GeminiProvider` with the API key.
2.  Defines a `categoryPlan` array, which is a long list of `CategoryDef` objects. Each `CategoryDef` specifies a test category name and a function that returns an array of individual tests.
3.  Iterates through the `categoryPlan`, running each category's tests using `runCategory()`.
4.  Introduces `INTER_CATEGORY_DELAY` to space out API calls and prevent rate limiting.
5.  Collects results for all categories.
6.  Prints a final report summarizing total tests, passes, failures, skips, errors, token usage, and estimated API cost.

**Key Components:**
*   Imports numerous test categories from `scripts/tests/*.ts` files (e.g., `cat26ContextManagerV2`, `cat70GeminiStructuredOutput`, `cat125HookEventCoverage`).
*   Uses `GeminiProvider` from `src/providers/gemini-provider.ts` for API interactions.
*   Relies on `runCategory` and `sleep` utility functions (defined in `scripts/tests/types.js`).

### `scripts/real-conditions-burnin.ps1`

This PowerShell script is designed for long-running "burn-in" tests, continuously executing various test suites over an extended period.

**Purpose:** To identify intermittent failures, memory leaks, or performance degradation under sustained load, simulating real-world continuous operation.

**Usage:**

```powershell
.\scripts\real-conditions-burnin.ps1 -Hours 48 -Profile mixed -MaxCycles 1000
```

**Parameters:**
*   `Hours`: Duration of the campaign (default: 24).
*   `MaxCycles`: Maximum number of test cycles to run (0 for unlimited).
*   `PauseSeconds`: Delay between cycles.
*   `Profile`: `mixed` (unit + e2e) or `e2e-only`.
*   `CoverageEveryNCycles`: How often to take a code coverage snapshot.
*   `RepoRoot`, `LogRoot`: Custom paths for the repository and logs.

**Execution Flow:**
1.  Sets up logging directories and files.
2.  Defines `e2eFiles` (e.g., `test-e2e.mjs`) that must exist.
3.  `Restore-TodoFile`: Manages the `todo.md` file, restoring its initial state after each cycle.
4.  `Get-CyclePlan`: Determines which test suites to run in each cycle based on the `Profile` and current `Cycle` number. This includes `npm test` for unit/integration suites and `node` for e2e tests.
5.  Enters a loop that runs for the specified `Hours` or `MaxCycles`.
6.  Inside the loop, it executes each step in the `CyclePlan` using `Invoke-Step`, capturing stdout/stderr.
7.  If a step is `coverage-snapshot`, it calls `Read-CoverageSummary` to parse `coverage/coverage-summary.json`.
8.  Records detailed results for each cycle and step in JSONL files.
9.  Generates a final summary report.

### `scripts/check-raw.ts`

This script generates and inspects raw documentation output from the Code Buddy's internal documentation generation system.

**Purpose:** To quickly verify the output of the internal documentation generation, particularly for API references and environment variables, without running the full build process.

**Execution Flow:**
1.  Initializes the `KnowledgeGraph` (`src/knowledge/knowledge-graph.js`).
2.  Populates the deep code graph (`src/knowledge/code-graph-deep-populator.js`).
3.  Generates documentation using `generateDocs()` (`src/docs/docs-generator.js`).
4.  Reads specific generated Markdown files (`.codebuddy/docs/9-api-reference.md` and `8-configuration.md`).
5.  Prints excerpts of these files to the console for inspection.

## 3. Codebase Maintenance & Migration

These scripts are used for automated refactoring, fixing common issues, and migrating test files to new frameworks or conventions.

### `scripts/fix-all-tests.mjs`

This comprehensive script applies multiple fixes to Vitest test files, primarily addressing ESM compatibility and common migration issues from Jest.

**Purpose:** To automate the conversion and cleanup of test files to be compatible with Vitest and ESM, reducing manual effort during framework transitions.

**Fixes Applied (in order):**
1.  `jest.setTimeout` / `vi.setTimeout` → `vi.setConfig({ testTimeout: ... })`
2.  `jest.requireActual` / `vi.requireActual` → `await vi.importActual`
3.  Adds `default` export to mock factories for Node.js built-in modules (`crypto`, `chalk`, `os`, `path`, `react`, `fs-extra`, `fs`, `fs/promises`).
4.  Replaces `require()` with `import` for mocked modules.
5.  Converts arrow functions to regular `function()` in `mockImplementation` (especially for constructors).
6.  Fixes `jest.requireMock` by extracting mock objects before `vi.mock`.
7.  Fixes `vi.mock` factories that don't return objects.

**Execution Flow:**
1.  `walkDir('tests')`: Recursively finds all `.test.ts` files in the `tests` directory.
2.  Iterates through each file, applying the defined regex-based and string manipulation fixes.
3.  If a file is modified, it's written back to disk, and a log message is printed.

### `scripts/fix-arrow-mocks.mjs`, `scripts/fix-fs-mocks.mjs`, `scripts/fix-fs-promises-mocks.mjs`, `scripts/fix-mock-defaults.mjs`

These are specialized versions or subsets of the fixes found in `fix-all-tests.mjs`. They target specific patterns related to:
*   **`fix-arrow-mocks.mjs`**: Converting arrow functions in `mockImplementation` to regular functions, particularly for constructor mocks.
*   **`fix-fs-mocks.mjs`**: Ensuring `fs`, `path`, and `react` mocks correctly export a `default` property.
*   **`fix-fs-promises-mocks.mjs`**: Similar to `fix-fs-mocks.mjs` but specifically for `fs/promises` and `child_process`, and also handles `require()` to `import` conversion for these modules.
*   **`fix-mock-defaults.mjs`**: A more general script to add `default: impl` to `vi.mock` factories for a list of common modules (`crypto`, `chalk`, `os`, `fs-extra`, `react`).

**Purpose:** To provide granular control over specific test file refactoring tasks, allowing for targeted fixes without running the full `fix-all-tests.mjs` suite.

### `scripts/fix-channel-imports.cjs`

This CommonJS script modifies import paths within the `src/channels` directory.

**Purpose:** To correct import statements that might incorrectly reference `../index.js` (a barrel file) to instead reference `../core.js`, likely to resolve circular dependency issues or improve module isolation.

**Execution Flow:**
1.  Uses `fast-glob` to find all `.ts` files in `src/channels/`.
2.  Excludes `src/channels/index.ts` and `src/channels/core.ts` from modification.
3.  Reads each file, replaces `from '../index.js'` with `from '../core.js'`, and writes back the modified content.

### `scripts/fix-critical-issues.sh`

This Bash script automates the resolution of several critical setup and dependency issues identified in an audit.

**Purpose:** To provide a robust, automated way to prepare the development environment, install system-level tools, and resolve common dependency conflicts.

**Execution Flow:**
1.  **Fix Zod version conflict**: Updates `package.json` to use `zod: ^3.25.0` if `^4.1.13` is found.
2.  **Install `ripgrep`**: Detects the operating system (`apt-get`, `brew`, `yum`) and installs `ripgrep` (used for fast code searching).
3.  **Clean previous installation**: Removes `node_modules` and `package-lock.json`.
4.  **Install dependencies**: Runs `npm install`, with a fallback to `npm install --legacy-peer-deps` if the first attempt fails.
5.  **Verify installation**: Checks if critical dependencies (`zod`, `openai`, `typescript`, etc.) are present in `node_modules`.
6.  **Build TypeScript**: Runs `npm run build` and checks for `dist/index.js`.
7.  **Run basic tests**: Invokes `node dist/index.js --help` to verify CLI executability.
8.  **Update `SECURITY.md`**: Prompts the user to update the security contact email if it's still `security@example.com`.
9.  Provides a final summary and next steps.

## 4. External Data & Campaigns

These scripts handle interactions with external data sources and orchestrate complex, multi-step operations.

### `scripts/fetch-models-snapshot.ts`

This script downloads model pricing and context window information from LiteLLM's GitHub repository.

**Purpose:** To keep the project's internal model configuration (`src/config/models-snapshot.json`) up-to-date with the latest capabilities and context windows of various LLMs, without manual updates.

**Execution Flow:**
1.  Fetches `model_prices_and_context_window.json` from the LiteLLM GitHub repository.
2.  Parses the JSON data.
3.  Filters and extracts relevant fields (`max_tokens`, `max_input_tokens`, `max_output_tokens`, `supports_vision`, `supports_function_calling`) for chat/completion models.
4.  Writes the processed data to `src/config/models-snapshot.json`.
5.  Includes graceful fallback mechanisms to keep the existing snapshot file or write an empty one if the fetch fails.

### `scripts/codebuddy-real-app-campaign.mjs`

This script runs a "real application campaign" where the Code Buddy agent is tasked with building several small applications from scratch in isolated directories.

**Purpose:** To rigorously test the Code Buddy agent's end-to-end capabilities in a realistic development scenario, evaluating its ability to understand prompts, use tools, generate code, and pass validation tests.

**Execution Flow:**
1.  Sets up a campaign root directory (`apps/codebuddy-real-campaign`).
2.  Reads the `GOOGLE_API_KEY` from `.env`.
3.  Defines an array of `scenarios`, each with:
    *   An `id` (e.g., `level-1-cli`).
    *   A `prompt` describing the application to build.
    *   A `validate` function to run tests/checks on the generated application.
4.  For each scenario:
    *   Creates a dedicated directory.
    *   Constructs a `cliCmd` to invoke the Code Buddy agent (`src/index.ts`) with specific parameters (e.g., `--directory`, `--model`, `--auto-approve`, `--prompt`).
    *   Executes the Code Buddy command, capturing its output.
    *   `extractToolStats()`: Parses the agent's output to count tool calls and unique tools used.
    *   Executes the scenario's `validate` function, which typically involves `npm install`, `npm test`, and running a `smoke-test.mjs` within the generated application's directory.
    *   Records the results (tool calls, validation status) in a report.
5.  Writes a final `campaign-report.json` summarizing all scenario outcomes.

**Key Functions:**
*   `run(command, cwd, allowFail)`: Executes shell commands, captures output, and handles failures.
*   `ensureDir(dir)`: Creates directories recursively.
*   `readGoogleApiKey()`: Retrieves the API key from `.env`.
*   `extractToolStats(responseText)`: Parses agent output for tool usage.
*   `findAppDir(baseDir)`: Locates the actual application directory within a scenario's output.
*   `scenarioPrompt(levelName, goal)`: Generates a structured prompt for the agent.