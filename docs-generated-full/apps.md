---
title: "apps"
module: "apps"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.043Z"
---
# apps

The `apps` module serves as a central repository for a diverse collection of self-contained application projects. These projects primarily demonstrate various full-stack development patterns, API integrations, and challenge solutions, often utilizing Node.js for backend services. While largely independent, they collectively showcase a range of application functionalities from command-line tools to authenticated web applications and AI-powered chat interfaces.

### Module Structure and Purpose

1.  **[CodeBuddy Real Campaign](apps-codebuddy-real-campaign.md)**: This is the most extensive sub-module, comprising a series of distinct "levels" or challenge solutions. Each level is a complete application demonstrating specific concepts:
    *   **CLI Task Tracker**: A command-line interface for task management with local JSON persistence.
    *   **Notes Board Web Application (v2)**: A full-stack web application for creating and managing notes.
    *   **AI Support Desk (v2)**: An AI-powered chat application integrated with the Google Gemini API.
    *   **Authenticated Task Manager (SQLite)**: A full-stack task manager with user authentication and session management.
    *   Additional levels (e.g., Realtime Collaborative Board, AI Ops, Multi-Worker Orchestrator) further explore real-time communication, operational intelligence, and distributed processing.
    These levels are designed to be self-contained, with internal workflows like `addTask` calling `loadTasks` within the CLI Task Tracker, or `fetchNotes` in the Notes Board.

2.  **Gemini Chatbox Applications**: This group includes **[gemini-chatbox-codebuddy-v2](apps-gemini-chatbox-codebuddy-v2.md)**, **[gemini-chatbox-codebuddy](apps-gemini-chatbox-codebuddy.md)**, and **[gemini-chatbox](apps-gemini-chatbox.md)**. These are individual, self-contained mini-applications focused on demonstrating and testing integration with the Google Gemini API. They typically feature an Express.js backend to proxy requests to the Gemini API and a simple web frontend for user interaction, enabling AI-powered chat experiences.

3.  **[cb-fix-check](apps-cb-fix-check.md)**: This module appears to be a placeholder or non-code asset, containing a single text file and no detectable functional purpose or interactions with other modules.

### Interactions and Workflows

The modules within `apps` are predominantly independent. There are no direct cross-module calls or shared execution flows *between* the `codebuddy-real-campaign` and the standalone `gemini-chatbox` applications, nor with `cb-fix-check`. Instead, the `apps` module functions as a collection of distinct projects.

Common themes across several modules include:
*   **Node.js and Express.js**: Widely used for backend development.
*   **Google Gemini API Integration**: A recurring feature for AI-powered functionalities, particularly in the `gemini-chatbox` applications and `Level 3: AI Support Desk (v2)`.

Key workflows are internal to each application:
*   **User Interaction with AI**: Users send messages via a web interface (e.g., `app.js` in `level-3-ai-chat-v2/public`) to a backend, which communicates with the Gemini API and relays responses back.
*   **Task Management**: CLI commands (e.g., `index.js` in `level-1-cli/task-tracker`) or web forms (e.g., `app.js` in `level-4-auth-sqlite/public`) handle task creation, listing, and completion, often persisting data locally.
*   **Real-time Updates**: Applications like `level-6-ops-realtime` use WebSockets (`connectWebSocket`, `broadcast`) to provide live incident updates to clients.
*   **Job Orchestration**: Modules like `level-8-multi-worker` manage and process jobs, potentially distributing them to workers (`processJob`).