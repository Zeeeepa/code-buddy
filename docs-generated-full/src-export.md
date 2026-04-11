---
title: "src — export"
module: "src-export"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.495Z"
---
# src — export

# Knowledge Base Export Module

The `src/export` module provides functionality to export session data and related documentation to various knowledge base platforms. It currently supports **Notion** and **Obsidian** (local Markdown vaults), offering features like session export with metadata, code block formatting, internal linking, and tag preservation.

This module is designed to be flexible and extensible, allowing for easy integration of new knowledge base platforms in the future.

## Core Concepts

### Data Structures

The module operates on a few key data structures:

*   **`SessionData`**: Represents the core information of a session to be exported.
    ```typescript
    interface SessionData {
      id: string;
      name: string;
      messages: Array<{
        role: 'user' | 'assistant' | 'system';
        content: string;
        timestamp?: Date;
        toolCalls?: Array<{
          name: string;
          input: string;
          output: string;
        }>;
      }>;
      metadata?: Record<string, unknown>;
      createdAt: Date;
      updatedAt: Date;
    }
    ```
*   **`ExportOptions`**: Customizes the export behavior for a given session.
    ```typescript
    interface ExportOptions {
      includeTimestamps?: boolean; // Include message timestamps
      includeToolOutputs?: boolean; // Include tool call inputs/outputs
      includeMetadata?: boolean;    // Include session metadata
      tags?: string[];              // Tags to apply to the exported content
      frontmatter?: Record<string, string | number | boolean | string[]>; // Custom frontmatter for Obsidian
    }
    ```

### Configuration Interfaces

To configure the exporters, specific configuration objects are required:

*   **`NotionConfig`**:
    ```typescript
    interface NotionConfig {
      apiKey: string;
      parentPageId?: string; // ID of a parent page
      databaseId?: string;   // ID of a database (preferred for structured data)
    }
    ```
*   **`ObsidianConfig`**:
    ```typescript
    interface ObsidianConfig {
      vaultPath: string;    // Absolute path to the Obsidian vault
      folderPath?: string;  // Optional subfolder within the vault
      templatePath?: string; // (Not currently used in provided code, but part of interface)
    }
    ```

## Architecture

### Overview

The module follows an abstract factory pattern, with a base `KnowledgeBaseExporter` class defining the common interface for all exporters. Concrete implementations (`NotionExporter`, `ObsidianExporter`) handle platform-specific logic. A central `KnowledgeBaseExportManager` orchestrates the configuration and execution of these exporters, providing a unified API.

### Class Diagram

```mermaid
classDiagram
    EventEmitter <|-- KnowledgeBaseExporter
    KnowledgeBaseExporter <|-- NotionExporter
    KnowledgeBaseExporter <|-- ObsidianExporter
    EventEmitter <|-- KnowledgeBaseExportManager

    KnowledgeBaseExportManager "1" *-- "0..1" NotionExporter : manages
    KnowledgeBaseExportManager "1" *-- "0..1" ObsidianExporter : manages

    KnowledgeBaseExportManager : +configureNotion(config)
    KnowledgeBaseExportManager : +configureObsidian(config)
    KnowledgeBaseExportManager : +exportToNotion(session, options)
    KnowledgeBaseExportManager : +exportToObsidian(session, options)
    KnowledgeBaseExportManager : +exportToAll(session, options)
    KnowledgeBaseExportManager : +testConnections()
    KnowledgeBaseExportManager : +createObsidianIndex(title)

    KnowledgeBaseExporter : <<abstract>> +export(session, options)
    KnowledgeBaseExporter : <<abstract>> +testConnection()
    KnowledgeBaseExporter : +emit('exported', data)

    NotionExporter : -config: NotionConfig
    NotionExporter : -apiUrl: string
    NotionExporter : -request(method, endpoint, body)
    NotionExporter : -buildProperties(session, options)
    NotionExporter : -sessionToNotionBlocks(session, options)
    NotionExporter : -parseContent(content)

    ObsidianExporter : -config: ObsidianConfig
    ObsidianExporter : -sessionToMarkdown(session, options)
    ObsidianExporter : -sanitizeFilename(name)
    ObsidianExporter : +createIndex(title)

    SessionData : id, name, messages, metadata, createdAt, updatedAt
    ExportOptions : includeTimestamps, includeToolOutputs, includeMetadata, tags, frontmatter
    NotionConfig : apiKey, parentPageId, databaseId
    ObsidianConfig : vaultPath, folderPath, templatePath
```

## Key Components

### 1. `KnowledgeBaseExporter` (Abstract Base Class)

This abstract class extends `EventEmitter` and defines the common interface for all knowledge base exporters.

*   **`abstract export(session: SessionData, options?: ExportOptions): Promise<string>`**:
    The core method for exporting a session. Implementations must return a promise resolving to a URL or file path of the exported content.
*   **`abstract testConnection(): Promise<boolean>`**:
    Verifies the connection or configuration for the specific platform.
*   **Events**: Emits an `'exported'` event upon successful export, providing platform-specific details (e.g., `{ platform: 'notion', pageId: '...', url: '...' }` or `{ platform: 'obsidian', filePath: '...' }`).

### 2. `NotionExporter`

Handles the export of session data to Notion.

*   **Configuration**: Initialized with a `NotionConfig` object containing the `apiKey` and either `parentPageId` or `databaseId`.
*   **`export(session: SessionData, options: ExportOptions = {}): Promise<string>`**:
    1.  Transforms `SessionData` into Notion-compatible blocks using `sessionToNotionBlocks`.
    2.  Constructs Notion page properties using `buildProperties`.
    3.  Sends a `POST` request to the Notion API `/pages` endpoint via the private `request` method.
    4.  Emits an `'exported'` event with the Notion page ID and URL.
    5.  Returns the URL of the newly created Notion page.
*   **Internal Utilities**:
    *   **`private request<T>(method: string, endpoint: string, body?: object): Promise<T>`**: A generic wrapper for making authenticated requests to the Notion API. It handles authorization headers and error responses.
    *   **`private buildProperties(session: SessionData, options: ExportOptions): Record<string, NotionProperty>`**: Creates the Notion page properties, including the title, optional tags (if a `Tags` multi-select property exists in the database), and creation date.
    *   **`private sessionToNotionBlocks(session: SessionData, options: ExportOptions): NotionBlock[]`**: Converts the session's messages into an array of Notion block objects. It handles:
        *   Optional metadata callout.
        *   Role-based headings (`User`, `Assistant`).
        *   Optional timestamps.
        *   Splitting message content into paragraphs and code blocks using `parseContent`.
        *   Optional tool call outputs as toggle blocks.
    *   **`private parseContent(content: string): Array<{ type: 'text' | 'code'; content: string; language?: string }>`**: Parses a given string, identifying and separating Markdown code blocks (` ``` `) from plain text.
*   **`testConnection(): Promise<boolean>`**: Verifies the Notion API key by attempting to fetch the current user's information (`/users/me`).
*   **Notion API Types**: The module includes internal interfaces (`NotionPageCreate`, `NotionProperty`, `NotionBlock`) to strongly type the Notion API request bodies.

### 3. `ObsidianExporter`

Handles the export of session data to a local Obsidian Markdown vault.

*   **Configuration**: Initialized with an `ObsidianConfig` object specifying the `vaultPath` and an optional `folderPath` within the vault.
*   **`export(session: SessionData, options: ExportOptions = {}): Promise<string>`**:
    1.  Converts `SessionData` into a Markdown string using `sessionToMarkdown`.
    2.  Determines the output file path, creating the target folder if it doesn't exist (`fs.ensureDir`).
    3.  Sanitizes the session name for use as a filename using `sanitizeFilename`.
    4.  Handles duplicate filenames by appending ` (1)`, ` (2)`, etc.
    5.  Writes the Markdown content to the file (`fs.writeFile`).
    6.  Emits an `'exported'` event with the file path.
    7.  Returns the absolute path to the created Markdown file.
*   **Internal Utilities**:
    *   **`private sessionToMarkdown(session: SessionData, options: ExportOptions): string`**: Generates the Markdown content for a session. It includes:
        *   YAML frontmatter with session ID, creation/update dates, custom `frontmatter` from `ExportOptions`, and `tags`.
        *   A main title (`# Session Name`).
        *   Optional metadata callout (`> [!info]`).
        *   Role-based headings (`## 👤 User`) with optional timestamps.
        *   Message content.
        *   Optional tool call outputs formatted as Obsidian callouts (`> [!note]- 🔧 Tool:`).
        *   A "Related" section with internal links (e.g., `[[Code Buddy Sessions]]`) and tags.
    *   **`private sanitizeFilename(name: string): string`**: Cleans a string to be safe for use as a filename, replacing invalid characters and trimming length.
*   **`testConnection(): Promise<boolean>`**: Checks if the configured `vaultPath` is accessible on the file system (`fs.access`).
*   **`createIndex(title: string = 'Code Buddy Sessions'): Promise<string>`**:
    *   Scans the configured export folder within the Obsidian vault for `.md` files.
    *   Generates a new Markdown file (e.g., `Code Buddy Sessions.md`) containing a list of internal links to all exported session files.
    *   Returns the path to the created index file.

### 4. `KnowledgeBaseExportManager`

This class acts as the central entry point for managing and performing exports. It holds instances of `NotionExporter` and `ObsidianExporter` once they are configured.

*   **`configureNotion(config: NotionConfig): void`**:
    Initializes the `NotionExporter` with the provided configuration. Emits a `'configured'` event for 'notion'.
*   **`configureObsidian(config: ObsidianConfig): void`**:
    Initializes the `ObsidianExporter` with the provided configuration. Emits a `'configured'` event for 'obsidian'.
*   **`exportToNotion(session: SessionData, options?: ExportOptions): Promise<string>`**:
    Delegates the export task to the configured `notionExporter`. Throws an error if Notion is not configured.
*   **`exportToObsidian(session: SessionData, options?: ExportOptions): Promise<string>`**:
    Delegates the export task to the configured `obsidianExporter`. Throws an error if Obsidian is not configured.
*   **`exportToAll(session: SessionData, options?: ExportOptions): Promise<{ notion?: string; obsidian?: string }>`**:
    Attempts to export the session to all currently configured platforms concurrently. Returns an object with the results for each platform.
*   **`testConnections(): Promise<{ notion?: boolean; obsidian?: boolean }>`**:
    Tests the connection for all configured platforms and returns an object with their respective statuses.
*   **`createObsidianIndex(title?: string): Promise<string>`**:
    Delegates to the `obsidianExporter` to create an index file. Throws an error if Obsidian is not configured.

### 5. `getKnowledgeBaseExportManager()` (Singleton Access)

This function provides a singleton instance of `KnowledgeBaseExportManager`. This ensures that throughout the application, there's only one manager instance, allowing for consistent configuration and state.

```typescript
export function getKnowledgeBaseExportManager(): KnowledgeBaseExportManager {
  if (!exportManagerInstance) {
    exportManagerInstance = new KnowledgeBaseExportManager();
  }
  return exportManagerInstance;
}
```

## How to Use

### 1. Getting the Manager

First, obtain the singleton instance of the export manager:

```typescript
import { getKnowledgeBaseExportManager, SessionData, ExportOptions } from './knowledge-base-export';

const exportManager = getKnowledgeBaseExportManager();
```

### 2. Configuring Exporters

Before exporting, you must configure the desired platforms.

**For Notion:**

```typescript
exportManager.configureNotion({
  apiKey: process.env.NOTION_API_KEY!,
  databaseId: 'your-notion-database-id', // Or parentPageId
});

// You can listen for configuration events
exportManager.on('configured', (platform) => {
  console.log(`Exporter configured for: ${platform}`);
});
```

**For Obsidian:**

```typescript
exportManager.configureObsidian({
  vaultPath: '/Users/youruser/Documents/ObsidianVaults/MyCodeBuddyVault',
  folderPath: 'Code Buddy Sessions', // Optional subfolder
});
```

### 3. Exporting Sessions

Once configured, you can export `SessionData`.

```typescript
const session: SessionData = {
  id: 'sess_123',
  name: 'Debugging a React Component',
  messages: [
    { role: 'user', content: 'My React component is not rendering.', timestamp: new Date() },
    { role: 'assistant', content: 'Can you share the code for the component and its parent?', timestamp: new Date() },
    { role: 'user', content: '```jsx\nfunction MyComponent() { /* ... */ }\n```', timestamp: new Date() },
    {
      role: 'assistant',
      content: 'It seems like you forgot to export the component.',
      timestamp: new Date(),
      toolCalls: [{ name: 'linter', input: 'check(code)', output: 'Missing export statement.' }]
    },
  ],
  createdAt: new Date(),
  updatedAt: new Date(),
  metadata: {
    model: 'gpt-4',
    temperature: 0.7
  }
};

const exportOptions: ExportOptions = {
  includeTimestamps: true,
  includeToolOutputs: true,
  includeMetadata: true,
  tags: ['react', 'debugging', 'code-buddy'],
  frontmatter: {
    status: 'completed',
    priority: 1
  }
};

// Export to Notion
try {
  const notionUrl = await exportManager.exportToNotion(session, exportOptions);
  console.log('Exported to Notion:', notionUrl);
} catch (error) {
  console.error('Notion export failed:', error);
}

// Export to Obsidian
try {
  const obsidianPath = await exportManager.exportToObsidian(session, exportOptions);
  console.log('Exported to Obsidian:', obsidianPath);
} catch (error) {
  console.error('Obsidian export failed:', error);
}

// Export to all configured platforms
try {
  const results = await exportManager.exportToAll(session, exportOptions);
  console.log('Exported to all configured platforms:', results);
} catch (error) {
  console.error('Export to all failed:', error);
}
```

### 4. Testing Connections

You can verify the configuration and connectivity to your knowledge bases:

```typescript
try {
  const connectionStatuses = await exportManager.testConnections();
  console.log('Connection statuses:', connectionStatuses);
  // Example output: { notion: true, obsidian: true }
} catch (error) {
  console.error('Failed to test connections:', error);
}
```

### 5. Creating an Obsidian Index

For Obsidian, you can generate an index file that links to all exported sessions:

```typescript
try {
  const indexPath = await exportManager.createObsidianIndex('My Code Buddy Sessions Index');
  console.log('Obsidian index created at:', indexPath);
} catch (error) {
  console.error('Failed to create Obsidian index:', error);
}
```

## Integration and Extensibility

The `src/export` module is designed to be a standalone service for knowledge base interactions.

*   **External Dependencies**: It relies on `fs-extra` for robust file system operations (Obsidian) and `fetch` for HTTP requests (Notion API). It also uses `path` for path manipulation and `events` for its event emitter capabilities.
*   **Entry Point**: The primary way to interact with this module from other parts of the codebase is through the `getKnowledgeBaseExportManager()` singleton function.
*   **Extensibility**: To add support for a new knowledge base platform (e.g., Confluence, Google Docs):
    1.  Create a new class that extends `KnowledgeBaseExporter`.
    2.  Implement the `export` and `testConnection` abstract methods, handling the platform-specific API calls and data transformations.
    3.  Add a new `configure[Platform]` method to `KnowledgeBaseExportManager` to instantiate your new exporter.
    4.  Add corresponding `exportTo[Platform]` and update `exportToAll` and `testConnections` in `KnowledgeBaseExportManager`.