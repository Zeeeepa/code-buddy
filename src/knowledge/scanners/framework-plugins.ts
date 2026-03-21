/**
 * Framework Plugins — Declare dynamic entry points per framework/tool
 *
 * Inspired by Knip's plugin system: each plugin knows which functions
 * are invoked dynamically (registries, event emitters, CLI handlers, etc.)
 * and which file patterns are implicit entry points.
 *
 * Used by dead code detection to avoid false positives.
 */

// ============================================================================
// Plugin Interface
// ============================================================================

export interface FrameworkPlugin {
  /** Plugin identifier */
  name: string;
  /** How to detect this framework (file patterns or package.json deps) */
  detect: FrameworkDetector;
  /** Function/method names that are called dynamically (not via static call site) */
  dynamicEntryMethods: string[];
  /** Regex patterns for function FQNs that are entry points */
  entryPatterns?: RegExp[];
  /** File patterns that are implicit entry points (glob-style) */
  entryFilePatterns?: RegExp[];
  /** Module path patterns where all exports are considered used */
  publicApiModules?: RegExp[];
}

export interface FrameworkDetector {
  /** Check if package.json has any of these deps */
  packageDeps?: string[];
  /** Check if any of these files exist */
  filePatterns?: string[];
}

// ============================================================================
// Built-in Plugins
// ============================================================================

const vitestPlugin: FrameworkPlugin = {
  name: 'vitest',
  detect: { packageDeps: ['vitest'] },
  dynamicEntryMethods: ['describe', 'it', 'test', 'expect', 'beforeEach', 'afterEach', 'beforeAll', 'afterAll'],
  entryFilePatterns: [/\.test\.[tj]sx?$/, /\.spec\.[tj]sx?$/, /vitest\.config/],
};

const expressPlugin: FrameworkPlugin = {
  name: 'express',
  detect: { packageDeps: ['express', 'fastify', 'koa', 'hono'] },
  dynamicEntryMethods: ['get', 'post', 'put', 'delete', 'patch', 'use', 'all', 'listen', 'route'],
  entryPatterns: [/^fn:create\w*Server$/, /^fn:create\w*Router$/, /^fn:setup\w*Routes$/],
  publicApiModules: [/\/routes\//, /\/middleware\//],
};

const reactPlugin: FrameworkPlugin = {
  name: 'react',
  detect: { packageDeps: ['react', 'preact', 'solid-js'] },
  dynamicEntryMethods: [
    'render', 'createElement', 'useState', 'useEffect', 'useCallback',
    'useMemo', 'useRef', 'useContext', 'useReducer', 'useLayoutEffect',
    'forwardRef', 'memo', 'lazy', 'Suspense',
  ],
  entryFilePatterns: [/\.tsx$/],
  entryPatterns: [/^fn:[A-Z]\w+$/, /^cls:[A-Z]\w+$/], // PascalCase components
};

const commanderPlugin: FrameworkPlugin = {
  name: 'commander',
  detect: { packageDeps: ['commander', 'yargs', 'cac', 'meow', 'citty'] },
  dynamicEntryMethods: ['command', 'option', 'action', 'parseAsync', 'parse'],
  entryPatterns: [/^fn:register\w*Command/, /^fn:setup\w*CLI/],
  publicApiModules: [/\/commands\//, /\/cli\//],
};

const eventEmitterPlugin: FrameworkPlugin = {
  name: 'events',
  detect: { packageDeps: ['events', 'eventemitter3'] },
  dynamicEntryMethods: [
    'on', 'once', 'emit', 'addListener', 'removeListener',
    'addEventListener', 'removeEventListener', 'off',
    'handleMessage', 'handleEvent', 'onMessage', 'onError', 'onClose',
  ],
  publicApiModules: [/\/channels\//, /\/handlers\//],
};

const playwrightPlugin: FrameworkPlugin = {
  name: 'playwright',
  detect: { packageDeps: ['playwright', 'playwright-core', 'puppeteer'] },
  dynamicEntryMethods: ['goto', 'click', 'fill', 'type', 'press', 'waitForSelector', 'evaluate'],
  entryFilePatterns: [/\.e2e\.[tj]sx?$/, /playwright\.config/],
};

const inkPlugin: FrameworkPlugin = {
  name: 'ink',
  detect: { packageDeps: ['ink', 'ink-testing-library'] },
  dynamicEntryMethods: ['render', 'useApp', 'useInput', 'useStdin', 'useStdout'],
  entryFilePatterns: [/\.tsx$/],
};

const toolRegistryPlugin: FrameworkPlugin = {
  name: 'tool-registry',
  detect: { filePatterns: ['src/tools/registry/'] },
  dynamicEntryMethods: [
    'execute', 'validate', 'getSchema', 'getMetadata', 'isAvailable',
    'run', 'init', 'dispose', 'cleanup',
  ],
  entryPatterns: [/^fn:create\w+Tools?$/, /^fn:register\w+/],
  publicApiModules: [/\/tools\/registry\//, /\/tools\/[^/]+$/],
};

const middlewarePlugin: FrameworkPlugin = {
  name: 'middleware',
  detect: { filePatterns: ['src/agent/middleware/'] },
  dynamicEntryMethods: ['beforeTurn', 'afterTurn', 'beforeResponse', 'afterResponse'],
  publicApiModules: [/\/middleware\//],
};

const channelPlugin: FrameworkPlugin = {
  name: 'channels',
  detect: { filePatterns: ['src/channels/'] },
  dynamicEntryMethods: [
    'start', 'stop', 'handleMessage', 'sendMessage', 'connect', 'disconnect',
    'onMessage', 'onReady', 'onError',
  ],
  entryPatterns: [/^fn:create\w+Adapter$/, /^cls:\w+Adapter$/],
  publicApiModules: [/\/channels\/[^/]+$/],
};

const agentPlugin: FrameworkPlugin = {
  name: 'agents',
  detect: { filePatterns: ['src/agent/specialized/'] },
  dynamicEntryMethods: ['execute', 'run', 'think', 'act', 'plan', 'delegate'],
  entryPatterns: [/^fn:get\w+Agent$/, /^cls:\w+Agent$/],
  publicApiModules: [/\/agent\/specialized\//, /\/agent\/flow\//],
};

const scannerPlugin: FrameworkPlugin = {
  name: 'scanners',
  detect: { filePatterns: ['src/knowledge/scanners/'] },
  dynamicEntryMethods: ['scanFile', 'initialize', 'isReady'],
  publicApiModules: [/\/scanners\//],
};

// ============================================================================
// Plugin Registry
// ============================================================================

const BUILTIN_PLUGINS: FrameworkPlugin[] = [
  vitestPlugin,
  expressPlugin,
  reactPlugin,
  commanderPlugin,
  eventEmitterPlugin,
  playwrightPlugin,
  inkPlugin,
  toolRegistryPlugin,
  middlewarePlugin,
  channelPlugin,
  agentPlugin,
  scannerPlugin,
];

/**
 * Get all framework plugins.
 * In the future, this can be extended to load user-defined plugins from config.
 */
export function getFrameworkPlugins(): FrameworkPlugin[] {
  return BUILTIN_PLUGINS;
}

/**
 * Collect all dynamic entry method names from all plugins.
 * Returns a set for O(1) lookup.
 */
export function getAllDynamicEntryMethods(): Set<string> {
  const methods = new Set<string>();
  for (const plugin of BUILTIN_PLUGINS) {
    for (const method of plugin.dynamicEntryMethods) {
      methods.add(method);
    }
  }
  return methods;
}

/**
 * Collect all entry FQN patterns from all plugins.
 */
export function getAllEntryPatterns(): RegExp[] {
  const patterns: RegExp[] = [];
  for (const plugin of BUILTIN_PLUGINS) {
    if (plugin.entryPatterns) patterns.push(...plugin.entryPatterns);
  }
  return patterns;
}

/**
 * Collect all public API module patterns from all plugins.
 */
export function getAllPublicApiModulePatterns(): RegExp[] {
  const patterns: RegExp[] = [];
  for (const plugin of BUILTIN_PLUGINS) {
    if (plugin.publicApiModules) patterns.push(...plugin.publicApiModules);
  }
  return patterns;
}
