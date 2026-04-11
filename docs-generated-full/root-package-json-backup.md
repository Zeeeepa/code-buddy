---
title: "Root — package.json.backup"
module: "root-package-json-backup"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.241Z"
---
# Root — package.json.backup

This document provides a comprehensive overview of the `package.json` file for the `@phuetz/grok-cli` project. This file serves as the manifest for the project, defining its metadata, dependencies, scripts, and entry points. Understanding `package.json` is crucial for developing, building, testing, and deploying the `grok-cli` application.

## 1. Overview

The `package.json` file is the heart of any Node.js project, including `@phuetz/grok-cli`. It declares the project's identity, lists its required packages, and defines a set of scripts for common development and operational tasks. For `grok-cli`, it specifically configures how the CLI tool is built, run, and distributed.

## 2. Project Metadata

This section provides essential information about the `@phuetz/grok-cli` project:

*   **`name`**: `@phuetz/grok-cli` - The unique identifier for the package.
*   **`version`**: `1.0.0` - The current version of the package.
*   **`description`**: "An open-source AI agent that brings the power of Grok directly into your terminal." - A brief summary of the project's purpose.
*   **`author`**: "Patrice Huetz <ton-email@example.com>" - The primary author.
*   **`repository`**: Defines where the source code can be found (`git+https://github.com/phuetz/grok-cli.git`).
*   **`bugs`**: Points to the issue tracker (`https://github.com/phuetz/grok-cli/issues`).
*   **`homepage`**: The project's main documentation page (`https://github.com/phuetz/grok-cli#readme`).
*   **`license`**: `MIT` - Specifies the open-source license under which the project is distributed.
*   **`keywords`**: A list of terms (`cli`, `agent`, `grok`, `ai`, etc.) that help discoverability and categorize the project.

## 3. Module Configuration & Entry Points

This section dictates how the project's code is structured and exposed.

*   **`type`**: `"module"`
    *   This declares that the project uses ES Modules (ESM) syntax by default, allowing `import` and `export` statements without requiring specific file extensions or transpilation for module resolution.
*   **`main`**: `"dist/index.js"`
    *   Specifies the primary entry point for the package when imported using CommonJS `require()`. While `type: module` is set, `main` can still be used by older tools or for compatibility.
*   **`exports`**:
    ```json
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
    ```
    *   This modern field defines the package's public entry points and conditional exports.
    *   The `.` key indicates the root of the package.
    *   `import`: Specifies `./dist/index.js` as the entry point when the package is imported using ES Modules (`import '@phuetz/grok-cli'`).
    *   `types`: Points to `./dist/index.d.ts`, providing TypeScript declaration files for type checking and IDE assistance.
*   **`bin`**:
    ```json
    "grok": "dist/index.js"
    ```
    *   This field defines the command-line interface (CLI) executable. When `@phuetz/grok-cli` is installed globally (or via `npx`), the `grok` command will execute `dist/index.js`. This is how users interact with the CLI tool.

## 4. Development Workflow Scripts

The `scripts` section defines a collection of convenient commands for various development, testing, and build tasks. These scripts are executed using `npm run <script-name>` or `bun run <script-name>`.

### Build & Clean

*   **`build`**: `tsc`
    *   Compiles TypeScript source files (`src/`) into JavaScript and declaration files (`dist/`). This is the standard build command.
*   **`build:bun`**: `bun run tsc`
    *   An alternative build command specifically for environments using Bun as the runtime/package manager.
*   **`build:watch`**: `tsc --watch`
    *   Runs the TypeScript compiler in watch mode, automatically recompiling files upon changes. Useful for active development.
*   **`clean`**: `rm -rf dist coverage .nyc_output *.tsbuildinfo`
    *   Removes all generated build artifacts, test coverage reports, and TypeScript build info files, ensuring a clean slate.

### Development & Execution

*   **`dev`**: `bun run src/index.ts`
    *   Runs the application directly from the TypeScript source using Bun. Ideal for rapid development without a prior build step.
*   **`dev:node`**: `tsx src/index.ts`
    *   Runs the application directly from the TypeScript source using `tsx`, a Node.js runner for TypeScript.
*   **`start`**: `node dist/index.js`
    *   Executes the compiled JavaScript application using Node.js. This is typically used for running the production build.
*   **`start:bun`**: `bun run dist/index.js`
    *   Executes the compiled JavaScript application using Bun.

### Testing

*   **`test`**: `jest`
    *   Runs all tests using Jest.
*   **`test:watch`**: `jest --watch`
    *   Runs Jest in watch mode, re-running tests related to changed files.
*   **`test:coverage`**: `jest --coverage`
    *   Runs tests and generates a code coverage report.

### Linting & Formatting

*   **`lint`**: `eslint . --ext .js,.jsx,.ts,.tsx`
    *   Runs ESLint to check for code style and quality issues across JavaScript and TypeScript files.
*   **`lint:fix`**: `eslint . --ext .js,.jsx,.ts,.tsx --fix`
    *   Runs ESLint and automatically fixes fixable issues.
*   **`format`**: `prettier --write "src/**/*.{ts,tsx,js,jsx,json,md}"`
    *   Formats source code files using Prettier, overwriting them with the formatted version.
*   **`format:check`**: `prettier --check "src/**/*.{ts,tsx,js,jsx,json,md}"`
    *   Checks if files are formatted according to Prettier rules without making changes.

### Type Checking

*   **`typecheck`**: `tsc --noEmit`
    *   Performs a full TypeScript type check without emitting any JavaScript files.
*   **`typecheck:watch`**: `tsc --noEmit --watch`
    *   Runs TypeScript type checking in watch mode.

### Validation & Hooks

*   **`validate`**: `npm run lint && npm run typecheck && npm test`
    *   A composite script that runs linting, type checking, and all tests. This is a good command to run before committing changes or opening a pull request.
*   **`install:bun`**: `bun install`
    *   Installs dependencies using Bun.
*   **`prepare`**: `npm run build`
    *   A lifecycle hook that runs automatically after `npm install` (or `bun install`) when the package is being prepared for use. It ensures the project is built immediately after dependencies are installed.

## 5. Dependencies

This section lists all external packages required by the project, categorized by their role.

### `dependencies`

These are packages required for the application to run in production.

*   **CLI & UI**: `commander`, `chalk`, `ink`, `react`, `cli-highlight`, `marked`, `marked-terminal`
    *   Provide core CLI parsing, colorful output, interactive UI components (Ink/React), and markdown rendering.
*   **AI/LLM Integration**: `@modelcontextprotocol/sdk`, `openai`, `tiktoken`
    *   Facilitate interaction with AI models, including OpenAI's API and tokenization.
*   **File System & Utilities**: `adm-zip`, `axios`, `better-sqlite3`, `diff-match-patch`, `dotenv`, `fast-glob`, `form-data`, `fs-extra`, `ignore`, `semver`, `zod`, `@vscode/ripgrep`
    *   Handle file operations (reading, writing, zipping), HTTP requests, local database management, text differencing, environment variable loading, file globbing, form data, file system extensions, `.gitignore` parsing, semantic versioning, schema validation, and fast file searching.

### `optionalDependencies`

These packages are not strictly required for the core functionality but provide enhanced features or alternative implementations. The application is designed to function even if these are not installed.

*   `@mlc-ai/web-llm`, `@xenova/transformers`, `node-llama-cpp`
    *   These are likely used for local, on-device LLM inference, offering alternatives to cloud-based AI services.
*   `node-pty`
    *   Provides pseudo-terminal capabilities, potentially for running shell commands within the CLI or for interactive sessions.

### `devDependencies`

These packages are only needed during development, testing, and building the project. They are not bundled with the production application.

*   **TypeScript Tooling**: `typescript`, `@types/node`, `@types/react`, `@types/semver`, `@types/ws`, `ts-jest`, `tsx`
    *   TypeScript compiler, type definitions for Node.js and React, Jest integration for TypeScript, and a TypeScript execution environment.
*   **Testing**: `jest`, `@types/jest`
    *   The Jest testing framework and its type definitions.
*   **Linting & Formatting**: `eslint`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, `prettier`
    *   ESLint for code quality, its TypeScript plugins, and Prettier for code formatting.
*   **Type Definitions for Dependencies**: `@types/adm-zip`, `@types/better-sqlite3`, `@types/diff-match-patch`, `@types/fs-extra`, `@types/glob`, `@types/js-yaml`
    *   Provide TypeScript type information for various runtime dependencies.
*   **VSCode Language Server**: `vscode-languageserver`, `vscode-languageserver-textdocument`
    *   Potentially used for developing language server features or integrating with VSCode's language services.

## 6. Environment Requirements

*   **`engines`**:
    ```json
    "node": ">=18.0.0"
    ```
    *   Specifies that the project requires Node.js version 18.0.0 or higher to run correctly.
*   **`preferGlobal`**: `true`
    *   Indicates that this package is primarily intended to be installed globally (e.g., `npm install -g @phuetz/grok-cli`) because it provides a command-line tool.

## 7. Contribution Guidelines

For contributors, understanding `package.json` is key:

*   **Dependencies**: Always add new runtime dependencies to `dependencies` and development-only tools to `devDependencies`. Remember to run `npm install` (or `bun install`) after modifying these sections.
*   **Scripts**: Utilize the defined `scripts` for common tasks like building (`npm run build`), testing (`npm test`), linting (`npm run lint`), and formatting (`npm run format`).
*   **Validation**: Before submitting a pull request, always run `npm run validate` to ensure your changes pass all checks.
*   **Node.js Version**: Ensure your local Node.js environment meets the `engines.node` requirement.

This `package.json` provides a robust foundation for the `@phuetz/grok-cli` project, streamlining development, ensuring code quality, and defining its public interface.