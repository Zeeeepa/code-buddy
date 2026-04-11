# Available Tools

> Auto-generated tool reference for CodeBuddy. Do not edit manually.
> Generated: 2026-03-28

## Table of Contents

- [File Reading](#file-reading) (2)
- [File Writing](#file-writing) (5)
- [File Search](#file-search) (5)
- [System Operations](#system-operations) (6)
- [Git Operations](#git-operations) (1)
- [Web Operations](#web-operations) (3)
- [Planning & Tasks](#planning-tasks) (5)
- [Codebase Analysis](#codebase-analysis) (9)
- [Media](#media) (5)
- [Documents](#documents) (3)
- [Utility](#utility) (21)

## File Reading

### view_file

View file contents or directory listings

**Parameters:**
- `path` (string, required) - Path to file or directory to view
- `file_path` (string) - Alias for path
- `target_file` (string) - Alias for path
- `start_line` (number) - Starting line number for partial file view (optional)
- `end_line` (number) - Ending line number for partial file view (optional)

**Keywords:** view, read, show, display, content, file, open, look, see, check, list, directory, ls, cat

---

### list_directory

List files and directories with type, size, and modification time

**Parameters:**
- `path` (string) - Directory path to list (default: current directory)   Default: `.`

**Keywords:** list, directory, files, ls, folder, contents, dir, entries

---

## File Writing

### str_replace_editor

Replace text in existing files

**Parameters:**
- `path` (string, required) - Path to the file to edit
- `file_path` (string) - Alias for path
- `target_file` (string) - Alias for path
- `old_str` (string, required) - Text to replace (must match exactly, or will use fuzzy matching for multi-line strings)
- `old_text` (string) - Alias for old_str
- `old_content` (string) - Alias for old_str
- `find` (string) - Alias for old_str
- `old_string` (string) - Alias for old_str
- `new_str` (string, required) - Text to replace with
- `new_text` (string) - Alias for new_str
- `new_content` (string) - Alias for new_str
- `replace` (string) - Alias for new_str
- `new_string` (string) - Alias for new_str
- `replace_all` (boolean) - Replace all occurrences (default: false, only replaces first occurrence)

**Keywords:** edit, modify, change, update, replace, fix, refactor, alter, patch

---

### create_file

Create new files with content

**Parameters:**
- `path` (string, required) - Path where the file should be created
- `file_path` (string) - Alias for path
- `target_file` (string) - Alias for path
- `content` (string, required) - Content to write to the file

**Keywords:** create, new, write, generate, make, add, initialize, init, touch

---

### multi_edit

Apply multiple text replacements to a single file atomically

**Parameters:**
- `file_path` (string, required) - Path to the file to edit
- `edits` (array, required) - Array of edit operations to apply in order

**Keywords:** multi, edit, replace, batch, atomic, refactor, multiple, edits, rename

---

### codebase_replace

Find and replace text across multiple files in the codebase

**Parameters:**
- `search_pattern` (string, required) - The text or regex pattern to search for
- `replacement` (string, required) - The replacement string. For regex, use $1, $2 for capture groups.
- `glob` (string) - File glob pattern to filter files (e.g., "**/*.ts", "src/**/*.js"). Default: "**/*"
- `is_regex` (boolean) - Treat search_pattern as a regular expression. Default: false
- `dry_run` (boolean) - Preview changes without modifying files. Default: false
- `max_files` (number) - Maximum number of files to modify (safety limit). Default: 50

**Keywords:** replace, find, rename, refactor, codebase, search, substitute, sed, bulk, mass, global

---

### organize_imports

Organize, add missing, or remove unused imports in source files

**Parameters:**
- `file_path` (string, required) - Path to the file to organize imports for
- `action` (string) - Action to perform   Values: `organize`, `remove_unused`, `add_missing`
- `symbol` (string) - Symbol name to add import for (required when action is add_missing)

**Keywords:** import, organize, unused, missing, add import, remove import, sort, cleanup, typescript, python

---

## File Search

### search

Search for text content or files

**Parameters:**
- `query` (string, required) - Text to search for or file name/path pattern
- `search_type` (string) - Type of search: 'text' for content search, 'files' for file names, 'both' for both (default: 'both')   Values: `text`, `files`, `both`
- `include_pattern` (string) - Glob pattern for files to include (e.g. '*.ts', '*.js')
- `exclude_pattern` (string) - Glob pattern for files to exclude (e.g. '*.log', 'node_modules')
- `case_sensitive` (boolean) - Whether search should be case sensitive (default: false)
- `whole_word` (boolean) - Whether to match whole words only (default: false)
- `regex` (boolean) - Whether query is a regex pattern (default: false)
- `max_results` (number) - Maximum number of results to return (default: 50)
- `file_types` (array) - File types to search (e.g. ['js', 'ts', 'py'])
- `include_hidden` (boolean) - Whether to include hidden files (default: false)

**Keywords:** search, find, locate, grep, look for, where, which, query, pattern, regex

---

### find_definition

Find definition/declaration location of a symbol

**Parameters:**
- `symbol_name` (string, required) - The symbol name to find the definition for

**Keywords:** definition, go to definition, declaration, symbol

---

### find_references

Find references/usages of a symbol

**Parameters:**
- `symbol_name` (string, required) - The symbol name to find references for
- `context_lines` (number) - Number of context lines before/after each match (default: 2)

**Keywords:** references, usages, where used, callers, semantic

---

### find_symbols

Find symbols (functions, classes, variables) in the codebase

**Parameters:**
- `name` (string, required) - Symbol name or partial name to search for
- `types` (array) - Types of symbols to find (default: all types)
- `exported_only` (boolean) - Only find exported/public symbols (default: false)

**Keywords:** symbols, functions, classes, definitions, code, index, semantic

---

### search_multi

Run multiple searches in one call

**Parameters:**
- `patterns` (array, required) - Array of patterns to search for
- `operator` (string) - OR: find files with any pattern. AND: find files with all patterns (default: OR)   Values: `OR`, `AND`

**Keywords:** multi, search, batch, parallel, patterns, queries

---

## System Operations

### bash

Execute bash commands

**Parameters:**
- `command` (string, required) - The bash command to execute

**Keywords:** bash, terminal, command, run, execute, shell, npm, yarn, pip, install, build, test, compile

---

### docker

Docker container management operations

**Parameters:**
- `operation` (string, required) - The Docker operation to perform   Values: `list_containers`, `list_images`, `run`, `stop`, `start`, `remove_container`, `remove_image`, `logs`, `exec`, `build`, `pull`, `push`, `inspect`, `compose_up`, `compose_down`, `system_info`, `prune`
- `args` (object) - Operation-specific arguments

**Keywords:** docker, container, image, build, run, stop, logs, exec, compose, pull, push, prune, volume, network, dockerfile

---

### kubernetes

Kubernetes cluster management operations

**Parameters:**
- `operation` (string, required) - The Kubernetes operation to perform   Values: `cluster_info`, `get_context`, `list_contexts`, `use_context`, `get`, `describe`, `apply`, `delete`, `logs`, `exec`, `scale`, `rollout_status`, `rollout_restart`, `port_forward`, `get_events`, `top`, `create_namespace`, `set_namespace`, `create_configmap`, `create_secret`
- `args` (object) - Operation-specific arguments

**Keywords:** kubernetes, k8s, kubectl, pod, deployment, service, namespace, cluster, node, scale, rollout, configmap, secret, ingress, helm

---

### computer_control

Control desktop applications with mouse, keyboard, and window actions

**Parameters:**
- `action` (string, required) - The action to perform   Values: `snapshot`, `snapshot_with_screenshot`, `get_element`, `find_elements`, `click`, `left_click`, `middle_click`, `double_click`, `right_click`, `move_mouse`, `drag`, `scroll`, `cursor_position`, `wait`, `type`, `key`, `key_down`, `key_up`, `hotkey`, `get_windows`, `get_window`, `list_window_matches`, `wait_for_window`, `focus_window`, `close_window`, `get_active_window`, `minimize_window`, `maximize_window`, `restore_window`, `move_window`, `resize_window`, `set_window`, `act_on_best_window`, `get_audit_log`, `clear_audit_log`, `export_audit_log`, `set_pilot_mode`, `get_pilot_mode`, `get_volume`, `set_volume`, `get_brightness`, `set_brightness`, `notify`, `lock`, `sleep`, `start_recording`, `stop_recording`, `recording_status`, `system_info`, `battery_info`, `network_info`, `check_permission`
- `safetyProfile` (string) - Safety profile for action gating (strict blocks dangerous actions unless confirmed)   Values: `balanced`, `strict`
- `pilotMode` (string) - High-level piloting preset for default safety + matching behavior   Values: `cautious`, `normal`, `fast`
- `confirmDangerous` (boolean) - Required in strict profile for dangerous actions
- `simulateOnly` (boolean) - If true, do a dry-run for mutating actions without applying changes
- `auditLimit` (number) - Number of audit entries to return for get_audit_log (1-500)
- `exportAuditPath` (string) - Optional output path for export_audit_log JSON file
- `policyOverrides` (object) - Per-action safety overrides: { "close_window": "confirm|allow|block", ... }
- `ref` (number) - Element reference number from snapshot (e.g., 1, 2, 3)
- `x` (number) - X coordinate for mouse actions
- `y` (number) - Y coordinate for mouse actions
- `width` (number) - Window width (for resize_window)
- `height` (number) - Window height (for resize_window)
- `text` (string) - Text to type
- `key` (string) - Key to press (enter, tab, escape, backspace, delete, up, down, left, right, f1-f12, etc.)
- `seconds` (number) - Wait duration in seconds (for wait action)
- `modifiers` (array) - Modifier keys (ctrl, alt, shift, meta/command)
- `button` (string) - Mouse button   Values: `left`, `right`, `middle`
- `deltaX` (number) - Horizontal scroll amount (negative = left)
- `deltaY` (number) - Vertical scroll amount (negative = down)
- `windowTitle` (string) - Window title to find/focus
- `windowTitleRegex` (string) - Case-insensitive regex pattern for window title matching
- `windowTitleMatch` (string) - Window title matching mode   Values: `contains`, `equals`
- `processName` (string) - Process name to find/focus (e.g. Discord, chrome, msedge)
- `processNameMatch` (string) - Process name matching mode   Values: `equals`, `contains`
- `windowHandle` (string) - Window handle to focus/close directly
- `windowMatchStrategy` (string) - When multiple windows match, choose first, focused, largest, or newest   Values: `first`, `focused`, `largest`, `newest`
- `requireUniqueWindowMatch` (boolean) - If true, fail when multiple windows match instead of auto-selecting one
- `focus` (boolean) - Whether to focus window (for set_window)
- `windowState` (string) - Target state for set_window   Values: `normal`, `minimized`, `maximized`
- `bestWindowAction` (string) - Action used by act_on_best_window   Values: `focus`, `close`, `minimize`, `maximize`, `restore`, `move`, `resize`, `set`
- `timeoutMs` (number) - Timeout in milliseconds for wait_for_window
- `pollIntervalMs` (number) - Polling interval in milliseconds for wait_for_window
- `level` (number) - Volume or brightness level (0-100)
- `muted` (boolean) - Mute state
- `title` (string) - Notification title
- `body` (string) - Notification body
- `role` (string) - Element role to find (button, link, text-field, checkbox, etc.)
- `name` (string) - Element name to search for
- `interactiveOnly` (boolean) - Only include interactive elements in snapshot
- `format` (string) - Recording format   Values: `mp4`, `webm`, `gif`
- `fps` (number) - Recording frame rate
- `audio` (boolean) - Include audio in recording
- `permission` (string) - Permission to check (screen-recording, accessibility, camera, microphone)

**Keywords:** computer, control, desktop, mouse, keyboard, window, click, type, automation

---

### process

Manage system processes (spawn, inspect, logs, terminate)

**Parameters:**
- `action` (string, required) - The process action to perform   Values: `list`, `poll`, `log`, `write`, `kill`, `clear`, `remove`
- `args` (object) - Action-specific arguments

**Keywords:** process, spawn, kill, list, logs, pid, monitor

---

### js_repl

Execute JavaScript snippets in a controlled runtime

**Parameters:**
- `action` (string, required) - Action: execute code (default), reset context, or list variables   Values: `execute`, `reset`, `variables`
- `code` (string) - JavaScript code to execute (required for execute action)

**Keywords:** javascript, repl, eval, node, snippet, runtime

---

## Git Operations

### git

Git version control operations

**Parameters:**
- `operation` (string, required) - The git operation to perform   Values: `status`, `diff`, `add`, `commit`, `push`, `pull`, `branch`, `checkout`, `stash`, `auto_commit`, `blame`, `cherry_pick`, `bisect_start`, `bisect_step`, `bisect_reset`
- `args` (object) - Operation-specific arguments

**Keywords:** git, commit, push, pull, branch, merge, diff, status, checkout, stash, version, control

---

## Web Operations

### web_search

Search the web for information including weather, news, documentation, and general queries

**Parameters:**
- `query` (string, required) - The search query to execute
- `max_results` (number) - Maximum number of results to return (default: 5)

**Keywords:** search, google, web, internet, online, latest, news, documentation, docs, how to, weather, météo, meteo, forecast, temperature, info, find, lookup

---

### web_fetch

Fetch web page content

**Parameters:**
- `url` (string, required) - The URL of the web page to fetch

**Keywords:** fetch, url, website, page, download, http, https, link, read

---

### browser

Automate web browser for navigation, interaction, and testing

**Parameters:**
- `action` (string, required) - The browser action to perform   Values: `launch`, `connect`, `close`, `tabs`, `new_tab`, `focus_tab`, `close_tab`, `snapshot`, `get_element`, `find_elements`, `navigate`, `go_back`, `go_forward`, `reload`, `click`, `double_click`, `right_click`, `type`, `fill`, `select`, `press`, `hover`, `scroll`, `screenshot`, `pdf`, `get_cookies`, `set_cookie`, `clear_cookies`, `set_headers`, `set_offline`, `emulate_device`, `set_geolocation`, `evaluate`, `get_content`, `get_url`, `get_title`, `drag`, `upload_files`, `wait_for_navigation`, `get_local_storage`, `set_local_storage`, `get_session_storage`, `set_session_storage`, `add_route_rule`, `remove_route_rule`, `clear_route_rules`, `set_timezone`, `set_locale`, `download`
- `cdpUrl` (string) - CDP WebSocket URL for connecting to existing browser
- `headless` (boolean) - Run browser in headless mode (default: true)
- `tabId` (string) - Tab ID for focus_tab/close_tab
- `url` (string) - URL to navigate to
- `waitUntil` (string) - When to consider navigation complete   Values: `load`, `domcontentloaded`, `networkidle`
- `interactiveOnly` (boolean) - Only include interactive elements in snapshot
- `maxElements` (number) - Maximum elements to include in snapshot
- `ref` (number) - Element reference number from snapshot
- `role` (string) - Element role to search for (button, link, textbox, etc.)
- `name` (string) - Element name/text to search for
- `text` (string) - Text to type
- `key` (string) - Key to press (Enter, Tab, Escape, etc.)
- `modifiers` (array) - Modifier keys (Control, Alt, Shift, Meta)
- `button` (string) - Mouse button   Values: `left`, `right`, `middle`
- `clear` (boolean) - Clear field before typing
- `fields` (object) - Fields to fill: { "refNumber": "value", ... }
- `submit` (boolean) - Press Enter after filling fields
- `value` (string) - Value to select in dropdown
- `label` (string) - Label to select in dropdown
- `index` (number) - Index to select in dropdown
- `direction` (string) - Scroll direction   Values: `up`, `down`, `left`, `right`
- `amount` (number) - Scroll amount in pixels
- `toElement` (number) - Element ref to scroll to
- `fullPage` (boolean) - Capture full page vs viewport only
- `element` (number) - Element ref to capture
- `format` (string) - Image format   Values: `png`, `jpeg`, `webp`
- `quality` (number) - Image quality (0-100)
- `cookieName` (string) - Cookie name
- `cookieValue` (string) - Cookie value
- `cookieDomain` (string) - Cookie domain
- `headers` (object) - HTTP headers to set
- `offline` (boolean) - Enable offline mode
- `device` (string) - Device name to emulate (iPhone 14, iPad Pro, Pixel 5, etc.)
- `viewport` (object) - Custom viewport size
- `latitude` (number) - Latitude for geolocation
- `longitude` (number) - Longitude for geolocation
- `expression` (string) - JavaScript code to evaluate in page
- `timeout` (number) - Timeout in milliseconds
- `sourceRef` (number) - Source element ref for drag operation
- `targetRef` (number) - Target element ref for drag operation
- `files` (array) - File paths to upload
- `storageData` (object) - Key-value pairs for localStorage/sessionStorage
- `ruleId` (string) - Route rule ID
- `rulePattern` (string) - URL pattern to match for route rule
- `ruleAction` (string) - Action for route rule   Values: `block`, `mock`, `redirect`
- `ruleResponse` (object) - Mock response for route rule (status, body, contentType)
- `ruleRedirectUrl` (string) - Redirect URL for route rule
- `timezone` (string) - Timezone ID (e.g., America/New_York)
- `locale` (string) - Locale string (e.g., en-US)

**Keywords:** browser, automate, click, fill, form, screenshot, scrape, navigate, headless, puppeteer, playwright, selenium, test, ui, automation, web

---

## Planning & Tasks

### todo_update

Manage persistent task list for tracking progress

**Parameters:**
- `action` (string, required) - Action to perform   Values: `add`, `complete`, `update`, `remove`, `clear_done`, `list`
- `text` (string) - Item text (required for add; optional for update)
- `id` (string) - Item ID (required for complete/update/remove)
- `status` (string) - New status (for update)   Values: `pending`, `in_progress`, `done`, `blocked`
- `priority` (string) - Priority (for add/update, default: medium)   Values: `high`, `medium`, `low`

**Keywords:** todo, task, plan, track, progress, attention, focus

---

### get_todo_list

View current todo list and task status

**Parameters:**
- `filter` (string) - Filter todos by status (default: all)   Values: `all`, `pending`, `in_progress`, `completed`

**Keywords:** todo, task, list, view, show, what, do, faire, tâches, taches, pending, status

---

### plan

Manage a persistent execution plan (PLAN.md) with step tracking

**Parameters:**
- `action` (string, required) - Action: init (create new plan), read (show current plan), update (change step status), append (add new steps)   Values: `init`, `read`, `update`, `append`
- `goal` (string) - High-level goal for the plan (required for init)
- `step` (string) - Step description (for append) or step identifier (for update)
- `status` (string) - New status for the step (for update)   Values: `pending`, `in_progress`, `completed`, `failed`

**Keywords:** plan, goal, steps, track, progress, todo, organize, breakdown, checklist, PLAN.md

---

### create_todo_list

Create todo list for task planning

**Parameters:**
- `todos` (array, required) - Array of todo items

**Keywords:** todo, plan, task, list, organize, steps, breakdown, project

---

### update_todo_list

Update todo list progress

**Parameters:**
- `updates` (array, required) - Array of todo updates

**Keywords:** todo, update, complete, done, progress, status, mark

---

## Codebase Analysis

### code_graph

Query code dependency graph: callers, callees, impact analysis, Mermaid flowcharts, class hierarchies

**Parameters:**
- `operation` (string, required) - who_calls: find all callers. what_calls: find all callees. impact: transitive impact analysis. flowchart: Mermaid call chain. class_tree: inheritance hierarchy. file_map: file functions with signatures. find_path: dependency path A→B. module_deps: import diagram. communities: architectural clusters. semantic_search: embedding similarity. dead_code: uncalled functions/unimported modules. coupling: inter-module coupling heatmap. refactor: refactoring suggestions. drift: architecture changes vs snapshot. snapshot: save baseline for drift. visualize: interactive D3.js HTML. impact_preview: PR impact from git diff. stats: graph statistics + PageRank.   Values: `who_calls`, `what_calls`, `impact`, `flowchart`, `class_tree`, `file_map`, `find_path`, `module_deps`, `communities`, `semantic_search`, `dead_code`, `coupling`, `refactor`, `drift`, `snapshot`, `visualize`, `impact_preview`, `stats`
- `query` (string) - Function, class, or module name (fuzzy matched)
- `target` (string) - Target entity for find_path operation
- `depth` (number) - Depth for flowchart/impact/module_deps (default 2, max 6)

**Keywords:** code graph, call graph, who calls, what calls, callers, callees, impact analysis, what breaks, affected, flowchart, mermaid, diagram, organigramme, class hierarchy, inheritance, extends, implements, file functions, methods, signatures, dependency path, module dependencies, communities, clusters, subsystems, semantic search, embedding, similarity, pagerank, dead code, unused, uncalled, orphan, coupling, heatmap, refactoring, god function, hub module, drift, snapshot, evolution, visualize, interactive, d3, impact preview, pr impact, diff impact

---

### lsp_rename

Rename a symbol across the codebase using LSP

**Parameters:**
- `file_path` (string, required) - Path to the file containing the symbol to rename
- `line` (number, required) - Line number of the symbol (1-based)
- `character` (number, required) - Column number of the symbol (1-based)
- `new_name` (string, required) - New name for the symbol

**Keywords:** rename, refactor, symbol, lsp, language server, cross-file, identifier

---

### codebase_map

Analyze codebase structure and query code graph

**Parameters:**
- `operation` (string, required) - The operation: build (create map), summary (show overview), search (find files), symbols (list exports), graph_query (pattern match on code graph triples), graph_neighbors (ego-graph k-hop around entity), graph_path (shortest dependency path between two entities), graph_stats (code graph statistics), graph_file_functions (list all functions/methods in a file with their call graph)   Values: `build`, `summary`, `search`, `symbols`, `graph_query`, `graph_neighbors`, `graph_path`, `graph_stats`, `graph_file_functions`
- `query` (string) - Search query for finding relevant context, or entity name for graph operations (e.g. 'agent-executor', 'CodeBuddyAgent')
- `target` (string) - Target entity for graph_path operation
- `depth` (number) - Depth for graph_neighbors (default 2, max 4)
- `predicate` (string) - Filter by predicate for graph_query (e.g. 'imports', 'usedBy', 'definedIn', 'contains', 'patternOf')
- `node_type` (string) - Filter by node type for graph_query (e.g. 'module', 'agent', 'tool', 'middleware')
- `deep` (boolean) - Perform deep analysis including symbols and dependencies (slower)

**Keywords:** codebase, structure, architecture, map, overview, symbols, dependencies, analyze, graph, imports, who imports, neighbors, path, layers, components, modules, relationships, calls, call graph, extends, inherits, methods, flowchart, organigramme

---

### generate_openapi

Auto-generate OpenAPI 3.0.3 spec from project source code

**Parameters:**
- `project_root` (string, required) - Path to the project root directory
- `framework` (string) - Force a specific framework (auto-detected if not specified)   Values: `express`, `fastify`, `koa`, `flask`, `fastapi`, `spring`, `gin`, `echo`
- `output_format` (string) - Output format for the generated spec   Values: `json`, `yaml`

**Keywords:** openapi, swagger, api, documentation, rest, endpoint, route, spec, generate, express, flask, fastapi, spring

---

### lsp_code_action

Get available code actions (quick fixes, refactorings) from LSP

**Parameters:**
- `file_path` (string, required) - Path to the file
- `start_line` (number, required) - Start line of the range (1-based)
- `start_character` (number, required) - Start column of the range (1-based)
- `end_line` (number) - End line of the range (1-based, defaults to start_line)
- `end_character` (number) - End column of the range (1-based, defaults to start_character)

**Keywords:** code action, quickfix, refactor, lsp, language server, suggestion

---

### reason

Solve complex problems using Tree-of-Thought reasoning with MCTS

**Parameters:**
- `problem` (string, required) - The problem statement or question to reason about
- `context` (string) - Additional context, constraints, or background information
- `mode` (string) - Reasoning depth: shallow (~5 iterations), medium (~20), deep (~50), exhaustive (~100). Default: medium   Values: `shallow`, `medium`, `deep`, `exhaustive`
- `constraints` (array) - Constraints that the solution must satisfy

**Keywords:** reason, think, plan, analyze, architecture, design, debug, complex, trade-off, compare, evaluate, strategy, decision, mcts, tree-of-thought

---

### scan_licenses

Scan project dependencies for license compliance

**Parameters:**
- `project_root` (string, required) - Path to the project root directory (must contain package.json)

**Keywords:** license, compliance, scan, spdx, dependency, copyleft, gpl, mit, legal, audit, npm

---

### spawn_parallel_agents

Execute multiple subtasks concurrently with specialized sub-agents

**Parameters:**
- `tasks` (array, required) - List of tasks to execute in parallel

**Keywords:** parallel, agents, concurrent, subtasks, batch, delegate

---

### spawn_subagent

Spawn specialized subagent

**Parameters:**
- `type` (string, required) - Type of subagent to spawn   Values: `code-reviewer`, `debugger`, `test-runner`, `explorer`, `refactorer`, `documenter`
- `task` (string, required) - The task for the subagent to perform
- `context` (string) - Additional context for the task

**Keywords:** subagent, agent, review, debug, test, explore, document, refactor

---

## Media

### audio

Process audio files

**Parameters:**
- `operation` (string, required) - Operation: info (get audio metadata), transcribe (convert speech to text), list (list audio files), to_base64   Values: `info`, `transcribe`, `list`, `to_base64`
- `path` (string, required) - Path to audio file or directory
- `language` (string) - Language code for transcription (e.g., 'en', 'fr', 'es')
- `prompt` (string) - Optional prompt to guide transcription

**Keywords:** audio, sound, music, transcribe, speech, voice, mp3, wav

---

### ocr

Extract text from images

**Parameters:**
- `operation` (string, required) - OCR operation to perform   Values: `extract`, `extract_region`, `list_languages`, `batch`
- `path` (string) - Path to image file
- `paths` (array) - Array of image paths for batch OCR
- `language` (string) - OCR language code (e.g., 'eng', 'fra', 'deu')
- `region` (object) - Region to OCR (for extract_region)

**Keywords:** ocr, text, extract, image, recognize, read

---

### screenshot

Capture screenshots

**Parameters:**
- `fullscreen` (boolean) - Capture entire screen (default: true)
- `window` (string) - Window title or ID to capture
- `region` (object) - Screen region to capture
- `delay` (number) - Delay in seconds before capture
- `format` (string) - Image format (default: png)   Values: `png`, `jpg`
- `quality` (number) - JPEG quality 1-100 (only for jpg format)
- `outputPath` (string) - Custom output file path
- `forLLM` (boolean) - Normalize screenshot for LLM consumption (resize + compress)

**Keywords:** screenshot, capture, screen, image, snap, window

---

### video

Process video files

**Parameters:**
- `operation` (string, required) - Operation to perform on the video   Values: `info`, `extract_frames`, `thumbnail`, `extract_audio`, `list`
- `path` (string, required) - Path to video file or directory
- `interval` (number) - Seconds between frames for frame extraction
- `count` (number) - Number of frames to extract
- `timestamps` (array) - Specific timestamps (in seconds) to extract frames from
- `output_dir` (string) - Output directory for extracted content

**Keywords:** video, movie, frames, thumbnail, mp4, extract

---

### clipboard

Clipboard operations

**Parameters:**
- `operation` (string, required) - Clipboard operation to perform   Values: `read_text`, `write_text`, `read_image`, `write_image`, `read_html`, `copy_file_path`, `copy_file_content`, `get_type`, `clear`
- `text` (string) - Text to write to clipboard (for write_text)
- `path` (string) - File path (for image operations or copy_file_*)

**Keywords:** clipboard, copy, paste, cut

---

## Documents

### archive

Work with archives

**Parameters:**
- `operation` (string, required) - Archive operation to perform   Values: `list`, `extract`, `create`, `list_archives`
- `path` (string) - Path to archive file or directory
- `sources` (array) - Source paths for creating archive
- `output_dir` (string) - Output directory for extraction
- `output_path` (string) - Output path for created archive
- `format` (string) - Format for creating archive (default: zip)   Values: `zip`, `tar`, `tar.gz`, `tar.bz2`, `tar.xz`
- `files` (array) - Specific files to extract
- `password` (string) - Password for encrypted archives
- `overwrite` (boolean) - Overwrite existing files during extraction

**Keywords:** zip, tar, archive, compress, extract, unzip, rar, 7z

---

### document

Read Office documents

**Parameters:**
- `operation` (string, required) - Operation: read (extract content), list (list documents in directory)   Values: `read`, `list`
- `path` (string, required) - Path to document or directory

**Keywords:** docx, xlsx, pptx, word, excel, powerpoint, office, spreadsheet

---

### pdf

Read PDF documents

**Parameters:**
- `operation` (string, required) - Operation: extract (get text content), info (get metadata), list (list PDFs in directory), to_base64 (convert to base64)   Values: `extract`, `info`, `list`, `to_base64`
- `path` (string, required) - Path to PDF file or directory
- `pages` (array) - Specific page numbers to extract (optional)
- `max_pages` (number) - Maximum number of pages to extract (optional)

**Keywords:** pdf, document, extract, read, pages

---

## Utility

### analyze_logs

Analyze log files — parse entries, detect patterns, find anomalies

**Parameters:**
- `file_path` (string, required) - Path to the log file to analyze
- `max_lines` (number) - Maximum number of log lines to process (default: 100000)
- `level_filter` (string) - Filter entries by log level   Values: `error`, `warn`, `info`, `debug`, `trace`
- `search` (string) - Search string to filter log entries
- `tail` (number) - Only analyze the last N lines of the file

**Keywords:** log, analyze, parse, error, warn, debug, trace, pattern, anomaly, syslog, json, tail, grep, monitor

---

### restore_context

Restore compressed context content by identifier

**Parameters:**
- `identifier` (string, required) - File path (e.g. "src/agent/types.ts") or URL to restore

**Keywords:** restore, context, memory, compressed, retrieve, earlier

---

### task_verify

Run verification contract (tsc, test, lint)

**Parameters:**
- `steps` (array) - Which verification steps to run (default: all)
- `fix` (boolean) - Auto-fix lint issues (default: false)

**Keywords:** verify, test, typecheck, lint, check, validate, ci

---

### ask_human

Ask the user a clarifying question

**Parameters:**
- `question` (string, required) - The question to ask the user
- `options` (array) - Optional predefined choices for the user (legacy, prefer choices)
- `choices` (array) - Structured choices with labels, values, and optional descriptions. Max 6 choices.
- `multiSelect` (boolean) - If true, user can select multiple choices. Default: false
- `default` (string) - Default answer if user provides no input

**Keywords:** ask, human, clarify, question, input, pause, confirm

---

### diagram

Generate diagrams

**Parameters:**
- `operation` (string, required) - Type of diagram to generate   Values: `mermaid`, `flowchart`, `sequence`, `class`, `pie`, `gantt`, `ascii_box`, `ascii_tree`, `list`
- `code` (string) - Mermaid code for mermaid operation
- `title` (string) - Title for the diagram
- `nodes` (array) - Nodes for flowchart or ASCII tree
- `connections` (array) - Connections between nodes
- `participants` (array) - Participants for sequence diagram
- `messages` (array) - Messages for sequence diagram
- `classes` (array) - Classes for class diagram
- `relationships` (array) - Relationships for class diagram
- `data` (array) - Data points for pie chart
- `sections` (array) - Sections for Gantt chart
- `format` (string) - Output format (default: ascii)   Values: `svg`, `png`, `ascii`, `utf8`

**Keywords:** diagram, flowchart, chart, mermaid, sequence, class, uml, graph, visualize

---

### knowledge_search

Search the agent knowledge base

**Parameters:**
- `query` (string, required) - Keywords or phrase to search for in knowledge bases
- `limit` (number) - Maximum results to return (default: 5)
- `scope` (string) - Filter by agent mode scope (e.g. "code", "review")

**Keywords:** knowledge, search, convention, docs, domain, procedure

---

### lessons_add

Capture a lesson learned

**Parameters:**
- `category` (string, required) - Lesson category   Values: `PATTERN`, `RULE`, `CONTEXT`, `INSIGHT`
- `content` (string, required) - The lesson content
- `context` (string) - Additional context or file path where this applies
- `source` (string) - How the lesson was discovered (default: manual)   Values: `user_correction`, `self_observed`, `manual`

**Keywords:** lesson, learn, correction, pattern, rule, mistake

---

### lessons_search

Search lessons learned

**Parameters:**
- `query` (string, required) - Search terms to match against lessons
- `category` (string) - Filter by lesson category   Values: `PATTERN`, `RULE`, `CONTEXT`, `INSIGHT`
- `limit` (number) - Maximum results (default: 10)

**Keywords:** lesson, search, pattern, rule, past, history, mistake

---

### recall

Retrieve persistent memory by key

**Parameters:**
- `key` (string, required) - Memory key to retrieve
- `scope` (string) - Optional scope filter   Values: `project`, `user`

**Keywords:** memory, recall, retrieve, lookup, context

---

### remember

Store persistent memory entries

**Parameters:**
- `key` (string, required) - Short unique key for this memory
- `value` (string, required) - The information to be remembered
- `scope` (string) - Scope for this memory (default: project)   Values: `project`, `user`
- `category` (string) - Type of information being stored   Values: `project`, `preferences`, `decisions`, `patterns`, `custom`

**Keywords:** memory, remember, persist, context, store, preference

---

### run_script

Execute scripts in a secure sandboxed Docker environment

**Parameters:**
- `script` (string, required) - The script source code to execute
- `language` (string) - Script language (default: python)   Values: `python`, `typescript`, `javascript`, `shell`
- `dependencies` (array) - Package dependencies to install before running (e.g., ['numpy', 'pandas'])
- `env` (object) - Environment variables to set for the script

**Keywords:** script, python, typescript, javascript, shell, execute, run, sandbox, docker, compute, data

---

### a2ui

Build dynamic UI surfaces and components with the A2UI protocol

**Parameters:**
- `action` (string, required) - The action to perform   Values: `create_surface`, `delete_surface`, `add_component`, `add_components`, `update_data`, `begin_rendering`, `render_terminal`, `render_html`, `get_surface`, `list_surfaces`, `start_server`, `stop_server`, `server_status`, `get_data`, `get_component_state`, `canvas_snapshot`
- `surfaceId` (string) - Unique identifier for the surface
- `component` (object) - Single component to add (for add_component action)
- `components` (array) - Array of components to add (for add_components action)
- `data` (object) - Data to set in the data model
- `dataPath` (string) - Dot-notation path for nested data updates (e.g., "user.profile")
- `root` (string) - ID of root component to render
- `styles` (object) - Global surface styles
- `port` (number) - Server port (default: 18790)
- `host` (string) - Server host (default: 127.0.0.1)
- `componentId` (string) - Component ID (for get_component_state action)

**Keywords:** a2ui, surface, component, ui, interface, canvas, render

---

### canvas

Create and manipulate visual workspaces with positioned elements

**Parameters:**
- `action` (string, required) - The action to perform   Values: `create`, `delete`, `list`, `add_element`, `update_element`, `delete_element`, `move`, `resize`, `select`, `deselect`, `clear_selection`, `bring_to_front`, `send_to_back`, `undo`, `redo`, `render`, `export`, `import`
- `canvasId` (string) - Canvas identifier
- `elementId` (string) - Element identifier
- `element` (object) - Element definition
- `position` (object)
- `size` (object)
- `format` (string) - Output format for render/export   Values: `terminal`, `html`, `json`, `svg`
- `config` (object) - Canvas configuration
- `json` (string) - Serialized canvas JSON to import (for import action)
- `data` (string) - Alias of json for import action

**Keywords:** canvas, visual, workspace, diagram, layout, element, render, export, import

---

### device_manage

Manage paired devices (SSH/ADB/local)

**Parameters:**
- `action` (string, required) - Device action to perform   Values: `list`, `pair`, `remove`, `snap`, `screenshot`, `record`, `location`, `run`
- `deviceId` (string) - Device identifier
- `name` (string) - Display name for pairing
- `transport` (string) - Transport type   Values: `ssh`, `adb`, `local`
- `address` (string) - Connection address (host/IP)
- `port` (number) - Connection port
- `username` (string) - SSH username
- `keyPath` (string) - Path to SSH key
- `command` (string) - Command to run (for run action)
- `duration` (number) - Recording duration in seconds (for record action)

**Keywords:** device, ssh, adb, android, remote, screenshot, camera, pair

---

### export

Export data to various formats

**Parameters:**
- `operation` (string, required) - Export operation   Values: `conversation`, `csv`, `code_snippets`, `list`
- `format` (string) - Export format for conversation   Values: `json`, `markdown`, `html`, `txt`, `pdf`
- `messages` (array) - Messages to export
- `data` (array) - Data array for CSV export
- `title` (string) - Title for the export
- `include_metadata` (boolean) - Include metadata in export
- `include_timestamps` (boolean) - Include timestamps in export
- `theme` (string) - Theme for HTML export   Values: `light`, `dark`
- `output_path` (string) - Output file path

**Keywords:** export, save, convert, format, json, markdown, html

---

### forget

Delete a persistent memory entry

**Parameters:**
- `key` (string, required) - Memory key to remove
- `scope` (string) - Scope to remove from (default: project)   Values: `project`, `user`

**Keywords:** memory, forget, remove, delete, cleanup

---

### knowledge_add

Add a new knowledge entry

**Parameters:**
- `title` (string, required) - Title for this knowledge entry (becomes the filename)
- `content` (string, required) - Markdown content of the knowledge entry
- `tags` (array) - Tags for discovery
- `scope` (array) - Agent modes this applies to (e.g. ["code", "review"])

**Keywords:** knowledge, add, save, persist, remember, convention

---

### lessons_list

List all lessons learned

**Parameters:**
- `category` (string) - Filter by lesson category   Values: `PATTERN`, `RULE`, `CONTEXT`, `INSIGHT`
- `limit` (number) - Maximum results (default: 20)

**Keywords:** lesson, list, all, show, history

---

### qr

QR code operations

**Parameters:**
- `operation` (string, required) - QR code operation   Values: `generate`, `generate_url`, `generate_wifi`, `generate_vcard`, `decode`, `list`
- `data` (string) - Data to encode in QR code
- `url` (string) - URL for generate_url
- `ssid` (string) - WiFi SSID for generate_wifi
- `password` (string) - WiFi password for generate_wifi
- `wifi_type` (string) - WiFi security type   Values: `WPA`, `WEP`, `nopass`
- `contact` (object) - Contact info for vCard (firstName, lastName, phone, email, etc.)
- `path` (string) - Path to QR code image for decode
- `format` (string) - Output format (default: utf8)   Values: `ascii`, `utf8`, `svg`, `png`

**Keywords:** qr, code, barcode, scan, generate

---

### create_skill

Create a new SKILL.md workflow

**Parameters:**
- `name` (string, required) - Skill name (becomes the filename)
- `description` (string, required) - Short description of what the skill does
- `body` (string, required) - Markdown body of the skill (instructions, steps, etc.)
- `tags` (array) - Tags for discovery
- `requires` (array) - Required tools or capabilities
- `overwrite` (boolean) - Overwrite if skill already exists (default: false)

**Keywords:** skill, create, workflow, reusable, procedure, automate

---

### skill_discover

Search Skills Hub for capabilities

**Parameters:**
- `query` (string, required) - Search query to find relevant skills
- `tags` (array) - Tags to filter by
- `auto_install` (boolean) - Automatically install the top matching skill (default: false)
- `limit` (number) - Maximum results to return (default: 5)

**Keywords:** skill, discover, search, hub, install, capability, plugin

---

## security

### scan_secrets

Scan source files for hardcoded secrets, credentials, and API keys

**Parameters:**
- `path` (string, required) - File or directory path to scan for secrets
- `recursive` (boolean) - Whether to scan directories recursively (default: true)
- `exclude` (array) - Directory names to exclude from scanning

**Keywords:** secrets, credentials, api key, token, password, leak, scan, security, hardcoded, detect, aws, github, stripe, jwt

---

_Total tools: 66_
<!-- hash:c452dc7a661a3154 -->
