# Tool System

The project uses a dual-registry tool architecture with RAG-based selection. Tools are organized by category and selected per-query based on semantic relevance.

## Tool Registry

The tool ecosystem contains **117** tool modules organized in `src/tools/` and `src/tools/registry/`.

## Tool Categories

| Category | Tools | Key Modules |
|----------|-------|-------------|
| Tool registration and factory | 29 | `advanced-tools`, `attention-tools`, `bash-tools` |
| intelligence | 5 | `ast-parser`, `code-context`, `dependency-analyzer` |
| Pre/post execution hooks | 4 | `default-hooks`, `result-sanitizer`, `session-lanes` |
| advanced | 2 | `multi-file-editor`, `operation-history` |
| bash | 2 | `bash-tool`, `command-validator` |
| Image processing and OCR | 2 | `image-processor`, `ocr-tool` |
| apply patch | 1 | `apply-patch` |
| archive tool | 1 | `archive-tool` |
| ask human tool | 1 | `ask-human-tool` |
| audio tool | 1 | `audio-tool` |
| base tool | 1 | `base-tool` |
| batch processor | 1 | `batch-processor` |
| Browser automation (Playwright) | 1 | `playwright-tool` |
| browser tool | 1 | `browser-tool` |
| changelog generator | 1 | `changelog-generator` |

## RAG-Based Tool Selection

Each user query triggers a semantic similarity search over tool metadata:

1. **Query embedding** — User message converted to vector
2. **Similarity scoring** — Each tool scored against query (0-1)
3. **Top-K selection** — ~15-20 most relevant tools selected
4. **Token savings** — Reduces prompt from 110+ tools to ~15-20

Tools have priority (3-10), keywords, and category metadata used for matching.

## Registered Tools

27 tools registered in metadata:

- **bash**: bash
- **browser**: browser
- **code**: code_graph
- **codebase**: codebase_map
- **computer**: computer_control
- **create**: create_file, create_todo_list
- **docker**: docker
- **edit**: edit_file
- **find**: find_symbols, find_references, find_definition
- **get**: get_todo_list
- **git**: git
- **js**: js_repl
- **kubernetes**: kubernetes
- **list**: list_directory
- **multi**: multi_edit
- **process**: process
- **search**: search, search_multi
- **spawn**: spawn_subagent
- **str**: str_replace_editor
- **update**: update_todo_list
- **view**: view_file
- **web**: web_search, web_fetch