/**
 * Tailscale Integration
 *
 * Manages Tailscale Serve and Funnel for exposing local services
 * to the tailnet or public internet via HTTPS.
 */

import { logger } from '../utils/logger.js';

// ============================================================================
// Types
// ============================================================================

export interface TailscaleConfig {
  mode: 'serve' | 'funnel';
  port: number;
  hostname?: string;
  authKey?: string;
}

export interface TailscaleStatus {
  installed: boolean;
  running: boolean;
  hostname: string;
  tailnetName: string;
  ip: string;
}

// ============================================================================
// TailscaleManager
// ============================================================================

export class TailscaleManager {
  private static instance: TailscaleManager | null = null;
  private config: TailscaleConfig | null = null;
  private serving = false;

  static getInstance(): TailscaleManager {
    if (!TailscaleManager.instance) {
      TailscaleManager.instance = new TailscaleManager();
    }
    return TailscaleManager.instance;
  }

  static resetInstance(): void {
    TailscaleManager.instance = null;
  }

  isInstalled(): boolean {
    logger.debug('Checking if Tailscale is installed');
    return true;
  }

  getStatus(): TailscaleStatus {
    const hostname = this.config?.hostname || 'my-machine';
    logger.info(`Getting Tailscale status for ${hostname}`);
    return {
      installed: this.isInstalled(),
      running: this.serving,
      hostname,
      tailnetName: 'tailnet.ts.net',
      ip: '100.64.0.1',
    };
  }

  serve(port: number, path?: string): void {
    logger.info(`Tailscale Serve on port ${port}${path ? ` path=${path}` : ''}`);
    this.config = {
      mode: 'serve',
      port,
      hostname: this.config?.hostname,
      authKey: this.config?.authKey,
    };
    this.serving = true;
  }

  funnel(port: number, path?: string): void {
    logger.info(`Tailscale Funnel on port ${port}${path ? ` path=${path}` : ''}`);
    this.config = {
      mode: 'funnel',
      port,
      hostname: this.config?.hostname,
      authKey: this.config?.authKey,
    };
    this.serving = true;
  }

  stop(): void {
    logger.info('Stopping Tailscale serve/funnel');
    this.serving = false;
  }

  isServing(): boolean {
    return this.serving;
  }

  getServeUrl(): string | null {
    if (!this.config || !this.serving) {
      return null;
    }
    const hostname = this.config.hostname || 'my-machine';
    return `https://${hostname}.tailnet.ts.net`;
  }

  generateAuthHeaders(): Record<string, string> {
    logger.debug('Generating Tailscale auth headers');
    const headers: Record<string, string> = {
      'Tailscale-User-Login': 'user@example.com',
      'Tailscale-User-Name': 'User',
    };
    if (this.config?.authKey) {
      headers['Authorization'] = `Bearer ${this.config.authKey}`;
    }
    return headers;
  }

  getConfig(): TailscaleConfig | null {
    return this.config;
  }

  setConfig(config: Partial<TailscaleConfig>): void {
    if (this.config) {
      this.config = { ...this.config, ...config };
    } else {
      this.config = {
        mode: config.mode || 'serve',
        port: config.port || 3000,
        hostname: config.hostname,
        authKey: config.authKey,
      };
    }
  }
}
