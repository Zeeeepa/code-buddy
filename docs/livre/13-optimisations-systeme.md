# Chapitre 13 — Optimisations Système ⚡

---

## 🎬 Scène d'ouverture

*Trois mois après le lancement de Grok-CLI en production. Bureau de Lina, 8h du matin.*

**Lina** : *(fixant son tableau de bord avec inquiétude)* « Karim, viens voir ces chiffres. »

**Karim** : *(le responsable infrastructure s'approche)* « Qu'est-ce qui se passe ? »

**Lina** : « 15 000 euros ce mois-ci. C'est trois fois plus que le mois dernier. Et regarde les temps de réponse — certains développeurs attendent 10 secondes pour des réponses simples. »

**Karim** : *(examinant les logs)* « Je vois le problème. Chaque interaction, même triviale, utilise le modèle le plus puissant. Les outils s'exécutent séquentiellement. Et le démarrage prend 3 secondes à cause de tous les modules chargés. »

**Lina** : « On a construit quelque chose de puissant, mais pas quelque chose d'efficace. »

**Karim** : « Il est temps d'optimiser au niveau système. Model routing, parallélisation, lazy loading... »

**Lina** : *(ouvrant une nouvelle branche Git)* « `feature/system-optimizations`. C'est parti. »

---

## 📋 Table des Matières

| Section | Titre | Description |
|:-------:|-------|-------------|
| 13.1 | 📊 Le Problème de l'Échelle | Triangle du gaspillage LLM |
| 13.2 | 🎯 Model Routing | FrugalGPT : choisir le bon modèle |
| 13.3 | ⚡ Exécution Parallèle | LLMCompiler : parallélisation des outils |
| 13.4 | 🚀 Lazy Loading | Optimisation du démarrage |
| 13.5 | ⏱️ Optimisation Latence | Maintenir le flow state |
| 13.6 | 📈 Métriques et Monitoring | Dashboard de performance |

---

## 13.1 📊 Le Problème de l'Échelle

Quand un agent LLM passe du prototype à la production, trois formes de gaspillage émergent simultanément. C'est le **Triangle du Gaspillage LLM**.

### 13.1.1 🔺 Le Triangle du Gaspillage

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      🔺 TRIANGLE DU GASPILLAGE LLM                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                              💰 COÛT ($)                                    │
│                                  /\                                         │
│                                 /  \                                        │
│                                /    \                                       │
│                               / 🤖   \                                      │
│                              / Modèle \                                     │
│                             /   trop   \                                    │
│                            /  puissant  \                                   │
│                           /______________\                                  │
│                          /                \                                 │
│                         /                  \                                │
│                        /____________________\                               │
│                    ⏱️ LATENCE           💾 RESSOURCES                       │
│                    (secondes)           (CPU/RAM)                           │
│                                                                             │
│   ⏱️ Latence:                    💾 Ressources:                             │
│   ├── Exécution séquentielle     ├── Chargement complet                     │
│   ├── Pas de cache               ├── Modules inutilisés                     │
│   └── Attente réseau             └── Connexions non poolées                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 13.1.2 📊 Profil d'une Session Non-Optimisée

Analysons une session typique de 30 minutes :

```typescript
// Analyse d'une session de 30 minutes (avant optimisation)
interface SessionProfile {
  totalRequests: 45;              // 45 requêtes
  tokensUsed: 2_300_000;          // 2.3M tokens
  averageLatency: 4200;           // 4.2 secondes

  costBreakdown: {
    powerful: '89%';              // 89% du coût sur GPT-4
    fast: '11%';                  // 11% sur GPT-4o-mini
  };

  toolExecutions: {
    total: 156;                   // 156 exécutions
    sequential: 142;              // 142 séquentielles (91%)
    parallel: 14;                 // 14 parallèles (9%)
  };

  wastedTime: {
    sequentialTools: 45_000;      // +45s (outils en série)
    redundantCalls: 23_000;       // +23s (appels redondants)
    coldStarts: 12_000;           // +12s (démarrages)
  };
}

// 💸 80 secondes gaspillées sur 30 minutes
// 💰 Coût 3x plus élevé que nécessaire
```

### 13.1.3 🎯 Objectifs d'Optimisation

| Métrique | Icône | Avant | Objectif | Amélioration |
|----------|:-----:|------:|:--------:|:------------:|
| Coût par session | 💰 | $2.50 | $0.75 | **-70%** |
| Latence moyenne | ⏱️ | 4.2s | 1.5s | **-64%** |
| Temps de démarrage | 🚀 | 3.0s | <100ms | **-97%** |
| Requêtes API | 📡 | 100% | 32% | **-68%** |

---

## 13.2 🎯 Model Routing : L'Art de Choisir le Bon Modèle

### 13.2.1 💡 L'Intuition FrugalGPT

La recherche de Stanford sur **FrugalGPT** (2023) révèle une vérité contre-intuitive : les modèles les plus puissants ne sont pas toujours les meilleurs choix.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        💡 PRINCIPE FRUGALGPT                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Coût par requête                                                           │
│       │                                                                     │
│  $0.10│                                    ┌─────────┐                      │
│       │                                    │ 🦸 Pro  │ ← Overkill pour     │
│       │                                    │ (10%)   │   70% des tâches    │
│  $0.05│                      ┌─────────┐   └─────────┘                      │
│       │                      │ ⚖️ Std  │                                    │
│       │        ┌─────────┐   │ (30%)   │                                    │
│  $0.01│        │ 🚀 Mini │   └─────────┘                                    │
│       │        │ (60%)   │                                                  │
│  $0.00└────────┴─────────┴────────────────────────────────────────►         │
│           Simple       Moyen        Complexe       Expert                   │
│                                                                             │
│  📊 Distribution optimale :                                                 │
│  ├── 🚀 60% des tâches → Mini  (économie 95%)                               │
│  ├── ⚖️ 30% des tâches → Std   (économie 50%)                               │
│  └── 🦸 10% des tâches → Pro   (qualité max)                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 13.2.2 🏗️ Architecture du Model Router

```typescript
// src/optimization/model-routing.ts

/**
 * 🎚️ Tiers de modèles disponibles
 */
export enum ModelTier {
  FAST = 'fast',          // 🚀 grok-3-mini, gpt-4o-mini
  BALANCED = 'balanced',  // ⚖️ grok-3, gpt-4o
  POWERFUL = 'powerful'   // 🦸 grok-3-pro, gpt-4-turbo
}

/**
 * ⚙️ Configuration des modèles par tier
 */
interface ModelConfig {
  model: string;
  costPer1kTokens: number;
  maxTokens: number;
  latencyMs: number;
  capabilities: Set<string>;
}

const MODEL_CONFIGS: Record<ModelTier, ModelConfig> = {
  [ModelTier.FAST]: {
    model: 'grok-3-mini',
    costPer1kTokens: 0.0001,
    maxTokens: 8192,
    latencyMs: 200,
    capabilities: new Set([
      'simple_qa',
      'formatting',
      'summarization',
      'translation'
    ])
  },
  [ModelTier.BALANCED]: {
    model: 'grok-3',
    costPer1kTokens: 0.002,
    maxTokens: 32768,
    latencyMs: 500,
    capabilities: new Set([
      'code_generation',
      'analysis',
      'planning',
      'multi_step_reasoning'
    ])
  },
  [ModelTier.POWERFUL]: {
    model: 'grok-3-pro',
    costPer1kTokens: 0.01,
    maxTokens: 128000,
    latencyMs: 1500,
    capabilities: new Set([
      'complex_architecture',
      'security_analysis',
      'mathematical_proof',
      'novel_algorithms'
    ])
  }
};

/**
 * 🎯 Model Router intelligent basé sur FrugalGPT
 *
 * Stratégie :
 * 1. Classifier la tâche (simple/moyenne/complexe)
 * 2. Sélectionner le tier minimal suffisant
 * 3. Cascader vers un tier supérieur si nécessaire
 */
export class ModelRouter {
  private taskHistory: Map<string, TaskPerformance> = new Map();
  private cascadeEnabled: boolean;

  constructor(options: RouterOptions = {}) {
    this.cascadeEnabled = options.enableCascade ?? true;
  }

  /**
   * 🎯 Sélectionne le tier optimal pour une tâche
   */
  async selectTier(task: TaskDescription): Promise<RoutingDecision> {
    // 1️⃣ Classification de la tâche
    const classification = await this.classifyTask(task);

    // 2️⃣ Vérification de l'historique (apprentissage)
    const historicalTier = this.checkHistory(task);
    if (historicalTier) {
      return {
        tier: historicalTier,
        reason: 'historical_success',
        confidence: 0.9
      };
    }

    // 3️⃣ Sélection basée sur la classification
    const selectedTier = this.selectBasedOnClassification(classification);

    // 4️⃣ Ajustement contextuel
    const adjustedTier = this.adjustForContext(selectedTier, task);

    return {
      tier: adjustedTier,
      reason: classification.primaryCategory,
      confidence: classification.confidence,
      estimatedCost: this.estimateCost(adjustedTier, task),
      estimatedLatency: MODEL_CONFIGS[adjustedTier].latencyMs
    };
  }

  /**
   * 🔍 Classification de la complexité de la tâche
   */
  private classifyTask(task: TaskDescription): TaskClassification {
    const features = this.extractFeatures(task);
    const complexityScore = this.calculateComplexityScore(features);
    const category = this.determineCategory(features);

    return {
      complexityScore,
      primaryCategory: category,
      confidence: this.calculateConfidence(features),
      features
    };
  }

  /**
   * 📊 Extraction des caractéristiques de la tâche
   */
  private extractFeatures(task: TaskDescription): TaskFeatures {
    const content = task.prompt.toLowerCase();

    return {
      // 📏 Longueur et structure
      promptLength: task.prompt.length,
      hasCodeBlocks: /```[\s\S]*```/.test(task.prompt),
      hasMultipleQuestions: (content.match(/\?/g) || []).length > 1,

      // 🔴 Indicateurs de complexité
      mentionsArchitecture: /architect|design|pattern|structure/i.test(content),
      mentionsSecurity: /security|vulnerab|exploit|auth/i.test(content),
      mentionsPerformance: /optimi|performance|latency/i.test(content),
      requiresMultiStep: /then|after|finally|step|phase/i.test(content),

      // 🟢 Indicateurs de simplicité
      isFormatting: /format|indent|style|lint/i.test(content),
      isTranslation: /translate|convert|transform/i.test(content),
      isSimpleQuestion: content.length < 100 &&
        (content.match(/\?/g) || []).length === 1,

      // 📁 Contexte
      filesReferenced: (content.match(/\.(ts|js|py|go|rs)/g) || []).length,
      toolsRequired: task.requiredTools?.length || 0
    };
  }

  /**
   * 📈 Calcul du score de complexité (0-1)
   */
  private calculateComplexityScore(features: TaskFeatures): number {
    let score = 0;

    // 🔴 Facteurs positifs (augmentent la complexité)
    if (features.mentionsArchitecture) score += 0.25;
    if (features.mentionsSecurity) score += 0.30;
    if (features.mentionsPerformance) score += 0.20;
    if (features.requiresMultiStep) score += 0.15;
    if (features.hasCodeBlocks && features.promptLength > 500) score += 0.10;
    if (features.filesReferenced > 3) score += 0.10;

    // 🟢 Facteurs négatifs (réduisent la complexité)
    if (features.isSimpleQuestion) score -= 0.30;
    if (features.isFormatting) score -= 0.20;
    if (features.isTranslation) score -= 0.15;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * 🎚️ Sélection du tier basée sur le score
   */
  private selectBasedOnClassification(
    classification: TaskClassification
  ): ModelTier {
    const { complexityScore } = classification;

    if (complexityScore < 0.3) return ModelTier.FAST;
    if (complexityScore < 0.7) return ModelTier.BALANCED;
    return ModelTier.POWERFUL;
  }

  /**
   * 🔄 Exécution avec cascade (fallback vers tier supérieur)
   */
  async executeWithCascade<T>(
    task: TaskDescription,
    executor: (model: string) => Promise<CascadeResult<T>>
  ): Promise<T> {
    const tiers = [ModelTier.FAST, ModelTier.BALANCED, ModelTier.POWERFUL];
    const initialDecision = await this.selectTier(task);
    const startIndex = tiers.indexOf(initialDecision.tier);

    for (let i = startIndex; i < tiers.length; i++) {
      const tier = tiers[i];
      const config = MODEL_CONFIGS[tier];

      try {
        const result = await executor(config.model);

        // ✅ Vérification de la qualité
        if (result.quality >= task.minQuality || i === tiers.length - 1) {
          this.recordSuccess(task, tier, result.quality);
          return result.value;
        }

        // ⬆️ Qualité insuffisante → tier suivant
        console.log(
          `⬆️ Quality ${result.quality.toFixed(2)} < ${task.minQuality}, ` +
          `escalating ${tier} → ${tiers[i + 1]}`
        );

      } catch (error) {
        if (i === tiers.length - 1) throw error;
        console.log(`❌ Error in ${tier}, cascading...`);
      }
    }

    throw new Error('All tiers failed');
  }
}
```

### 13.2.3 📊 Résultats du Model Routing

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    📊 IMPACT DU MODEL ROUTING                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  📉 Distribution des tâches :                                               │
│                                                                             │
│  AVANT (100% GPT-4o)              APRÈS (routing intelligent)               │
│  ┌──────────────────────┐         ┌──────────────────────┐                 │
│  │████████████████████│ 100%     │████████░░░░░░░░░░░░│ 40% GPT-4o        │
│  │     GPT-4o         │          │                    │                   │
│  └──────────────────────┘         │████████████████░░│ 50% GPT-4o-mini   │
│                                   │                    │                   │
│                                   │████░░░░░░░░░░░░░░│ 10% GPT-4-turbo   │
│                                   └──────────────────────┘                 │
│                                                                             │
│  💰 Économies réalisées :                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Coût moyen/requête : $0.025 → $0.008           📉 -68%             │   │
│  │  Latence moyenne    : 850ms → 420ms             ⚡ -51%             │   │
│  │  Qualité maintenue  : 94% → 93%                 ✅ -1% (négligeable)│   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 13.2.4 📋 Matrice de Routing

| Type de Tâche | Icône | Tier Recommandé | Économie | Exemple |
|---------------|:-----:|:---------------:|:--------:|---------|
| Question simple | ❓ | 🚀 Fast | 95% | "Quelle heure est-il ?" |
| Formatage code | 🎨 | 🚀 Fast | 95% | "Indente ce JSON" |
| Traduction | 🌍 | 🚀 Fast | 95% | "Traduis en anglais" |
| Génération code | 💻 | ⚖️ Balanced | 50% | "Écris une fonction de tri" |
| Analyse code | 🔍 | ⚖️ Balanced | 50% | "Explique ce module" |
| Planification | 📋 | ⚖️ Balanced | 50% | "Planifie cette feature" |
| Architecture | 🏗️ | 🦸 Powerful | 0% | "Conçois le système" |
| Sécurité | 🔒 | 🦸 Powerful | 0% | "Audit de sécurité" |
| Algorithme novel | 🧠 | 🦸 Powerful | 0% | "Invente un algo" |

---

## 13.3 ⚡ Exécution Parallèle des Outils

### 13.3.1 🐌 Le Problème de l'Exécution Séquentielle

Par défaut, les agents exécutent les outils un par un :

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   🐌 EXÉCUTION SÉQUENTIELLE (NAÏVE)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Temps ───────────────────────────────────────────────────────────────►     │
│                                                                             │
│  ┌───────────┐                                                              │
│  │ 📄 Read A │ 200ms                                                        │
│  └───────────┘                                                              │
│              ┌───────────┐                                                  │
│              │ 📄 Read B │ 200ms                                            │
│              └───────────┘                                                  │
│                          ┌───────────┐                                      │
│                          │ 📄 Read C │ 200ms                                │
│                          └───────────┘                                      │
│                                      ┌─────────────┐                        │
│                                      │ 🔍 Search   │ 300ms                  │
│                                      └─────────────┘                        │
│                                                    ┌───────────┐            │
│                                                    │ 📊 Analyze│ 150ms      │
│                                                    └───────────┘            │
│                                                                             │
│  ⏱️ Total : 200 + 200 + 200 + 300 + 150 = 1050ms                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 13.3.2 🚀 LLMCompiler : Analyse des Dépendances

L'idée de **LLMCompiler** (Berkeley, 2023) est d'analyser les dépendances entre outils pour paralléliser automatiquement :

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                  🚀 EXÉCUTION PARALLÈLE (LLMCompiler)                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Temps ───────────────────────────────────────────────────────────────►     │
│                                                                             │
│  ┌───────────┐┌───────────┐┌───────────┐┌─────────────┐                    │
│  │ 📄 Read A ││ 📄 Read B ││ 📄 Read C ││ 🔍 Search   │  Niveau 0          │
│  └───────────┘└───────────┘└───────────┘└─────────────┘  (parallèle)       │
│  ← 200ms →    ← 200ms →    ← 200ms →    ← 300ms →                          │
│                                                                             │
│                                         ┌───────────┐                       │
│                                         │ 📊 Analyze│  Niveau 1            │
│                                         └───────────┘  (dépend des reads)  │
│                                         ← 150ms →                           │
│                                                                             │
│  ⏱️ Total : max(200, 200, 200, 300) + 150 = 450ms                           │
│  🚀 Speedup : 1050 / 450 = 2.3x                                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 13.3.3 🔧 Implémentation du Parallel Executor

```typescript
// src/optimization/parallel-executor.ts

/**
 * 🔗 Graphe de dépendances des outils
 */
interface DependencyGraph {
  nodes: Map<string, ToolNode>;
  edges: Map<string, Set<string>>;  // toolId → dépend de
}

interface ToolNode {
  id: string;
  tool: ToolCall;
  level: number;      // Profondeur dans le graphe
  inputs: string[];   // Données requises
  outputs: string[];  // Données produites
}

interface ExecutionPlan {
  levels: ToolNode[][];      // Outils groupés par niveau
  totalLevels: number;
  parallelizableTools: number;
  sequentialTools: number;
}

/**
 * ⚡ ParallelExecutor - Exécution parallèle basée sur LLMCompiler
 *
 * Principe :
 * 1. Construire le graphe de dépendances
 * 2. Calculer les niveaux (tri topologique)
 * 3. Exécuter chaque niveau en parallèle
 */
export class ParallelExecutor {
  private maxConcurrency: number;

  constructor(options: ExecutorOptions = {}) {
    this.maxConcurrency = options.maxConcurrency ?? 10;
  }

  /**
   * 🎯 Exécute un ensemble d'outils avec parallélisation maximale
   */
  async executeTools(
    tools: ToolCall[],
    executor: ToolExecutor
  ): Promise<ToolResult[]> {
    // 1️⃣ Construction du graphe de dépendances
    const graph = this.buildDependencyGraph(tools);

    // 2️⃣ Création du plan d'exécution
    const plan = this.createExecutionPlan(graph);

    console.log(
      `⚡ [ParallelExecutor] ${plan.totalLevels} levels, ` +
      `${plan.parallelizableTools}/${tools.length} parallelizable`
    );

    // 3️⃣ Exécution niveau par niveau
    const results: Map<string, ToolResult> = new Map();

    for (let level = 0; level < plan.levels.length; level++) {
      const levelTools = plan.levels[level];

      // Exécution parallèle du niveau
      const levelResults = await this.executeLevelParallel(
        levelTools,
        executor,
        results
      );

      // Stockage des résultats
      for (const result of levelResults) {
        results.set(result.toolId, result);
      }
    }

    // 4️⃣ Retour dans l'ordre original
    return tools.map(tool => results.get(tool.id)!);
  }

  /**
   * 🔍 Construction du graphe de dépendances
   */
  private buildDependencyGraph(tools: ToolCall[]): DependencyGraph {
    const nodes = new Map<string, ToolNode>();
    const edges = new Map<string, Set<string>>();

    // Création des noeuds
    for (const tool of tools) {
      const inputs = this.extractInputs(tool);
      const outputs = this.extractOutputs(tool);

      nodes.set(tool.id, {
        id: tool.id,
        tool,
        level: -1,
        inputs,
        outputs
      });

      edges.set(tool.id, new Set());
    }

    // Détection des dépendances
    for (const [id, node] of nodes) {
      for (const [otherId, otherNode] of nodes) {
        if (id === otherId) continue;

        // Dépendance si les outputs de l'autre sont nos inputs
        const hasDependency = otherNode.outputs.some(
          output => node.inputs.includes(output)
        );

        if (hasDependency) {
          edges.get(id)!.add(otherId);
        }
      }
    }

    // Calcul des niveaux (tri topologique)
    this.calculateLevels(nodes, edges);

    return { nodes, edges };
  }

  /**
   * 📊 Extraction des inputs d'un outil
   */
  private extractInputs(tool: ToolCall): string[] {
    const inputs: string[] = [];

    switch (tool.name) {
      case 'Read':
        // Pas d'input externe
        break;

      case 'Edit':
        // Dépend de la lecture du fichier
        inputs.push(`file:${tool.params.path}`);
        break;

      case 'Analyze':
        // Dépend des fichiers à analyser
        if (tool.params.files) {
          inputs.push(...tool.params.files.map((f: string) => `file:${f}`));
        }
        break;
    }

    return inputs;
  }

  /**
   * 📤 Extraction des outputs d'un outil
   */
  private extractOutputs(tool: ToolCall): string[] {
    const outputs: string[] = [];

    switch (tool.name) {
      case 'Read':
        outputs.push(`file:${tool.params.path}`);
        break;

      case 'Search':
        outputs.push(`search:${tool.params.pattern}`);
        break;

      case 'Bash':
        outputs.push(`bash:${tool.id}`);
        break;
    }

    return outputs;
  }

  /**
   * 📐 Calcul des niveaux par tri topologique (Kahn's algorithm)
   */
  private calculateLevels(
    nodes: Map<string, ToolNode>,
    edges: Map<string, Set<string>>
  ): void {
    const inDegree = new Map<string, number>();

    // Initialisation des degrés entrants
    for (const id of nodes.keys()) {
      inDegree.set(id, edges.get(id)!.size);
    }

    // File des noeuds sans dépendances (niveau 0)
    const queue: string[] = [];
    for (const [id, degree] of inDegree) {
      if (degree === 0) {
        queue.push(id);
        nodes.get(id)!.level = 0;
      }
    }

    // Parcours BFS
    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentNode = nodes.get(current)!;

      // Mise à jour des successeurs
      for (const [id, deps] of edges) {
        if (deps.has(current)) {
          const newDegree = inDegree.get(id)! - 1;
          inDegree.set(id, newDegree);

          // Niveau = max des niveaux des dépendances + 1
          const node = nodes.get(id)!;
          node.level = Math.max(node.level, currentNode.level + 1);

          if (newDegree === 0) {
            queue.push(id);
          }
        }
      }
    }
  }

  /**
   * ⚡ Exécution parallèle d'un niveau
   */
  private async executeLevelParallel(
    tools: ToolNode[],
    executor: ToolExecutor,
    previousResults: Map<string, ToolResult>
  ): Promise<ToolResult[]> {
    // Sémaphore pour limiter la concurrence
    const semaphore = new Semaphore(this.maxConcurrency);

    const promises = tools.map(async (node) => {
      await semaphore.acquire();

      try {
        const startTime = Date.now();
        const result = await executor.execute(node.tool);
        const duration = Date.now() - startTime;

        return {
          toolId: node.id,
          ...result,
          duration
        };

      } finally {
        semaphore.release();
      }
    });

    return Promise.all(promises);
  }
}

/**
 * 🚦 Sémaphore pour limiter la concurrence
 */
class Semaphore {
  private permits: number;
  private queue: (() => void)[] = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    return new Promise<void>(resolve => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      next();
    } else {
      this.permits++;
    }
  }
}
```

### 13.3.4 📊 Benchmarks de Parallélisation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   📊 BENCHMARKS D'EXÉCUTION PARALLÈLE                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  📋 Scénario : Analyse de codebase (15 fichiers)                            │
│                                                                             │
│  🐌 Séquentiel:                                                             │
│  ├── 15 × Read  : 200ms × 15 = 3000ms                                       │
│  ├── 5 × Search : 300ms × 5  = 1500ms                                       │
│  ├── 1 × Analyze: 500ms                                                     │
│  └── Total: 5000ms                                                          │
│                                                                             │
│  🚀 Parallèle:                                                              │
│  ├── Niveau 0: max(15×Read, 5×Search) = 300ms                               │
│  ├── Niveau 1: Analyze = 500ms                                              │
│  └── Total: 800ms                                                           │
│                                                                             │
│  ⚡ Speedup: 5000 / 800 = 6.25x                                              │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  📈 Benchmarks par type de tâche :                                          │
│                                                                             │
│  ┌────────────────────┬───────────┬───────────┬───────────┬──────────────┐ │
│  │ Tâche              │ Séq. (ms) │ Par. (ms) │ Speedup   │ Icône        │ │
│  ├────────────────────┼───────────┼───────────┼───────────┼──────────────┤ │
│  │ Lecture multi-file │ 3200      │ 520       │ 6.15x     │ 📄📄📄       │ │
│  │ Recherche globale  │ 2400      │ 680       │ 3.53x     │ 🔍🔍🔍       │ │
│  │ Refactoring        │ 4800      │ 1200      │ 4.00x     │ ✏️✏️✏️       │ │
│  │ Test + Build       │ 8500      │ 3400      │ 2.50x     │ 🧪🔨         │ │
│  │ Multi-tool chain   │ 5600      │ 1800      │ 3.11x     │ 🔗🔗🔗       │ │
│  └────────────────────┴───────────┴───────────┴───────────┴──────────────┘ │
│                                                                             │
│  📊 Moyenne globale : 3.86x speedup                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 13.4 🚀 Lazy Loading et Optimisation du Démarrage

### 13.4.1 ❄️ Le Problème du Cold Start

Le temps de démarrage impacte directement l'expérience utilisateur :

```typescript
// ❌ AVANT : chargement synchrone de tout
// Temps de démarrage : ~3 secondes

import { PDFProcessor } from './agents/pdf-processor';      // 300ms
import { ExcelProcessor } from './agents/excel-processor';  // 250ms
import { SQLAnalyzer } from './agents/sql-analyzer';        // 200ms
import { ImageProcessor } from './agents/image-processor';  // 400ms
import { AudioTranscriber } from './agents/audio-transcriber'; // 350ms
import { VideoAnalyzer } from './agents/video-analyzer';    // 500ms
import { SemanticCache } from './utils/semantic-cache';     // 200ms
import { MCPClient } from './mcp/client';                   // 300ms
import { TreeOfThought } from './reasoning/tot';            // 250ms
// ... 50+ imports lourds

// 💀 Problème : tous ces modules sont chargés même pour un simple "hello"
```

### 13.4.2 🏗️ Architecture de Lazy Loading

```typescript
// src/performance/lazy-loader.ts

type ModuleFactory<T> = () => Promise<{ default: T } | T>;

/**
 * 🚀 LazyLoader - Chargement différé des modules
 *
 * Stratégie :
 * 1. Les modules critiques sont chargés au démarrage
 * 2. Les autres sont chargés à la demande
 * 3. Le préchargement se fait en arrière-plan
 */
export class LazyLoader {
  private cache: Map<string, unknown> = new Map();
  private loading: Map<string, Promise<unknown>> = new Map();
  private loadTimes: Map<string, number> = new Map();

  /**
   * 📦 Charge un module à la demande avec déduplication
   */
  async load<T>(name: string, factory: ModuleFactory<T>): Promise<T> {
    // ✅ Déjà en cache
    if (this.cache.has(name)) {
      return this.cache.get(name) as T;
    }

    // ⏳ Déjà en cours de chargement (déduplication)
    if (this.loading.has(name)) {
      return this.loading.get(name) as Promise<T>;
    }

    // 🆕 Nouveau chargement
    const startTime = Date.now();

    const loadPromise = (async () => {
      try {
        const module = await factory();
        const instance = 'default' in module ? module.default : module;

        this.cache.set(name, instance);
        this.loadTimes.set(name, Date.now() - startTime);

        console.log(`📦 [LazyLoad] ${name} loaded in ${Date.now() - startTime}ms`);
        return instance;

      } finally {
        this.loading.delete(name);
      }
    })();

    this.loading.set(name, loadPromise);
    return loadPromise;
  }

  /**
   * 🔮 Précharge des modules en arrière-plan (non-bloquant)
   */
  async preload(
    modules: Array<{ name: string; factory: ModuleFactory<unknown> }>
  ): Promise<void> {
    await Promise.allSettled(
      modules.map(({ name, factory }) => this.load(name, factory))
    );
  }

  /**
   * 📊 Statistiques de chargement
   */
  getStats(): LoaderStats {
    return {
      loaded: this.cache.size,
      loading: this.loading.size,
      loadTimes: Object.fromEntries(this.loadTimes),
      totalLoadTime: Array.from(this.loadTimes.values())
        .reduce((a, b) => a + b, 0)
    };
  }
}
```

### 13.4.3 📋 Registre des Modules Différés

```typescript
// src/performance/module-registry.ts

/**
 * 📦 Définition d'un module différé
 */
interface LazyModule<T = unknown> {
  name: string;
  factory: () => Promise<T>;
  priority: 'critical' | 'high' | 'medium' | 'low';
  preloadTrigger?: string[];  // Événements déclenchant le préchargement
}

/**
 * 📋 ModuleRegistry - Registre centralisé des modules
 */
export class ModuleRegistry {
  private loader: LazyLoader;
  private modules: Map<string, LazyModule> = new Map();

  constructor() {
    this.loader = new LazyLoader();
    this.registerBuiltinModules();
  }

  /**
   * 📝 Enregistrement des modules intégrés
   */
  private registerBuiltinModules(): void {
    // 📄 Agents spécialisés (chargés à la demande)
    this.register({
      name: 'PDFProcessor',
      factory: async () => {
        const { PDFProcessor } = await import('../agent/specialized/pdf-processor.js');
        return new PDFProcessor();
      },
      priority: 'low',
      preloadTrigger: ['file.pdf.detected']
    });

    this.register({
      name: 'ExcelProcessor',
      factory: async () => {
        const { ExcelProcessor } = await import('../agent/specialized/excel-processor.js');
        return new ExcelProcessor();
      },
      priority: 'low',
      preloadTrigger: ['file.xlsx.detected', 'file.csv.detected']
    });

    // ⚡ Optimisations (chargées selon le mode)
    this.register({
      name: 'SemanticCache',
      factory: async () => {
        const { SemanticCache } = await import('../utils/semantic-cache.js');
        return new SemanticCache();
      },
      priority: 'medium',
      preloadTrigger: ['session.start']
    });

    this.register({
      name: 'ParallelExecutor',
      factory: async () => {
        const { ParallelExecutor } = await import('./parallel-executor.js');
        return new ParallelExecutor();
      },
      priority: 'high',
      preloadTrigger: ['agent.ready']
    });

    // 🧠 Raisonnement avancé (chargé pour tâches complexes)
    this.register({
      name: 'TreeOfThought',
      factory: async () => {
        const { TreeOfThought } = await import('../agent/reasoning/tree-of-thought.js');
        return new TreeOfThought();
      },
      priority: 'low',
      preloadTrigger: ['task.complex.detected']
    });
  }

  /**
   * 📦 Charge un module
   */
  async get<T>(name: string): Promise<T> {
    const module = this.modules.get(name);
    if (!module) {
      throw new Error(`Module not registered: ${name}`);
    }
    return this.loader.load(name, module.factory) as Promise<T>;
  }

  /**
   * 🔮 Précharge les modules pour un événement
   */
  async triggerPreload(event: string): Promise<void> {
    const toPreload = Array.from(this.modules.values())
      .filter(m => m.preloadTrigger?.includes(event));

    if (toPreload.length > 0) {
      console.log(`🔮 [Preload] ${toPreload.length} modules for ${event}`);
      await this.loader.preload(
        toPreload.map(m => ({ name: m.name, factory: m.factory }))
      );
    }
  }
}

// Singleton global
export const moduleRegistry = new ModuleRegistry();
```

### 13.4.4 🚀 Démarrage Optimisé

```typescript
// src/index.ts (optimisé)

import { moduleRegistry } from './performance/module-registry.js';

async function main() {
  const startTime = Date.now();

  // 1️⃣ Configuration de base (~5ms)
  console.log('🚀 Starting Grok-CLI...');
  const config = await loadConfig();

  // 2️⃣ Interface utilisateur (critique, ~20ms)
  const { ChatInterface } = await import('./ui/chat-interface.js');
  const ui = new ChatInterface(config);

  // 3️⃣ Agent minimal (critique, ~10ms)
  const { GrokAgent } = await import('./agent/grok-agent.js');
  const agent = new GrokAgent(config);

  // ✅ Prêt à répondre en ~37ms
  console.log(`✅ Ready in ${Date.now() - startTime}ms`);

  // 4️⃣ Préchargement en arrière-plan (non-bloquant)
  setImmediate(async () => {
    await moduleRegistry.triggerPreload('session.start');
    await moduleRegistry.triggerPreload('agent.ready');
  });

  // 5️⃣ Boucle principale avec préchargement contextuel
  ui.on('message', async (message) => {
    // Préchargement intelligent basé sur le message
    if (message.includes('.pdf')) {
      moduleRegistry.triggerPreload('file.pdf.detected');
    }
    if (message.includes('sql') || message.includes('database')) {
      moduleRegistry.triggerPreload('database.connection');
    }

    await agent.process(message);
  });

  await ui.start();
}

main().catch(console.error);
```

### 13.4.5 📊 Résultats du Lazy Loading

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     📊 IMPACT DU LAZY LOADING                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ⏱️ Temps de démarrage :                                                    │
│                                                                             │
│  AVANT:                                                                     │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │████████████████████████████████████████████████████████████████████│    │
│  │                         3000ms (tous modules)                      │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  APRÈS:                                                                     │
│  ┌───┐                                                                      │
│  │███│ 37ms (modules critiques)                                             │
│  └───┘                                                                      │
│       └── 📉 Réduction : 98.8%                                              │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  💾 Mémoire initiale :                                                      │
│  ├── Avant : 245 MB                                                         │
│  ├── Après : 48 MB                                                          │
│  └── 📉 Réduction : 80.4%                                                   │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  📨 Premier message :                                                       │
│  ├── Avant : 3000ms + 500ms = 3500ms                                        │
│  ├── Après (cold)  : 37ms + 500ms = 537ms                                   │
│  ├── Après (warm)  : 37ms + 150ms = 187ms (modules préchargés)              │
│  └── ⚡ Amélioration : 85-95%                                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 13.5 ⏱️ Optimisation de la Latence

### 13.5.1 🧘 L'Importance du Flow State

La recherche sur l'interaction humain-IA montre que la latence impacte directement la productivité :

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      🧘 LATENCE ET FLOW STATE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ⏱️ Latence        👁️ Perception       🎯 Impact                            │
│                                                                             │
│  < 100ms          Instantané          ✅ Flow parfait                       │
│  100-300ms        Rapide              ✅ Flow maintenu                       │
│  300-1000ms       Perceptible         ⚠️ Flow fragile                       │
│  1-3s             Attente             ❌ Flow interrompu                     │
│  > 3s             Frustration         💀 Abandon fréquent                   │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  📈 Productivité relative :                                                 │
│                                                                             │
│  100%│ ████████████████████████████ ← Flow optimal                          │
│   80%│ ██████████████████████                                               │
│   60%│ ███████████████                                                      │
│   40%│ ███████                                                              │
│   20%│ ███                                                                  │
│      └────────────────────────────────────────────────►                     │
│        100ms    500ms    1s      2s      3s                                 │
│                                                                             │
│  🎯 Objectif : Maintenir P95 < 1 seconde                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 13.5.2 🔧 Stratégies d'Optimisation

```typescript
// src/optimization/latency-optimizer.ts

/**
 * ⚙️ Configuration des seuils de latence
 */
interface LatencyConfig {
  targetP50: number;    // 300ms
  targetP95: number;    // 1000ms
  targetP99: number;    // 2000ms
  maxAcceptable: number; // 5000ms
}

/**
 * ⏱️ LatencyOptimizer - Optimiseur de latence multi-stratégie
 */
export class LatencyOptimizer {
  private config: LatencyConfig;
  private strategies: LatencyStrategy[] = [];
  private measurements: LatencyMeasurement[] = [];

  constructor(config: Partial<LatencyConfig> = {}) {
    this.config = {
      targetP50: config.targetP50 ?? 300,
      targetP95: config.targetP95 ?? 1000,
      targetP99: config.targetP99 ?? 2000,
      maxAcceptable: config.maxAcceptable ?? 5000
    };

    this.initializeStrategies();
  }

  private initializeStrategies(): void {
    this.strategies = [
      new StreamingStrategy(),          // 📡 Streaming des réponses
      new PredictivePrefetchStrategy(), // 🔮 Préchargement prédictif
      new ConnectionPoolStrategy(),     // 🔗 Pool de connexions
      new ResponseCachingStrategy(),    // 💾 Cache des réponses
      new ProgressiveRenderingStrategy() // 🎨 Rendu progressif
    ];
  }

  /**
   * 🎯 Optimise une requête
   */
  async optimizeRequest<T>(
    request: () => Promise<T>,
    context: RequestContext
  ): Promise<OptimizedResult<T>> {
    const startTime = Date.now();

    // Sélection des stratégies applicables
    const applicable = this.strategies.filter(s => s.isApplicable(context));

    // Pré-requête
    for (const strategy of applicable) {
      await strategy.preRequest(context);
    }

    // Exécution avec timeout
    const result = await this.executeWithTimeout(
      request,
      this.config.maxAcceptable
    );

    const latency = Date.now() - startTime;

    // Enregistrement
    this.recordMeasurement({ latency, context, success: true });

    // Post-requête
    for (const strategy of applicable) {
      await strategy.postRequest(context, result, latency);
    }

    return { value: result, latency, cached: false };
  }

  /**
   * 📊 Calcul des percentiles
   */
  getPercentiles(): LatencyPercentiles {
    if (this.measurements.length === 0) {
      return { p50: 0, p95: 0, p99: 0 };
    }

    const sorted = [...this.measurements]
      .map(m => m.latency)
      .sort((a, b) => a - b);

    return {
      p50: sorted[Math.floor(sorted.length * 0.50)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    };
  }

  /**
   * ⚠️ Vérifie la santé de la latence
   */
  checkHealth(): LatencyHealth {
    const percentiles = this.getPercentiles();

    return {
      healthy: percentiles.p95 <= this.config.targetP95,
      percentiles,
      alerts: this.generateAlerts(percentiles)
    };
  }
}
```

### 13.5.3 📡 Stratégie de Streaming

```typescript
/**
 * 📡 StreamingStrategy - Affiche les réponses au fur et à mesure
 *
 * Au lieu d'attendre la réponse complète, on affiche les tokens
 * dès leur arrivée → perception de latence réduite.
 */
class StreamingStrategy implements LatencyStrategy {
  name = 'streaming';

  isApplicable(context: RequestContext): boolean {
    return context.supportsStreaming && !context.requiresFullResponse;
  }

  async execute<T>(
    request: StreamableRequest<T>,
    onChunk: (chunk: string) => void
  ): Promise<T> {
    const stream = await request.stream();
    let fullResponse = '';

    for await (const chunk of stream) {
      fullResponse += chunk;
      onChunk(chunk);  // Affichage immédiat
    }

    return request.parse(fullResponse);
  }
}
```

---

## 13.6 📈 Métriques et Monitoring

### 13.6.1 🎛️ Dashboard de Performance

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    📊 SYSTEM PERFORMANCE DASHBOARD                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  🎯 MODEL ROUTING                      ⚡ PARALLEL EXECUTION                 │
│  ┌─────────────────────────────┐      ┌─────────────────────────────┐      │
│  │ Fast tier     : ██████░░ 58%│      │ Avg Speedup  : 3.8x         │      │
│  │ Balanced tier : ████░░░░ 32%│      │ Parallelized : 78%          │      │
│  │ Powerful tier : ██░░░░░░ 10%│      │ Levels avg   : 2.3          │      │
│  │                             │      │                             │      │
│  │ Cost savings  : 68%         │      │ Time saved   : 45s/session  │      │
│  └─────────────────────────────┘      └─────────────────────────────┘      │
│                                                                             │
│  🚀 LAZY LOADING                       ⏱️ LATENCY                           │
│  ┌─────────────────────────────┐      ┌─────────────────────────────┐      │
│  │ Startup time  : 37ms        │      │ P50          : 280ms ✅     │      │
│  │ Memory saved  : 197 MB      │      │ P95          : 890ms ✅     │      │
│  │ Modules loaded: 12/47       │      │ P99          : 1.8s  ✅     │      │
│  │                             │      │                             │      │
│  │ Preload queue : 3 pending   │      │ Target P95   : <1s          │      │
│  └─────────────────────────────┘      └─────────────────────────────┘      │
│                                                                             │
│  💰 COST SUMMARY (this session)                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                     │   │
│  │   Without optimizations : ████████████████████████████ $2.50       │   │
│  │   With optimizations    : ████████░░░░░░░░░░░░░░░░░░░ $0.75       │   │
│  │                                                                     │   │
│  │   💵 Savings : $1.75 (70%)                                          │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 13.6.2 📊 Métriques Clés à Surveiller

| Métrique | Icône | Cible | Alerte | Action |
|----------|:-----:|:-----:|:------:|--------|
| Startup time | 🚀 | <100ms | >500ms | Audit lazy loading |
| P95 latency | ⏱️ | <1s | >2s | Activer streaming |
| Cache hit rate | 💾 | >60% | <30% | Ajuster seuil |
| Parallelization | ⚡ | >70% | <50% | Revoir dépendances |
| Fast tier usage | 🎯 | >50% | <30% | Ajuster classifier |
| Memory usage | 💾 | <100MB | >200MB | Unload modules |

---

## 📝 Points Clés

| Concept | Icône | Description | Impact |
|---------|:-----:|-------------|--------|
| **Model Routing** | 🎯 | FrugalGPT : bon modèle pour chaque tâche | -68% coût |
| **Parallélisation** | ⚡ | LLMCompiler : exécution par niveaux | 3.8x speedup |
| **Lazy Loading** | 🚀 | Chargement différé des modules | 98% startup |
| **Latence** | ⏱️ | Streaming + prefetch + pool | P95 <1s |
| **Monitoring** | 📊 | Dashboard temps réel | Amélioration continue |

---

## 🏋️ Exercices

### Exercice 1 : 🎯 Classificateur de Tâches
Implémentez un classificateur de tâches plus sophistiqué en utilisant :
- Des embeddings de phrases pour détecter la complexité
- Un historique des performances par type de tâche
- Une cascade automatique avec learning

### Exercice 2 : ⚡ Visualiseur de Plan d'Exécution
Créez un visualiseur TUI qui affiche en temps réel :
- Le graphe de dépendances des outils
- Le niveau d'exécution actuel
- Les outils en parallèle vs séquentiels

### Exercice 3 : 🚀 Préchargement Prédictif
Implémentez un système de préchargement prédictif basé sur :
- L'historique des commandes de l'utilisateur
- L'heure de la journée
- Le type de projet détecté

### Exercice 4 : 📊 Dashboard de Performance
Construisez un dashboard avec blessed ou ink affichant :
- Les percentiles de latence en temps réel
- La distribution des tiers de modèle
- Les économies cumulées
- Les alertes actives

---

## 📚 Références

| Source | Description | Lien |
|--------|-------------|------|
| **FrugalGPT** | Stanford, model routing | [arXiv](https://arxiv.org/abs/2305.05176) |
| **LLMCompiler** | Berkeley, parallel execution | [arXiv](https://arxiv.org/abs/2312.04511) |
| **AsyncLM** | Async tool calling | [Paper](https://arxiv.org/abs/2401.00132) |
| **Flow State** | Human-AI latency research | [Replit Research](https://replit.com) |
| **Grok-CLI** | `src/optimization/` | Local |

---

## 🌅 Épilogue

*Trois semaines plus tard. Réunion mensuelle de l'équipe.*

**Karim** : *(présentant les métriques)* « Les résultats sont spectaculaires. Regardez ces chiffres. »

**Lina** : *(souriant)* « 70% de réduction des coûts. De 15 000 à 4 500 euros ce mois-ci. »

**Marc** : « Et la latence ? »

**Karim** : « P95 à 890ms. On est passé de 4 secondes à moins d'une seconde. Les développeurs ne se plaignent plus. »

**Lina** : « Le model routing fait vraiment la différence. 60% des requêtes utilisent le tier rapide maintenant. »

**Marc** : « Et le démarrage ? »

**Karim** : « 37 millisecondes. Le lazy loading a réduit le temps de 99%. L'app est prête instantanément. »

**Lina** : *(regardant son équipe)* « On a construit quelque chose d'efficace maintenant. Puissant ET économique. »

**Marc** : « C'est la vraie ingénierie — maximiser la valeur tout en minimisant le gaspillage. »

**Karim** : « Prochaine étape : l'apprentissage persistant. Que l'agent apprenne et s'améliore au fil du temps. »

---

## 🧭 Navigation

| Précédent | Suivant |
|:---------:|:-------:|
| [← Chapitre 12 : Optimisations Cognitives](12-optimisations-cognitives.md) | [Chapitre 14 : Apprentissage Persistant →](14-apprentissage-persistant.md) |

---

**Prochainement** : *Chapitre 14 — Apprentissage Persistant* : Mémoire épisodique, sémantique et procédurale pour un agent qui s'améliore avec le temps.
