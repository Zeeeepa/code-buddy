# Chapitre 12 : Cache Sémantique — 68% de Requêtes en Moins

---

## 1. Le Problème

Une semaine de logs : 68% des requêtes sont des variations de la même question. "ls", "liste les fichiers", "montre le contenu du dossier" — trois façons de demander la même chose. Trois appels API. Trois fois $0.03.

**L'erreur classique** : Un cache exact qui compare caractère par caractère. "ls" ≠ "liste les fichiers" → cache miss → nouvel appel API.

```typescript
// ❌ Cache exact - ne trouve rien
const cache = new Map<string, string>();
cache.get("ls");                    // "result A"
cache.get("liste les fichiers");    // undefined - MISS !

// ✅ Cache sémantique - comprend le sens
const result = await semanticCache.get("liste les fichiers");
// Trouve "ls" avec similarité 0.94 → HIT !
```

---

## 2. La Solution Rapide : Cache Sémantique en 50 Lignes

```typescript
class SemanticCache {
  private entries: Map<string, { query: string; embedding: number[]; response: string }> = new Map();
  private embedder: Embedder;
  private threshold = 0.92;

  async get(query: string): Promise<string | null> {
    const queryEmbedding = await this.embedder.embed(query);

    let bestMatch: string | null = null;
    let bestSimilarity = 0;

    for (const entry of this.entries.values()) {
      const similarity = this.cosineSimilarity(queryEmbedding, entry.embedding);
      if (similarity > bestSimilarity && similarity >= this.threshold) {
        bestSimilarity = similarity;
        bestMatch = entry.response;
      }
    }

    return bestMatch;
  }

  async set(query: string, response: string): Promise<void> {
    const embedding = await this.embedder.embed(query);
    const id = Date.now().toString();
    this.entries.set(id, { query, embedding, response });
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] ** 2;
      normB += b[i] ** 2;
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

// Utilisation
const cache = new SemanticCache(embedder);
await cache.set("ls", "file1.ts, file2.ts, file3.ts");

const result = await cache.get("liste les fichiers");
// → "file1.ts, file2.ts, file3.ts" (similarité 0.94)
```

---

## 3. Deep Dive : Anatomie du Cache Sémantique

### 3.1 La Similarité Cosine

Deux textes qui signifient la même chose → vecteurs proches dans l'espace des embeddings.

```
                    A · B           Σ(aᵢ × bᵢ)
cos(θ) = ─────────────────── = ──────────────────────
               ||A|| × ||B||     √Σaᵢ² × √Σbᵢ²
```

| Similarité | Signification |
|:----------:|---------------|
| 1.0 | Identique |
| 0.95+ | Très similaire (safe pour cache) |
| 0.90-0.95 | Similaire (acceptable) |
| 0.85-0.90 | Vaguement lié (risqué) |
| < 0.85 | Non lié |

### 3.2 Types de Redondance

| Type | Exemple | Détection | Cache |
|------|---------|-----------|:-----:|
| **Exact** | `"ls"` → `"ls"` | Hash | Trivial |
| **Sémantique** | `"ls"` → `"liste les fichiers"` | Embeddings | ✅ |
| **Paramétrique** | `"lis config.ts"` → `"lis utils.ts"` | Template | Partiel |
| **Contextuel** | Même question, contexte différent | N/A | ❌ |

### 3.3 Implémentation Production

```typescript
interface CacheEntry {
  id: string;
  query: string;
  queryEmbedding: number[];
  response: string;
  createdAt: Date;
  accessCount: number;
  lastAccess: Date;
  metadata: { model: string; tokens: number };
}

class ProductionSemanticCache {
  private entries = new Map<string, CacheEntry>();
  private readonly maxEntries = 10_000;
  private readonly ttlMs = 7 * 24 * 60 * 60 * 1000;  // 7 jours
  private readonly threshold = 0.92;

  async get(query: string): Promise<CacheResult | null> {
    const queryEmbedding = await this.embedder.embed(query);

    let best: CacheEntry | null = null;
    let bestSimilarity = 0;

    for (const entry of this.entries.values()) {
      // Vérifier TTL
      if (Date.now() - entry.createdAt.getTime() > this.ttlMs) {
        this.entries.delete(entry.id);
        continue;
      }

      const similarity = this.cosineSimilarity(queryEmbedding, entry.queryEmbedding);
      if (similarity > bestSimilarity && similarity >= this.threshold) {
        bestSimilarity = similarity;
        best = entry;
      }
    }

    if (best) {
      best.accessCount++;
      best.lastAccess = new Date();
      return { response: best.response, similarity: bestSimilarity, originalQuery: best.query };
    }

    return null;
  }

  async set(query: string, response: string, metadata: CacheEntry['metadata']): Promise<void> {
    if (this.entries.size >= this.maxEntries) {
      this.evictLeastValuable();
    }

    const embedding = await this.embedder.embed(query);
    const entry: CacheEntry = {
      id: crypto.randomUUID(),
      query,
      queryEmbedding: embedding,
      response,
      createdAt: new Date(),
      accessCount: 0,
      lastAccess: new Date(),
      metadata
    };

    this.entries.set(entry.id, entry);
  }

  // LRU pondéré par fréquence
  private evictLeastValuable(): void {
    let victim: CacheEntry | null = null;
    let lowestScore = Infinity;

    for (const entry of this.entries.values()) {
      const ageHours = (Date.now() - entry.createdAt.getTime()) / 3600000;
      const score = entry.accessCount / Math.max(ageHours, 1);
      if (score < lowestScore) {
        lowestScore = score;
        victim = entry;
      }
    }

    if (victim) this.entries.delete(victim.id);
  }
}
```

---

## 4. Edge Cases et Pièges

### Piège 1 : Faux positifs avec seuil trop bas

```typescript
// ❌ Seuil de 0.85 = trop permissif
const cache = new SemanticCache({ threshold: 0.85 });
await cache.set("supprimer le fichier test.ts", "Fichier supprimé");

// "lire le fichier test.ts" trouve "supprimer" avec similarité 0.87
const result = await cache.get("lire le fichier test.ts");
// Retourne "Fichier supprimé" - FAUX POSITIF DANGEREUX !

// ✅ Seuil de 0.92 = plus sûr
const cache = new SemanticCache({ threshold: 0.92 });
// "lire" et "supprimer" ont similarité ~0.78 → miss → nouvel appel
```

**Contournement** : Seuil ≥ 0.92 en production. Commencer conservateur (0.95), baisser progressivement.

### Piège 2 : Cache qui ne s'invalide pas

```typescript
// ❌ Fichier modifié mais cache obsolète
await cache.set("contenu de config.ts", "const port = 3000;");
// L'utilisateur modifie config.ts → port = 8080
await cache.get("lis config.ts");
// Retourne l'ancienne valeur !

// ✅ Invalidation sur modification de fichier
class InvalidatingCache extends SemanticCache {
  private fileWatcher: FSWatcher;

  constructor() {
    super();
    this.fileWatcher = watch('.', { recursive: true });
    this.fileWatcher.on('change', (_, filename) => {
      this.invalidateRelated(filename);
    });
  }

  private invalidateRelated(filename: string): void {
    for (const [id, entry] of this.entries) {
      if (entry.query.includes(filename)) {
        this.entries.delete(id);
      }
    }
  }
}
```

**Contournement** : Watcher filesystem + invalidation ciblée.

### Piège 3 : Lookup O(n) sur gros cache

```typescript
// ❌ 10K entrées × 1 embedding = lent
async get(query: string): Promise<CacheResult | null> {
  for (const entry of this.entries.values()) {  // O(n)
    const similarity = this.cosineSimilarity(...);
  }
}

// ✅ LSH (Locality-Sensitive Hashing) pour O(1)
import { LSH } from 'lsh-lib';

class FastSemanticCache {
  private lsh = new LSH({ dimensions: 384, numHashTables: 10 });

  async get(query: string): Promise<CacheResult | null> {
    const embedding = await this.embedder.embed(query);
    const candidates = this.lsh.query(embedding);  // O(1)

    // Comparer seulement avec les candidats (~10 au lieu de 10K)
    for (const candidate of candidates) {
      const similarity = this.cosineSimilarity(embedding, candidate.embedding);
      if (similarity >= this.threshold) return candidate;
    }
    return null;
  }
}
```

**Contournement** : LSH pour caches > 1000 entrées.

---

## 5. Optimisation : Cache des Outils

Les outils déterministes peuvent aussi être cachés :

```typescript
class ToolCache {
  private cache = new LRUCache<string, ToolResult>({ max: 1000 });

  // Configuration par outil
  private config: Record<string, { enabled: boolean; ttl: number }> = {
    'read_file': { enabled: true, ttl: 10 * 60 * 1000 },    // 10 min
    'list_directory': { enabled: true, ttl: 2 * 60 * 1000 }, // 2 min
    'git_status': { enabled: false, ttl: 0 },                // Trop volatil
    'bash': { enabled: false, ttl: 0 }                       // Side effects
  };

  async get(tool: string, args: Record<string, unknown>): Promise<ToolResult | null> {
    const cfg = this.config[tool];
    if (!cfg?.enabled) return null;

    const key = `${tool}:${JSON.stringify(args)}`;
    const entry = this.cache.get(key);
    return entry || null;
  }

  async set(tool: string, args: Record<string, unknown>, result: ToolResult): Promise<void> {
    const cfg = this.config[tool];
    if (!cfg?.enabled || !result.success) return;

    const key = `${tool}:${JSON.stringify(args)}`;
    this.cache.set(key, result, { ttl: cfg.ttl });
  }

  // Invalidation sur écriture
  invalidate(path: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(path)) this.cache.delete(key);
    }
  }
}
```

| Outil | Cacheable | TTL | Raison |
|-------|:---------:|:---:|--------|
| `read_file` | ✅ | 10 min | Stable jusqu'à modification |
| `list_directory` | ✅ | 2 min | Change rarement |
| `search_content` | ✅ | 15 min | Stable par session |
| `git_status` | ❌ | - | Trop volatil |
| `bash` | ❌ | - | Side effects |

---

## 6. Tuning du Seuil

| Seuil | Hit Rate | Faux Positifs | Recommandation |
|:-----:|:--------:|:-------------:|----------------|
| 0.99 | ~25% | ~0% | Ultra-conservateur |
| 0.95 | ~50% | ~1% | **Production recommandé** |
| 0.92 | ~65% | ~3% | Équilibré (défaut) |
| 0.90 | ~72% | ~5% | Agressif |
| 0.85 | ~80% | ~12% | Risque qualité |

---

## 7. Context Warnings Multi-Seuils (Inspiré de Mistral-Vibe)

### Le Problème

L'utilisateur ne sait pas qu'il approche de la limite de contexte. Soudain : "Error: Maximum context length exceeded". Frustration garantie.

### Solution : Warnings Progressifs

```typescript
interface ContextManagerConfig {
  warningThresholds: number[];  // [50, 75, 90]
  autoCompactThreshold: number; // 200_000 tokens
  enableWarnings: boolean;
}

class ContextManagerV2 {
  private triggeredWarnings: Set<number> = new Set();

  shouldWarn(messages: Message[]): WarningResult {
    const stats = this.getStats(messages);
    const thresholds = [90, 75, 50];  // Ordre décroissant

    for (const threshold of thresholds) {
      if (stats.usagePercent >= threshold && !this.triggeredWarnings.has(threshold)) {
        this.triggeredWarnings.add(threshold);  // Ne warn qu'une fois

        return {
          warn: true,
          message: this.formatWarning(threshold, stats),
          threshold,
        };
      }
    }

    return { warn: false, message: '' };
  }

  private formatWarning(threshold: number, stats: ContextStats): string {
    const emoji = threshold >= 90 ? '🔴' : threshold >= 75 ? '🟡' : '🟢';
    const level = threshold >= 90 ? 'Critical' : threshold >= 75 ? 'Warning' : 'Notice';

    return `${emoji} Context ${level}: ${stats.usagePercent.toFixed(1)}% used (${stats.totalTokens.toLocaleString()}/${stats.maxTokens.toLocaleString()} tokens)`;
  }
}
```

### Auto-Compact (comme Mistral-Vibe)

```typescript
prepareMessages(messages: Message[]): Message[] {
  const stats = this.getStats(messages);

  // Déclencher auto-compact à 200K tokens
  if (stats.totalTokens >= this.config.autoCompactThreshold) {
    console.log('📦 Auto-compact triggered...');

    const optimized = this.applyStrategies(messages);
    const newStats = this.getStats(optimized);

    console.log(`📦 Reduced ${(stats.totalTokens - newStats.totalTokens).toLocaleString()} tokens`);
    return optimized;
  }

  return messages;
}
```

### Affichage dans le Terminal

```
🟢 Context Notice: 52.3% used (104,600/200,000 tokens)
    ...conversation continues...
🟡 Context Warning: 76.1% used (152,200/200,000 tokens)
    ...conversation continues...
🔴 Context Critical: 91.2% used (182,400/200,000 tokens)
📦 Auto-compact: Reduced 45,000 tokens (182,400 → 137,400)
```

### Configuration

| Seuil | Emoji | Action |
|:-----:|:-----:|--------|
| 50% | 🟢 | Notification informative |
| 75% | 🟡 | Avertissement |
| 90% | 🔴 | Critique + auto-compact proche |
| 100% | 📦 | Auto-compact déclenché |

---

## Tableau Récapitulatif

| Métrique | Sans Cache | Avec Cache Sémantique | Amélioration |
|----------|:----------:|:---------------------:|:------------:|
| Requêtes API/jour | 10,000 | 3,200 | **-68%** |
| Coût/jour | $500 | $170 | **-66%** |
| Latence moyenne | 1,200ms | 420ms | **-65%** |
| Latence P99 | 3,500ms | 1,800ms | **-49%** |

---

## Ce Qui Vient Ensuite

Le cache optimise les sorties, mais l'agent reçoit toujours 41 outils à chaque requête. Le **Chapitre 13** introduit les optimisations système : filtrage d'outils, routing de modèles, et parallélisation — pour diviser les coûts par trois.

---

[Chapitre 11](11-plugins-mcp.md) | [Table des Matières](README.md) | [Chapitre 13](13-optimisations-systeme.md)
