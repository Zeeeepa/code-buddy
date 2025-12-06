import { ChatEntry } from "../../agent/grok-agent.js";
import { getCostTracker } from "../../utils/cost-tracker.js";
import { getPerformanceManager } from "../../performance/index.js";
import { getResponseCache } from "../../utils/response-cache.js";
import { getSelfHealingEngine } from "../../utils/self-healing.js";

export interface CommandHandlerResult {
  handled: boolean;
  entry?: ChatEntry;
  passToAI?: boolean;
  prompt?: string;
}

/**
 * Cost - Track API usage costs
 */
export function handleCost(args: string[]): CommandHandlerResult {
  const costTracker = getCostTracker();
  const action = args[0]?.toLowerCase();

  let content: string;

  switch (action) {
    case "budget":
      if (args[1]) {
        const budget = parseFloat(args[1]);
        costTracker.setBudgetLimit(budget);
        content = `💰 Session budget set to $${budget.toFixed(2)}`;
      } else {
        content = `Usage: /cost budget <amount>`;
      }
      break;

    case "daily":
      if (args[1]) {
        const daily = parseFloat(args[1]);
        costTracker.setDailyLimit(daily);
        content = `📅 Daily limit set to $${daily.toFixed(2)}`;
      } else {
        content = `Usage: /cost daily <amount>`;
      }
      break;

    case "export":
      const report = costTracker.getReport();
      content = `📊 Cost Report\n\n${JSON.stringify(report, null, 2)}`;
      break;

    case "reset":
      costTracker.resetSession();
      content = `🔄 Cost tracking reset`;
      break;

    case "status":
    default:
      content = costTracker.formatDashboard();
      break;
  }

  return {
    handled: true,
    entry: {
      type: "assistant",
      content,
      timestamp: new Date(),
    },
  };
}

/**
 * Stats - Show performance statistics
 */
export function handleStats(args: string[]): CommandHandlerResult {
  const perfManager = getPerformanceManager();
  const action = args[0]?.toLowerCase();

  let content: string;

  switch (action) {
    case "cache":
      const toolCache = perfManager.getToolCache();
      if (toolCache) {
        const stats = toolCache.getStats();
        content = `🗃️ Tool Cache Statistics

Hits: ${stats.hits}
Misses: ${stats.misses}
Hit Rate: ${(stats.hitRate * 100).toFixed(1)}%
Saved Calls: ${stats.savedCalls}
Estimated Time Saved: ${(stats.savedTime / 1000).toFixed(1)}s`;
      } else {
        content = `⚠️ Tool cache not initialized`;
      }
      break;

    case "requests":
      const reqOptimizer = perfManager.getRequestOptimizer();
      if (reqOptimizer) {
        const stats = reqOptimizer.getStats();
        content = `📡 Request Optimizer Statistics

Total Requests: ${stats.totalRequests}
Successful: ${stats.successfulRequests}
Failed: ${stats.failedRequests}
Retried: ${stats.retriedRequests}
Deduplicated: ${stats.deduplicatedRequests}
Average Latency: ${stats.averageLatency.toFixed(0)}ms
Current Concurrency: ${stats.currentConcurrency}`;
      } else {
        content = `⚠️ Request optimizer not initialized`;
      }
      break;

    case "reset":
      perfManager.resetStats();
      content = `🔄 Performance statistics reset`;
      break;

    case "summary":
    default:
      const summary = perfManager.getSummary();
      content = `📊 Performance Summary

🧩 Lazy Loader
  Loaded: ${summary.lazyLoader.loadedModules}/${summary.lazyLoader.totalModules} modules
  Avg Load Time: ${summary.lazyLoader.averageLoadTime.toFixed(0)}ms

🗃️ Tool Cache
  Hit Rate: ${(summary.toolCache.hitRate * 100).toFixed(1)}%
  Saved Calls: ${summary.toolCache.savedCalls}

📡 Requests
  Total: ${summary.requestOptimizer.totalRequests}
  Deduplicated: ${summary.requestOptimizer.deduplicatedRequests}

🌐 API Cache
  Entries: ${summary.apiCache.entries}
  Hit Rate: ${(summary.apiCache.hitRate * 100).toFixed(1)}%

📈 Overall
  Operations: ${summary.overall.totalOperations}
  Cache Hit Rate: ${(summary.overall.cacheHitRate * 100).toFixed(1)}%
  Time Saved: ${(summary.overall.estimatedTimeSaved / 1000).toFixed(1)}s`;
      break;
  }

  return {
    handled: true,
    entry: {
      type: "assistant",
      content,
      timestamp: new Date(),
    },
  };
}

/**
 * Cache - Manage response cache
 */
export function handleCache(args: string[]): CommandHandlerResult {
  const cache = getResponseCache();
  const action = args[0]?.toLowerCase();

  let content: string;

  switch (action) {
    case "clear":
      cache.clear();
      content = `🗑️ Cache cleared!

All cached responses have been removed.`;
      break;

    case "stats":
      const stats = cache.getStats();
      content = `📊 Cache Statistics

Entries: ${stats.totalEntries}
Size: ${stats.cacheSize}
Hits: ${stats.totalHits}
Misses: ${stats.totalMisses}
Hit Rate: ${stats.totalHits + stats.totalMisses > 0
  ? ((stats.totalHits / (stats.totalHits + stats.totalMisses)) * 100).toFixed(1)
  : 0}%
${stats.oldestEntry ? `Oldest: ${stats.oldestEntry.toLocaleDateString()}` : ''}
${stats.newestEntry ? `Newest: ${stats.newestEntry.toLocaleDateString()}` : ''}`;
      break;

    case "status":
    default:
      content = cache.formatStatus();
      break;
  }

  return {
    handled: true,
    entry: {
      type: "assistant",
      content,
      timestamp: new Date(),
    },
  };
}

/**
 * Self-Healing - Configure auto-correction
 */
export function handleSelfHealing(args: string[]): CommandHandlerResult {
  const engine = getSelfHealingEngine();
  const action = args[0]?.toLowerCase();

  let content: string;

  switch (action) {
    case "on":
      engine.updateOptions({ enabled: true });
      content = `🔧 Self-Healing: ENABLED

The agent will automatically attempt to fix errors when commands fail.
Max retries: ${engine.getOptions().maxRetries}`;
      break;

    case "off":
      engine.updateOptions({ enabled: false });
      content = `🔧 Self-Healing: DISABLED

Errors will be reported without automatic fix attempts.`;
      break;

    case "stats":
      const stats = engine.getStats();
      content = `📊 Self-Healing Statistics

Total Attempts: ${stats.totalAttempts}
Successful: ${stats.successfulHeals}
Failed: ${stats.failedHeals}
Success Rate: ${stats.successRate}`;
      break;

    case "status":
    default:
      const options = engine.getOptions();
      content = `🔧 Self-Healing Status

Enabled: ${options.enabled ? '✅ Yes' : '❌ No'}
Max Retries: ${options.maxRetries}
Auto-Fix: ${options.autoFix ? 'Yes' : 'No'}
Verbose: ${options.verbose ? 'Yes' : 'No'}

Commands:
  /heal on     - Enable self-healing
  /heal off    - Disable self-healing
  /heal stats  - Show healing statistics`;
      break;
  }

  return {
    handled: true,
    entry: {
      type: "assistant",
      content,
      timestamp: new Date(),
    },
  };
}
