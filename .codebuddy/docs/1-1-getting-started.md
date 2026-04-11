# Getting Started

<details>
<summary>Relevant source files</summary>

- `src/advanced/session-replay.ts`
- `src/agent/agent-loader.ts`
- `src/agent/architect-mode.ts`

</details>

## Prerequisites

- Node.js 18+ runtime

## Installation

```bash
cd @phuetz/code-buddy
npm install
```

## First Run

```bash
npm run dev
```

## Available Scripts

| Script | Command |
|--------|---------|
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

## Summary

**Getting Started** covers:
1. **Prerequisites**
2. **Installation**
3. **First Run**
4. **Available Scripts**


---

**See also:** [Overview](./1-overview.md)


**Referenced by:** [Overview](./1-overview.md)


---
[← Previous: Overview](./1-overview.md) | [Next: Key Concepts →](./1-2-key-concepts.md)
