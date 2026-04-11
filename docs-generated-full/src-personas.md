---
title: "src — personas"
module: "src-personas"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.627Z"
---
# src — personas

The `src/personas` module is the core of Grok's personality management system. It allows the agent to adopt different behaviors, expertise, and communication styles, making it adaptable to various development tasks and user preferences. This module provides a robust framework for defining, managing, and dynamically switching between agent personas.

## Purpose and Features

The primary goal of the `personas` module is to enable flexible and context-aware customization of Grok's interactions. Key features include:

*   **Predefined Personas:** A set of built-in personas (e.g., `Senior Developer`, `Code Reviewer`, `Debugging Expert`) that offer specialized capabilities.
*   **Custom Persona Creation:** Users can define their own personas, tailoring Grok's `systemPrompt`, `traits`, `expertise`, and `style`.
*   **Context-Aware Selection:** Personas can be configured with `triggers` that automatically activate them based on user input, file types, or commands.
*   **Dynamic Switching:** The active persona can be changed manually or automatically during a conversation.
*   **Persistence:** Custom personas are saved to disk, ensuring they persist across sessions.
*   **Hot-Reloading:** Changes to custom persona files on disk are automatically detected and reloaded without restarting the application.
*   **System Prompt Generation:** Dynamically constructs a comprehensive system prompt for the underlying LLM, incorporating the active persona's characteristics.

## Core Concepts

### The `Persona` Interface

At the heart of the module is the `Persona` interface, which defines the structure of an agent's personality:

```typescript
export interface Persona {
  id: string;
  name: string;
  description: string;
  systemPrompt: string; // The core instruction for the LLM
  traits: PersonaTrait[]; // e.g., helpfulness, precision
  expertise: string[]; // e.g., 'software architecture', 'debugging'
  style: PersonaStyle; // e.g., verbosity, tone, codeStyle
  examples?: ConversationExample[]; // Few-shot examples
  triggers?: PersonaTrigger[]; // For auto-selection
  isBuiltin: boolean;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

Supporting interfaces further define persona characteristics:

*   **`PersonaTrait`**: Quantifiable attributes (0-100) like `helpfulness` or `precision`.
*   **`PersonaStyle`**: Defines communication preferences such as `verbosity`, `formality`, `tone`, `codeStyle`, and `explanationDepth`.
*   **`ConversationExample`**: Pairs of user input and assistant responses for few-shot prompting.
*   **`PersonaTrigger`**: Rules for `autoSelectPersona`, specifying `type` (keyword, fileType, command, context), `pattern`, and `priority`.

### Built-in vs. Custom Personas

The module distinguishes between:

*   **Built-in Personas**: Defined within the `BUILTIN_PERSONAS` constant in `persona-manager.ts`. These are read-only and cannot be modified or deleted by users. They provide a set of curated, high-quality starting points.
*   **Custom Personas**: Created by users and stored as JSON files in a dedicated directory (default: `~/.codebuddy/personas`). These are fully editable and deletable.

## `PersonaManager` Class

The `PersonaManager` class is the central orchestrator for all persona-related operations. It extends `EventEmitter` to broadcast changes in persona state.

### Initialization and Lifecycle

The `PersonaManager` is initialized upon instantiation:

1.  **Constructor**: Takes an optional `PersonaConfig` to set the initial active persona, auto-switch preference, and custom personas directory. It then calls `initialize()`.
2.  **`initialize()`**:
    *   Ensures the `customPersonasDir` exists on disk using `fs.ensureDir`.
    *   Loads all `BUILTIN_PERSONAS` into its internal `Map`.
    *   Calls `loadCustomPersonas()` to read existing custom persona JSON files from disk.
    *   Sets the `activePersona` based on the configuration (defaulting to 'default' if none specified or found).
    *   Starts `startWatcher()` to monitor the custom personas directory for changes.
3.  **`loadCustomPersonas()`**: Reads all `.json` files from the `customPersonasDir`, parses them, and adds them to the internal `personas` map. Invalid files are skipped.
4.  **`startWatcher()`**: Uses `fs.watch` to detect file system events (creation, modification, deletion) in the `customPersonasDir`. It debounces rapid events to prevent excessive reloads. Upon detecting a change to a `.json` file:
    *   If a file is added/modified, it's reloaded, and a `persona:reloaded` event is emitted.
    *   If a file is deleted, the persona is removed from memory, and if it was the active persona, the system switches to 'default'. A `persona:removed` event is emitted.
5.  **`dispose()`**: Cleans up resources by closing the file system watcher and removing all event listeners. This is crucial for proper shutdown or resetting the singleton.

### Key Functionality

#### Persona Management

*   **`createPersona(options)`**: Creates a new custom persona, generates a unique ID, saves it as a JSON file to `customPersonasDir`, adds it to the internal map, and emits `persona:created`.
*   **`updatePersona(id, updates)`**: Modifies an existing custom persona, updates its JSON file on disk, and emits `persona:updated`. Built-in personas cannot be updated.
*   **`deletePersona(id)`**: Removes a custom persona's JSON file from disk and deletes it from the internal map. If the deleted persona was active, it switches to 'default'. Emits `persona:deleted`. Built-in personas cannot be deleted.
*   **`clonePersona(id, newName)`**: Creates a new custom persona by copying an existing one, using `createPersona` internally.
*   **`exportPersona(id)`**: Returns the JSON string representation of a persona.
*   **`importPersona(json)`**: Parses a JSON string, validates it, generates a new unique ID, and creates a new custom persona using `createPersona`.

#### Persona Selection and Retrieval

*   **`setActivePersona(id)`**: Explicitly sets the active persona. If successful, it emits a `persona:changed` event with the previous and current persona.
*   **`getActivePersona()`**: Returns the currently active `Persona` object.
*   **`getPersona(id)`**: Retrieves a specific persona by its ID.
*   **`getAllPersonas()`**: Returns an array of all loaded personas (built-in and custom).
*   **`getBuiltinPersonas()`**: Returns an array of only built-in personas.
*   **`getCustomPersonas()`**: Returns an array of only custom personas.
*   **`autoSelectPersona(context)`**: This method implements context-aware persona switching.
    *   If `config.autoSwitch` is `false`, it returns the current active persona.
    *   It iterates through all available personas and their `triggers`.
    *   Triggers are matched against the provided `context` (e.g., `message` keywords, `fileType`, `command`).
    *   The persona with the highest `priority` matching trigger is selected.
    *   If a new persona is selected, `setActivePersona()` is called, triggering a `persona:changed` event.

#### System Prompt Generation

*   **`buildSystemPrompt(additionalContext?)`**: Constructs the complete system prompt that will be sent to the LLM. It starts with the `activePersona.systemPrompt` and dynamically appends instructions based on:
    *   `PersonaStyle` properties (verbosity, tone, codeStyle).
    *   `expertise` areas.
    *   `ConversationExample` interactions (few-shot prompting).
    *   Any `additionalContext` provided by the caller.

#### Status and Configuration

*   **`formatStatus()`**: Generates a formatted string displaying the active persona and a list of all available personas, useful for CLI output.
*   **`getConfig()`**: Returns the current `PersonaConfig`.

### Events

`PersonaManager` emits the following events:

*   `persona:changed`: When the active persona is switched (manual or auto-select).
*   `persona:created`: When a new custom persona is successfully created.
*   `persona:updated`: When an existing custom persona is modified.
*   `persona:deleted`: When a custom persona is removed.
*   `persona:reloaded`: When a custom persona file is changed on disk and reloaded.
*   `persona:removed`: When a custom persona file is deleted from disk.

## Singleton Access

The module provides a singleton pattern for `PersonaManager` to ensure a single, consistent state across the application:

*   **`getPersonaManager(config?)`**: Returns the singleton instance of `PersonaManager`. If an instance doesn't exist, it creates one.
*   **`resetPersonaManager()`**: Disposes of the current singleton instance and sets it to `null`, allowing a fresh instance to be created on the next `getPersonaManager` call. This is primarily used for testing or application shutdown.

## Integration with the System

The `PersonaManager` is a critical component that influences Grok's behavior across various interactions.

```mermaid
graph TD
    subgraph PersonaManager
        A[initialize()]
        B[loadCustomPersonas()]
        C[startWatcher()]
        D[setActivePersona()]
        E[autoSelectPersona()]
        F[buildSystemPrompt()]
        G[createPersona()]
        H[updatePersona()]
        I[deletePersona()]
    end

    J[App Startup] --> A
    A --> B
    A --> C
    A --> D
    K[User Input / Context] --> E
    E --> D
    L[Agent Executor] --> F
    M[CLI / UI] --> G
    M --> H
    M --> I
    C -- File Changes --> B
```

### Key Integration Points:

*   **Agent Execution (`agent/execution/agent-executor.ts`)**:
    *   The `agent-executor` retrieves the `PersonaManager` instance via `getPersonaManager()`.
    *   For each user message, it calls `autoSelectPersona()` to potentially switch to a more relevant persona based on the conversation context.
    *   Before sending a prompt to the LLM, it calls `buildSystemPrompt()` to generate the complete, persona-infused system prompt.
*   **Command Handlers (`commands/handlers/persona-handler.ts`)**:
    *   The `/persona` command handler directly interacts with `PersonaManager` methods like `setActivePersona()`, `createPersona()`, `deletePersona()`, `getPersona()`, `getAllPersonas()`, etc., to allow users to manage personas via the CLI.
*   **Status Commands (`commands/handlers/missing-handlers.ts`)**:
    *   The status command handler uses `getPersonaManager()` and `getActivePersona()` (and `formatStatus()`) to display information about the current persona state.
*   **Testing (`tests/persona-manager.test.ts`)**:
    *   The test suite thoroughly exercises all public and some private methods of `PersonaManager`, including lifecycle, CRUD operations, auto-selection, and event emission.

## Extending and Contributing

### Adding New Built-in Personas

To add a new built-in persona:

1.  Define a new object conforming to `Omit<Persona, 'createdAt' | 'updatedAt'>` in the `BUILTIN_PERSONAS` array within `src/personas/persona-manager.ts`.
2.  Ensure the `id` is unique and descriptive.
3.  Craft a detailed `systemPrompt` that clearly defines the persona's role and instructions.
4.  Populate `traits`, `expertise`, `style`, `examples`, and `triggers` to give the persona depth and enable effective auto-selection.
5.  Set `isBuiltin: true` and `isDefault: false` (unless it's intended to replace the current default).

### Creating Custom Personas

Users can create custom personas directly through the CLI (if implemented) or by manually creating JSON files in the `~/.codebuddy/personas` directory. The `PersonaManager` will automatically detect and load these files.

### Modifying the `Persona` Structure

Any changes to the `Persona` interface or its supporting interfaces (e.g., adding new fields to `PersonaStyle` or `PersonaTrigger`) will require:

1.  Updating the interface definitions in `src/personas/persona-manager.ts`.
2.  Adjusting `BUILTIN_PERSONAS` to include default values for new fields.
3.  Modifying `createPersona()` and `updatePersona()` to handle new fields, including default values if necessary.
4.  Updating `buildSystemPrompt()` if new fields should influence the LLM prompt.
5.  Reviewing `autoSelectPersona()` if new trigger types are introduced.
6.  Updating any UI or CLI components that interact with persona data.
7.  Updating relevant tests in `tests/persona-manager.test.ts`.