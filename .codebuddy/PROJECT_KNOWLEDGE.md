# Project Knowledge

> Auto-generated project understanding from 8 documentation sections.
> Last updated: 2026-03-15T07:55:33.100Z

# @phuetz/code-buddy v0.5.0

This document provides a comprehensive overview of `@phuetz/code-buddy`, an open-source, multi-provider AI coding agent designed for terminal use. It outlines the project's core functionalities, architectural components, and underlying technologies, serving as a foundational guide for developers and contributors.

> Open-source multi-provider AI coding agent for the terminal. Supports Grok, Claude, ChatGPT, Gemini, Ollama and LM Studio with 52+ tools, multi-channel m
# Recent Changes

This section provides a chronological overview of the most recent development activities within the project. Understanding these changes is crucial for tracking project evolution, identifying new features, bug fixes, and architectural shifts, and staying informed about the current state of the codebase.

The following log presents the last 30 commits, offering insights into the rapid development cycles, particularly focusing on documentation generation, system audits, and enhan
# Architecture

This document outlines the high-level architecture of the project, detailing its layered structure, core components, and the flow of execution. Understanding this architecture is crucial for comprehending how the system processes user requests, interacts with various services, and maintains robustness and extensibility.

## System Layers
# Code Quality Metrics

This document provides a comprehensive overview of key code quality metrics, offering insights into the maintainability, efficiency, and architectural health of the codebase. Understanding these metrics is crucial for identifying areas for improvement, reducing technical debt, and ensuring the long-term viability and scalability of the project. By regularly reviewing these metrics, development teams can make informed decisions to enhance code quality and streamline future
# Security Architecture

The security architecture is a foundational aspect of this project, designed to ensure the integrity, confidentiality, and availability of all operations, particularly those involving sensitive code generation and execution. This section provides a comprehensive overview of the system's robust security posture, detailing the modules and features that mitigate potential risks throughout the application lifecycle. Understanding these components is crucial for developing an
# Context & Memory Management

This section details the core mechanisms responsible for providing the Language Model (LLM) with relevant information and maintaining a persistent understanding across interactions. Effective context management ensures the LLM receives precise, up-to-date data for its current task, while a robust memory system allows it to learn, adapt, and maintain continuity over time, preventing repetitive or inconsistent behavior.

## Context Management (28 modules)
```markdown
# Configuration System

The configuration system is a foundational component of the application, providing a flexible and robust mechanism for managing settings across various environments and user preferences. It establishes a clear hierarchy for how different configuration sources are loaded and prioritized, ensuring that everything from API keys to model parameters can be customized and overridden as needed. Understanding this system is crucial for both developers and users to eff
# CLI & API Reference

This document provides a comprehensive reference for the agent's command-line interface (CLI) and its external HTTP API. Understanding these interfaces is crucial for both direct user interaction and programmatic integration with the agent, enabling control, data exchange, and extensibility.

## Slash Commands