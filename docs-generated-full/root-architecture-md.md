---
title: "Root — ARCHITECTURE.md"
module: "root-architecture-md"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.192Z"
---
# Root — ARCHITECTURE.md

This document describes `ARCHITECTURE.md`, the primary architectural documentation for the Code Buddy project.

## Documentation for `ARCHITECTURE.md`

The `ARCHITECTURE.md` file serves as the authoritative source for understanding the overall design, structure, and technical decisions behind the Code Buddy application. It is a living document intended to provide a comprehensive overview for developers, architects, and new team members.

### Purpose

The main goals of `ARCHITECTURE.md` are:

*   **Provide a High-Level Overview**: Quickly orient readers to the system's purpose and core functionality.
*   **Detail System Components**: Describe the various layers, modules, and key classes that constitute Code Buddy.
*   **Explain Design Principles**: Document the architectural patterns, security considerations, and performance optimizations employed.
*   **Guide Contribution**: Offer insights into how to extend the system, such as adding new tools or UI components.
*   **Document Advanced Features**: Detail specialized modules like the Local LLM Stack, Analytics, Intelligence, and the Workflow Engine.
*   **Maintain a Single Source of Truth**: Ensure consistency in architectural understanding across the development team.

### Audience

This document is primarily intended for:

*   **New Developers**: To quickly onboard and understand the codebase structure.
*   **Existing Developers**: As a reference for understanding specific modules, design patterns, or cross-cutting concerns.
*   **Architects/Reviewers**: To evaluate the system's design, scalability, and security posture.
*   **Project Managers**: To gain a technical understanding of the system's capabilities and limitations.

### Document Structure

`ARCHITECTURE.md` is organized into logical sections, each addressing a specific aspect of the Code Buddy system. The document begins with versioning information and a table of contents for easy navigation.

1.  **System Overview**: Introduces Code Buddy's core concept (AI-powered CLI, agentic architecture) and provides a high-level architectural diagram.
2.  **Architecture Layers**: Breaks down the system into distinct layers (Presentation, Application, API, Tool, Utility), detailing their responsibilities, key components, and technologies.
3.  **Core Components**: Dives deeper into critical components like `CodeBuddyAgent`, `ConfirmationService`, the Tool System, Context Injection, WorkflowGuardMiddleware, and WorkflowRules.
4.  **Design Patterns**: Illustrates the application of common software design patterns (Singleton, Observer, Strategy, Iterator, Factory) within the codebase.
5.  **Data Flow**: Explains the end-to-end message processing flow and settings resolution logic.
6.  **Security Architecture**: Outlines the defense-in-depth strategy, including input validation, confirmation systems, sandboxing, and monitoring.
7.  **Technology Stack**: Lists the core and development dependencies used in the project.
8.  **Extension Points**: Provides practical guidance on how to add new tools, UI components, or support new models.
9.  **Performance Considerations**: Details implemented optimizations and defines key performance limits.
10. **Local LLM Infrastructure**: Describes the modules for GPU monitoring (`GPUMonitor`), HuggingFace model management (`ModelHub`), and Codebase RAG enhancements (`OllamaEmbeddingProvider`, `HNSWVectorStore`). Includes an updated architecture diagram for this stack.
11. **Analytics Module**: Covers `PrometheusExporter`, `ROITracker`, `CodeEvolution`, and `CodebaseHeatmap` for usage, cost, and codebase analysis.
12. **Intelligence Module**: Details `SemanticSearch`, `ProactiveSuggestions`, `RefactoringRecommender`, and `TaskComplexityEstimator` for intelligent assistance.
13. **API Module**: Describes the `RestApiServer` and `WebhookManager` for external integrations.
14. **UI Enhancements**: Lists new UI components for improved user experience.
15. **Gateway WebSocket Protocol**: Explains the multi-client WebSocket server, handshake, message types, and configuration.
16. **Lobster Workflow Engine**: Details the DAG-based workflow engine, its structure, features, and Native Engine compatibility.
17. **Companion App / Node System**: Describes device pairing and remote invocation capabilities for companion applications.
18. **Send Policy Engine**: Explains the rule-based message delivery control system.
19. **Message Preprocessing Pipeline**: Outlines the 4-stage inbound message processing pipeline.
20. **Encrypted Secrets Vault**: Details the secure storage for API keys and credentials.
21. **Cloud Deployment**: Lists configuration generators for various cloud platforms and Nix.
22. **Future Architecture Considerations**: Discusses planned improvements like a plugin system, workspace awareness, advanced caching, and multi-agent support.
23. **Diagrams**: Includes specific diagrams (e.g., Component Dependency Graph) to visually represent relationships.
24. **Conclusion**: Summarizes the architectural priorities of Code Buddy.

### How to Use `ARCHITECTURE.md`

*   **For a quick overview**: Start with "System Overview" and "Architecture Layers".
*   **To understand core logic**: Refer to "Core Components" and "Data Flow".
*   **When implementing new features**: Consult "Architecture Layers" to identify the correct layer, "Core Components" for existing patterns, and "Extension Points" for guidance on adding new functionality.
*   **For security-sensitive changes**: Thoroughly review "Security Architecture".
*   **When working with local LLMs or RAG**: Focus on the "Local LLM Infrastructure" section.
*   **For advanced integrations or automation**: Explore the "Analytics Module", "Intelligence Module", "API Module", "Gateway WebSocket Protocol", and "Lobster Workflow Engine".
*   **Before deploying**: Check the "Cloud Deployment" section.

### Maintenance Guidelines

`ARCHITECTURE.md` is a critical document that must be kept current with the evolving codebase.

*   **Update on Change**: Any significant change to the system's design, introduction of new components, modification of core logic, or alteration of architectural patterns should be reflected in this document.
*   **Version and Date**: Ensure the `Version` and `Last Updated` fields at the top of the document are updated with every significant revision.
*   **Clarity and Conciseness**: Strive for clear, developer-focused language. Avoid jargon where simpler terms suffice, and use diagrams judiciously to enhance understanding.
*   **Accuracy**: Verify that all referenced function names, class names, and code patterns accurately reflect the current state of the codebase.
*   **Review**: Periodically review the entire document to ensure its continued relevance and accuracy.