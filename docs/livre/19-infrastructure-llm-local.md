# Chapitre 19 : Infrastructure LLM Local

> *"Pourquoi payer $0.03/1K tokens quand vous avez un GPU de gaming qui dort ?"*

---

## Ce Que Vous Allez Obtenir

| Module | Fonction | Économies |
|--------|----------|-----------|
| **GPU Monitor** | Surveillance VRAM en temps réel | Évite les crashs OOM |
| **Ollama Embeddings** | Embeddings locaux (gratuits) | -100% coût embeddings |
| **HNSW Vector Store** | Recherche vectorielle pure TypeScript | Pas de base externe |
| **Model Hub** | Téléchargement modèles HuggingFace | Gestion simplifiée |
| **KV-Cache Config** | Optimisation mémoire inférence | +50% contexte |
| **Speculative Decoding** | Accélération génération | 2-3x plus rapide |
| **Benchmark Suite** | Mesure TTFT/TPS/p95 | Optimisation guidée |
| **Schema Validator** | Structured output fiable | Tool calling robuste |

**Résultat :** Un pipeline RAG entièrement local + inférence optimisée.

---

## Pourquoi Aller Local ?

### Le Calcul Qui Fait Mal

```
Projet moyen :
├── 50,000 lignes de code
├── 1,000 chunks à embedder
├── 768 dimensions
└── Rafraîchissement : 10x/jour

OpenAI ada-002 : 1,000 × 10 × 30 jours × $0.0001 = $3/mois
                 × 12 mois × 5 projets = $180/an

Avec Ollama : $0
```

### Quand Aller Local ?

| Scénario | Cloud | Local | Verdict |
|----------|:-----:|:-----:|---------|
| Prototype rapide | ✅ | ❌ | Cloud |
| Données sensibles | ❌ | ✅ | **Local** |
| Volume élevé | 💸 | ✅ | **Local** |
| Latence critique | ❌ | ✅ | **Local** |
| GPU disponible | - | ✅ | **Local** |

---

## 1. GPU Monitor : Surveiller Votre VRAM

### Le Problème

```
$ ollama run devstral
Error: CUDA out of memory. Tried to allocate 2.00 GiB...
```

Charger un modèle 7B sans vérifier la VRAM disponible = crash garanti.

### La Solution

```typescript
import { GPUMonitor, initializeGPUMonitor } from './hardware/gpu-monitor.js';

// Initialisation (détecte automatiquement NVIDIA/AMD/Apple/Intel)
const monitor = await initializeGPUMonitor();

// Statistiques VRAM
const stats = await monitor.getStats();
console.log(`VRAM: ${stats.usedVRAM}/${stats.totalVRAM} MB (${stats.usagePercent}%)`);

// Recommandation pour charger un modèle
const modelSizeMB = 4000; // Modèle 7B Q4
const recommendation = monitor.calculateOffloadRecommendation(modelSizeMB);

if (recommendation.shouldOffload) {
  console.log(`⚠️ ${recommendation.reason}`);
  console.log(`   Layers GPU suggérés: ${recommendation.suggestedGpuLayers}`);
} else {
  console.log(`✅ Assez de VRAM pour le modèle complet`);
}
```

### Architecture

![GPUMonitor Architecture](images/gpu-monitor-architecture.svg)

### Détection Multi-Vendor

```typescript
// Le monitor détecte automatiquement votre GPU
switch (monitor.getVendor()) {
  case 'nvidia':  // nvidia-smi
  case 'amd':     // rocm-smi
  case 'apple':   // system_profiler SPDisplaysDataType
  case 'intel':   // intel_gpu_top
  case 'unknown': // Fallback mémoire système
}
```

### Estimation VRAM par Modèle

| Modèle | Q4_K_M | Q5_K_M | Q8_0 |
|--------|--------|--------|------|
| 3B params | ~2.1 GB | ~2.5 GB | ~3.5 GB |
| 7B params | ~4.5 GB | ~5.3 GB | ~7.5 GB |
| 13B params | ~8.5 GB | ~10 GB | ~14 GB |
| 70B params | ~40 GB | ~48 GB | ~70 GB |

---

## 2. Ollama Embeddings : Embeddings Locaux

### Le Problème

```typescript
// Chaque appel coûte de l'argent
const response = await openai.embeddings.create({
  model: 'text-embedding-ada-002',
  input: codeChunk,
});
```

### La Solution

```typescript
import {
  OllamaEmbeddingProvider,
  initializeOllamaEmbeddings
} from './context/codebase-rag/ollama-embeddings.js';

// Initialisation
const embedder = await initializeOllamaEmbeddings({
  baseUrl: 'http://localhost:11434',
  model: 'nomic-embed-text', // 768 dimensions, excellent pour code
});

// Embedding d'un chunk de code
const embedding = await embedder.embed(`
function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}
`);

// Embedding batch (avec progression)
embedder.on('batch:progress', (current, total) => {
  console.log(`Embedding ${current}/${total}`);
});

const embeddings = await embedder.embedBatch([
  'const x = 1;',
  'function foo() {}',
  'class Bar extends Baz {}',
]);
```

### Modèles d'Embedding Recommandés

| Modèle | Dimensions | Spécialité | Performance |
|--------|------------|------------|-------------|
| `nomic-embed-text` | 768 | Texte général | ⭐⭐⭐⭐ |
| `mxbai-embed-large` | 1024 | Haute précision | ⭐⭐⭐⭐⭐ |
| `all-minilm` | 384 | Vitesse | ⭐⭐⭐ |

### Installation Ollama

```bash
# macOS/Linux
curl -fsSL https://ollama.ai/install.sh | sh

# Télécharger le modèle d'embedding
ollama pull nomic-embed-text

# Vérifier
ollama list
```

### Calcul de Similarité

```typescript
// Similarité cosinus intégrée
const sim = embedder.similarity(embedding1, embedding2);
// sim ∈ [-1, 1] où 1 = identique
```

---

## 3. HNSW Vector Store : Recherche Vectorielle Pure TypeScript

### Le Problème

Les solutions existantes :
- **FAISS** : Nécessite Python + bindings natifs
- **Pinecone/Weaviate** : Cloud, coûts, latence réseau
- **ChromaDB** : Serveur séparé à gérer

### La Solution

Un index HNSW (Hierarchical Navigable Small World) 100% TypeScript :

```typescript
import { HNSWVectorStore, getHNSWStore } from './context/codebase-rag/hnsw-store.js';

// Création
const store = new HNSWVectorStore({
  dimensions: 768,        // Doit matcher votre embedder
  maxElements: 100000,    // Capacité max
  efConstruction: 200,    // Qualité construction (↑ = meilleur, plus lent)
  M: 16,                  // Connexions par noeud
});

// Ajout de vecteurs
store.add({
  id: 'src/utils/math.ts:calculateTotal',
  vector: embedding,
  metadata: {
    file: 'src/utils/math.ts',
    type: 'function',
    language: 'typescript',
  },
});

// Recherche k-NN
const results = store.search(queryEmbedding, 5);
// results = [{ id, distance, metadata }, ...]

// Persistance
await store.save('./cache/vectors.hnsw');
await store.load('./cache/vectors.hnsw');
```

### Comment Fonctionne HNSW

![HNSW Structure](images/hnsw-structure.svg)

**Complexité** : O(log N) au lieu de O(N) pour recherche linéaire

### Paramètres de Tuning

| Paramètre | Effet | Recommandation |
|-----------|-------|----------------|
| `M` | Connexions/noeud | 12-48 (16 par défaut) |
| `efConstruction` | Qualité build | 100-400 (200 par défaut) |
| `efSearch` | Qualité recherche | 50-200 (dynamique) |

```typescript
// Pour un petit index (< 10K vecteurs)
const smallStore = new HNSWVectorStore({
  dimensions: 768,
  M: 12,
  efConstruction: 100,
});

// Pour un gros index (> 100K vecteurs)
const largeStore = new HNSWVectorStore({
  dimensions: 768,
  M: 32,
  efConstruction: 400,
});
```

### Comparaison avec Alternatives

| Solution | Dépendances | Latence | Complexité |
|----------|-------------|---------|------------|
| **HNSW (nous)** | 0 | ~1ms | TypeScript pur |
| FAISS | Python, bindings | ~0.5ms | Setup complexe |
| Pinecone | Cloud | ~50ms | Simple mais coûteux |
| ChromaDB | Serveur | ~10ms | Middleware |

---

## 4. Model Hub : Gestion des Modèles HuggingFace

### Le Problème

```bash
# Téléchargement manuel = douleur
wget https://huggingface.co/TheBloke/devstral-7B-GGUF/resolve/main/devstral-7b.Q4_K_M.gguf
# Où le mettre ? Quelle quantization ? Combien de VRAM ?
```

### La Solution

```typescript
import {
  ModelHub,
  getModelHub,
  RECOMMENDED_MODELS,
  QUANTIZATION_TYPES
} from './models/model-hub.js';

// Initialisation
const hub = getModelHub({
  modelsDir: '~/.codebuddy/models',
});

// Lister les modèles disponibles
console.log(hub.formatModelList());
// ┌──────────────┬────────┬──────────┬───────────────────────┐
// │ Modèle       │ Taille │ VRAM Q4  │ Description           │
// ├──────────────┼────────┼──────────┼───────────────────────┤
// │ devstral-7b  │ 7B     │ ~4.5 GB  │ Code, Mistral-based   │
// │ codellama-7b │ 7B     │ ~4.5 GB  │ Code, Meta            │
// │ llama-3.2-3b │ 3B     │ ~2.1 GB  │ Général, compact      │
// └──────────────┴────────┴──────────┴───────────────────────┘

// Téléchargement avec progression
hub.on('download:progress', (percent, speed) => {
  console.log(`Téléchargement: ${percent}% (${speed} MB/s)`);
});

await hub.download('devstral-7b', 'Q4_K_M');

// Estimer VRAM nécessaire
const model = RECOMMENDED_MODELS['devstral-7b'];
const vram = hub.estimateVRAM(model, 'Q4_K_M');
console.log(`VRAM estimée: ${vram} MB`);
```

### Modèles Recommandés pour le Code

| Modèle | Paramètres | Forces | GPU Min |
|--------|------------|--------|---------|
| **devstral-7b** | 7B | Code génération, Mistral | 6 GB |
| **codellama-7b** | 7B | Code, Meta, multilingue | 6 GB |
| **llama-3.2-3b** | 3B | Général, rapide | 4 GB |
| **deepseek-coder-6.7b** | 6.7B | Code, instruction-tuned | 6 GB |

### Quantizations Expliquées

![Guide des Quantizations GGUF](images/quantization-guide.svg)

---

## 5. Pipeline Complet : RAG Local

### Assemblage des Composants

```typescript
import { initializeGPUMonitor } from './hardware/gpu-monitor.js';
import { initializeOllamaEmbeddings } from './context/codebase-rag/ollama-embeddings.js';
import { HNSWVectorStore } from './context/codebase-rag/hnsw-store.js';

async function createLocalRAGPipeline() {
  // 1. Vérifier les ressources GPU
  const gpu = await initializeGPUMonitor();
  const stats = await gpu.getStats();
  console.log(`GPU: ${stats.freeVRAM} MB disponibles`);

  // 2. Initialiser embeddings locaux
  const embedder = await initializeOllamaEmbeddings({
    model: 'nomic-embed-text',
  });

  // 3. Créer le store vectoriel
  const store = new HNSWVectorStore({
    dimensions: embedder.getDimensions(),
    maxElements: 50000,
  });

  // 4. Indexer le code
  async function indexCodebase(files: string[]) {
    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      const chunks = chunkCode(content); // Votre chunking logic

      for (const chunk of chunks) {
        const embedding = await embedder.embed(chunk.text);
        store.add({
          id: `${file}:${chunk.start}-${chunk.end}`,
          vector: embedding,
          metadata: {
            file,
            type: chunk.type,
            code: chunk.text,
          },
        });
      }
    }

    // Sauvegarder l'index
    await store.save('./cache/codebase.hnsw');
  }

  // 5. Recherche sémantique
  async function search(query: string, k = 5) {
    const queryEmbedding = await embedder.embed(query);
    return store.search(queryEmbedding, k);
  }

  return { indexCodebase, search, store, embedder, gpu };
}
```

### Workflow Type

![RAG Pipeline Local](images/rag-pipeline-local.svg)

---

## 6. Configuration Recommandée

### Minimum Viable (Laptop)

```yaml
GPU: 4 GB VRAM (GTX 1650, M1)
Modèle: llama-3.2-3b Q4_K_M
Embeddings: all-minilm (384 dims)
HNSW: M=12, efConstruction=100
Index max: ~20,000 vecteurs
```

### Recommandé (Desktop Gaming)

```yaml
GPU: 8-12 GB VRAM (RTX 3060/3070/4060)
Modèle: devstral-7b Q4_K_M
Embeddings: nomic-embed-text (768 dims)
HNSW: M=16, efConstruction=200
Index max: ~100,000 vecteurs
```

### Optimal (Workstation)

```yaml
GPU: 16+ GB VRAM (RTX 4080/4090, A4000)
Modèle: deepseek-coder-33b Q5_K_M
Embeddings: mxbai-embed-large (1024 dims)
HNSW: M=32, efConstruction=400
Index max: ~500,000 vecteurs
```

---

## 7. Troubleshooting

### Problème : "CUDA out of memory"

```typescript
// Solution : Réduire les layers GPU
const recommendation = gpu.calculateOffloadRecommendation(modelSizeMB);
// Utiliser recommendation.suggestedGpuLayers avec llama.cpp --n-gpu-layers
```

### Problème : "Ollama connection refused"

```bash
# Vérifier que Ollama tourne
ollama serve

# Ou via Docker
docker run -d -v ollama:/root/.ollama -p 11434:11434 ollama/ollama
```

### Problème : "Embeddings dimensions mismatch"

```typescript
// Vérifier la cohérence
const embedderDims = embedder.getDimensions();
const storeDims = store.getDimensions();

if (embedderDims !== storeDims) {
  console.error(`Mismatch: embedder=${embedderDims}, store=${storeDims}`);
  // Recréer le store avec les bonnes dimensions
}
```

### Problème : "HNSW search returns wrong results"

```typescript
// Augmenter efSearch pour plus de précision
store.setEfSearch(200); // Par défaut: 50

// Ou reconstruire avec efConstruction plus élevé
const newStore = new HNSWVectorStore({
  dimensions: 768,
  efConstruction: 400, // Augmenté
});
```

---

## 8. KV-Cache Configuration : Optimiser la Mémoire d'Inférence

### Le Problème

Avec llama.cpp ou LM Studio, les valeurs par défaut sont souvent sous-optimales :

```bash
# Contexte limité, pas de quantification KV
llama-server --model qwen2.5-7b.gguf -c 4096
# Utilise ~2GB pour le KV-cache en FP16
```

### La Solution

```typescript
import {
  KVCacheManager,
  getKVCacheManager,
  MODEL_ARCHITECTURES
} from './inference/kv-cache-config.js';

// Initialisation avec détection d'architecture
const kvManager = getKVCacheManager({
  contextLength: 16384,
  kvQuantization: 'q8_0',  // Réduit mémoire de 50%
  flashAttention: true,
});

// Configurer pour un modèle spécifique
kvManager.setArchitecture('qwen2.5-7b-instruct');

// Estimation mémoire
const estimate = kvManager.estimateMemory();
console.log(`KV-Cache: ${estimate.gpuMemoryMB} MB`);
console.log(`Fits in VRAM: ${estimate.fitsInVRAM ? '✅' : '❌'}`);
console.log(`Recommendation: ${estimate.recommendation}`);

// Générer les arguments llama.cpp
const args = kvManager.generateLlamaCppArgs();
// ['-c', '16384', '-b', '512', '--cache-type-k', 'q8_0', '--cache-type-v', 'q8_0', '-fa']
```

### Architectures Supportées

| Modèle | Layers | Embed | Heads | KV-Heads | GQA |
|--------|--------|-------|-------|----------|-----|
| `qwen2.5-7b` | 28 | 3584 | 28 | 4 | ✅ |
| `qwen2.5-14b` | 40 | 5120 | 40 | 8 | ✅ |
| `llama-3.1-8b` | 32 | 4096 | 32 | 8 | ✅ |
| `devstral-7b` | 32 | 4096 | 32 | 8 | ✅ |
| `deepseek-coder-6.7b` | 32 | 4096 | 32 | 32 | MHA |

### Types de Quantification KV

![KV-Cache et Quantization](images/kv-cache-quantization.svg)

### Optimisation Automatique par VRAM

```typescript
// Optimisation automatique selon VRAM disponible
const optimized = kvManager.optimizeForVRAM(8000, 4000); // 8GB VRAM, 4GB modèle

// Résultat pour 4GB disponibles :
// {
//   contextLength: 8192,
//   kvQuantization: 'q8_0',
//   offloadMode: 'full_gpu',
//   flashAttention: true
// }
```

---

## 9. Speculative Decoding : Accélérer la Génération

### Le Problème

La génération auto-régressive est lente : 1 token = 1 forward pass.

```
Standard: Token1 → Token2 → Token3 → Token4 → Token5
          100ms    100ms    100ms    100ms    100ms = 500ms
```

### La Solution : Draft & Verify

```typescript
import {
  SpeculativeDecoder,
  getSpeculativeDecoder,
  RECOMMENDED_PAIRS
} from './inference/speculative-decoding.js';

// Créer un décodeur avec modèle draft rapide
const decoder = getSpeculativeDecoder({
  draftModel: 'qwen2.5-0.5b',       // Petit modèle rapide
  targetModel: 'qwen2.5-7b',        // Grand modèle de vérification
  speculationLength: 4,             // Tokens à spéculer
  acceptanceThreshold: 0.8,
});

// Génération accélérée
const result = await decoder.generate(
  'Explain quantum computing',
  async (prompt) => callDraftModel(prompt),
  async (prompt, tokens) => verifyWithTarget(prompt, tokens)
);

// Stats de performance
const stats = decoder.getStats();
console.log(`Acceptance rate: ${(stats.acceptanceRate * 100).toFixed(1)}%`);
console.log(`Speedup: ${stats.speedup.toFixed(2)}x`);
```

### Comment Ça Marche

![Speculative Decoding](images/speculative-decoding.svg)

### Paires Draft/Target Recommandées

| Target Model | Draft Model | Speedup Typique |
|-------------|-------------|-----------------|
| `qwen2.5-7b` | `qwen2.5-0.5b` | 2-3x |
| `qwen2.5-14b` | `qwen2.5-1.5b` | 2-2.5x |
| `llama-3.1-8b` | `llama-3.2-1b` | 2-3x |
| `devstral-7b` | `qwen2.5-0.5b` | 2-2.5x |

### Speculation Adaptative

```typescript
// Le décodeur ajuste automatiquement la longueur de spéculation
decoder.on('adaptiveAdjust', (event) => {
  console.log(`Adjusted speculation: ${event.oldLength} → ${event.newLength}`);
  console.log(`Reason: ${event.reason}`);
});

// Si acceptanceRate < 50% → réduit speculation
// Si acceptanceRate > 90% → augmente speculation
```

---

## 10. Benchmark Suite : Mesurer les Performances

### Le Problème

Sans métriques, impossible d'optimiser :

```
"Mon modèle semble rapide..." → Non mesurable
"Mon modèle génère 45 tok/s avec TTFT 180ms" → Actionnable
```

### La Solution

```typescript
import {
  BenchmarkSuite,
  getBenchmarkSuite,
  DEFAULT_PROMPTS
} from './performance/benchmark-suite.js';

// Créer une suite de benchmarks
const suite = getBenchmarkSuite({
  warmupRuns: 2,      // Échauffement
  runs: 10,           // Mesures
  concurrency: 1,     // Séquentiel ou parallèle
  timeout: 60000,     // Timeout par run
});

// Callback pour mesurer votre modèle
const callback = async (prompt, onFirstToken) => {
  const response = await myLLM.generate(prompt, {
    onToken: (token, isFirst) => {
      if (isFirst && onFirstToken) onFirstToken();
    }
  });
  return {
    content: response.text,
    inputTokens: response.usage.input,
    outputTokens: response.usage.output,
  };
};

// Exécuter les benchmarks
suite.on('run', (event) => {
  console.log(`Run ${event.runIndex}/${event.totalRuns}: ${event.latencyMs}ms`);
});

const results = await suite.run('qwen2.5-7b-Q4', callback);

// Afficher les résultats formatés
console.log(suite.formatResults(results));
```

### Métriques Clés

![Benchmark Results](images/benchmark-results.svg)

### Comparaison de Modèles

```typescript
// Benchmark du premier modèle
const results1 = await suite.run('qwen2.5-7b-Q4', callback1);

// Benchmark du second modèle
const results2 = await suite.run('qwen2.5-7b-Q8', callback2);

// Comparaison
const comparison = suite.compare(results1, results2);
console.log(`TTFT: ${comparison.ttft.improved ? '✅ Improved' : '❌ Degraded'}`);
console.log(`  ${comparison.ttft.baseline}ms → ${comparison.ttft.current}ms`);
console.log(`  ${comparison.ttft.percentChange > 0 ? '+' : ''}${comparison.ttft.percentChange.toFixed(1)}%`);
```

### Prompts de Test par Catégorie

| Catégorie | Prompt | Mesure |
|-----------|--------|--------|
| `simple` | "What is 2+2?" | Latence minimale |
| `code` | "Write a function to sort an array" | Génération code |
| `reasoning` | "Explain quantum entanglement" | Raisonnement long |
| `creative` | "Write a haiku about programming" | Créativité |

---

## 11. Schema Validator : Structured Output Fiable

### Le Problème

Les LLM génèrent du texte libre, mais vous avez besoin de JSON structuré :

```typescript
// ❌ Réponse non structurée
"I would use the read_file tool with path /tmp/test.txt"

// ✅ Réponse structurée
{ "tool": "read_file", "arguments": { "path": "/tmp/test.txt" } }
```

### La Solution

```typescript
import {
  SchemaValidator,
  getSchemaValidator,
  TOOL_CALL_SCHEMA,
  ACTION_PLAN_SCHEMA
} from './utils/schema-validator.js';

// Créer un validateur avec coercion de types
const validator = getSchemaValidator({
  coerceTypes: true,      // "123" → 123
  removeAdditional: true, // Supprimer propriétés inconnues
  useDefaults: true,      // Appliquer les valeurs par défaut
});

// Définir un schema personnalisé
const schema = {
  type: 'object',
  properties: {
    action: { type: 'string', enum: ['read', 'write', 'delete'] },
    path: { type: 'string', minLength: 1 },
    content: { type: 'string' }
  },
  required: ['action', 'path']
};

// Valider une réponse LLM
const llmResponse = `Here's what I'll do:
\`\`\`json
{"action": "read", "path": "/tmp/test.txt"}
\`\`\``;

const result = validator.validateResponse(llmResponse, schema);

if (result.valid) {
  console.log('Validated data:', result.data);
  // { action: 'read', path: '/tmp/test.txt' }
} else {
  console.log('Validation errors:', result.errors);
}
```

### Extraction JSON Intelligente

```typescript
// Le validateur extrait le JSON de n'importe quel format

// ✅ JSON direct
validator.extractJSON('{"name": "test"}');

// ✅ Code block markdown
validator.extractJSON('Here is the result:\n```json\n{"name": "test"}\n```');

// ✅ JSON entouré de texte
validator.extractJSON('The answer is {"name": "test"} as requested.');

// ✅ Correction des trailing commas
validator.extractJSON('{"name": "test",}'); // → {"name": "test"}
```

### Schemas Prédéfinis

```typescript
import {
  TOOL_CALL_SCHEMA,     // Pour les appels d'outils
  ACTION_PLAN_SCHEMA,   // Pour les plans d'action
  CODE_EDIT_SCHEMA      // Pour les éditions de code
} from './utils/schema-validator.js';

// TOOL_CALL_SCHEMA
// {
//   tool: string (required),
//   arguments: object (required),
//   reasoning?: string
// }

// ACTION_PLAN_SCHEMA
// {
//   goal: string (required),
//   steps: [{ action: string, description: string }] (required),
//   estimatedSteps?: number
// }

// CODE_EDIT_SCHEMA
// {
//   file: string (required),
//   operation: 'create' | 'replace' | 'delete' (required),
//   oldContent?: string,
//   newContent?: string
// }
```

### Coercion de Types

| Input | Schema Type | Output |
|-------|-------------|--------|
| `"123"` | `number` | `123` |
| `"true"` | `boolean` | `true` |
| `1` | `boolean` | `true` |
| `123` | `string` | `"123"` |
| `["a", 1]` | `array<string>` | `["a", "1"]` |

### Génération de Prompts

```typescript
// Générer un prompt qui guide le LLM vers le bon format
const prompt = validator.createSchemaPrompt(schema);
// "Respond with valid JSON matching this schema:
//  {
//    action: string (one of: read, write, delete),
//    path: string (minimum 1 character),
//    content?: string
//  }
//  Required: action, path"
```

---

## Points Clés

| Concept | À Retenir |
|---------|-----------|
| **GPU Monitor** | Toujours vérifier VRAM avant de charger un modèle |
| **Ollama** | Embeddings gratuits, `nomic-embed-text` recommandé |
| **HNSW** | O(log N), pas de dépendances, persistance JSON |
| **Quantization** | Q4_K_M = meilleur compromis qualité/taille |
| **Pipeline** | GPU Check → Embed → Store → Search → Generate |
| **KV-Cache** | Quantification q8_0 = -50% mémoire, qualité préservée |
| **Speculative** | Draft + Target = 2-3x speedup génération |
| **Benchmark** | TTFT, TPS, p95 = métriques essentielles |
| **Schema** | Structured output = tool calling fiable |

---

| ← Précédent | Suivant → |
|:-----------:|:---------:|
| [Ch.18 : Productivité CLI](18-productivite-cli.md) | [Annexe A : Transformers](annexe-a-transformers.md) |
