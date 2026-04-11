---
title: "tests — skills-registry"
module: "tests-skills-registry"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:28.015Z"
---
# tests — skills-registry

This document describes the `SkillsRegistry` module, focusing on its public API and expected behavior as defined and verified by the `tests/skills-registry/registry.test.ts` test suite. While the provided source is a test file, it serves as a comprehensive specification for the `SkillsRegistry` class and its associated functions.

## Skills Registry Module Overview

The `SkillsRegistry` module provides a centralized system for discovering, installing, managing, and updating "skills" within the application. It acts as an interface to a skill repository, handling everything from searching for available skills to managing their lifecycle (installation, updates, configuration, enabling/disabling).

The `registry.test.ts` file thoroughly exercises all aspects of the `SkillsRegistry` class, ensuring its robustness and adherence to expected functionality.

## Core Components

The module primarily exposes the `SkillsRegistry` class and two utility functions for managing its singleton instance.

### `SkillsRegistry` Class

The `SkillsRegistry` class is the central component, encapsulating all logic for interacting with skills. It manages:
*   **Skill Discovery:** Searching, filtering, and retrieving details about available skills.
*   **Skill Lifecycle:** Installation, uninstallation, and updates.
*   **Installed Skill Management:** Enabling, disabling, configuring, and querying installed skills.
*   **Configuration:** Managing registry-specific settings.
*   **Caching:** Optimizing search and detail retrieval.
*   **Event Emission:** Notifying listeners of significant changes (e.g., `skill-install`, `update-available`).

### Singleton Access

The module provides a singleton pattern for accessing the `SkillsRegistry` instance:

*   **`getSkillsRegistry(): SkillsRegistry`**: Returns the global, shared instance of `SkillsRegistry`. If an instance does not yet exist, it is created.
*   **`resetSkillsRegistry(): void`**: Resets the global singleton instance. This is primarily used in testing environments to ensure test isolation, allowing each test to start with a clean registry state. In a production environment, this should be used with caution as it discards the current registry state.

```mermaid
graph TD
    subgraph SkillsRegistry Module
        SR_CLASS[SkillsRegistry Class]
        getSR(getSkillsRegistry())
        resetSR(resetSkillsRegistry())
        SR_INSTANCE(SkillsRegistry Singleton Instance)
    end

    getSR -- Creates/Returns --> SR_INSTANCE
    resetSR -- Clears/Replaces --> SR_INSTANCE
    SR_CLASS -- Instantiates --> SR_INSTANCE
```

### Key Data Structures

The tests interact with several key data types, indicating their importance in the module's API:

*   **`SkillSearchResult`**: Represents a skill found during a search operation, containing metadata like `name`, `category`, `verified` status, etc.
*   **`InstalledSkill`**: Represents a skill that has been installed, including its `manifest`, `config`, and `enabled` status.

## API Overview and Functionality

The `SkillsRegistry` class exposes a rich API for managing skills. The following sections detail its primary functionalities, as demonstrated by the test suite.

### 1. Skill Discovery & Search

The registry provides robust capabilities for finding and filtering skills.

*   **`registry.search(query: string, options?: { category?: string; verified?: boolean; limit?: number; offset?: number }): Promise<SkillSearchResult[]>`**
    *   Searches for skills by keyword (`query`).
    *   Supports filtering by `category` and `verified` status.
    *   Includes pagination options (`limit`, `offset`).
    *   Caches search results for performance.
    *   Emits a `search-complete` event upon completion, providing the results.

*   **`registry.getFeatured(): Promise<SkillSearchResult[]>`**
    *   Retrieves a list of featured skills.
    *   Featured skills are typically verified and sorted by download count (descending).

*   **`registry.getByCategory(category: string): Promise<SkillSearchResult[]>`**
    *   Fetches all skills belonging to a specific `category`.

### 2. Skill Information Retrieval

Beyond search, the registry allows fetching detailed information about specific skills.

*   **`registry.getSkillDetails(name: string): Promise<SkillSearchResult | null>`**
    *   Retrieves comprehensive details for a skill identified by its `name`.
    *   Returns `null` if the skill is not found.

*   **`registry.getVersions(name: string): Promise<Array<{ version: string; downloadUrl: string }>>`**
    *   Lists all available versions for a given skill, including their download URLs.
    *   Returns an empty array if the skill is unknown.

### 3. Skill Lifecycle Management

The registry handles the full lifecycle of skills, from installation to updates and uninstallation.

#### Installation

*   **`registry.install(name: string, version?: string): Promise<InstalledSkill>`**
    *   Installs a skill by its `name`. An optional `version` can be specified; otherwise, the latest version is installed.
    *   Throws an error if the skill is already installed or not found.
    *   Can be configured to block installation of unverified skills (`allowUnverified: false`).
    *   Emits a `skill-install` event with the `InstalledSkill` object upon successful installation.

*   **`registry.isInstalled(name: string): boolean`**
    *   Checks if a skill with the given `name` is currently installed.

#### Uninstallation

*   **`registry.uninstall(name: string): Promise<boolean>`**
    *   Removes an installed skill.
    *   Returns `true` if uninstallation was successful, `false` if the skill was not installed.
    *   Emits a `skill-uninstall` event with the skill's `name` upon successful uninstallation.

#### Updates

*   **`registry.update(name: string): Promise<InstalledSkill | null>`**
    *   Updates a specific installed skill to its latest available version.
    *   Returns the updated `InstalledSkill` object, or `null` if the skill is not installed.
    *   Emits a `skill-update` event with the updated `InstalledSkill` and the `oldVersion`.

*   **`registry.updateAll(): Promise<InstalledSkill[]>`**
    *   Attempts to update all currently installed skills to their latest versions.
    *   Returns an array of all skills that were successfully updated.

### 4. Installed Skill Management

Once installed, skills can be managed (enabled, disabled, configured).

*   **`registry.getInstalled(): InstalledSkill[]`**
    *   Returns an array of all currently installed skills.

*   **`registry.getInstalledSkill(name: string): InstalledSkill | undefined`**
    *   Retrieves the `InstalledSkill` object for a specific installed skill by its `name`.

*   **`registry.enable(name: string): boolean`**
    *   Enables an installed skill, making it active.
    *   Returns `true` if the skill was enabled, `false` if not found or already enabled.
    *   Emits a `skill-enable` event with the skill's `name`.

*   **`registry.disable(name: string): boolean`**
    *   Disables an installed skill, making it inactive.
    *   Returns `true` if the skill was disabled, `false` if not found or already disabled.
    *   Emits a `skill-disable` event with the skill's `name`.

*   **`registry.getEnabled(): InstalledSkill[]`**
    *   Returns an array of all currently *enabled* skills.

*   **`registry.configure(name: string, config: Record<string, any>): boolean`**
    *   Updates the configuration for an installed skill.
    *   Returns `true` if configuration was successful, `false` if the skill is not installed.

### 5. Update Checking

The registry can actively check for updates for installed skills.

*   **`registry.checkForUpdates(): Promise<Array<{ name: string; current: string; latest: string }>>`**
    *   Scans all installed skills and identifies which ones have newer versions available.
    *   Emits an `update-available` event for each skill found to have an update.

*   **`registry.startAutoUpdateCheck(): void`**
    *   Initiates a background process to periodically check for skill updates.

*   **`registry.stopAutoUpdateCheck(): void`**
    *   Halts the background auto-update checking process.

### 6. Configuration & State

The registry maintains its own configuration and provides statistics.

*   **`registry.getConfig(): { registryUrl: string; installDir: string; allowUnverified: boolean }`**
    *   Retrieves the current configuration settings for the registry.

*   **`registry.updateConfig(newConfig: Partial<typeof registry.getConfig>): void`**
    *   Updates specific configuration settings.

*   **`registry.clearCache(): void`**
    *   Clears any cached search results or skill details.

*   **`registry.getStats(): { installedCount: number; enabledCount: number; cacheEntries: number; isAutoUpdating: boolean }`**
    *   Provides various statistics about the registry's current state, such as the number of installed/enabled skills, cache size, and auto-update status.

## Testing Strategy

The `registry.test.ts` file employs a robust testing strategy:

*   **Isolation:** `beforeEach` and `afterEach` hooks ensure that each test runs with a fresh `SkillsRegistry` instance by calling `resetSkillsRegistry()` and `registry.shutdown()`. This prevents test side-effects from influencing subsequent tests.
*   **Comprehensive Coverage:** Tests are grouped by functionality (`describe` blocks) and cover a wide range of scenarios, including successful operations, edge cases (e.g., unknown skills), error conditions (e.g., duplicate installation, unverified skills), and event emissions.
*   **Asynchronous Operations:** Many tests correctly use `async/await` to handle the asynchronous nature of registry operations like `search`, `install`, and `update`.
*   **Expectations:** `expect` assertions are used extensively to verify return values, object states, array lengths, and emitted events.

## Integration Points

The `SkillsRegistry` module is designed to be a core service. It imports its main components from `../../src/skills-registry/index.js`, indicating that this test file is directly validating the public interface of the primary `SkillsRegistry` implementation. Any part of the application requiring skill management would interact with this module, typically by obtaining the singleton instance via `getSkillsRegistry()`.