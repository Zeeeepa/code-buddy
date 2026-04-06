/**
 * Desktop Module
 *
 * Public API for the Code Buddy desktop integration.
 * Exports the engine adapter, bridges, launcher, and installer.
 *
 * @module desktop
 */

export type { EngineAdapter, EngineStreamCallback, EnginePermissionCallback } from './engine-adapter.js';
export { CodeBuddyEngineAdapter } from './codebuddy-engine-adapter.js';
export { DesktopPermissionBridge } from './permission-bridge.js';
export { MCPToolBridge } from './mcp-bridge.js';
export { SandboxPathBridge } from './sandbox-bridge.js';
export { launchDesktop, isElectronAvailable } from './launcher.js';
export { installGUI, isGUIInstalled } from './installer.js';
export { DesktopAppManager } from './desktop-app.js';
