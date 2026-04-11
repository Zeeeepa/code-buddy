/**
 * Tests for Private State Manager
 */

import {
  PrivateStateManager,
  getPrivateStateManager,
  resetPrivateStateManager,
} from '../../src/agent/state-privacy.js';

// ── Tests ──────────────────────────────────────────────────────────

describe('PrivateStateManager', () => {
  describe('constructor', () => {
    it('initializes with default private keys', () => {
      const psm = new PrivateStateManager();
      expect(psm.isPrivate('nicknameIdx')).toBe(true);
      expect(psm.isPrivate('nicknameGeneration')).toBe(true);
      expect(psm.isPrivate('nextId')).toBe(true);
      expect(psm.isPrivate('waitCallbacks')).toBe(true);
      expect(psm.isPrivate('messageQueues')).toBe(true);
    });

    it('accepts additional private keys', () => {
      const psm = new PrivateStateManager(['customSecret', 'internalState']);
      expect(psm.isPrivate('customSecret')).toBe(true);
      expect(psm.isPrivate('internalState')).toBe(true);
      // Default keys still present
      expect(psm.isPrivate('nicknameIdx')).toBe(true);
    });
  });

  describe('markPrivate / unmarkPrivate', () => {
    it('marks a key as private', () => {
      const psm = new PrivateStateManager();
      expect(psm.isPrivate('myKey')).toBe(false);
      psm.markPrivate('myKey');
      expect(psm.isPrivate('myKey')).toBe(true);
    });

    it('unmarks a key as private', () => {
      const psm = new PrivateStateManager();
      psm.markPrivate('tempKey');
      expect(psm.isPrivate('tempKey')).toBe(true);
      psm.unmarkPrivate('tempKey');
      expect(psm.isPrivate('tempKey')).toBe(false);
    });
  });

  describe('filterForOutput', () => {
    it('removes private keys from output', () => {
      const psm = new PrivateStateManager();
      const obj = {
        name: 'test',
        nicknameIdx: 42,
        description: 'hello',
        nextId: 99,
      };

      const filtered = psm.filterForOutput(obj);
      expect(filtered).toEqual({ name: 'test', description: 'hello' });
      expect(filtered).not.toHaveProperty('nicknameIdx');
      expect(filtered).not.toHaveProperty('nextId');
    });

    it('returns all keys if none are private', () => {
      const psm = new PrivateStateManager();
      const obj = { name: 'test', value: 123 };
      const filtered = psm.filterForOutput(obj);
      expect(filtered).toEqual(obj);
    });
  });

  describe('filterForLLM', () => {
    it('removes private keys for LLM context', () => {
      const psm = new PrivateStateManager();
      const obj = {
        status: 'running',
        waitCallbacks: ['cb1', 'cb2'],
        messageQueues: { q1: [] },
      };

      const filtered = psm.filterForLLM(obj);
      expect(filtered).toEqual({ status: 'running' });
    });
  });

  describe('filterMapForOutput', () => {
    it('removes private keys from Map', () => {
      const psm = new PrivateStateManager();
      const map = new Map<string, unknown>([
        ['publicKey', 'visible'],
        ['nicknameIdx', 42],
        ['data', { nested: true }],
      ]);

      const filtered = psm.filterMapForOutput(map);
      expect(filtered.has('publicKey')).toBe(true);
      expect(filtered.has('data')).toBe(true);
      expect(filtered.has('nicknameIdx')).toBe(false);
      expect(filtered.size).toBe(2);
    });
  });

  describe('getPrivateKeys', () => {
    it('returns array of private key names', () => {
      const psm = new PrivateStateManager();
      const keys = psm.getPrivateKeys();
      expect(Array.isArray(keys)).toBe(true);
      expect(keys).toContain('nicknameIdx');
      expect(keys).toContain('nextId');
    });
  });

  describe('singleton', () => {
    beforeEach(() => {
      resetPrivateStateManager();
    });

    it('getPrivateStateManager returns singleton', () => {
      const a = getPrivateStateManager();
      const b = getPrivateStateManager();
      expect(a).toBe(b);
    });

    it('resetPrivateStateManager creates new instance', () => {
      const a = getPrivateStateManager();
      a.markPrivate('sessionKey');
      expect(a.isPrivate('sessionKey')).toBe(true);

      resetPrivateStateManager();
      const b = getPrivateStateManager();
      expect(b.isPrivate('sessionKey')).toBe(false);
    });
  });
});
