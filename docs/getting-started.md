# Getting Started

## Prerequisites

- **Node.js** 18.0.0 or higher
- **ripgrep** (recommended for faster search)
- **Docker** (optional, required for CodeAct/sandbox execution)

```bash
# macOS
brew install ripgrep

# Ubuntu/Debian
sudo apt-get install ripgrep

# Windows
choco install ripgrep
```

## Installation

```bash
# npm (recommended)
npm install -g @phuetz/code-buddy

# Or try without installing
npx @phuetz/code-buddy@latest

# From source
git clone https://github.com/phuetz/code-buddy.git
cd code-buddy
npm install
npm run build
npm start
```

## First Run

```bash
# Set your API key (Grok/xAI is the default provider)
export GROK_API_KEY=your_api_key

# Start interactive mode
buddy

# Or with a specific task
buddy --prompt "analyze the codebase structure"

# Use a local LLM (LM Studio)
buddy --base-url http://localhost:1234/v1 --api-key lm-studio

# Use Ollama
buddy --base-url http://localhost:11434/v1 --model llama3

# Full autonomy mode
buddy --yolo
```

Code Buddy auto-detects your provider from the API key environment variables. Set any of `GROK_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`, `MISTRAL_API_KEY`, etc.

## Headless Mode (CI / Scripting)

```bash
# Single prompt, JSON output to stdout
buddy -p "create a hello world Express app" --output-format json > result.json

# Pipe into other tools
buddy -p "explain this code" --output-format json 2>/dev/null | jq '.content'

# CI with full autonomy
buddy -p "run tests and fix failures" \
  --dangerously-skip-permissions \
  --output-format json \
  --max-tool-rounds 30

# Auto-approve all tool executions
buddy -p "fix lint errors" --auto-approve --output-format text
```

Headless mode exits cleanly after completion -- safe for `timeout`, shell scripts, and CI pipelines.

## Session Management

```bash
# Continue the most recent session
buddy --continue

# Resume a specific session by ID (supports partial matching)
buddy --resume abc123

# Set a cost limit for the session
buddy --max-price 5.00
```

## Typical Workflow

```bash
# 1. First-time setup
buddy --setup                # Quick API key setup wizard
buddy onboard                # Full interactive config wizard
buddy doctor                 # Verify environment and dependencies

# 2. Start coding
buddy                        # Launch interactive chat
buddy --vim                  # Launch with Vim keybindings

# 3. Describe what you want in natural language
> "Create a Node.js project with Express and Prisma"
> "Add Google OAuth authentication"
> "Write tests for the auth module"
> "Fix the typecheck errors"
> "Commit everything"

# 4. Advanced modes
buddy --model gemini-2.5-flash  # Switch AI model
buddy --system-prompt architect # Use architect system prompt
buddy speak                     # Voice conversation mode
buddy daemon start              # Run 24/7 in background
buddy server --port 3000        # Expose REST/WebSocket API
```

Code Buddy autonomously reads files, writes code, runs commands, and fixes errors -- typically 5-15 tool calls per task (up to 50, or 400 in YOLO mode). After each edit, it can auto-commit (Aider-style), run linters, and execute tests automatically.
