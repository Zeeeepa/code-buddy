# Interface Reference

<details>
<summary>Relevant source files</summary>

- `src/commands/cli/index.ts.ts`
- `src/server/index.ts.ts`

</details>

For architectural overview, see [Architecture](./tool-development.md#architecture). For deployment strategies, see Deployment.

## CLI Interface

The CLI interface serves as the primary entry point for user interaction with `@phuetz/code-buddy`. By centralizing command registration within the CLI module, the system ensures a consistent execution path for all local development tasks.

Currently, `src/commands/cli/index.ts` acts as the structural root for the command-line interface. While this module does not export specific functions or classes in the current context, it is designed to serve as the orchestrator for command discovery and execution.

**Developer Tip:** Keep your CLI entry point thin by delegating logic to specialized command modules rather than implementing business logic directly in the index file.

**Sources:** [src/commands/cli/index.ts:L1-L100](src/commands/cli/index.ts)

## Server API

The Server API provides the backend infrastructure for the code-buddy ecosystem. It is built on top of Express, allowing for modular route handling and middleware integration.

The file `src/server/index.ts` functions as the primary entry point for the Express application. It is responsible for initializing the server environment. As with the CLI module, this file currently serves as a structural placeholder for the application's lifecycle management.

**Developer Tip:** Use middleware in your server entry point to handle cross-cutting concerns like logging, authentication, and error handling before requests reach your route handlers.

**Sources:** [src/server/index.ts:L1-L100](src/server/index.ts)

## Interface Architecture

The following diagram illustrates the separation of concerns between the CLI and Server interfaces within the project structure.

```mermaid
graph TD
    "CLI Entry" --> "Command Logic"
    "Server Entry" --> "Express App"
    "CLI Entry" --- "src/commands/cli/index.ts"
    "Server Entry" --- "src/server/index.ts"
```

## Summary

1. The CLI interface is anchored by `src/commands/cli/index.ts`, which serves as the central registration point for all commands.
2. The Server API is anchored by `src/server/index.ts`, which acts as the Express application entry point.
3. Both modules currently function as structural [entry points](./plugin-system.md#entry-points), establishing the foundation for future command and route implementations.
4. Separation of concerns is maintained by isolating CLI and Server logic into distinct directory structures.