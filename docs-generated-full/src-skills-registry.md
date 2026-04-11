---
title: "src — skills-registry"
module: "src-skills-registry"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.719Z"
---
# src — skills-registry

The `src/skills-registry` module provides a robust, ClawHub-like system for discovering, installing, managing, and updating "skills" within the Code Buddy ecosystem. It acts as the central authority for skill lifecycle management, offering both interaction with an external registry (mocked for now) and local management of installed skills.

## 1. Overview

The Skills Registry is a core component responsible for handling all aspects of skill management. It allows developers to:
*   **Discover** skills through search and categorization.
*   **Install** new skills from the registry.
*   **Manage** installed skills, including enabling/disabling, configuring, and uninstalling.
*   **Update** skills to their latest versions.
*   **Monitor** for available updates.

It's designed to be extensible, with a clear separation between the registry interaction (currently mocked) and local skill state management. The module uses an `EventEmitter` pattern to notify other parts of the application about significant skill lifecycle events.

## 2. Core Concepts and Data Structures

The module defines several key interfaces that represent the different facets of a skill:

*   **`SkillManifest`**: The complete metadata for a skill, typically found within the skill's package. It includes details like `name`, `version`, `description`, `author`, `dependencies`, `requirements`, and `main` entry point.
*   **`SkillCategory`**: A union type defining predefined categories for skills (e.g., `'development'`, `'productivity'`, `'automation'`).
*   **`SkillVersion`**: Represents a specific version of a skill available in the registry, including its `downloadUrl`, `checksum`, and `size`.
*   **`InstalledSkill`**: Extends `SkillManifest` with local installation details such as `installPath`, `installedAt`, `updatedAt`, `enabled` status, and `config`.
*   **`SkillSearchResult`**: A simplified view of a skill, optimized for display in search results, including `name`, `displayName`, `latestVersion`, `author`, `downloads`, and `stars`.
*   **`RegistryConfig`**: Defines the operational parameters for the registry, such as `registryUrl`, `installDir`, `autoUpdate` settings, and `cacheTTLMs`. `DEFAULT_REGISTRY_CONFIG` provides sensible defaults.
*   **`RegistryEvents`**: An interface defining the custom events emitted by the `SkillsRegistry` instance, allowing other modules to react to skill installations, updates, errors, etc.

## 3. The `SkillsRegistry` Class

The `SkillsRegistry` class is the central component of this module. It extends Node.js's `EventEmitter`, allowing it to publish events for skill lifecycle changes.

### 3.1. Initialization and Configuration

The `SkillsRegistry` constructor accepts a `Partial<RegistryConfig>` to override default settings. It initializes internal state, including:
*   `config`: The active registry configuration.
*   `installedSkills`: A `Map` storing `InstalledSkill` objects, keyed by skill name.
*   `searchCache`: A `Map` for caching search results to improve performance.
*   `updateCheckTimer`: A `NodeJS.Timeout` for managing periodic update checks.
*   `mockRegistry`: An array of `SkillSearchResult` objects used to simulate an external registry API. The `initializeMockRegistry()` method populates this data.

### 3.2. Skill Discovery and Search

This section provides methods for finding skills available in the registry.

*   **`search(query: string, options?: { ... })`**:
    *   Performs a search against the registry (currently `mockRegistry`).
    *   Supports filtering by `category`, `verified` status, and pagination (`limit`, `offset`).
    *   Utilizes `searchCache` to store and retrieve results, respecting `config.cacheTTLMs`.
    *   Emits a `'search-complete'` event upon successful completion.
*   **`getSkillDetails(name: string)`**: Retrieves detailed information for a specific skill.
*   **`getVersions(name: string)`**: Fetches available versions for a given skill.
*   **`getFeatured()`**: Returns a list of popular and verified skills.
*   **`getByCategory(category: SkillCategory)`**: A convenience method that calls `search` filtered by category.

### 3.3. Skill Installation and Management

These methods handle the lifecycle of skills on the local system.

*   **`install(name: string, version?: string)`**:
    *   Installs a skill from the registry.
    *   Checks if the skill is already installed or if unverified skills are allowed (`config.allowUnverified`).
    *   Simulates download and creates an `InstalledSkill` entry.
    *   Emits a `'skill-install'` event.
*   **`uninstall(name: string)`**: Removes an installed skill. Emits a `'skill-uninstall'` event.
*   **`update(name: string, version?: string)`**:
    *   Updates an installed skill to a specified version or its latest available version.
    *   Emits a `'skill-update'` event with the updated skill and the old version.
*   **`updateAll()`**: Iterates through all installed skills and attempts to update them.

### 3.4. Installed Skill Lifecycle

Methods for querying and modifying the state of locally installed skills.

*   **`getInstalled()`**: Returns an array of all currently installed skills.
*   **`getInstalledSkill(name: string)`**: Retrieves a specific installed skill by name.
*   **`isInstalled(name: string)`**: Checks if a skill is currently installed.
*   **`enable(name: string)`**: Marks an installed skill as enabled. Emits a `'skill-enable'` event.
*   **`disable(name: string)`**: Marks an installed skill as disabled. Emits a `'skill-disable'` event.
*   **`getEnabled()`**: Returns an array of all currently enabled skills.
*   **`configure(name: string, config: Record<string, unknown>)`**: Updates the configuration for an installed skill.

### 3.5. Update Checking

Functionality for monitoring and notifying about skill updates.

*   **`checkForUpdates()`**:
    *   Compares installed skill versions against the latest versions in the registry.
    *   Emits an `'update-available'` event for each skill with an available update.
*   **`startAutoUpdateCheck()`**: Initiates a periodic check for updates based on `config.updateCheckIntervalMs`.
*   **`stopAutoUpdateCheck()`**: Halts the periodic update checking.

### 3.6. Configuration and Utilities

General utility methods for the registry.

*   **`getConfig()`**: Returns a copy of the current `RegistryConfig`.
*   **`updateConfig(config: Partial<RegistryConfig>)`**: Merges new configuration settings.
*   **`clearCache()`**: Clears the `searchCache`.
*   **`getStats()`**: Provides runtime statistics about the registry (e.g., installed count, cache size).
*   **`shutdown()`**: Cleans up resources, stopping auto-update checks and clearing internal state.

## 4. Singleton Access

The module provides a singleton pattern for accessing the `SkillsRegistry` instance, ensuring that only one instance manages skills across the application.

```mermaid
graph TD
    subgraph Application
        A[Other Modules] --> B(getSkillsRegistry)
    end

    subgraph Skills Registry Module
        B --> C{skillsRegistryInstance is null?}
        C -- Yes --> D[new SkillsRegistry(config)]
        C -- No --> E[Return existing instance]
        D --> F[skillsRegistryInstance]
        E --> F
        F --> B
        G(resetSkillsRegistry) --> H[skillsRegistryInstance.shutdown()]
        H --> I[Set skillsRegistryInstance = null]
    end
```

*   **`getSkillsRegistry(config?: Partial<RegistryConfig>)`**:
    *   This is the primary way to obtain the `SkillsRegistry` instance.
    *   If an instance doesn't exist, it creates one, optionally applying initial configuration.
    *   Subsequent calls return the same instance.
*   **`resetSkillsRegistry()`**:
    *   Used primarily for testing or application shutdown scenarios.
    *   It calls `shutdown()` on the existing instance and then clears the singleton reference, allowing a new instance to be created on the next `getSkillsRegistry` call.

## 5. Integration Points

The `skills-registry` module is designed to be a central service. Based on the provided call graph, its primary interactions are currently with its own test suite (`registry.test.ts`).

**Current Interactions (from call graph):**
*   `registry.test.ts` extensively calls almost all public methods of `SkillsRegistry` (e.g., `search`, `install`, `uninstall`, `update`, `enable`, `disable`, `checkForUpdates`, `getSkillsRegistry`, `resetSkillsRegistry`, etc.) to ensure functionality.

**Intended Interactions (how other modules would use it):**
*   **UI/CLI Modules**: Would use `search`, `getSkillDetails`, `getFeatured`, `getByCategory` to display available skills. They would call `install`, `uninstall`, `update`, `enable`, `disable`, `configure` based on user actions.
*   **Core Runtime/Orchestration**: Would use `getInstalled`, `getEnabled` to load and execute skills. It might subscribe to `skill-install`, `skill-update`, `skill-enable`, `skill-disable` events to react to changes in the skill landscape.
*   **Background Services**: Would use `startAutoUpdateCheck` and `checkForUpdates` to keep skills up-to-date.
*   **Configuration Management**: Would use `getConfig` and `updateConfig` to manage registry settings.

The `EventEmitter` pattern is crucial for loose coupling, allowing other parts of the application to react to skill changes without direct dependencies on the registry's internal state.