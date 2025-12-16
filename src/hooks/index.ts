/**
 * Hooks module - Event hooks and React hooks for input handling
 *
 * Features:
 * - Event hooks (hook-manager, hook-system)
 * - Lifecycle hooks (pre/post operations)
 * - React hooks for input handling
 */

export * from "./hook-manager.js";
export {
  HookSystem,
  getHookSystem,
  resetHookSystem,
  type HookType,
} from "./hook-system.js";
export * from "./use-enhanced-input.js";
export * from "./use-input-handler.js";
export * from "./use-input-history.js";

// Lifecycle hooks (pre/post operation hooks)
export {
  HooksManager,
  getHooksManager,
  initializeHooks,
  BUILTIN_HOOKS,
  DEFAULT_HOOKS_CONFIG,
  type HookType as LifecycleHookType,
  type HookContext,
  type HookDefinition,
  type HookResult,
  type HooksConfig,
} from "./lifecycle-hooks.js";
