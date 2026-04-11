---
title: "src — tracks"
module: "src-tracks"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.777Z"
---
# src — tracks

The `src/tracks` module implements a **Track System** designed to facilitate context-driven development. Inspired by the "spec → plan → implement" workflow, it provides a structured way to manage development tasks, features, and bug fixes as discrete "tracks." This system aims to ensure that work is well-defined, planned, and executed in alignment with project context and guidelines.

## 1. Core Concepts

The Track System revolves around a few central concepts:

*   **Track**: The primary entity representing a unit of work (e.g., a feature, bugfix, refactor). Each track encapsulates its definition, plan, and current status.
*   **TrackMetadata**: Essential information about a track, including its unique `id`, `name`, `type` (e.g., `feature`, `bugfix`), `status` (e.g., `planning`, `in_progress`, `completed`), creation/update timestamps, and `progress` metrics.
*   **TrackSpec**: The "what" of a track. It defines the requirements and acceptance criteria. This includes an `overview`, `requirements` (what needs to be built), and `acceptanceCriteria` (how to verify completion). Optional fields like `outOfScope`, `dependencies`, and `technicalNotes` provide further detail.
*   **TrackPlan**: The "how" of a track. It breaks down the implementation into `phases`, each containing a list of `tasks`. Tasks can have `subtasks` and track their `status` and associated `commitSha`.
*   **ProjectContext**: Global project-level information that influences how tracks are defined and implemented. This includes `product` vision, `techStack` details, `guidelines` (coding standards, testing), and `workflow` (development process).

All track data and project context are persisted as Markdown and JSON files within a `.codebuddy/` directory in the project's root.

## 2. Architecture Overview

The `src/tracks` module is composed of two main classes: `TrackManager` and `TrackCommands`, along with a `types.ts` file defining the data structures.

*   **`TrackCommands`**: Acts as the public interface, handling user input (typically slash commands) and orchestrating operations. It translates commands into calls to `TrackManager` and formats results for display. Crucially, it also generates **AI prompts** to guide an external AI agent through the track lifecycle.
*   **`TrackManager`**: The core logic and persistence layer. It manages the creation, retrieval, updating, and deletion of tracks, handles file system interactions, and converts between in-memory data structures and their Markdown/JSON representations.

The interaction flow is generally:

```mermaid
graph TD
    A[User Command <br> (e.g., /track new)] --> B{TrackCommands.execute}
    B -- Calls --> C[TrackManager]
    C -- Reads/Writes --> D[File System <br> (.codebuddy/)]
    B -- Generates <br> AI Prompts --> E[AI Agent]
    E -- (AI Agent acts based on prompt) --> A
```

## 3. Key Components

### 3.1. `src/tracks/track-manager.ts` - The Persistence & Logic Layer

The `TrackManager` class is responsible for the underlying data management and file system interactions for tracks and project context.

**Key Responsibilities:**

*   **Initialization (`initialize`)**: Sets up the `.codebuddy/` directory structure, including `tracks/` and `context/` subdirectories, and creates default context files (`product.md`, `tech-stack.md`, `guidelines.md`, `workflow.md`) and a `tracks.md` index if they don't exist.
*   **Track CRUD Operations**:
    *   `createTrack(options: TrackCreateOptions)`: Generates a unique ID, creates a new track directory, and saves initial `metadata.json`, `spec.md`, and `plan.md` files. It also updates the `tracks.md` index.
    *   `getTrack(trackId: string)`: Loads a complete `Track` object by reading its metadata, spec, and plan files.
    *   `listTracks(options?: TrackListOptions)`: Retrieves a list of `TrackMetadata` objects, with optional filtering by `status` or `type`.
    *   `updateTrackStatus(trackId: string, status: TrackStatus)`: Changes a track's status and updates its `updatedAt` timestamp.
    *   `deleteTrack(trackId: string)`: Removes a track's directory and its entry from `tracks.md`.
*   **Spec & Plan Management**:
    *   `updateSpec(trackId: string, spec: Partial<TrackSpec>)`: Updates a track's specification.
    *   `updatePlan(trackId: string, plan: TrackPlan)`: Updates a track's implementation plan and triggers a `recalculateProgress`.
    *   `updateTaskStatus(trackId: string, phaseId: string, taskId: string, status: TaskStatus, commitSha?: string)`: Marks a specific task within a plan as `completed`, `in_progress`, `pending`, or `skipped`.
    *   `getNextTask(trackId: string)`: Identifies the next `pending` task in a track's plan, including subtasks.
*   **Context Management**:
    *   `loadContext()`: Reads all project context Markdown files (`product.md`, `tech-stack.md`, `guidelines.md`, `workflow.md`) into a `ProjectContext` object.
    *   `updateContext(file: 'product' | 'tech-stack' | 'guidelines' | 'workflow', content: string)`: Writes new content to a specific context file.
    *   `getContextString()`: Aggregates relevant context files into a single Markdown string suitable for AI prompts.
*   **File I/O Helpers**: Private methods like `saveTrackMetadata`, `loadTrackMetadata`, `saveTrackSpec`, `loadTrackSpec`, `saveTrackPlan`, `loadTrackPlan` abstract the direct file system operations.
*   **Markdown Conversion**: Private methods (`specToMarkdown`, `markdownToSpec`, `planToMarkdown`, `markdownToPlan`, `taskToMarkdown`) handle the serialization and deserialization of `TrackSpec` and `TrackPlan` objects to and from Markdown files. This allows for human-readable and editable track definitions.
*   **Utility Methods**: Includes `generateTrackId`, `slugify`, `extractListItems`, `findTask`, `recalculateProgress`, `updateTracksIndex`, `removeFromTracksIndex`, and `getStatusEmoji`.

**File Structure Managed by `TrackManager`:**

```
.codebuddy/
├── context/
│   ├── product.md
│   ├── tech-stack.md
│   ├── guidelines.md
│   └── workflow.md
├── tracks.md             <-- Index of all tracks
└── tracks/
    ├── <track_id_1>/
    │   ├── metadata.json
    │   ├── spec.md
    │   └── plan.md
    └── <track_id_2>/
        ├── metadata.json
        ├── spec.md
        └── plan.md
```

### 3.2. `src/tracks/track-commands.ts` - The Command Interface

The `TrackCommands` class provides a command-line interface (CLI) for interacting with the Track System. It parses user commands (e.g., `/track new`) and delegates the actual work to the `TrackManager`. A key feature is its ability to generate specific prompts for an AI agent, guiding it through the various stages of track development.

**Key Responsibilities:**

*   **Command Execution (`execute`)**: Parses the input string, identifies the subcommand (e.g., `new`, `implement`, `status`), and dispatches to the appropriate private handler method.
*   **Command Handlers**:
    *   `handleNew(args: string)`: Creates a new track. If no arguments are provided, it returns a prompt for the AI to gather track details. Otherwise, it calls `TrackManager.createTrack` and returns a prompt for the AI to define the spec and plan.
    *   `handleImplement(args: string)`: Identifies the next pending task in an active track, calls `TrackManager.getNextTask`, and returns a prompt for the AI to implement that task.
    *   `handleStatus(args: string)`: Displays the detailed status of a specific track or an overview of all active tracks.
    *   `handleList(args: string)`: Lists tracks, with optional filtering by status or type.
    *   `handleUpdate(args: string)`: Returns a prompt for the AI to update a track's spec or plan.
    *   `handleComplete(args: string)`: Marks a track as `completed` via `TrackManager.updateTrackStatus`.
    *   `handleSetup()`: Initializes the track system by calling `TrackManager.initialize` and returns a prompt for the AI to configure project context files.
    *   `handleContext()`: Retrieves and displays the aggregated project context.
*   **Formatting Helpers**: `formatTrackStatus`, `formatTrackList`, and `getStatusEmoji` are used to present track information clearly to the user.
*   **AI Prompt Generation**: Methods like `getNewTrackPrompt`, `getSpecPlanPrompt`, `getImplementPrompt`, `getTrackCompletePrompt`, `getUpdatePrompt`, and `getSetupPrompt` generate detailed instructions for an AI agent, guiding it on what information to gather or what actions to perform (e.g., "Generate spec.md with...").
*   **Singleton Pattern**: The `getTrackCommands()` function ensures that only one instance of `TrackCommands` is created, making it easy to access throughout the application.

### 3.3. `src/tracks/types.ts` - Data Models

This file defines all the TypeScript interfaces and type aliases used across the Track System, ensuring strong typing and clarity for track metadata, specification, plan, tasks, and project context.

## 4. Development Workflow

The Track System supports a structured development workflow, often guided by an AI agent:

1.  **Setup**: A developer (or AI) runs `/track setup`. `TrackManager.initialize()` creates the `.codebuddy/` directory and default context files. `TrackCommands` then prompts the AI to customize these context files (`product.md`, `tech-stack.md`, `guidelines.md`, `workflow.md`).
2.  **New Track**: A developer (or AI) initiates a new track with `/track new <name>`.
    *   `TrackCommands.handleNew` either prompts the AI for track details (name, type, description) or parses them from the command.
    *   `TrackManager.createTrack` creates the track's directory and initial empty `spec.md` and `plan.md`.
    *   `TrackCommands` then provides a `getSpecPlanPrompt` to the AI, instructing it to define the `spec.md` (requirements, acceptance criteria) and `plan.md` (phases, tasks) based on the project context.
3.  **Implementation**: When ready to work, a developer (or AI) runs `/track implement`.
    *   `TrackCommands.handleImplement` calls `TrackManager.getNextTask` to find the next `pending` task.
    *   `TrackCommands` provides an `getImplementPrompt` to the AI, detailing the task and reminding it of project guidelines and workflow.
    *   The AI implements the task, creates a commit, and then updates the `plan.md` (via `TrackManager.updateTaskStatus`) to mark the task as `completed` with the commit SHA.
4.  **Completion**: Once all tasks in a track are complete, `TrackCommands` provides a `getTrackCompletePrompt` to the AI, guiding it through final review, documentation updates, and marking the track as `completed` using `/track complete <id>`.

## 5. Data Persistence

All track and context data is stored directly on the file system, making it transparent, version-controllable (e.g., with Git), and easily editable by humans or tools.

*   **`.codebuddy/context/*.md`**: Markdown files for project-wide context.
*   **`.codebuddy/tracks.md`**: A Markdown file serving as an index/overview of all tracks, automatically updated by `TrackManager`.
*   **`.codebuddy/tracks/<track_id>/metadata.json`**: JSON file containing `TrackMetadata`.
*   **`.codebuddy/tracks/<track_id>/spec.md`**: Markdown file containing `TrackSpec`.
*   **`.codebuddy/tracks/<track_id>/plan.md`**: Markdown file containing `TrackPlan`, with tasks represented as checkbox lists.

## 6. Integration Points

The `src/tracks` module integrates with the rest of the codebase primarily through:

*   **`commands/handlers/track-handlers.ts`**: This is the main entry point for user-initiated `/track` commands. It calls `getTrackCommands()` to get the singleton instance and then `execute()` to process the command.
*   **`src/commands/enhanced-command-handler.ts`**: May directly call `TrackCommands.handleNew` for automated track creation scenarios.
*   **File System Abstraction**: The `TrackManager` uses `fs-extra` for file system operations. The call graph indicates that `writeFile` and `ensureDir` calls are routed through `src/sandbox/e2b-sandbox.ts` and `src/observability/run-store.ts` respectively. This suggests that file system operations are potentially sandboxed or instrumented for observability in the broader application environment. Developers should be aware that direct `fs` calls might be intercepted or proxied.
*   **AI Agent**: The module is designed to work in conjunction with an external AI agent that interprets the generated prompts and performs actions (e.g., writing code, updating files) based on the instructions.

## 7. Contributing to the Module

When contributing to the `src/tracks` module, consider the following:

*   **File-based Persistence**: All changes to track data must be reflected in the corresponding Markdown/JSON files. Ensure that `TrackManager`'s `save` and `load` methods are correctly updated for any new data fields.
*   **Markdown Parsing**: If extending `TrackSpec` or `TrackPlan` with new sections or formats, update `markdownToSpec`, `specToMarkdown`, `markdownToPlan`, and `planToMarkdown` to correctly parse and serialize the new data.
*   **AI Prompts**: When adding new commands or modifying existing workflows, ensure that `TrackCommands` generates clear, actionable prompts for the AI agent. The prompts should provide sufficient context and explicit instructions for the AI to perform its task.
*   **Error Handling**: Implement robust error handling, especially for file system operations and invalid user input.
*   **Testing**: The `track-manager.test.ts` suite provides examples for testing the `TrackManager`'s functionality. Ensure new features are covered by tests.
*   **Consistency**: Maintain consistency in track ID generation, slugification, and status emojis.