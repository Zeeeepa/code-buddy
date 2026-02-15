/**
 * Auth Handler
 *
 * Manages authentication flows for multiple LLM providers,
 * including login, logout, and status reporting.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { logger } from '../../utils/logger.js';

// ============================================================================
// Types
// ============================================================================

export interface ProviderStatus {
  authenticated: boolean;
  provider: string;
  keyPrefix: string;
  expiresAt?: number;
}

interface StoredCredentials {
  [provider: string]: {
    apiKey: string;
    storedAt: number;
    expiresAt?: number;
  };
}

// ============================================================================
// Constants
// ============================================================================

const KNOWN_PROVIDERS: Record<string, string> = {
  grok: 'GROK_API_KEY',
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  gemini: 'GEMINI_API_KEY',
  ollama: 'OLLAMA_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
};

// ============================================================================
// AuthHandler
// ============================================================================

export class AuthHandler {
  private credentials: StoredCredentials = {};
  private configPath: string;

  constructor(configDir?: string) {
    const dir = configDir || path.join(os.homedir(), '.codebuddy');
    this.configPath = path.join(dir, 'auth.json');
    this.loadCredentials();
  }

  private loadCredentials(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        this.credentials = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
      }
    } catch (err) {
      logger.warn('Failed to load auth credentials', { error: err });
      this.credentials = {};
    }
  }

  private saveCredentials(): void {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.configPath, JSON.stringify(this.credentials, null, 2), { mode: 0o600 });
    } catch (err) {
      logger.warn('Failed to save auth credentials', { error: err });
    }
  }

  login(provider?: string): { success: boolean; provider: string; message: string } {
    const providerName = provider || 'grok';
    const envVar = KNOWN_PROVIDERS[providerName];

    if (!envVar) {
      return {
        success: false,
        provider: providerName,
        message: `Unknown provider: ${providerName}. Available: ${Object.keys(KNOWN_PROVIDERS).join(', ')}`,
      };
    }

    // Check environment variable
    const apiKey = process.env[envVar];
    if (!apiKey) {
      return {
        success: false,
        provider: providerName,
        message: `No API key found. Set ${envVar} environment variable.`,
      };
    }

    this.credentials[providerName] = {
      apiKey,
      storedAt: Date.now(),
    };
    this.saveCredentials();

    logger.info(`Logged in to ${providerName}`);
    return {
      success: true,
      provider: providerName,
      message: `Successfully authenticated with ${providerName}.`,
    };
  }

  logout(provider?: string): { success: boolean; message: string } {
    if (provider) {
      if (this.credentials[provider]) {
        delete this.credentials[provider];
        this.saveCredentials();
        logger.info(`Logged out from ${provider}`);
        return { success: true, message: `Logged out from ${provider}.` };
      }
      return { success: false, message: `Not logged in to ${provider}.` };
    }

    // Logout from all
    const count = Object.keys(this.credentials).length;
    this.credentials = {};
    this.saveCredentials();
    logger.info('Logged out from all providers');
    return { success: true, message: `Logged out from ${count} provider(s).` };
  }

  status(): ProviderStatus[] {
    return this.listProviders().map(p => this.getProviderStatus(p));
  }

  getProviderStatus(provider: string): ProviderStatus {
    const stored = this.credentials[provider];
    const envVar = KNOWN_PROVIDERS[provider];
    const envKey = envVar ? process.env[envVar] : undefined;
    const apiKey = stored?.apiKey || envKey || '';

    return {
      authenticated: !!apiKey,
      provider,
      keyPrefix: apiKey ? apiKey.substring(0, 8) + '...' : '',
      expiresAt: stored?.expiresAt,
    };
  }

  listProviders(): string[] {
    return Object.keys(KNOWN_PROVIDERS);
  }

  formatStatusTable(): string {
    const statuses = this.status();
    const lines: string[] = [];
    lines.push('Authentication Status:');
    lines.push('─'.repeat(60));
    lines.push(`${'Provider'.padEnd(15)} ${'Status'.padEnd(15)} ${'Key Prefix'.padEnd(15)} Expires`);
    lines.push('─'.repeat(60));

    for (const s of statuses) {
      const statusStr = s.authenticated ? 'authenticated' : 'not configured';
      const expires = s.expiresAt ? new Date(s.expiresAt).toISOString() : 'n/a';
      lines.push(
        `${s.provider.padEnd(15)} ${statusStr.padEnd(15)} ${s.keyPrefix.padEnd(15)} ${expires}`
      );
    }

    return lines.join('\n');
  }
}
