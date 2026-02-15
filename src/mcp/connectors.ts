/**
 * Pre-configured MCP Connectors
 *
 * Registry of pre-configured MCP server connectors for popular
 * services, with environment variable checks and setup instructions.
 */

import { logger } from '../utils/logger.js';

// ============================================================================
// Types
// ============================================================================

export interface ConnectorConfig {
  name: string;
  type: string;
  description: string;
  mcpServerConfig: Record<string, unknown>;
  requiredEnvVars: string[];
  setupInstructions: string;
}

// ============================================================================
// Pre-configured Connectors
// ============================================================================

const CONNECTORS: ConnectorConfig[] = [
  {
    name: 'google-calendar',
    type: 'calendar',
    description: 'Google Calendar integration for event management',
    mcpServerConfig: {
      command: 'npx',
      args: ['@anthropic/mcp-google-calendar'],
    },
    requiredEnvVars: ['GOOGLE_CALENDAR_CLIENT_ID', 'GOOGLE_CALENDAR_CLIENT_SECRET'],
    setupInstructions:
      '1. Create a Google Cloud project\n' +
      '2. Enable Calendar API\n' +
      '3. Create OAuth2 credentials\n' +
      '4. Set GOOGLE_CALENDAR_CLIENT_ID and GOOGLE_CALENDAR_CLIENT_SECRET',
  },
  {
    name: 'linear',
    type: 'project-management',
    description: 'Linear issue tracker integration',
    mcpServerConfig: {
      command: 'npx',
      args: ['@anthropic/mcp-linear'],
    },
    requiredEnvVars: ['LINEAR_API_KEY'],
    setupInstructions:
      '1. Go to Linear Settings > API\n' +
      '2. Create a personal API key\n' +
      '3. Set LINEAR_API_KEY environment variable',
  },
  {
    name: 'notion',
    type: 'knowledge-base',
    description: 'Notion workspace integration for docs and databases',
    mcpServerConfig: {
      command: 'npx',
      args: ['@anthropic/mcp-notion'],
    },
    requiredEnvVars: ['NOTION_API_KEY'],
    setupInstructions:
      '1. Go to notion.so/my-integrations\n' +
      '2. Create a new integration\n' +
      '3. Copy the Internal Integration Token\n' +
      '4. Set NOTION_API_KEY environment variable',
  },
  {
    name: 'asana',
    type: 'project-management',
    description: 'Asana task and project management integration',
    mcpServerConfig: {
      command: 'npx',
      args: ['@anthropic/mcp-asana'],
    },
    requiredEnvVars: ['ASANA_ACCESS_TOKEN'],
    setupInstructions:
      '1. Go to Asana Developer Console\n' +
      '2. Create a Personal Access Token\n' +
      '3. Set ASANA_ACCESS_TOKEN environment variable',
  },
  {
    name: 'github',
    type: 'version-control',
    description: 'GitHub repository and issue management',
    mcpServerConfig: {
      command: 'npx',
      args: ['@anthropic/mcp-github'],
    },
    requiredEnvVars: ['GITHUB_TOKEN'],
    setupInstructions:
      '1. Go to GitHub Settings > Developer settings > Personal access tokens\n' +
      '2. Generate a new token with repo scope\n' +
      '3. Set GITHUB_TOKEN environment variable',
  },
  {
    name: 'slack',
    type: 'communication',
    description: 'Slack workspace messaging integration',
    mcpServerConfig: {
      command: 'npx',
      args: ['@anthropic/mcp-slack'],
    },
    requiredEnvVars: ['SLACK_BOT_TOKEN'],
    setupInstructions:
      '1. Create a Slack App at api.slack.com/apps\n' +
      '2. Add Bot Token Scopes (chat:write, channels:read)\n' +
      '3. Install to workspace\n' +
      '4. Set SLACK_BOT_TOKEN environment variable',
  },
];

// ============================================================================
// ConnectorRegistry
// ============================================================================

let instance: ConnectorRegistry | null = null;

export class ConnectorRegistry {
  private connectors: Map<string, ConnectorConfig> = new Map();

  constructor() {
    for (const connector of CONNECTORS) {
      this.connectors.set(connector.name, connector);
    }
  }

  static getInstance(): ConnectorRegistry {
    if (!instance) {
      instance = new ConnectorRegistry();
    }
    return instance;
  }

  static resetInstance(): void {
    instance = null;
  }

  getAvailableConnectors(): ConnectorConfig[] {
    return Array.from(this.connectors.values());
  }

  getConnector(name: string): ConnectorConfig | undefined {
    return this.connectors.get(name);
  }

  isConfigured(name: string): boolean {
    const connector = this.connectors.get(name);
    if (!connector) {
      return false;
    }
    return connector.requiredEnvVars.every(v => !!process.env[v]);
  }

  getSetupInstructions(name: string): string | undefined {
    const connector = this.connectors.get(name);
    if (!connector) {
      return undefined;
    }
    logger.debug('Getting setup instructions', { connector: name });
    return connector.setupInstructions;
  }

  listConfigured(): ConnectorConfig[] {
    return this.getAvailableConnectors().filter(c => this.isConfigured(c.name));
  }

  listUnconfigured(): ConnectorConfig[] {
    return this.getAvailableConnectors().filter(c => !this.isConfigured(c.name));
  }
}

export function getConnectorRegistry(): ConnectorRegistry {
  return ConnectorRegistry.getInstance();
}

export function resetConnectorRegistry(): void {
  ConnectorRegistry.resetInstance();
}
