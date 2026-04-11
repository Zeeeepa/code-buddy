---
title: "src — deploy"
module: "src-deploy"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.434Z"
---
# src — deploy

The `src/deploy` module is responsible for generating various configuration files required for deploying applications to different cloud platforms and for defining declarative builds using Nix. It acts as a central hub for creating platform-specific deployment manifests and build definitions, abstracting away the intricacies of each platform's configuration syntax.

This module is designed to be extensible, allowing for easy addition of new cloud providers or build systems.

## Module Structure

The `src/deploy` module is composed of two primary files:

*   `cloud-configs.ts`: Handles the generation of deployment configurations for popular cloud platforms like Fly.io, Railway, Render, Hetzner, Northflank, and Google Cloud Platform (GCP).
*   `nix-config.ts`: Manages the generation of Nix-specific files (`flake.nix` and `default.nix`) for declarative builds and development environments.

## Cloud Deployment Configurations (`cloud-configs.ts`)

This file provides a unified interface for generating deployment configuration files tailored to specific cloud providers. It aims to simplify the deployment process by producing ready-to-use configuration files based on a common set of application parameters.

### Key Concepts and Types

*   **`CloudPlatform`**: A union type defining the currently supported cloud providers: `'fly' | 'railway' | 'render' | 'hetzner' | 'northflank' | 'gcp'`.
*   **`DeployConfig`**: The primary input interface for all cloud deployment generators. It encapsulates common application parameters:
    ```typescript
    export interface DeployConfig {
      platform: CloudPlatform; // The target cloud platform
      appName: string;
      region?: string; // Optional deployment region
      port?: number;   // Application port, defaults to 3000
      env?: Record<string, string>; // Environment variables
      memory?: string; // e.g., "512mb", "1gb"
      cpus?: number;   // Number of CPU cores
    }
    ```
*   **`GenerateResult`**: The standard output interface for all configuration generation functions.
    ```typescript
    export interface GenerateResult {
      success: boolean; // Indicates if generation was successful
      files: Array<{ path: string; content: string }>; // List of generated files and their content
      instructions: string; // CLI or manual instructions for deployment
    }
    ```

### Core Logic and Functions

1.  **Input Sanitization**:
    *   `sanitizeAppName(name: string)`: Ensures application names adhere to platform-specific naming conventions (alphanumeric, hyphens, underscores). Throws an error for invalid names.
    *   `sanitizeEnvValue(value: string)`: Escapes characters that might be problematic in YAML/TOML or shell contexts to prevent injection issues.

2.  **Platform-Specific Generators**:
    Each supported cloud platform has its own dedicated generator function:
    *   `generateFlyConfig(config: DeployConfig)`: Generates `fly.toml`.
    *   `generateRailwayConfig(config: DeployConfig)`: Generates `railway.json`.
    *   `generateRenderConfig(config: DeployConfig)`: Generates `render.yaml`.
    *   `generateHetznerConfig(config: DeployConfig)`: Generates `hetzner-cloud-init.yml` (for cloud-init).
    *   `generateNorthflankConfig(config: DeployConfig)`: Generates `northflank.json`.
    *   `generateGCPConfig(config: DeployConfig)`: Generates `app.yaml` (for Google Cloud Run/App Engine Flex).

    These functions take a `DeployConfig` object, apply platform-specific defaults (e.g., default port, region), sanitize inputs, and return a `GenerateResult` containing the file content and deployment instructions.

3.  **Main Dispatcher**:
    *   `generateDeployConfig(config: DeployConfig)`: This is the central function that dispatches the `DeployConfig` to the appropriate platform-specific generator based on `config.platform`. It acts as a router, ensuring the correct configuration is generated.

4.  **File System Interaction**:
    *   `writeDeployConfigs(outputDir: string, config: DeployConfig)`: This asynchronous function orchestrates the entire process. It calls `generateDeployConfig` to get the `GenerateResult`, then iterates through the `result.files` array, creating necessary directories and writing each file to the specified `outputDir`. It logs each file written using `logger.info`.

### Cloud Deployment Flow

The typical flow for generating and writing cloud deployment configurations is as follows:

```mermaid
graph TD
    A[Start Deployment Request] --> B{DeployConfig Input};
    B --> C[writeDeployConfigs(outputDir, config)];
    C --> D[generateDeployConfig(config)];
    D -- config.platform = 'fly' --> E[generateFlyConfig(config)];
    D -- config.platform = 'render' --> F[generateRenderConfig(config)];
    D -- ...other platforms... --> G[generateOtherConfig(config)];
    E --> H{GenerateResult};
    F --> H;
    G --> H;
    H --> I{Loop through result.files};
    I --> J[fs.mkdir(dirname)];
    J --> K[fs.writeFile(fullPath, content)];
    K --> L[logger.info(Wrote file)];
    L --> I;
    I --> M[Return GenerateResult];
```

## Nix Configuration Generator (`nix-config.ts`)

This file focuses on generating Nix-specific configuration files, `flake.nix` and `default.nix`, which enable declarative builds and reproducible development environments using the Nix package manager.

### Key Concepts and Types

*   **`NixConfig`**: The input interface for Nix configuration generation.
    ```typescript
    export interface NixConfig {
      packageName: string;
      version: string;
      description: string;
      nodeVersion?: string; // Optional Node.js version, defaults to '22'
    }
    ```

### Core Logic and Functions

1.  **`generateFlakeNix(config: NixConfig)`**:
    Generates the content for `flake.nix`. This file defines a Nix flake, which is a modern way to manage Nix projects. It includes:
    *   Inputs for `nixpkgs` and `flake-utils`.
    *   An `outputs` section that defines a default package (`packages.default`) using `pkgs.buildNpmPackage`.
    *   A `devShells.default` for a development environment with Node.js and npm.
    *   **Important**: It includes `npmDepsHash = "sha256-PLACEHOLDER";` which needs to be filled in by the user after initial generation (e.g., using `nix flake update --commit-lock-file`).
    *   A wrapper script for the package to execute the main `index.js` file.

2.  **`generateDefaultNix(config: NixConfig)`**:
    Generates the content for `default.nix`. This is a more traditional Nix package definition, also using `pkgs.buildNpmPackage`. It's simpler than `flake.nix` and is often used for basic package definitions without the full flake ecosystem.
    *   Similar to `flake.nix`, it includes `npmDepsHash = "sha256-PLACEHOLDER";`.

3.  **`writeNixConfigs(outputDir: string, config: NixConfig)`**:
    This asynchronous function takes an `outputDir` and a `NixConfig` object. It calls `generateFlakeNix` and `generateDefaultNix` to get the content, then writes these files to `flake.nix` and `default.nix` respectively within the `outputDir`. It logs the action using `logger.info`.

## Integration and Usage

The `src/deploy` module is a critical utility for both CLI commands and internal tools that need to provision or configure deployment artifacts.

### Incoming Calls

*   **`src/tools/deploy-tool.ts`**: This tool likely uses `writeDeployConfigs` to generate and save cloud deployment configurations and `generateDeployConfig` for scenarios where only the configuration content is needed without writing to disk.
*   **`commands/cli/deploy-command.ts`**: The CLI `deploy` command directly leverages `writeDeployConfigs` and `writeNixConfigs` to fulfill user requests for generating deployment files. This is the primary user-facing entry point for this module.
*   **`scripts/tests/cat-sanitize-glob-deploy.ts`**: Various `generate*Config` functions (e.g., `generateRailwayConfig`, `generateFlyConfig`, `generateRenderConfig`, `generateFlakeNix`, `generateDefaultNix`) are called directly by test scripts to verify the correctness of the generated content.

### Outgoing Calls

The module primarily interacts with:
*   `fs/promises`: For asynchronous file system operations (creating directories, writing files).
*   `path`: For resolving file paths.
*   `../utils/logger.js`: For logging informational messages about file operations.

### Typical Workflow

A typical interaction with this module would involve:

1.  A user or an automated tool provides a `DeployConfig` (for cloud platforms) or `NixConfig` (for Nix).
2.  The `writeDeployConfigs` or `writeNixConfigs` function is called, specifying an output directory.
3.  The module generates the appropriate configuration file(s) and writes them to the specified location.
4.  The `GenerateResult` (for cloud configs) or a simple path object (for Nix configs) is returned, potentially including deployment instructions.