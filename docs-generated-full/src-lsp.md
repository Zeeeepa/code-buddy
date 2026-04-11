---
title: "src — lsp"
module: "src-lsp"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.565Z"
---
# src — lsp

The `src/lsp` module provides comprehensive Language Server Protocol (LSP) capabilities, serving two primary roles:

1.  **LSP Client**: Interacting with *external*, standard LSP servers (e.g., `typescript-language-server`, `pylsp`) to provide core IDE features like go-to-definition, find references, diagnostics, and hover information.
2.  **Code Buddy LSP Server**: Implementing an *internal* LSP server that integrates Code Buddy's AI capabilities (completions, diagnostics, code actions, hover, signature help) directly into any LSP-compatible editor (e.g., VS Code, Neovim).

This dual approach allows Code Buddy to leverage existing, highly optimized language servers for foundational features while augmenting the developer experience with AI-powered assistance.

---

## 1. LSP Client (`lsp-client.ts`)

The `LSPClient` class is responsible for spawning and managing external LSP server processes, communicating with them via JSON-RPC over stdio, and translating LSP responses into Code Buddy's internal data structures.

### 1.1. Purpose

*   **Abstract LSP Complexity**: Provides a high-level API for various LSP operations without requiring callers to understand JSON-RPC or server lifecycle management.
*   **Multi-Language Support**: Automatically detects the language of a file and spawns/manages the appropriate LSP server (e.g., `typescript-language-server` for TypeScript, `pylsp` for Python).
*   **Singleton Management**: Ensures only one `LSPClient` instance exists and can be accessed globally via `getLSPClient()`.

### 1.2. Key Features & How it Works

#### Server Lifecycle Management

The `LSPClient` manages the lifecycle of child processes for each language server.

*   **`ensureServer(language: LSPLanguage)`**: This is the core method for lazy-loading servers. When an LSP operation is requested for a specific language, this method checks if a server for that language is already running and initialized. If not, it attempts to `startServer`.
*   **`startServer(language: LSPLanguage)`**:
    *   Spawns the configured command (e.g., `typescript-language-server --stdio`).
    *   Sets up `stdout` and `stderr` listeners to process incoming JSON-RPC messages and log errors.
    *   Sends the `initialize` request to the LSP server, declaring Code Buddy's capabilities (e.g., text document synchronization, completion, hover, definition, references, rename, code actions).
    *   Sends the `initialized` notification.
*   **`stopServer(language: LSPLanguage)` / `stopAll()`**: Gracefully shuts down servers by sending `shutdown` and `exit` messages, then killing the child process.

#### JSON-RPC Communication

Communication with LSP servers happens over stdio using the JSON-RPC 2.0 protocol.

*   **`sendRequest(conn: ServerConnection, method: string, params: unknown)`**: Sends a JSON-RPC request with an `id` and returns a `Promise` that resolves with the server's response or rejects on error/timeout.
*   **`sendNotification(conn: ServerConnection, method: string, params: unknown)`**: Sends a JSON-RPC notification without expecting a response.
*   **`processBuffer(conn: ServerConnection)`**: Continuously reads from the server's `stdout` buffer, parses JSON-RPC messages based on `Content-Length` headers, and dispatches them to `handleMessage`.
*   **`handleMessage(conn: ServerConnection, msg: JsonRpcMessage)`**:
    *   If `msg.id` is present, it's a response to a pending request, which is then resolved or rejected.
    *   If `msg.method` is `textDocument/publishDiagnostics`, it's a notification containing diagnostics, which are stored in `conn.diagnostics`.

#### Document Synchronization

LSP servers need to be aware of the content of files being edited.

*   **`openDocument(conn: ServerConnection, filePath: string, languageId: string)`**: Sends a `textDocument/didOpen` notification to the LSP server when a file is first accessed, providing its full content. This ensures the server has the latest state.

#### Supported LSP Operations

The `LSPClient` exposes methods for common LSP features:

*   **`goToDefinition(file, line, column)`**: Calls `textDocument/definition`.
*   **`findReferences(file, line, column)`**: Calls `textDocument/references`.
*   **`hover(file, line, column)`**: Calls `textDocument/hover`.
*   **`getDocumentSymbols(file)`**: Calls `textDocument/documentSymbol`.
*   **`getDiagnostics(file)`**: Retrieves cached diagnostics from `textDocument/publishDiagnostics` notifications.
*   **`prepareRename(filePath, line, character)`**: Calls `textDocument/prepareRename` to check if a symbol can be renamed.
*   **`rename(filePath, line, character, newName)`**: Calls `textDocument/rename` to perform a rename operation, returning a `LSPWorkspaceEdit`.
*   **`codeAction(filePath, range, diagnostics)`**: Calls `textDocument/codeAction` to fetch available refactorings or quick fixes.

### 1.3. Integration

The `LSPClient` is used by various Code Buddy tools and features:

*   **`lsp_check` tool**: Uses `getDiagnostics`.
*   **`lsp_goto_def` tool**: Uses `goToDefinition`.
*   **`lsp_find_refs` tool**: Uses `findReferences`.
*   **`lsp-rename-tool.ts`**: Uses `prepareRename` and `rename`.
*   **`auto-import-tool.ts`**: Uses `codeAction` for organizing imports and adding missing imports.
*   **`issues-tree-provider.ts`**: Uses `getDiagnostics` to populate the issues view.

```mermaid
graph TD
    subgraph Code Buddy Tools/Features
        A[lsp_check Tool]
        B[lsp_goto_def Tool]
        C[lsp_find_refs Tool]
        D[LSP Rename Tool]
        E[Auto-Import Tool]
        F[Issues Tree Provider]
    end

    subgraph src/lsp
        G[LSPClient]
    end

    subgraph External LSP Servers
        H[typescript-language-server]
        I[pylsp]
        J[clangd]
        K[...]
    end

    A --> G: getDiagnostics
    B --> G: goToDefinition
    C --> G: findReferences
    D --> G: prepareRename, rename
    E --> G: codeAction
    F --> G: getDiagnostics

    G -- Spawns & Communicates via JSON-RPC --> H
    G -- Spawns & Communicates via JSON-RPC --> I
    G -- Spawns & Communicates via JSON-RPC --> J
    G -- Spawns & Communicates via JSON-RPC --> K
```

---

## 2. Code Buddy LSP Server (`server.ts`)

This file implements an actual LSP server that an editor (like VS Code with the Code Buddy extension) can connect to. It leverages Code Buddy's AI (`CodeBuddyClient`) to provide advanced code assistance features.

### 2.1. Purpose

*   **IDE Integration**: Provides a standard LSP interface for editors to consume Code Buddy's AI capabilities.
*   **AI-Powered Features**: Implements completions, diagnostics, code actions, hover, and signature help using the `CodeBuddyClient`.
*   **Configuration Management**: Handles LSP client (editor) settings for API keys, models, and feature toggles.

### 2.2. Key Features & How it Works

The server uses `vscode-languageserver/node` to establish a connection and manage text documents.

#### Initialization and Configuration

*   **`connection.onInitialize()`**: Declares the server's capabilities (e.g., incremental text document sync, completion provider, code action provider, hover, signature help, diagnostic provider).
*   **`connection.onInitialized()`**: Initializes the `CodeBuddyClient` using an API key from environment variables or LSP client settings.
*   **`connection.onDidChangeConfiguration()`**: Updates `globalSettings` and reinitializes the `CodeBuddyClient` if settings change. It also triggers re-validation of all open documents.

#### AI-Powered Diagnostics

*   **`validateTextDocument(textDocument: TextDocument)`**:
    *   Triggered on document content changes (debounced) and configuration changes.
    *   Constructs a prompt for the `CodeBuddyClient` asking it to act as a code reviewer and return a JSON array of issues.
    *   Parses the AI response and converts it into `Diagnostic` objects, which are then sent to the editor via `connection.sendDiagnostics()`.
    *   `mapSeverity()` translates AI-reported severities to LSP `DiagnosticSeverity`.

#### AI-Powered Completions

*   **`connection.onCompletion()`**:
    *   **Context Gathering**: Uses `gatherCompletionContext()` from `context-gatherer.ts` to extract the surrounding code, prefix, suffix, and detected `TriggerKind`.
    *   **Caching**: Checks `completionCacheLRU` (an LRU cache from `completion-cache.ts`) using a key derived from `filePath:line:prefix`. If a cached result exists, it's returned immediately.
    *   **AI Request**: If no cache hit, it constructs a prompt for `CodeBuddyClient` with the code context and `TriggerKind`.
    *   **Response Processing**: Parses the AI's JSON response into `CompletionItem` objects, mapping AI-reported kinds to LSP `CompletionItemKind`.
    *   **Caching Results**: Stores the AI-generated completions in `completionCacheLRU` for future requests.

#### AI-Powered Code Actions

*   **`connection.onCodeAction()`**:
    *   **Quick Fixes**: For diagnostics originating from "Code Buddy", it suggests a "Fix with Code Buddy" quick fix.
    *   **Refactoring/Explanation**: If a text range is selected, it offers "Refactor with Code Buddy" and "Explain with Code Buddy" actions.
    *   These actions typically trigger commands in the editor extension (e.g., `codebuddy.fix`, `codebuddy.refactor`, `codebuddy.explain`) which then interact with the `CodeBuddyClient` directly or via other tools.

#### AI-Powered Hover

*   **`connection.onHover()`**:
    *   Identifies the word under the cursor.
    *   Constructs a prompt for `CodeBuddyClient` asking for a brief explanation of the word in its context.
    *   Returns the AI's explanation as `Hover` content in Markdown format.

#### AI-Powered Signature Help

*   **`connection.onSignatureHelp()`**:
    *   Detects the function call context (e.g., `funcName(`).
    *   Prompts `CodeBuddyClient` to provide the function's parameters and return type.
    *   Formats the AI's response into `SignatureHelp` objects.

### 2.3. Internal Components

*   **`CompletionCache` (src/lsp/completion-cache.ts)**: An LRU (Least Recently Used) cache with a TTL (Time To Live) for storing AI-generated completion results. This prevents redundant AI calls for frequently requested completions, improving responsiveness.
*   **`CompletionContext` / `gatherCompletionContext` (src/lsp/context-gatherer.ts)**: A utility that analyzes the code around the cursor (prefix, suffix, surrounding lines) and determines the `TriggerKind` (e.g., `import`, `block`, `parameter`). This structured context is crucial for generating accurate AI prompts.

### 2.4. Integration

The Code Buddy LSP Server (`server.ts`) is designed to be run as a separate process, typically spawned by an editor extension (e.g., `vscode-extension/src/extension.ts`).

```mermaid
graph TD
    subgraph Editor (e.g., VS Code)
        A[User Interaction]
    end

    subgraph Code Buddy LSP Server (src/lsp/server.ts)
        B[LSP Connection]
        C[TextDocuments Manager]
        D[CompletionCache]
        E[ContextGatherer]
    end

    subgraph Code Buddy AI Backend
        F[CodeBuddyClient (src/codebuddy/client.ts)]
    end

    A -- LSP Requests (completion, hover, diagnostics) --> B
    B -- Document Content --> C
    C -- Get Text, Position --> E: gatherCompletionContext
    E -- Context --> D: get/set
    D -- Cache Miss --> F: chat (for completions, diagnostics, hover, etc.)
    F -- AI Response --> D: set
    D -- Cached/AI Result --> B
    B -- LSP Responses (CompletionItem[], Diagnostic[], Hover) --> A
```