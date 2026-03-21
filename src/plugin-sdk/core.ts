/**
 * Plugin SDK — Core Module
 *
 * Re-exports foundational plugin types and provides helper utilities
 * for defining plugins with a clean, type-safe API.
 */

// Re-export core types from the internal plugin system
export type {
  Plugin,
  PluginManifest,
  PluginContext,
  PluginPermissions,
  PluginProvider,
  PluginProviderType,
  PluginConfigSchema,
  PluginConfigPropertySchema,
  PluginIsolationConfig,
  SearchResult,
  ValidationResult,
} from '../plugins/types.js';

export {
  PluginStatus,
  validateManifest,
  validatePermissions,
  hasPermission,
  validatePluginConfig,
  validateConfigValue,
} from '../plugins/types.js';

/**
 * Current Plugin SDK version.
 * Plugin authors can check this at runtime to ensure compatibility.
 */
export const PluginSDKVersion = '1.0.0';

/**
 * Plugin lifecycle hooks.
 * Extends the base Plugin interface with optional pre/post activation hooks.
 */
export interface PluginLifecycle {
  /** Called before the plugin is activated. Return false to abort activation. */
  onBeforeActivate?(): Promise<boolean> | boolean;

  /** Called after the plugin has been activated successfully. */
  onAfterActivate?(): Promise<void> | void;

  /** Called before the plugin is deactivated. */
  onBeforeDeactivate?(): Promise<void> | void;

  /** Called after the plugin has been deactivated. */
  onAfterDeactivate?(): Promise<void> | void;
}

/**
 * Configuration for definePlugin().
 * Combines a PluginManifest with lifecycle hooks and activation logic.
 */
export interface DefinePluginConfig {
  /** Plugin manifest metadata */
  manifest: import('../plugins/types.js').PluginManifest;

  /** Lifecycle hooks (optional) */
  lifecycle?: PluginLifecycle;

  /**
   * Called when the plugin is activated.
   * This is the main setup function where you register tools, commands, and providers.
   */
  activate(context: import('../plugins/types.js').PluginContext): Promise<void> | void;

  /**
   * Called when the plugin is deactivated.
   * Clean up resources, connections, timers, etc.
   */
  deactivate?(): Promise<void> | void;
}

/**
 * Define a plugin with a clean, declarative API.
 *
 * @example
 * ```ts
 * import { definePlugin } from '@phuetz/code-buddy/plugin-sdk/core';
 *
 * export default definePlugin({
 *   manifest: {
 *     id: 'my-plugin',
 *     name: 'My Plugin',
 *     version: '1.0.0',
 *     description: 'A custom plugin',
 *   },
 *   activate(ctx) {
 *     ctx.logger.info('Plugin activated!');
 *   },
 *   deactivate() {
 *     // cleanup
 *   },
 * });
 * ```
 */
export function definePlugin(config: DefinePluginConfig): import('../plugins/types.js').Plugin {
  return {
    async activate(context) {
      // Run pre-activation hook
      if (config.lifecycle?.onBeforeActivate) {
        const proceed = await config.lifecycle.onBeforeActivate();
        if (proceed === false) {
          context.logger.warn(`Plugin ${config.manifest.id} activation aborted by onBeforeActivate hook`);
          return;
        }
      }

      // Run main activation
      await config.activate(context);

      // Run post-activation hook
      if (config.lifecycle?.onAfterActivate) {
        await config.lifecycle.onAfterActivate();
      }
    },

    async deactivate() {
      // Run pre-deactivation hook
      if (config.lifecycle?.onBeforeDeactivate) {
        await config.lifecycle.onBeforeDeactivate();
      }

      // Run main deactivation
      if (config.deactivate) {
        await config.deactivate();
      }

      // Run post-deactivation hook
      if (config.lifecycle?.onAfterDeactivate) {
        await config.lifecycle.onAfterDeactivate();
      }
    },
  };
}
