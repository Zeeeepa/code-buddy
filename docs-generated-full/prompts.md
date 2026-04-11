---
title: "prompts"
module: "prompts"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.178Z"
---
# prompts

The `prompts` module serves as the central repository for defining the various operational modes and personas of the "Code Buddy" AI assistant. It contains a collection of Markdown files, each representing a distinct system prompt or a significant part of one, which guides the AI's behavior, identity, and constraints when interacting with users.

## Purpose

The primary purpose of the `prompts` module is to:

1.  **Define AI Personas:** Establish specific roles for Code Buddy (e.g., Architect, Code Reviewer) with tailored guidelines and focus areas.
2.  **Enforce Behavioral Rules:** Implement critical security guidelines, tool usage protocols, and response styles that govern Code Buddy's interactions.
3.  **Modularize Prompt Engineering:** Allow for easy management, modification, and extension of Code Buddy's core instructions without embedding them directly into application logic.

These prompt files are static assets that are loaded and provided to a Large Language Model (LLM) as part of its system prompt, effectively "programming" its behavior for a given session or task.

## Module Structure and Key Components

The `prompts` module consists of several Markdown files, each designed for a specific purpose:

```
prompts/
├── architect.md
├── code-reviewer.md
├── default.md
├── minimal.md
└── secure.md
```

### `default.md` - The Base Persona

This file defines the standard, general-purpose "Code Buddy" persona. It includes:

*   **Identity:** "Code Buddy, an AI-powered terminal assistant for software development."
*   **Security Rules:** A critical, non-negotiable set of rules covering instruction integrity, data protection, and command safety. These rules are designed to prevent prompt injection and protect sensitive information.
*   **Tool Usage Rules:** Guidelines for how Code Buddy should interact with its available tools (e.g., `view_file`, `str_replace_editor`, `create_file`, bash commands).
*   **Response Style:** Direct, concise, and explanatory when valuable.

This prompt serves as the foundation for most Code Buddy operations unless a more specialized mode is explicitly activated.

### `secure.md` - Enhanced Security Persona

This prompt provides an even stricter set of security guidelines compared to `default.md`. It reiterates and expands upon the critical security rules, emphasizing:

*   **Instruction Integrity:** Stronger refusal mechanisms for prompt injection attempts.
*   **Data Protection:** Explicit mention of redacting sensitive patterns like AWS keys and connection strings.
*   **Command Safety:** Increased caution with commands affecting files outside the working directory and refusal of destructive commands.
*   **Tool Validation:** Explicit requirement to validate file paths and check bash commands for shell injection.

This persona is intended for environments or tasks where maximum security vigilance is paramount.

### `minimal.md` - Simplified Persona

This file defines a stripped-down version of Code Buddy's identity and capabilities. It focuses on:

*   **Identity:** A basic "Code Buddy" identity.
*   **Core Capabilities:** Lists fundamental abilities like receiving context, sending responses, and emitting function calls.
*   **Task Approach:** Encourages breaking down complex tasks.
*   **Response Style:** Direct and concise.

It omits the detailed security and tool usage rules found in `default.md` and `secure.md`, making it suitable for scenarios where a lighter, less constrained AI behavior is desired, perhaps for internal testing or specific, controlled tasks.

### `architect.md` - Specialized Architect Persona

This prompt configures Code Buddy to act as a software architect. It includes:

*   **Identity:** "Code Buddy in Architect mode - a software architect focused on system design."
*   **Architecture Focus:** Detailed guidelines on what to consider when analyzing or designing systems, categorized into Structure, Patterns, Scalability, Maintainability, and Integration.
*   **Analysis Approach:** A structured methodology for approaching architectural problems.
*   **Response Style:** Systemic thinking, future-oriented, balanced, and rationale-driven.

This persona is activated when Code Buddy needs to provide architectural insights and design recommendations.

### `code-reviewer.md` - Specialized Code Reviewer Persona

This prompt configures Code Buddy to act as a meticulous code reviewer. It includes:

*   **Identity:** "Code Buddy in Code Review mode - a meticulous code reviewer focused on quality."
*   **Review Guidelines:** Specific areas of focus for code review, including Correctness, Security, Performance, Maintainability, and Best Practices.
*   **Response Format:** A structured format for reviews, including Summary, Issues Found (by severity), Positive Aspects, and Recommendations.
*   **Response Style:** Constructive, specific, explanatory, and appreciative of good code.

This persona is activated when Code Buddy is tasked with analyzing and providing feedback on code changes.

## How Prompts are Used

These Markdown files are not executed directly. Instead, they are loaded by a higher-level component (e.g., a `PromptManager` or `Agent` class within the Code Buddy application). This component is responsible for:

1.  **Selecting the appropriate prompt(s):** Based on the user's request or the current operational mode.
2.  **Loading content:** Reading the Markdown content from the selected files.
3.  **Constructing the final system prompt:** Combining the loaded content with any dynamic context or user input to form the complete system prompt that is sent to the LLM.

This modular approach allows the Code Buddy application to dynamically switch between different AI behaviors and enforce varying levels of security and guidance.

```mermaid
graph TD
    subgraph Prompts Module
        A[default.md]
        B[secure.md]
        C[minimal.md]
        D[architect.md]
        E[code-reviewer.md]
    end

    F[Code Buddy Application Logic] --> G{Select Prompt(s)}
    G --> A
    G --> B
    G --> C
    G --> D
    G --> E

    A -- Load Content --> H[Construct System Prompt]
    B -- Load Content --> H
    C -- Load Content --> H
    D -- Load Content --> H
    E -- Load Content --> H

    H -- Send to --> I[Large Language Model (LLM)]
    I -- Generates Response --> F
```

## Contribution Guidelines

When contributing to the `prompts` module:

*   **Maintain Clarity:** Ensure prompt instructions are unambiguous and easy for an LLM to interpret.
*   **Adhere to Markdown:** Use standard Markdown syntax for readability.
*   **Categorize Directives:** Group related instructions (e.g., `<identity>`, `<security_rules>`, `<response_style>`) for better organization, even if these are just conceptual tags for human readability within the prompt.
*   **Test Thoroughly:** Any changes to prompts, especially security rules, should be rigorously tested to ensure the AI behaves as expected and does not introduce vulnerabilities or unintended side effects.
*   **Document New Personas:** If adding a new persona, clearly define its purpose, focus areas, and expected behavior.