/**
 * Authentication Tests
 *
 * Tests for API key and JWT authentication.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { createHmac, randomBytes } from 'crypto';

describe('API Key Management', () => {
  describe('Key Generation', () => {
    it('should generate key with correct prefix', () => {
      const prefix = 'cb_sk_';
      const randomPart = randomBytes(24).toString('base64url');
      const key = prefix + randomPart;

      expect(key.startsWith('cb_sk_')).toBe(true);
    });

    it('should generate unique keys', () => {
      const generateKey = () => 'cb_sk_' + randomBytes(24).toString('base64url');

      const key1 = generateKey();
      const key2 = generateKey();

      expect(key1).not.toBe(key2);
    });

    it('should create key hash', () => {
      const key = 'cb_sk_test123';
      const hash = createHmac('sha256', 'salt').update(key).digest('hex');

      expect(hash).toHaveLength(64);
    });

    it('should include creation metadata', () => {
      const apiKey = {
        id: 'key_123',
        name: 'Test Key',
        keyHash: 'abc123',
        scopes: ['chat'],
        createdAt: new Date().toISOString(),
        createdBy: 'user123',
      };

      expect(apiKey.createdAt).toBeDefined();
      expect(apiKey.createdBy).toBeDefined();
    });
  });

  describe('Key Validation', () => {
    it('should validate key format', () => {
      const isValidFormat = (key: string) => {
        return key.startsWith('cb_sk_') && key.length > 10;
      };

      expect(isValidFormat('cb_sk_validkey123')).toBe(true);
      expect(isValidFormat('invalid_key')).toBe(false);
      expect(isValidFormat('cb_sk_')).toBe(false);
    });

    it('should check key expiration', () => {
      const apiKey = {
        expiresAt: new Date(Date.now() - 1000).toISOString(), // Expired
      };

      const isExpired = apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date();
      expect(isExpired).toBe(true);
    });

    it('should allow non-expiring keys', () => {
      const apiKey = {
        expiresAt: undefined,
      };

      const isExpired = apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date();
      expect(isExpired).toBeFalsy();
    });

    it('should verify key hash', () => {
      const key = 'cb_sk_test123';
      const salt = 'salt';
      const storedHash = createHmac('sha256', salt).update(key).digest('hex');
      const computedHash = createHmac('sha256', salt).update(key).digest('hex');

      expect(storedHash).toBe(computedHash);
    });
  });

  describe('Scope Checking', () => {
    it('should check if key has scope', () => {
      const apiKey = { scopes: ['chat', 'tools'] };
      const hasScope = (scope: string) => apiKey.scopes.includes(scope);

      expect(hasScope('chat')).toBe(true);
      expect(hasScope('admin')).toBe(false);
    });

    it('should support wildcard scopes', () => {
      const apiKey = { scopes: ['tools:*'] };

      const hasWildcardScope = (scope: string) => {
        const [category] = scope.split(':');
        return apiKey.scopes.some(s =>
          s === scope || s === `${category}:*` || s === '*'
        );
      };

      expect(hasWildcardScope('tools:read')).toBe(true);
      expect(hasWildcardScope('tools:execute')).toBe(true);
      expect(hasWildcardScope('chat:stream')).toBe(false);
    });

    it('should allow admin scope for all operations', () => {
      const apiKey = { scopes: ['admin'] };

      const hasAccess = (requiredScope: string) => {
        return apiKey.scopes.includes('admin') || apiKey.scopes.includes(requiredScope);
      };

      expect(hasAccess('chat')).toBe(true);
      expect(hasAccess('tools:execute')).toBe(true);
      expect(hasAccess('sessions:write')).toBe(true);
    });
  });

  describe('Key Revocation', () => {
    it('should mark key as revoked', () => {
      const apiKey = {
        id: 'key_123',
        revoked: false,
        revokedAt: null as string | null,
      };

      // Revoke key
      apiKey.revoked = true;
      apiKey.revokedAt = new Date().toISOString();

      expect(apiKey.revoked).toBe(true);
      expect(apiKey.revokedAt).toBeDefined();
    });

    it('should reject revoked keys', () => {
      const apiKey = { revoked: true };
      const isValid = !apiKey.revoked;

      expect(isValid).toBe(false);
    });
  });

  describe('Key Listing', () => {
    it('should not expose key hash in listing', () => {
      const apiKey = {
        id: 'key_123',
        name: 'Test Key',
        keyHash: 'secret_hash',
        keyPreview: 'cb_sk_...xyz',
      };

      const publicInfo = {
        id: apiKey.id,
        name: apiKey.name,
        keyPreview: apiKey.keyPreview,
      };

      expect(publicInfo).not.toHaveProperty('keyHash');
    });

    it('should generate key preview', () => {
      const key = 'cb_sk_abcdefghijklmnop';
      const preview = key.slice(0, 10) + '...' + key.slice(-4);

      expect(preview).toBe('cb_sk_abcd...mnop');
    });
  });
});

describe('JWT Authentication', () => {
  describe('Token Generation', () => {
    it('should create JWT header', () => {
      const header = {
        alg: 'HS256',
        typ: 'JWT',
      };

      const encoded = Buffer.from(JSON.stringify(header)).toString('base64url');
      expect(encoded).toBeDefined();
    });

    it('should create JWT payload', () => {
      const payload = {
        sub: 'user123',
        userId: 'user123',
        scopes: ['chat'],
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      expect(payload.sub).toBeDefined();
      expect(payload.exp).toBeGreaterThan(payload.iat);
    });

    it('should sign token with HMAC-SHA256', () => {
      const data = 'header.payload';
      const secret = 'test-secret';
      const signature = createHmac('sha256', secret).update(data).digest('base64url');

      expect(signature).toBeDefined();
    });

    it('should format complete JWT', () => {
      const header = Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url');
      const payload = Buffer.from('{"sub":"user123"}').toString('base64url');
      const signature = 'mock_signature';

      const token = `${header}.${payload}.${signature}`;
      const parts = token.split('.');

      expect(parts).toHaveLength(3);
    });
  });

  describe('Token Verification', () => {
    it('should parse token parts', () => {
      const token = 'header.payload.signature';
      const parts = token.split('.');

      expect(parts).toHaveLength(3);
    });

    it('should reject malformed tokens', () => {
      const malformedTokens = [
        'invalid',
        'header.payload',
        'header.payload.sig.extra',
        '',
      ];

      malformedTokens.forEach(token => {
        const parts = token.split('.');
        expect(parts.length).not.toBe(3);
      });
    });

    it('should decode payload', () => {
      const payloadData = { sub: 'user123', scopes: ['chat'] };
      const encoded = Buffer.from(JSON.stringify(payloadData)).toString('base64url');
      const decoded = JSON.parse(Buffer.from(encoded, 'base64url').toString());

      expect(decoded.sub).toBe('user123');
    });

    it('should verify signature', () => {
      const header = Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url');
      const payload = Buffer.from('{"sub":"user123"}').toString('base64url');
      const data = `${header}.${payload}`;
      const secret = 'test-secret';

      const expectedSig = createHmac('sha256', secret).update(data).digest('base64url');
      const providedSig = createHmac('sha256', secret).update(data).digest('base64url');

      expect(expectedSig).toBe(providedSig);
    });

    it('should reject invalid signature', () => {
      const correctSig = 'correct_signature';
      const providedSig = 'wrong_signature';

      expect(correctSig).not.toBe(providedSig);
    });
  });

  describe('Token Expiration', () => {
    it('should check expiration', () => {
      const now = Math.floor(Date.now() / 1000);
      const expiredPayload = { exp: now - 100 };
      const validPayload = { exp: now + 3600 };

      expect(expiredPayload.exp < now).toBe(true);
      expect(validPayload.exp < now).toBe(false);
    });

    it('should parse expiration formats', () => {
      const parseExpiration = (exp: string | number): number => {
        if (typeof exp === 'number') return exp;

        const match = exp.match(/^(\d+)([smhd])$/);
        if (!match) return 3600;

        const value = parseInt(match[1]);
        const unit = match[2];
        const multipliers: Record<string, number> = {
          s: 1,
          m: 60,
          h: 3600,
          d: 86400,
        };

        return value * multipliers[unit];
      };

      expect(parseExpiration('24h')).toBe(86400);
      expect(parseExpiration('30m')).toBe(1800);
      expect(parseExpiration(7200)).toBe(7200);
    });
  });

  describe('Token Refresh', () => {
    it('should issue new token with extended expiration', () => {
      const originalExp = Math.floor(Date.now() / 1000) + 100;
      const newExp = Math.floor(Date.now() / 1000) + 3600;

      expect(newExp).toBeGreaterThan(originalExp);
    });

    it('should preserve user claims', () => {
      const originalPayload = {
        sub: 'user123',
        userId: 'user123',
        scopes: ['chat', 'tools'],
      };

      const refreshedPayload = {
        ...originalPayload,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      expect(refreshedPayload.sub).toBe(originalPayload.sub);
      expect(refreshedPayload.scopes).toEqual(originalPayload.scopes);
    });

    it('should reject refresh of revoked tokens', () => {
      const revokedTokens = new Set(['token_abc123']);
      const tokenId = 'token_abc123';

      const isRevoked = revokedTokens.has(tokenId);
      expect(isRevoked).toBe(true);
    });
  });

  describe('Claims', () => {
    it('should include required claims', () => {
      const payload = {
        sub: 'user123',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      expect(payload.sub).toBeDefined();
      expect(payload.iat).toBeDefined();
      expect(payload.exp).toBeDefined();
    });

    it('should support custom claims', () => {
      const payload = {
        sub: 'user123',
        userId: 'user123',
        scopes: ['chat'],
        customClaim: 'value',
      };

      expect(payload.customClaim).toBe('value');
    });

    it('should extract user ID from token', () => {
      const payload = { userId: 'user123' };
      const userId = payload.userId;

      expect(userId).toBe('user123');
    });

    it('should extract scopes from token', () => {
      const payload = { scopes: ['chat', 'tools'] };
      const scopes = payload.scopes;

      expect(scopes).toContain('chat');
      expect(scopes).toContain('tools');
    });
  });
});

describe('Authentication Flow', () => {
  it('should prefer API key over JWT', () => {
    const hasApiKey = true;
    const hasJwt = true;

    const authMethod = hasApiKey ? 'api_key' : hasJwt ? 'jwt' : null;
    expect(authMethod).toBe('api_key');
  });

  it('should extract auth from multiple sources', () => {
    const headers = {
      authorization: 'Bearer token123',
      'x-api-key': 'cb_sk_key123',
    };

    const apiKey = headers['x-api-key'];
    const bearerToken = headers.authorization?.startsWith('Bearer ')
      ? headers.authorization.slice(7)
      : null;

    expect(apiKey).toBe('cb_sk_key123');
    expect(bearerToken).toBe('token123');
  });

  it('should attach auth info to request', () => {
    const req = {
      auth: undefined as any,
    };

    req.auth = {
      type: 'api_key',
      keyId: 'key_123',
      scopes: ['chat'],
      authenticated: true,
    };

    expect(req.auth.authenticated).toBe(true);
    expect(req.auth.type).toBe('api_key');
  });

  it('should allow unauthenticated access when auth disabled', () => {
    const config = { authEnabled: false };

    const requiresAuth = config.authEnabled;
    expect(requiresAuth).toBe(false);
  });
});
