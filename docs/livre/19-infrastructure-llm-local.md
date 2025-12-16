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

**Résultat :** Un pipeline RAG entièrement local, zéro dépendance cloud.

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

```
┌─────────────────────────────────────────────────────────────┐
│                      GPUMonitor                              │
├─────────────────────────────────────────────────────────────┤
│  initialize()          │ Détection GPU (nvidia-smi, etc.)   │
│  getStats()            │ VRAM totale/utilisée/libre         │
│  calculateOffloadRecommendation() │ Layers GPU vs CPU      │
│  getRecommendedLayers()│ Pour taille de modèle donnée       │
│  formatStats()         │ Affichage formaté pour CLI         │
├─────────────────────────────────────────────────────────────┤
│  Events: stats, warning, critical                            │
└─────────────────────────────────────────────────────────────┘
```

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

```
Niveau 3:  A ──────────────────── Z
           │                      │
Niveau 2:  A ─── D ─── M ─── R ── Z
           │    │     │     │    │
Niveau 1:  A─B─C─D─E─F─M─N─O─R─S─Z
           │ │ │ │ │ │ │ │ │ │ │ │
Niveau 0:  A B C D E F G H I ... Z (tous les vecteurs)

Recherche : Commencer en haut, descendre en suivant
            les voisins les plus proches
```

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

```
┌─────────────────────────────────────────────────────────────┐
│                    QUANTIZATION GUIDE                        │
├──────────┬────────────┬──────────┬──────────────────────────┤
│ Type     │ Bits/Poids │ Qualité  │ Usage                    │
├──────────┼────────────┼──────────┼──────────────────────────┤
│ Q4_K_M   │ 4.5        │ ⭐⭐⭐⭐   │ Meilleur rapport qualité │
│ Q5_K_M   │ 5.5        │ ⭐⭐⭐⭐⭐  │ Haute qualité, +VRAM     │
│ Q6_K     │ 6.5        │ ⭐⭐⭐⭐⭐  │ Près de FP16             │
│ Q8_0     │ 8.0        │ ⭐⭐⭐⭐⭐  │ Quasi-lossless           │
└──────────┴────────────┴──────────┴──────────────────────────┘

Recommandation :
├── GPU 4-6 GB  → Q4_K_M
├── GPU 8-12 GB → Q5_K_M ou Q6_K
└── GPU 16+ GB  → Q8_0 ou même FP16
```

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

```
┌─────────────────────────────────────────────────────────────┐
│                     RAG Pipeline Local                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. CHECK GPU        2. EMBED           3. STORE             │
│  ┌──────────┐       ┌──────────┐       ┌──────────┐         │
│  │GPUMonitor│──────▶│ Ollama   │──────▶│  HNSW    │         │
│  │ VRAM: OK │       │Embeddings│       │VectorDB  │         │
│  └──────────┘       └──────────┘       └────┬─────┘         │
│                                              │               │
│  4. QUERY           5. RETRIEVE         6. GENERATE         │
│  ┌──────────┐       ┌──────────┐       ┌──────────┐         │
│  │  User    │──────▶│ Top-K    │──────▶│  LLM     │         │
│  │  Query   │       │ Results  │       │ (Local)  │         │
│  └──────────┘       └──────────┘       └──────────┘         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

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

## Points Clés

| Concept | À Retenir |
|---------|-----------|
| **GPU Monitor** | Toujours vérifier VRAM avant de charger un modèle |
| **Ollama** | Embeddings gratuits, `nomic-embed-text` recommandé |
| **HNSW** | O(log N), pas de dépendances, persistance JSON |
| **Quantization** | Q4_K_M = meilleur compromis qualité/taille |
| **Pipeline** | GPU Check → Embed → Store → Search → Generate |

---

| ← Précédent | Suivant → |
|:-----------:|:---------:|
| [Ch.18 : Productivité CLI](18-productivite-cli.md) | [Annexe A : Transformers](annexe-a-transformers.md) |
