/**
 * Chrome Bridge
 *
 * Native Messaging API bridge for Chrome extension integration.
 * Provides stubs for browser interaction (console, DOM, network, recording).
 */

import { logger } from '../utils/logger.js';

// ============================================================================
// Types
// ============================================================================

export interface ChromeBridgeConfig {
  port: number;
  extensionId?: string;
}

export interface DOMElementInfo {
  tagName: string;
  id?: string;
  className?: string;
  textContent?: string;
  attributes: Record<string, string>;
  children: number;
}

export interface NetworkRequest {
  url: string;
  method: string;
  status: number;
  type: string;
  timestamp: number;
}

export interface RecordedAction {
  type: 'click' | 'input' | 'navigation' | 'scroll';
  target: string;
  value?: string;
  timestamp: number;
}

// ============================================================================
// ChromeBridge (Singleton)
// ============================================================================

let instance: ChromeBridge | null = null;

export class ChromeBridge {
  private config: ChromeBridgeConfig;
  private connected: boolean = false;
  private recording: boolean = false;
  private recordedActions: RecordedAction[] = [];
  private consoleErrors: string[] = [];
  private networkRequests: NetworkRequest[] = [];

  private constructor(config?: Partial<ChromeBridgeConfig>) {
    this.config = {
      port: config?.port ?? 9222,
      extensionId: config?.extensionId,
    };
  }

  static getInstance(config?: Partial<ChromeBridgeConfig>): ChromeBridge {
    if (!instance) {
      instance = new ChromeBridge(config);
    }
    return instance;
  }

  static resetInstance(): void {
    if (instance) {
      instance.connected = false;
      instance.recording = false;
      instance.recordedActions = [];
      instance.consoleErrors = [];
      instance.networkRequests = [];
    }
    instance = null;
  }

  /**
   * Establish connection to Chrome
   */
  async connect(port?: number): Promise<boolean> {
    if (port !== undefined) {
      this.config.port = port;
    }
    this.connected = true;
    logger.debug(`Chrome bridge connected on port ${this.config.port}`);
    return true;
  }

  /**
   * Close connection
   */
  async disconnect(): Promise<void> {
    this.connected = false;
    this.recording = false;
    logger.debug('Chrome bridge disconnected');
  }

  /**
   * Check connection state
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get captured console errors (stub)
   */
  async getConsoleErrors(): Promise<string[]> {
    if (!this.connected) {
      throw new Error('Not connected to Chrome');
    }
    return [...this.consoleErrors];
  }

  /**
   * Get DOM element info (stub)
   */
  async getDOMState(selector: string): Promise<DOMElementInfo | null> {
    if (!this.connected) {
      throw new Error('Not connected to Chrome');
    }
    // Stub: return a mock element
    return {
      tagName: 'div',
      id: selector.startsWith('#') ? selector.slice(1) : undefined,
      className: selector.startsWith('.') ? selector.slice(1) : undefined,
      textContent: '',
      attributes: {},
      children: 0,
    };
  }

  /**
   * Get captured network requests (stub)
   */
  async getNetworkRequests(filter?: string): Promise<NetworkRequest[]> {
    if (!this.connected) {
      throw new Error('Not connected to Chrome');
    }
    if (filter) {
      return this.networkRequests.filter(r => r.url.includes(filter));
    }
    return [...this.networkRequests];
  }

  /**
   * Execute JavaScript in browser (stub)
   */
  async executeScript(script: string): Promise<unknown> {
    if (!this.connected) {
      throw new Error('Not connected to Chrome');
    }
    logger.debug(`Executing script: ${script.slice(0, 100)}`);
    return undefined;
  }

  /**
   * Start recording user actions
   */
  async startRecording(): Promise<void> {
    if (!this.connected) {
      throw new Error('Not connected to Chrome');
    }
    this.recording = true;
    this.recordedActions = [];
    logger.debug('Started recording');
  }

  /**
   * Stop recording user actions
   */
  async stopRecording(): Promise<void> {
    this.recording = false;
    logger.debug('Stopped recording');
  }

  /**
   * Get recorded actions
   */
  getRecording(): RecordedAction[] {
    return [...this.recordedActions];
  }

  /**
   * Check if currently recording
   */
  isRecording(): boolean {
    return this.recording;
  }

  /**
   * Get config
   */
  getConfig(): ChromeBridgeConfig {
    return { ...this.config };
  }
}
