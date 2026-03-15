# Development Guide

## Getting Started

```bash
git clone <repo-url>
cd grok-cli
npm install
npm run dev          # Development mode (Bun)
npm run dev:node     # Development mode (tsx/Node.js)
```

## Build & Development Commands

| Command | Description |
|---------|-------------|
| `npm run build` | `tsc` |
| `npm run build:bun` | `bun run tsc` |
| `npm run build:watch` | `tsc --watch` |
| `npm run clean` | `rm -rf dist coverage .nyc_output *.tsbuildinfo` |
| `npm run dev` | `bun run src/index.ts` |
| `npm run dev:node` | `tsx src/index.ts` |
| `npm run start` | `node dist/index.js` |
| `npm run start:bun` | `bun run dist/index.js` |
| `npm run test` | `vitest run` |
| `npm run test:watch` | `vitest` |
| `npm run test:coverage` | `vitest run --coverage` |
| `npm run lint` | `eslint . --ext .js,.jsx,.ts,.tsx` |
| `npm run lint:fix` | `eslint . --ext .js,.jsx,.ts,.tsx --fix` |
| `npm run format` | `prettier --write "src/**/*.{ts,tsx,js,jsx,json,md}"` |
| `npm run format:check` | `prettier --check "src/**/*.{ts,tsx,js,jsx,json,md}"` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run typecheck:watch` | `tsc --noEmit --watch` |
| `npm run check:circular` | `npx tsx scripts/check-circular-deps.ts` |
| `npm run validate` | `npm run lint && npm run typecheck && npm test` |
| `npm run install:bun` | `bun install` |

## Project Structure

```
src/
├── agent/           # Core agent system (orchestrator, executor, middleware)
├── codebuddy/       # LLM client, tool definitions
├── tools/           # 110+ tool implementations
├── context/         # Context window management
├── security/        # Security layers, validation
├── knowledge/       # Code graph, analysis
├── channels/        # Messaging platforms
├── server/          # HTTP/WebSocket server
├── commands/        # CLI and slash commands
├── config/          # Configuration management
├── memory/          # Persistence and memory
├── ui/              # Terminal UI (Ink/React)
├── daemon/          # Background daemon
├── docs/            # Documentation generator
└── index.ts         # CLI entry point
```

## Coding Conventions

- TypeScript strict mode, avoid `any`
- Single quotes, semicolons, 2-space indent
- Files: kebab-case (`text-editor.ts`), components: PascalCase
- ESM imports with `.js` extension
- Conventional Commits (`feat(scope): description`)

## Testing

- Framework: **Vitest** with happy-dom
- Tests in `tests/` and co-located `src/**/*.test.ts`
- Run: `npm test` (all), `npm run test:watch` (dev)
- Coverage: `npm run test:coverage`
- Validate: `npm run validate` (lint + typecheck + test)

## Adding a New Tool

1. Create class in `src/tools/`
2. Add definition in `src/codebuddy/tools.ts`
3. Add execution case in `CodeBuddyAgent.executeTool()`
4. Register in `src/tools/registry/`
5. Add metadata in `src/tools/metadata.ts`