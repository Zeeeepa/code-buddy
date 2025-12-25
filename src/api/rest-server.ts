/**
 * Local REST API Server
 *
 * Provides a REST API for external scripts to interact with Code Buddy:
 * - Send prompts and receive responses
 * - Execute tools
 * - Manage sessions
 * - Query status and metrics
 */

import * as http from 'http';
import * as url from 'url';
import { EventEmitter } from 'events';

export interface ApiRequest {
  method: string;
  path: string;
  query: Record<string, string>;
  body: unknown;
  headers: Record<string, string>;
}

export interface ApiResponse {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}

export type RouteHandler = (req: ApiRequest) => Promise<ApiResponse>;

export interface ApiServerConfig {
  port?: number;
  host?: string;
  enableCors?: boolean;
  apiKey?: string;
  maxRequestSize?: number;
}

const DEFAULT_CONFIG: Required<ApiServerConfig> = {
  port: 3847,
  host: '127.0.0.1',
  enableCors: true,
  apiKey: '',
  maxRequestSize: 1024 * 1024, // 1MB
};

/**
 * REST API Server
 */
export class RestApiServer extends EventEmitter {
  private config: Required<ApiServerConfig>;
  private server: http.Server | null = null;
  private routes: Map<string, Map<string, RouteHandler>> = new Map();
  private isRunning: boolean = false;

  // External handlers (to be set by the main app)
  public onPrompt?: (prompt: string, options?: Record<string, unknown>) => Promise<string>;
  public onToolExecute?: (tool: string, params: Record<string, unknown>) => Promise<unknown>;
  public onGetSessions?: () => Promise<unknown[]>;
  public onGetMetrics?: () => Promise<unknown>;

  constructor(config: ApiServerConfig = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.setupDefaultRoutes();
  }

  /**
   * Setup default API routes
   */
  private setupDefaultRoutes(): void {
    // Health check
    this.addRoute('GET', '/health', async () => ({
      status: 200,
      body: { status: 'ok', timestamp: new Date().toISOString() },
    }));

    // API info
    this.addRoute('GET', '/api', async () => ({
      status: 200,
      body: {
        name: 'Code Buddy API',
        version: '1.0.0',
        endpoints: this.getEndpoints(),
      },
    }));

    // Send prompt
    this.addRoute('POST', '/api/prompt', async (req) => {
      const body = req.body as { prompt?: string; options?: Record<string, unknown> };

      if (!body.prompt) {
        return { status: 400, body: { error: 'Missing prompt' } };
      }

      if (!this.onPrompt) {
        return { status: 503, body: { error: 'Prompt handler not configured' } };
      }

      try {
        const response = await this.onPrompt(body.prompt, body.options);
        return { status: 200, body: { response } };
      } catch (error) {
        return {
          status: 500,
          body: { error: error instanceof Error ? error.message : 'Unknown error' },
        };
      }
    });

    // Execute tool
    this.addRoute('POST', '/api/tools/:tool', async (req) => {
      const toolName = req.path.split('/').pop() || '';
      const params = req.body as Record<string, unknown>;

      if (!this.onToolExecute) {
        return { status: 503, body: { error: 'Tool handler not configured' } };
      }

      try {
        const result = await this.onToolExecute(toolName, params);
        return { status: 200, body: { result } };
      } catch (error) {
        return {
          status: 500,
          body: { error: error instanceof Error ? error.message : 'Unknown error' },
        };
      }
    });

    // List available tools
    this.addRoute('GET', '/api/tools', async () => ({
      status: 200,
      body: {
        tools: [
          { name: 'read_file', description: 'Read a file' },
          { name: 'write_file', description: 'Write a file' },
          { name: 'edit_file', description: 'Edit a file' },
          { name: 'bash', description: 'Execute bash command' },
          { name: 'search', description: 'Search files' },
          { name: 'glob', description: 'Find files by pattern' },
        ],
      },
    }));

    // Get sessions
    this.addRoute('GET', '/api/sessions', async () => {
      if (!this.onGetSessions) {
        return { status: 503, body: { error: 'Sessions handler not configured' } };
      }

      try {
        const sessions = await this.onGetSessions();
        return { status: 200, body: { sessions } };
      } catch (error) {
        return {
          status: 500,
          body: { error: error instanceof Error ? error.message : 'Unknown error' },
        };
      }
    });

    // Get metrics
    this.addRoute('GET', '/api/metrics', async () => {
      if (!this.onGetMetrics) {
        return { status: 503, body: { error: 'Metrics handler not configured' } };
      }

      try {
        const metrics = await this.onGetMetrics();
        return { status: 200, body: { metrics } };
      } catch (error) {
        return {
          status: 500,
          body: { error: error instanceof Error ? error.message : 'Unknown error' },
        };
      }
    });

    // Get status
    this.addRoute('GET', '/api/status', async () => ({
      status: 200,
      body: {
        running: true,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        pid: process.pid,
      },
    }));
  }

  /**
   * Add a route handler
   */
  addRoute(method: string, path: string, handler: RouteHandler): void {
    if (!this.routes.has(method)) {
      this.routes.set(method, new Map());
    }
    this.routes.get(method)!.set(path, handler);
  }

  /**
   * Get list of endpoints
   */
  getEndpoints(): Array<{ method: string; path: string }> {
    const endpoints: Array<{ method: string; path: string }> = [];
    for (const [method, paths] of this.routes) {
      for (const path of paths.keys()) {
        endpoints.push({ method, path });
      }
    }
    return endpoints;
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    if (this.isRunning) return;

    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => this.handleRequest(req, res));

      this.server.on('error', (error) => {
        this.emit('error', error);
        reject(error);
      });

      this.server.listen(this.config.port, this.config.host, () => {
        this.isRunning = true;
        this.emit('start', { port: this.config.port, host: this.config.host });
        resolve();
      });
    });
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    if (!this.server || !this.isRunning) return;

    return new Promise((resolve) => {
      this.server!.close(() => {
        this.isRunning = false;
        this.emit('stop');
        resolve();
      });
    });
  }

  /**
   * Handle incoming request
   */
  private async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // Parse URL
      const parsedUrl = url.parse(req.url || '/', true);
      const path = parsedUrl.pathname || '/';
      const method = req.method || 'GET';

      // CORS headers
      if (this.config.enableCors) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
      }

      // Handle OPTIONS (preflight)
      if (method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      // Check API key if configured
      if (this.config.apiKey) {
        const providedKey = req.headers['x-api-key'] || req.headers['authorization'];
        if (providedKey !== this.config.apiKey && providedKey !== `Bearer ${this.config.apiKey}`) {
          this.sendResponse(res, { status: 401, body: { error: 'Unauthorized' } });
          return;
        }
      }

      // Parse body
      let body: unknown = {};
      if (['POST', 'PUT', 'PATCH'].includes(method)) {
        body = await this.parseBody(req);
      }

      // Build request object
      const apiRequest: ApiRequest = {
        method,
        path,
        query: parsedUrl.query as Record<string, string>,
        body,
        headers: req.headers as Record<string, string>,
      };

      // Find route handler
      const handler = this.findHandler(method, path);

      if (!handler) {
        this.sendResponse(res, { status: 404, body: { error: 'Not found' } });
        return;
      }

      // Execute handler
      const response = await handler(apiRequest);
      this.sendResponse(res, response);

      // Log request
      const duration = Date.now() - startTime;
      this.emit('request', { method, path, status: response.status, duration });

    } catch (error) {
      this.sendResponse(res, {
        status: 500,
        body: { error: error instanceof Error ? error.message : 'Internal server error' },
      });
    }
  }

  /**
   * Parse request body
   */
  private parseBody(req: http.IncomingMessage): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let size = 0;

      req.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > this.config.maxRequestSize) {
          reject(new Error('Request too large'));
          return;
        }
        chunks.push(chunk);
      });

      req.on('end', () => {
        const body = Buffer.concat(chunks).toString();
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch {
          resolve(body);
        }
      });

      req.on('error', reject);
    });
  }

  /**
   * Find route handler
   */
  private findHandler(method: string, path: string): RouteHandler | null {
    const methodRoutes = this.routes.get(method);
    if (!methodRoutes) return null;

    // Exact match
    if (methodRoutes.has(path)) {
      return methodRoutes.get(path)!;
    }

    // Pattern match (simple :param support)
    for (const [pattern, handler] of methodRoutes) {
      if (pattern.includes(':')) {
        const regex = new RegExp('^' + pattern.replace(/:\w+/g, '[^/]+') + '$');
        if (regex.test(path)) {
          return handler;
        }
      }
    }

    return null;
  }

  /**
   * Send response
   */
  private sendResponse(res: http.ServerResponse, response: ApiResponse): void {
    const headers = {
      'Content-Type': 'application/json',
      ...response.headers,
    };

    for (const [key, value] of Object.entries(headers)) {
      res.setHeader(key, value);
    }

    res.writeHead(response.status);
    res.end(JSON.stringify(response.body));
  }

  /**
   * Get server address
   */
  getAddress(): string {
    return `http://${this.config.host}:${this.config.port}`;
  }

  /**
   * Check if running
   */
  isServerRunning(): boolean {
    return this.isRunning;
  }
}

// Singleton instance
let apiServer: RestApiServer | null = null;

/**
 * Get or create API server
 */
export function getApiServer(config?: ApiServerConfig): RestApiServer {
  if (!apiServer) {
    apiServer = new RestApiServer(config);
  }
  return apiServer;
}

/**
 * Start API server
 */
export async function startApiServer(config?: ApiServerConfig): Promise<RestApiServer> {
  const server = getApiServer(config);
  await server.start();
  return server;
}

/**
 * Stop API server
 */
export async function stopApiServer(): Promise<void> {
  if (apiServer) {
    await apiServer.stop();
    apiServer = null;
  }
}

export default RestApiServer;
