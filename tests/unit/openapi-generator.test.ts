/**
 * OpenAPI Generator Tool — Unit Tests
 *
 * Tests: framework detection, route extraction (Express, Flask, FastAPI, Spring, Gin),
 * spec generation, YAML output, and the executeGenerateOpenAPI wrapper.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  detectFramework,
  generateOpenAPISpec,
  executeGenerateOpenAPI,
} from '../../src/tools/openapi-generator';
import type { OpenAPISpec } from '../../src/tools/openapi-generator';

// Helper: create a temp project directory with files
function createTempProject(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openapi-test-'));
  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = path.join(dir, relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf-8');
  }
  return dir;
}

function cleanupTempProject(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch { /* ignore */ }
}

describe('detectFramework', () => {
  it('should detect Express framework', () => {
    const dir = createTempProject({
      'src/app.ts': `
        import express from 'express';
        const app = express();
        app.get('/health', (req, res) => res.json({ ok: true }));
      `,
    });
    try {
      const result = detectFramework(dir);
      expect(result.name).toBe('express');
      expect(result.confidence).toBeGreaterThan(0);
    } finally {
      cleanupTempProject(dir);
    }
  });

  it('should detect Flask framework', () => {
    const dir = createTempProject({
      'app.py': `
        from flask import Flask
        app = Flask(__name__)
        @app.route('/api/users', methods=['GET', 'POST'])
        def users():
            pass
      `,
    });
    try {
      const result = detectFramework(dir);
      expect(result.name).toBe('flask');
    } finally {
      cleanupTempProject(dir);
    }
  });

  it('should return unknown for empty project', () => {
    const dir = createTempProject({
      'README.md': '# Hello',
    });
    try {
      const result = detectFramework(dir);
      expect(result.name).toBe('unknown');
      expect(result.confidence).toBe(0);
    } finally {
      cleanupTempProject(dir);
    }
  });
});

describe('generateOpenAPISpec', () => {
  it('should generate spec from Express routes', async () => {
    const dir = createTempProject({
      'package.json': JSON.stringify({ name: 'test-api', version: '1.0.0' }),
      'src/routes.ts': `
        import { Router } from 'express';
        const router = Router();
        router.get('/api/users', getUsers);
        router.post('/api/users', createUser);
        router.get('/api/users/:id', getUser);
        router.put('/api/users/:id', updateUser);
        router.delete('/api/users/:id', deleteUser);
      `,
    });
    try {
      const { spec, filePath } = await generateOpenAPISpec(dir, { framework: 'express' });
      expect(spec.openapi).toBe('3.0.3');
      expect(spec.info.title).toBe('test-api');
      expect(Object.keys(spec.paths)).toContain('/api/users');
      expect(Object.keys(spec.paths)).toContain('/api/users/{id}');
      expect(spec.paths['/api/users'].get).toBeDefined();
      expect(spec.paths['/api/users'].post).toBeDefined();
      expect(spec.paths['/api/users/{id}'].put).toBeDefined();
      expect(spec.paths['/api/users/{id}'].delete).toBeDefined();
      // Check path parameters
      expect(spec.paths['/api/users/{id}'].get!.parameters).toBeDefined();
      expect(spec.paths['/api/users/{id}'].get!.parameters![0].name).toBe('id');
      expect(spec.paths['/api/users/{id}'].get!.parameters![0].in).toBe('path');
      // File should exist
      expect(fs.existsSync(filePath)).toBe(true);
      expect(filePath.endsWith('.json')).toBe(true);
    } finally {
      cleanupTempProject(dir);
    }
  });

  it('should generate spec from Flask routes', async () => {
    const dir = createTempProject({
      'package.json': JSON.stringify({ name: 'flask-app' }),
      'app.py': `
        from flask import Flask
        app = Flask(__name__)
        @app.route('/api/items', methods=['GET'])
        def list_items():
            pass
        @app.route('/api/items/<int:item_id>', methods=['GET', 'PUT'])
        def item(item_id):
            pass
      `,
    });
    try {
      const { spec } = await generateOpenAPISpec(dir, { framework: 'flask' });
      expect(Object.keys(spec.paths)).toContain('/api/items');
      expect(Object.keys(spec.paths)).toContain('/api/items/{item_id}');
      expect(spec.paths['/api/items'].get).toBeDefined();
      expect(spec.paths['/api/items/{item_id}'].put).toBeDefined();
    } finally {
      cleanupTempProject(dir);
    }
  });

  it('should generate spec from FastAPI routes', async () => {
    const dir = createTempProject({
      'main.py': `
        from fastapi import FastAPI
        app = FastAPI()
        @app.get('/api/health')
        def health():
            return {"status": "ok"}
        @app.post('/api/data')
        def create_data():
            pass
      `,
    });
    try {
      const { spec } = await generateOpenAPISpec(dir, { framework: 'fastapi' });
      expect(Object.keys(spec.paths)).toContain('/api/health');
      expect(Object.keys(spec.paths)).toContain('/api/data');
      expect(spec.paths['/api/data'].post!.requestBody).toBeDefined();
    } finally {
      cleanupTempProject(dir);
    }
  });

  it('should generate YAML output', async () => {
    const dir = createTempProject({
      'package.json': JSON.stringify({ name: 'yaml-test' }),
      'server.ts': `
        app.get('/health', handler);
      `,
    });
    try {
      const { filePath } = await generateOpenAPISpec(dir, { framework: 'express', outputFormat: 'yaml' });
      expect(filePath.endsWith('.yaml')).toBe(true);
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('openapi:');
      expect(content).toContain('/health');
    } finally {
      cleanupTempProject(dir);
    }
  });

  it('should throw when no routes are found in empty dir', async () => {
    const dir = createTempProject({ 'empty.txt': '' });
    try {
      await expect(generateOpenAPISpec(dir, { framework: 'express' })).rejects.toThrow('No API routes detected');
    } finally {
      cleanupTempProject(dir);
    }
  });

  it('should throw when no routes are found', async () => {
    const dir = createTempProject({
      'src/util.ts': 'export const x = 42;',
    });
    try {
      await expect(generateOpenAPISpec(dir, { framework: 'express' })).rejects.toThrow('No API routes detected');
    } finally {
      cleanupTempProject(dir);
    }
  });

  it('should extract Spring routes', async () => {
    const dir = createTempProject({
      'src/Controller.java': `
        @RestController
        public class UserController {
          @GetMapping("/users")
          public List<User> list() {}
          @PostMapping("/users")
          public User create() {}
          @DeleteMapping("/users/{id}")
          public void delete(@PathVariable Long id) {}
        }
      `,
    });
    try {
      const { spec } = await generateOpenAPISpec(dir, { framework: 'spring' });
      expect(Object.keys(spec.paths)).toContain('/users');
      expect(spec.paths['/users'].get).toBeDefined();
      expect(spec.paths['/users'].post).toBeDefined();
    } finally {
      cleanupTempProject(dir);
    }
  });

  it('should extract Gin routes', async () => {
    const dir = createTempProject({
      'main.go': `
        package main
        import "github.com/gin-gonic/gin"
        func main() {
          r := gin.Default()
          r.GET("/ping", pingHandler)
          r.POST("/data", dataHandler)
        }
      `,
    });
    try {
      const { spec } = await generateOpenAPISpec(dir, { framework: 'gin' });
      expect(Object.keys(spec.paths)).toContain('/ping');
      expect(Object.keys(spec.paths)).toContain('/data');
    } finally {
      cleanupTempProject(dir);
    }
  });
});

describe('executeGenerateOpenAPI', () => {
  it('should return success with formatted output', async () => {
    const dir = createTempProject({
      'package.json': JSON.stringify({ name: 'test-api' }),
      'routes.ts': `
        app.get('/api/test', handler);
        app.post('/api/test', handler);
      `,
    });
    try {
      const result = await executeGenerateOpenAPI({ project_root: dir, framework: 'express' });
      expect(result.success).toBe(true);
      expect(result.output).toContain('OpenAPI Spec Generated');
      expect(result.output).toContain('Paths: 1');
      expect(result.output).toContain('Endpoints: 2');
    } finally {
      cleanupTempProject(dir);
    }
  });

  it('should return error when no routes found', async () => {
    const dir = createTempProject({ 'empty.txt': '' });
    try {
      const result = await executeGenerateOpenAPI({ project_root: dir, framework: 'express' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('No API routes detected');
    } finally {
      cleanupTempProject(dir);
    }
  });
});
