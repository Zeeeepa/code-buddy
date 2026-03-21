# Code Buddy — Guide d'Utilisation Quotidienne

> Comment utiliser Code Buddy au jour le jour pour coder plus vite.

---

## 1. Démarrage Rapide (2 minutes)

```bash
# Configuration unique
export GROK_API_KEY=xai-...        # ou OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY

# Lancer
buddy

# Ou avec un modèle spécifique
buddy --model claude-sonnet-4
buddy --model gemini-2.5-flash
buddy --model grok-4-latest
```

**Raccourcis utiles :**
```bash
buddy -p "ta question"             # Mode non-interactif (sort après réponse)
buddy --continue                   # Reprendre la dernière session
buddy --resume abc123              # Reprendre une session par ID
buddy --yolo                       # Mode autonome complet
```

---

## 2. Cas d'Usage Quotidiens

### Comprendre du code

```
> Explique-moi comment fonctionne le système d'authentification
> Quel est le flux de données entre le frontend et l'API ?
> Montre-moi tous les endroits où UserService est utilisé
> Génère un diagramme Mermaid de l'architecture
```

L'agent lit automatiquement les fichiers pertinents, suit les imports, et construit une vue d'ensemble.

### Écrire du nouveau code

```
> Ajoute un endpoint POST /api/users avec validation Zod
> Crée un composant React pour afficher la liste des produits avec pagination
> Écris un script Python qui parse les logs et génère un rapport CSV
> Ajoute des tests unitaires pour le module de paiement
```

L'agent :
1. Lit le code existant pour comprendre les patterns
2. Génère le code en suivant les conventions du projet
3. Crée les fichiers nécessaires
4. Lance les tests pour vérifier

### Corriger des bugs

```
> Le test UserService.test.ts échoue, corrige-le
> Il y a une erreur TypeScript dans src/api/routes.ts, fixe-la
> L'appli crash quand on envoie un formulaire vide, debug et corrige
> npm test échoue, lance les tests, analyse les erreurs et corrige
```

L'agent utilise le cycle **repair** automatique : lire l'erreur → localiser le bug → corriger → re-tester → itérer.

### Refactorer

```
> Refactore UserController pour séparer la logique métier dans un service
> Convertis ces callbacks en async/await
> Renomme la fonction processData en transformUserData partout
> Migre ce fichier de CommonJS vers ESM
```

**Commandes spéciales :**
```
/transform typescript src/utils.js      # Convertir JS → TS
/transform async src/legacy-api.ts      # Callbacks → async/await
/transform es-modules src/config.js     # CommonJS → ESM
/transform modernize src/old-code.ts    # Mise à jour syntaxe
```

### Git workflow complet

```
> Commite les changements avec un bon message
> Crée une PR pour la feature d'authentification
> Montre les conflits de merge et résous-les intelligemment
> Fais un blame sur le fichier config.ts pour voir qui a changé quoi
```

**Commandes :**
```
/pr                          # Créer une PR (détecte gh/glab)
/pr --draft                  # PR en mode brouillon
/conflicts scan              # Lister les conflits
/conflicts resolve --ai      # Résoudre avec l'IA
```

---

## 3. Workflows Avancés

### Mode Autonome (YOLO)

Pour les tâches répétitives où tu fais confiance à l'agent :

```bash
buddy --yolo
```

Ou en session interactive :
```
/yolo on                     # Activer (confirmation requise)
/yolo safe                   # Mode sûr (src/, test/ seulement)
/yolo status                 # Voir les guardrails actifs
/yolo pause                  # Pause temporaire
/yolo resume                 # Reprendre
/yolo off                    # Désactiver
/yolo undo-all               # Annuler tout ce que YOLO a fait
```

**Guardrails automatiques :**
- Limite de coût : $100 (configurable)
- Maximum 50 éditions / 100 commandes par session
- `rm -rf`, `DROP DATABASE`, `git push --force` toujours bloqués
- Ghost snapshots pour undo à chaque étape

### Pipeline Dev (Golden Path)

```
/dev plan                    # Créer un plan de développement
/dev run                     # Exécuter le plan
/dev pr                      # Créer la PR
/dev fix-ci                  # Analyser et corriger les échecs CI
/dev status                  # Voir l'état du workflow
```

### Recherche Large

```bash
# Lancer une recherche parallèle sur un sujet
buddy research "state of WebAssembly in 2026" --workers 5 --output report.md
```

### Raisonnement Profond

```
/think deep Comment architecturer un système de cache distribué pour cette API ?
/think exhaustive Quelle est la meilleure approche pour migrer de REST à GraphQL ?
```

Modes : `shallow` (rapide), `medium` (BFS), `deep` (MCTS), `exhaustive` (MCTS + progressive deepening)

---

## 4. Qualité & Sécurité

### Analyser le code

```
/bug src/                    # Scanner les bugs potentiels
/lint                        # Lancer le linter (auto-détecte eslint/ruff/clippy/etc.)
/lint fix                    # Linter + auto-fix
/coverage check              # Vérifier la couverture par rapport aux cibles
```

### Sécurité

```
/secrets-scan                # Trouver les secrets hardcodés dans le code
/vulns                       # Scanner les CVE dans les dépendances
> Scanne les licences du projet pour vérifier la conformité
```

### Review de code

```
/review                      # Review du code modifié (staged + unstaged)
> Review le fichier src/api/auth.ts
> Fais un audit sécurité du module de paiement
```

---

## 5. Navigation Contextuelle

### Mentions inline

Ajoute du contexte directement dans ton message :

```
@web latest React 19 features       # Résultats de recherche web injectés
@git log --since="2 days ago"        # Historique git récent comme contexte
@git diff main                       # Diff avec main comme contexte
@terminal                            # Dernières sorties bash comme contexte
```

### Fichiers de contexte

```
/add src/config.ts                   # Ajouter un fichier au contexte
/context list                        # Voir les fichiers chargés
/compact                             # Compresser le contexte si trop long
```

### Mémoire persistante

```
/memory                             # Voir la mémoire sauvegardée
/remember "Le projet utilise PostgreSQL avec Prisma ORM"
> Rappelle-toi que le déploiement se fait sur Railway
```

---

## 6. Modèles & Coûts

### Changer de modèle

```
/switch grok-4-latest               # Changer pendant la conversation
/switch claude-sonnet-4              # Passer à Claude
/switch auto                         # Revenir au routage automatique
```

### Suivre les coûts

```
/cost                                # Résumé de la session
/quota                               # Quota API restant par provider
```

### Paires de modèles (Architecte / Éditeur)

Dans `.codebuddy/config.toml` :
```toml
[model_pairs]
architect = "claude-opus"          # Pour la planification
editor = "grok-code-fast"          # Pour l'exécution
```

---

## 7. CI/CD & Automatisation

### Mode Headless (CI)

```bash
# Dans un pipeline GitHub Actions / GitLab CI
buddy -p "run tests and fix failures" \
  --dangerously-skip-permissions \
  --output-format json \
  --max-tool-rounds 30

# Pipe d'entrée/sortie
echo "fix the lint errors" | buddy -p - --auto-approve
cat src/module.ts | buddy -p "review this code" --output-format text
```

### File Watcher

```
/watch start                         # Surveiller les changements de fichiers
/watch stop                          # Arrêter la surveillance
/watch status                        # Voir les fichiers surveillés
```

Quand un fichier change, l'agent peut automatiquement linter, tester, ou notifier.

### Daemon 24/7

```bash
buddy daemon start                   # Lancer en arrière-plan
buddy daemon status                  # Vérifier le statut
buddy daemon stop                    # Arrêter
```

---

## 8. Extensions & Personnalisation

### Skills

```
/starter                            # Parcourir les 40 skills bundled
/skill list                         # Lister les skills installées
> Crée une skill pour automatiser le déploiement sur Railway
```

### Configuration TOML

Fichier `.codebuddy/config.toml` :
```toml
active_model = "grok-4-latest"

[middleware]
max_turns = 100
max_cost = 20.0

[agent]
auto_commit = true                   # Commit auto après chaque édition
yolo_mode = false

[agent_defaults.agents.swe]
temperature = 0.2
maxTokens = 8192

[ui]
theme = "dark"
show_tokens = true
show_cost = true
```

### Profils

```toml
[profiles.cheap]
active_model = "grok-code-fast"
[profiles.cheap.middleware]
max_cost = 2.0

[profiles.deep]
active_model = "claude-opus"
[profiles.deep.middleware]
max_cost = 50.0
```

```bash
buddy --profile cheap               # Utiliser le profil économique
buddy --profile deep                 # Utiliser le profil approfondi
```

---

## 9. Raccourcis Essentiels

| Commande | Action |
|----------|--------|
| `Ctrl+C` | Arrêter proprement (sauvegarde session) |
| `Ctrl+R` | Recherche dans l'historique |
| `↑` / `↓` | Navigation dans l'historique |
| `/undo` | Annuler la dernière action |
| `/redo` | Refaire l'action annulée |
| `/copy` | Copier la dernière réponse |
| `/copy code` | Copier le dernier bloc de code |
| `/clear` | Effacer le chat |
| `/help` | Aide complète |
| `/status` | Config rapide |
| `/sessions list` | Historique des sessions |
| `/sessions cleanup` | Nettoyer les vieilles sessions |

---

## 10. Astuces pour le Quotidien

**Sois spécifique dans tes demandes :**
```
❌ "Fixe le bug"
✅ "Le test auth.test.ts ligne 42 échoue avec 'TypeError: undefined is not a function'. Corrige-le."
```

**Utilise le contexte :**
```
❌ "Ajoute de la validation"
✅ "Ajoute de la validation Zod au endpoint POST /api/users dans src/routes/users.ts, en suivant le pattern de src/routes/products.ts"
```

**Itère par petites étapes :**
```
1. "Crée le schéma Prisma pour User"
2. "Génère les routes CRUD"
3. "Ajoute l'authentification JWT"
4. "Écris les tests"
5. "Lance les tests et corrige les erreurs"
```

**Utilise les plans pour les grosses tâches :**
```
> Planifie la migration de l'app Express vers Fastify
[L'agent crée un PLAN.md avec les étapes]
/dev run
[L'agent exécute le plan étape par étape]
```

**Profite du mode YOLO pour les tâches mécaniques :**
```
/yolo safe
> Ajoute des tests pour tous les fichiers dans src/utils/ qui n'en ont pas
[L'agent crée 15 fichiers de tests sans demander de confirmation]
/yolo off
```
