/**
 * OpenAPI Documentation Generator
 *
 * Auto-detects web framework (Express, Flask, FastAPI, Spring, Gin, etc.)
 * and extracts route definitions to generate an OpenAPI 3.0.3 specification.
 *
 * Uses regex + heuristics (not full AST) for v1.
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger.js';
import type { ToolResult } from '../types/index.js';

// ============================================================================
// Types
// ============================================================================

export interface OpenAPIParameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required?: boolean;
  schema: { type: string };
  description?: string;
}

export interface OpenAPIRequestBody {
  required?: boolean;
  content: {
    'application/json': {
      schema: Record<string, unknown>;
    };
  };
}

export interface OpenAPIResponse {
  description: string;
  content?: {
    'application/json': {
      schema: Record<string, unknown>;
    };
  };
}

export interface OpenAPIOperation {
  summary?: string;
  operationId?: string;
  parameters?: OpenAPIParameter[];
  requestBody?: OpenAPIRequestBody;
  responses: Record<string, OpenAPIResponse>;
  tags?: string[];
}

export type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'patch' | 'options' | 'head';

export interface PathItem {
  [method: string]: OpenAPIOperation;
}

export interface Schema {
  type: string;
  properties?: Record<string, { type: string; description?: string }>;
  required?: string[];
}

export interface OpenAPISpec {
  openapi: '3.0.3';
  info: { title: string; version: string; description?: string };
  paths: Record<string, PathItem>;
  components?: { schemas?: Record<string, Schema> };
}

export interface GenerateOptions {
  framework?: string;
  outputFormat?: 'json' | 'yaml';
}

// ============================================================================
// Framework Detection
// ============================================================================

export type FrameworkName = 'express' | 'fastify' | 'koa' | 'flask' | 'fastapi' | 'spring' | 'gin' | 'echo' | 'unknown';

interface FrameworkDetection {
  name: FrameworkName;
  confidence: number;
  files: string[];
}

const FRAMEWORK_INDICATORS: { name: FrameworkName; patterns: RegExp[]; filePatterns: string[] }[] = [
  {
    name: 'express',
    patterns: [/require\(['"]express['"]\)/, /from\s+['"]express['"]/, /express\(\)/, /app\.(get|post|put|delete|patch|use)\s*\(/],
    filePatterns: ['package.json'],
  },
  {
    name: 'fastify',
    patterns: [/require\(['"]fastify['"]\)/, /from\s+['"]fastify['"]/, /fastify\(\)/],
    filePatterns: ['package.json'],
  },
  {
    name: 'koa',
    patterns: [/require\(['"]koa['"]\)/, /from\s+['"]koa['"]/, /new\s+Koa\(\)/],
    filePatterns: ['package.json'],
  },
  {
    name: 'flask',
    patterns: [/from\s+flask\s+import/, /Flask\(__name__\)/, /@app\.route\(/],
    filePatterns: ['requirements.txt', 'pyproject.toml', 'setup.py'],
  },
  {
    name: 'fastapi',
    patterns: [/from\s+fastapi\s+import/, /FastAPI\(\)/, /@(?:app|router)\.(get|post|put|delete|patch)\(/],
    filePatterns: ['requirements.txt', 'pyproject.toml'],
  },
  {
    name: 'spring',
    patterns: [/@RequestMapping/, /@GetMapping/, /@PostMapping/, /@RestController/],
    filePatterns: ['pom.xml', 'build.gradle'],
  },
  {
    name: 'gin',
    patterns: [/gin\.Default\(\)/, /gin\.New\(\)/, /router\.(GET|POST|PUT|DELETE)\(/],
    filePatterns: ['go.mod'],
  },
  {
    name: 'echo',
    patterns: [/echo\.New\(\)/, /e\.(GET|POST|PUT|DELETE)\(/],
    filePatterns: ['go.mod'],
  },
];

/**
 * Scan source files to detect which framework is used
 */
export function detectFramework(projectRoot: string): FrameworkDetection {
  const sourceExtensions = ['.ts', '.js', '.mjs', '.cjs', '.py', '.java', '.go', '.kt'];
  const files = collectSourceFiles(projectRoot, sourceExtensions, 200);

  const scores: Map<FrameworkName, { score: number; files: string[] }> = new Map();

  for (const filePath of files) {
    let content: string;
    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch {
      continue;
    }

    for (const fw of FRAMEWORK_INDICATORS) {
      for (const pattern of fw.patterns) {
        if (pattern.test(content)) {
          const entry = scores.get(fw.name) || { score: 0, files: [] };
          entry.score++;
          if (!entry.files.includes(filePath)) entry.files.push(filePath);
          scores.set(fw.name, entry);
        }
      }
    }
  }

  if (scores.size === 0) {
    return { name: 'unknown', confidence: 0, files: [] };
  }

  const sorted = Array.from(scores.entries()).sort((a, b) => b[1].score - a[1].score);
  const [name, data] = sorted[0];
  return { name, confidence: Math.min(1, data.score / 5), files: data.files };
}

/**
 * Collect source files up to a limit (avoid scanning huge codebases)
 */
function collectSourceFiles(dir: string, extensions: string[], limit: number): string[] {
  const results: string[] = [];
  const skipDirs = new Set(['node_modules', '.git', 'dist', 'build', '__pycache__', 'vendor', '.venv', 'venv', 'target']);

  function walk(current: string, depth: number): void {
    if (results.length >= limit || depth > 5) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (results.length >= limit) return;
      if (entry.isDirectory()) {
        if (!skipDirs.has(entry.name)) {
          walk(path.join(current, entry.name), depth + 1);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (extensions.includes(ext)) {
          results.push(path.join(current, entry.name));
        }
      }
    }
  }

  walk(dir, 0);
  return results;
}

// ============================================================================
// Route Extraction
// ============================================================================

interface ExtractedRoute {
  method: HttpMethod;
  path: string;
  summary?: string;
  parameters: OpenAPIParameter[];
  hasBody: boolean;
  tags?: string[];
}

/**
 * Extract route path parameters: /users/:id → [{ name: 'id', in: 'path' }]
 */
function extractPathParams(routePath: string): OpenAPIParameter[] {
  const params: OpenAPIParameter[] = [];
  // Express-style :param
  const expressMatches = routePath.matchAll(/:(\w+)/g);
  for (const m of expressMatches) {
    params.push({ name: m[1], in: 'path', required: true, schema: { type: 'string' } });
  }
  // OpenAPI-style {param}
  const oaMatches = routePath.matchAll(/\{(\w+)\}/g);
  for (const m of oaMatches) {
    if (!params.some(p => p.name === m[1])) {
      params.push({ name: m[1], in: 'path', required: true, schema: { type: 'string' } });
    }
  }
  // Spring-style {param} already handled above
  return params;
}

/**
 * Normalize route path to OpenAPI format
 */
function normalizeRoutePath(routePath: string): string {
  // Convert :param to {param}
  return routePath.replace(/:(\w+)/g, '{$1}');
}

// ---------- Express / Fastify / Koa ----------

const EXPRESS_ROUTE_RE = /(?:app|router|route)\.(get|post|put|delete|patch|options|head)\s*\(\s*['"`]([^'"`]+)['"`]/gi;

function extractExpressRoutes(content: string): ExtractedRoute[] {
  const routes: ExtractedRoute[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(EXPRESS_ROUTE_RE.source, EXPRESS_ROUTE_RE.flags);
  while ((match = re.exec(content)) !== null) {
    const method = match[1].toLowerCase() as HttpMethod;
    const routePath = match[2];
    routes.push({
      method,
      path: normalizeRoutePath(routePath),
      parameters: extractPathParams(routePath),
      hasBody: ['post', 'put', 'patch'].includes(method),
    });
  }
  return routes;
}

// ---------- Flask ----------

const FLASK_ROUTE_RE = /@(?:app|blueprint|bp)\.route\s*\(\s*['"]([^'"]+)['"]\s*(?:,\s*methods\s*=\s*\[([^\]]+)\])?\s*\)/gi;

function extractFlaskRoutes(content: string): ExtractedRoute[] {
  const routes: ExtractedRoute[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(FLASK_ROUTE_RE.source, FLASK_ROUTE_RE.flags);
  while ((match = re.exec(content)) !== null) {
    const routePath = match[1];
    const methodsStr = match[2] || "'GET'";
    const methods = methodsStr.replace(/['"]/g, '').split(',').map(m => m.trim().toLowerCase());
    for (const method of methods) {
      if (['get', 'post', 'put', 'delete', 'patch'].includes(method)) {
        // Convert Flask <param> to {param}
        const normalizedPath = routePath.replace(/<(?:\w+:)?(\w+)>/g, '{$1}');
        routes.push({
          method: method as HttpMethod,
          path: normalizedPath,
          parameters: extractPathParams(normalizedPath),
          hasBody: ['post', 'put', 'patch'].includes(method),
        });
      }
    }
  }
  return routes;
}

// ---------- FastAPI ----------

const FASTAPI_ROUTE_RE = /@(?:app|router)\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/gi;

function extractFastAPIRoutes(content: string): ExtractedRoute[] {
  const routes: ExtractedRoute[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(FASTAPI_ROUTE_RE.source, FASTAPI_ROUTE_RE.flags);
  while ((match = re.exec(content)) !== null) {
    const method = match[1].toLowerCase() as HttpMethod;
    const routePath = match[2];
    routes.push({
      method,
      path: normalizeRoutePath(routePath),
      parameters: extractPathParams(routePath),
      hasBody: ['post', 'put', 'patch'].includes(method),
    });
  }
  return routes;
}

// ---------- Spring ----------

const SPRING_MAPPING_RE = /@(Get|Post|Put|Delete|Patch|Request)Mapping\s*\(\s*(?:value\s*=\s*)?['"]([^'"]+)['"]/gi;

function extractSpringRoutes(content: string): ExtractedRoute[] {
  const routes: ExtractedRoute[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(SPRING_MAPPING_RE.source, SPRING_MAPPING_RE.flags);
  while ((match = re.exec(content)) !== null) {
    const mapping = match[1].toLowerCase();
    const method: HttpMethod = mapping === 'request' ? 'get' : mapping as HttpMethod;
    const routePath = match[2];
    routes.push({
      method,
      path: normalizeRoutePath(routePath),
      parameters: extractPathParams(routePath),
      hasBody: ['post', 'put', 'patch'].includes(method),
    });
  }
  return routes;
}

// ---------- Gin / Echo ----------

const GIN_ROUTE_RE = /(?:router|r|g|e)\.(GET|POST|PUT|DELETE|PATCH)\s*\(\s*['"]([^'"]+)['"]/gi;

function extractGinRoutes(content: string): ExtractedRoute[] {
  const routes: ExtractedRoute[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(GIN_ROUTE_RE.source, GIN_ROUTE_RE.flags);
  while ((match = re.exec(content)) !== null) {
    const method = match[1].toLowerCase() as HttpMethod;
    const routePath = match[2];
    routes.push({
      method,
      path: normalizeRoutePath(routePath),
      parameters: extractPathParams(routePath),
      hasBody: ['post', 'put', 'patch'].includes(method),
    });
  }
  return routes;
}

/**
 * Extract routes from all relevant source files
 */
function extractAllRoutes(projectRoot: string, framework: FrameworkName): ExtractedRoute[] {
  const extMap: Record<string, string[]> = {
    express: ['.ts', '.js', '.mjs', '.cjs'],
    fastify: ['.ts', '.js', '.mjs', '.cjs'],
    koa: ['.ts', '.js', '.mjs', '.cjs'],
    flask: ['.py'],
    fastapi: ['.py'],
    spring: ['.java', '.kt'],
    gin: ['.go'],
    echo: ['.go'],
    unknown: ['.ts', '.js', '.py', '.java', '.go'],
  };

  const extensions = extMap[framework] || extMap.unknown;
  const files = collectSourceFiles(projectRoot, extensions, 300);
  const allRoutes: ExtractedRoute[] = [];

  const extractorMap: Record<string, (content: string) => ExtractedRoute[]> = {
    express: extractExpressRoutes,
    fastify: extractExpressRoutes, // Same pattern
    koa: extractExpressRoutes,     // Similar pattern
    flask: extractFlaskRoutes,
    fastapi: extractFastAPIRoutes,
    spring: extractSpringRoutes,
    gin: extractGinRoutes,
    echo: extractGinRoutes,        // Similar pattern
  };

  // For unknown framework, try all extractors
  const extractors = framework === 'unknown'
    ? Object.values(extractorMap)
    : [extractorMap[framework] || extractExpressRoutes];

  for (const filePath of files) {
    let content: string;
    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch {
      continue;
    }

    for (const extractor of extractors) {
      const routes = extractor(content);
      for (const route of routes) {
        // Derive tag from file name
        const baseName = path.basename(filePath, path.extname(filePath));
        route.tags = [baseName.replace(/[-_]?(routes?|controller|handler|api|view)s?$/i, '') || 'default'];
        allRoutes.push(route);
      }
    }
  }

  return allRoutes;
}

// ============================================================================
// Spec Generation
// ============================================================================

function buildSpec(routes: ExtractedRoute[], projectName: string, description?: string): OpenAPISpec {
  const paths: Record<string, PathItem> = {};

  for (const route of routes) {
    if (!paths[route.path]) {
      paths[route.path] = {};
    }

    const operation: OpenAPIOperation = {
      summary: route.summary || `${route.method.toUpperCase()} ${route.path}`,
      operationId: `${route.method}_${route.path.replace(/[{}\/]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')}`,
      responses: {
        '200': { description: 'Successful response' },
      },
    };

    if (route.parameters.length > 0) {
      operation.parameters = route.parameters;
    }

    if (route.hasBody) {
      operation.requestBody = {
        required: true,
        content: {
          'application/json': {
            schema: { type: 'object' },
          },
        },
      };
    }

    if (route.tags && route.tags.length > 0) {
      operation.tags = route.tags;
    }

    paths[route.path][route.method] = operation;
  }

  return {
    openapi: '3.0.3',
    info: {
      title: projectName,
      version: '1.0.0',
      description,
    },
    paths,
  };
}

// ============================================================================
// Simple YAML serializer (no dependency)
// ============================================================================

function toYaml(obj: unknown, indent: number = 0): string {
  const prefix = '  '.repeat(indent);

  if (obj === null || obj === undefined) return 'null';
  if (typeof obj === 'boolean') return String(obj);
  if (typeof obj === 'number') return String(obj);
  if (typeof obj === 'string') {
    // Quote if contains special chars
    if (/[:#\[\]{}&*!|>'"@`,%]/.test(obj) || obj.includes('\n') || /^\s/.test(obj)) {
      return `'${obj.replace(/'/g, "''")}'`;
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    return obj.map(item => `${prefix}- ${toYaml(item, indent + 1).trimStart()}`).join('\n');
  }

  if (typeof obj === 'object') {
    const entries = Object.entries(obj as Record<string, unknown>);
    if (entries.length === 0) return '{}';
    return entries.map(([key, value]) => {
      const val = toYaml(value, indent + 1);
      if (typeof value === 'object' && value !== null && !Array.isArray(value) && Object.keys(value).length > 0) {
        return `${prefix}${key}:\n${val}`;
      }
      if (Array.isArray(value) && value.length > 0) {
        return `${prefix}${key}:\n${val}`;
      }
      return `${prefix}${key}: ${val}`;
    }).join('\n');
  }

  return String(obj);
}

// ============================================================================
// Main Generate Function
// ============================================================================

/**
 * Generate an OpenAPI spec for the project
 */
export async function generateOpenAPISpec(
  projectRoot: string,
  options?: GenerateOptions,
): Promise<{ spec: OpenAPISpec; filePath: string }> {
  const resolvedRoot = path.resolve(projectRoot);

  if (!fs.existsSync(resolvedRoot)) {
    throw new Error(`Project root not found: ${resolvedRoot}`);
  }

  // Detect framework
  const framework = options?.framework
    ? options.framework as FrameworkName
    : detectFramework(resolvedRoot).name;

  // Extract project name from package.json / go.mod / pom.xml
  let projectName = path.basename(resolvedRoot);
  try {
    const pkgPath = path.join(resolvedRoot, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      projectName = pkg.name || projectName;
    }
  } catch { /* ignore */ }

  // Extract routes
  const routes = extractAllRoutes(resolvedRoot, framework);

  if (routes.length === 0) {
    throw new Error(`No API routes detected. Framework: ${framework}. Ensure your route files are in the project directory.`);
  }

  // Build spec
  const description = `Auto-generated OpenAPI spec for ${projectName} (${framework} framework). ${routes.length} endpoints detected.`;
  const spec = buildSpec(routes, projectName, description);

  // Write output
  const format = options?.outputFormat || 'json';
  const fileName = format === 'yaml' ? 'openapi.yaml' : 'openapi.json';
  const filePath = path.join(resolvedRoot, fileName);

  const content = format === 'yaml'
    ? toYaml(spec)
    : JSON.stringify(spec, null, 2);

  fs.writeFileSync(filePath, content, 'utf-8');

  return { spec, filePath };
}

// ============================================================================
// Tool Execute Function
// ============================================================================

/**
 * Execute the generate_openapi tool (called from tool handler / registry adapter).
 */
export async function executeGenerateOpenAPI(args: {
  project_root: string;
  framework?: string;
  output_format?: 'json' | 'yaml';
}): Promise<ToolResult> {
  try {
    const { spec, filePath } = await generateOpenAPISpec(args.project_root, {
      framework: args.framework,
      outputFormat: args.output_format,
    });

    const routeCount = Object.keys(spec.paths).length;
    const methods = Object.values(spec.paths).flatMap(p => Object.keys(p));
    const methodCounts: Record<string, number> = {};
    for (const m of methods) {
      methodCounts[m] = (methodCounts[m] || 0) + 1;
    }

    const lines: string[] = [];
    lines.push(`# OpenAPI Spec Generated`);
    lines.push('');
    lines.push(`- File: ${filePath}`);
    lines.push(`- Title: ${spec.info.title}`);
    lines.push(`- Paths: ${routeCount}`);
    lines.push(`- Endpoints: ${methods.length}`);
    lines.push('');
    lines.push('## Methods');
    for (const [method, count] of Object.entries(methodCounts).sort()) {
      lines.push(`- ${method.toUpperCase()}: ${count}`);
    }
    lines.push('');
    lines.push('## Paths');
    for (const [routePath, pathItem] of Object.entries(spec.paths)) {
      const ops = Object.keys(pathItem).map(m => m.toUpperCase()).join(', ');
      lines.push(`- ${ops} ${routePath}`);
    }

    return { success: true, output: lines.join('\n') };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn('generate_openapi failed', { error: message });
    return { success: false, error: message };
  }
}
