# Code Buddy — Catalogue Complet des Outils

> **77 outils** organisés en 14 catégories. Sélectionnés automatiquement par RAG (seuls les outils pertinents sont envoyés au LLM à chaque appel).

---

## Fichiers — Lecture

| Outil | Description | Paramètres clés |
|-------|-------------|-----------------|
| `view_file` | Lire le contenu d'un fichier (avec plage de lignes optionnelle) | `path`, `start_line`, `end_line` |
| `list_directory` | Lister les fichiers d'un répertoire (respecte `.gitignore`) | `path`, `respectGitignore` |

## Fichiers — Écriture & Édition

| Outil | Description | Paramètres clés |
|-------|-------------|-----------------|
| `create_file` | Créer un nouveau fichier | `path`, `content` |
| `str_replace_editor` | Remplacer du texte dans un fichier (matching multi-stratégie : exact → flexible → regex → fuzzy) | `path`, `old_str`, `new_str` |
| `edit_file` | Édition rapide via Morph API (si `MORPH_API_KEY` configuré) | `target_file`, `instructions` |
| `multi_edit` | Appliquer plusieurs remplacements atomiques dans un fichier | `file_path`, `edits[]` |
| `apply_patch` | Appliquer un patch Codex-style (`*** Begin Patch`) avec seek 4 passes | `patch` |
| `codebase_replace` | Chercher & remplacer dans tout le codebase (regex/littéral, dry-run) | `search_pattern`, `replacement`, `glob`, `dry_run` |
| `organize_imports` | Organiser, ajouter les imports manquants, supprimer les morts (TS/JS/Python) | `file_path`, `action` |

## Recherche

| Outil | Description | Paramètres clés |
|-------|-------------|-----------------|
| `search` | Recherche unifiée texte/fichier avec regex/glob | `query`, `search_type`, `include_pattern` |
| `find_symbols` | Trouver des symboles (fonctions, classes, interfaces) par nom | `name`, `types[]`, `exported_only` |
| `find_references` | Trouver toutes les références d'un symbole | `symbol_name`, `context_lines` |
| `find_definition` | Trouver la définition d'un symbole | `symbol_name` |
| `search_multi` | Recherches multiples avec logique OR/AND | `patterns[]`, `operator` |
| `tool_search` | Recherche BM25 sur les métadonnées d'outils (découverte MCP) | `query` |

## Système & Exécution

| Outil | Description | Paramètres clés |
|-------|-------------|-----------------|
| `bash` | Exécuter des commandes shell (streaming temps réel) | `command`, `timeout` |
| `run_script` | Exécuter Python/TS/Shell dans un sandbox Docker | `script`, `language`, `dependencies[]` |
| `js_repl` | Exécuter du JavaScript dans un runtime isolé (vm.createContext) | `code`, `timeout` |
| `process` | Gérer les processus : spawn, list, kill | `operation`, `command`, `pid` |

## Web

| Outil | Description | Paramètres clés |
|-------|-------------|-----------------|
| `web_search` | Recherche web (Brave → Perplexity → Serper → DuckDuckGo) | `query`, `max_results` |
| `web_fetch` | Récupérer le contenu d'une URL (protection SSRF) | `url` |
| `firecrawl_search` | Recherche via Firecrawl API (résultats plus propres) | `query`, `limit` |
| `firecrawl_scrape` | Scraper une page en markdown propre (JS rendering) | `url`, `formats[]` |

## Browser & Desktop

| Outil | Description | Paramètres clés |
|-------|-------------|-----------------|
| `browser` | Automatisation navigateur CDP : naviguer, cliquer, remplir, screenshot, batch | `action`, `url`, `selector`, `value` |
| `computer_control` | Contrôle desktop : souris, clavier, fenêtres, système | `action`, `ref`, `text`, `key` |

## Git

| Outil | Description | Paramètres clés |
|-------|-------------|-----------------|
| `git` | Opérations git : status, diff, commit, push, pull, branch, blame, bisect, cherry-pick | `operation`, `args` |
| `resolve_conflicts` | Détecter et résoudre les conflits de merge (ours/theirs/both/ai) | `file_path`, `strategy` |

## Docker & Kubernetes

| Outil | Description | Paramètres clés |
|-------|-------------|-----------------|
| `docker` | Gérer conteneurs/images : list, run, stop, build, logs, exec, compose | `operation`, `args` |
| `kubernetes` | Gérer clusters K8s : get, apply, delete, logs, exec, scale, rollout | `operation`, `args` |

## Documents & Médias

| Outil | Description | Paramètres clés |
|-------|-------------|-----------------|
| `pdf` | Extraire le contenu de fichiers PDF | `operation`, `path`, `pages` |
| `document` | Lire des documents Office (Word, Excel, PowerPoint) | `operation`, `path` |
| `archive` | Extraire/lister/ajouter dans des archives (ZIP, TAR, 7z, RAR) | `operation`, `path` |
| `notebook` | Jupyter : lire, éditer, **exécuter** des cellules, gérer le kernel | `action`, `path`, `cell_index` |
| `screenshot` | Capturer l'écran ou une fenêtre spécifique | `window_name`, `region` |
| `audio` | Transcrire et traiter des fichiers audio | `operation`, `path`, `language` |
| `video` | Traiter des vidéos : frames, thumbnails, extraction audio | `operation`, `path`, `timestamp` |
| `ocr` | Extraire du texte d'images (Tesseract.js) | `path`, `language` |
| `clipboard` | Opérations presse-papier (copier/coller, cross-platform) | `operation`, `content` |
| `diagram` | Générer des diagrammes (Mermaid, PlantUML, etc.) | `type`, `content` |
| `qr` | Générer/scanner des QR codes | `operation`, `content` |
| `export` | Exporter en JSON, CSV, Markdown, HTML | `data`, `format`, `path` |

## Sécurité

| Outil | Description | Paramètres clés |
|-------|-------------|-----------------|
| `scan_secrets` | Scanner le code pour les secrets hardcodés (14 patterns : AWS, GitHub, Stripe, JWT, etc.) | `path`, `recursive` |
| `scan_vulnerabilities` | Scanner les dépendances pour les CVE (npm/pip/cargo/go) | `path`, `package_manager` |
| `scan_licenses` | Vérifier la conformité des licences (SPDX, copyleft/permissive) | `project_root` |
| `find_bugs` | Analyse statique regex (25+ patterns, 6 langages, 8 catégories) | `path`, `severity` |

## Code Intelligence (LSP)

| Outil | Description | Paramètres clés |
|-------|-------------|-----------------|
| `lsp_rename` | Renommer un symbole cross-fichiers via LSP | `file_path`, `line`, `character`, `new_name` |
| `lsp_code_action` | Obtenir les actions de code (quick fix, refactoring) via LSP | `file_path`, `start_line`, `end_line` |
| `generate_openapi` | Générer une spec OpenAPI 3.0.3 depuis le code (8 frameworks détectés) | `project_root`, `framework` |
| `analyze_logs` | Analyser des fichiers de logs (5 parsers, détection d'anomalies) | `file_path`, `level_filter`, `tail` |

## Raisonnement & Planification

| Outil | Description | Paramètres clés |
|-------|-------------|-----------------|
| `reason` | Résoudre des problèmes complexes via Tree-of-Thought + MCTS | `problem`, `depth` |
| `plan` | Gérer un plan d'exécution persistant (PLAN.md) | `action`, `steps[]`, `goal` |
| `create_todo_list` | Créer une liste de tâches | `todos[]` |
| `get_todo_list` | Voir la liste de tâches | `filter` |
| `update_todo_list` | Mettre à jour les tâches | `updates[]` |
| `task_verify` | Exécuter le contrat de vérification (tsc + tests + lint) | `checks[]` |

## Agents & Orchestration

| Outil | Description | Paramètres clés |
|-------|-------------|-----------------|
| `spawn_subagent` | Créer un sous-agent spécialisé | `type`, `task`, `context` |
| `spawn_parallel_agents` | Exécuter des tâches en parallèle avec des agents | `tasks[]`, `max_parallel` |
| `ask_human` | Poser une question à l'utilisateur (timeout 120s) | `question`, `options[]` |
| `terminate` | Signaler la fin de la tâche et arrêter la boucle | — |

## Mémoire & Connaissances

| Outil | Description | Paramètres clés |
|-------|-------------|-----------------|
| `knowledge_search` | Chercher dans la base de connaissances | `query`, `limit` |
| `knowledge_add` | Ajouter une entrée de connaissance | `title`, `content`, `tags[]` |
| `remember` | Stocker un souvenir persistant | `key`, `value`, `category` |
| `recall` | Récupérer un souvenir | `key` |
| `forget` | Supprimer un souvenir | `key` |
| `lessons_add` | Capturer une leçon apprise | `lesson`, `category` |
| `lessons_search` | Chercher dans les leçons | `query` |
| `lessons_list` | Lister toutes les leçons | `filter` |
| `restore_context` | Restaurer du contexte compressé | `identifier` |

## Skills & Extensions

| Outil | Description | Paramètres clés |
|-------|-------------|-----------------|
| `create_skill` | Créer un nouveau SKILL.md à la volée | `name`, `description`, `instructions` |
| `skill_discover` | Chercher des skills dans le Hub | `query`, `category` |
| `docs_search` | Chercher dans la documentation du projet | `query`, `scope` |

## Déploiement & Devices

| Outil | Description | Paramètres clés |
|-------|-------------|-----------------|
| `deploy` | Déployer sur Fly.io, Railway, Render, GCP, Hetzner | `platform`, `app_name` |
| `device_manage` | Gérer les appareils (SSH, ADB, local) | `operation`, `device_id` |

## Canvas & UI

| Outil | Description | Paramètres clés |
|-------|-------------|-----------------|
| `a2ui` | Créer des interfaces visuelles dynamiques (A2UI protocol) | `action`, `components[]` |
| `canvas` | Créer des espaces de travail visuels avec éléments positionnés | `action`, `elements[]` |
