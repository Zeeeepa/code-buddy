---
title: "grok-cli — Wiki"
module: "overview"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.172Z"
---
# grok-cli — Wiki

Welcome to the **Code Buddy** project wiki!

This is the central hub for understanding, developing, and contributing to Code Buddy. Whether you're a new developer looking to get started, an experienced contributor diving into specific modules, or just curious about the architecture, this wiki is designed to guide you.

## What is Code Buddy?

**Code Buddy** (also known as `grok-cli`) is an open-source, multi-provider AI coding agent designed for your terminal. It acts as your personal AI-powered development tool and assistant, supporting a wide range of large language models (LLMs) including Grok, Claude, ChatGPT, Gemini, Ollama, and LM Studio.

Inspired by the Native Engine architecture, Code Buddy offers a rich set of features:
*   **52+ Tools**: A comprehensive suite of capabilities for coding tasks.
*   **Multi-Channel Messaging**: Interact with the AI across various interfaces.
*   **Skills System**: Define and manage custom AI capabilities.
*   **Extensible Architecture**: Easily integrate new providers, tools, and features.

## High-Level Architecture

Code Buddy's architecture is designed for modularity, extensibility, and robust AI interaction. At its core, it orchestrates communication between users, AI models, and various development tools.

Here's a simplified view of the most important modules and their relationships:

```mermaid
graph TD
    User[User Interaction] --> CLI[Code Buddy CLI]
    IDE[IDE Extensions] --> CLI
    CLI --> Agent[AI Agent (src/agent)]
    Agent --> Providers[LLM Providers (src/providers)]
    Agent --> Tools[Tools & Skills (src/tools)]
    Agent --> Memory[Context & Memory (src/memory)]
    Agent --> Prompts[Prompts & Personas (prompts)]
    Tools --> Sandbox[Execution Sandbox (src/sandbox)]
    Sandbox --> External[External Systems/APIs]
```

## Core Components & Data Flow

The project is structured into several key modules, each with a distinct responsibility:

1.  **User Interface & Entry Point**:
    *   The [Root](Root.md) module serves as the central hub, defining the project's strategic direction and core architecture.
    *   User interactions primarily flow through the **Code Buddy CLI**, which is orchestrated by the `src/commands` module. This module handles parsing user input and dispatching actions.
    *   For IDE integration, the project provides dedicated extensions like the [VS Code Extension (vscode-extension)](vscode-extension.md) and the [JetBrains Plugin (jetbrains-plugin)](jetbrains-plugin.md), offering a seamless AI experience directly within your editor.

2.  **The AI Core**:
    *   The brain of Code Buddy resides in the [AI Agent (src/agent)](src.md#ai-agent) module. This module is responsible for reasoning, planning, and executing tasks based on user requests.
    *   It communicates with various LLMs through the [LLM Providers (src/providers)](src.md#llm-providers) module, which abstracts away the differences between Grok, Claude, ChatGPT, and other models.
    *   The agent's behavior and identity are shaped by the [Prompts (prompts)](prompts.md) module, which defines various AI personas and operational modes.

3.  **Capabilities & Execution**:
    *   To perform actions, the AI Agent leverages a rich set of [Tools (src/tools)](src.md#tools). These tools encapsulate specific functionalities, such as file system operations, code execution, or API interactions.
    *   Many tools, especially those involving code execution, operate within the [Execution Sandbox (src/sandbox)](src.md#execution-sandbox) module. This Rust-based sidecar (`src-sidecar`) provides a secure and isolated environment for running potentially untrusted code.
    *   The project also features a sophisticated [Skills (src/skills)](src.md#skills) system, allowing for complex, multi-step operations to be defined and executed by the agent.

4.  **Context & Data Management**:
    *   Maintaining conversational history and project-specific information is crucial. The [Context (src/context)](src.md#context) and [Memory (src/memory)](src.md#memory) modules handle this, ensuring the AI has the necessary information to provide relevant assistance.
    *   For persistent data storage, the [database](database.md) module manages schema migrations.

5.  **Development & Operations**:
    *   The [scripts](scripts.md) module is the project's automation hub, containing all build, test, maintenance, and utility tasks. This includes generating documentation, running tests, and more.
    *   Performance is tracked using the [benchmarks](benchmarks.md) module, which measures CLI startup time and tool execution speed.
    *   Quality assurance is handled by the [tests](tests.md) and [test-scripts](test-scripts.md) modules, which contain unit, integration, and feature tests.
    *   Deployment configurations are managed by the [deploy](deploy.md) module, which defines Kubernetes manifests.
    *   The [packaging](packaging.md) module handles distribution across various platforms (Arch Linux, Snap, Windows).

## Getting Started for Developers

To get Code Buddy up and running for development:

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/phuetz/code-buddy.git
    cd code-buddy
    ```
2.  **Install dependencies**: Code Buddy supports both `npm` and `bun`.
    ```bash
    # Using npm
    npm install

    # Or using bun
    bun install
    ```
3.  **Start the development server**:
    ```bash
    # Using npm
    npm run dev

    # Or using bun
    bun run dev
    ```
    This will typically launch the Code Buddy CLI in development mode.

For more detailed development workflows, refer to the [scripts](scripts.md) module documentation.

## Contributing

We welcome contributions from everyone! If you're interested in helping out, please explore the modules, pick an area that interests you, and don't hesitate to reach out on our community channels. The [docs](docs.md) module is a great place to start for general project information and guidelines.