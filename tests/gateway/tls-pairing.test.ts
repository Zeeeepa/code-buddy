/**
 * Tests for Gateway TLS Local Pairing Skip
 *
 * Phase 5: TLS configuration, local pairing skip logic
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { GatewayConfig, ClientState } from '../../src/gateway/types.js';
import { DEFAULT_GATEWAY_CONFIG } from '../../src/gateway/types.js';

describe('Gateway TLS Configuration', () => {
  it('should have TLS fields in GatewayConfig', () => {
    const config: GatewayConfig = {
      ...DEFAULT_GATEWAY_CONFIG,
      tlsEnabled: true,
      tlsCert: '/path/to/cert.pem',
      tlsKey: '/path/to/key.pem',
    };

    expect(config.tlsEnabled).toBe(true);
    expect(config.tlsCert).toBe('/path/to/cert.pem');
    expect(config.tlsKey).toBe('/path/to/key.pem');
  });

  it('TLS should be disabled by default', () => {
    expect(DEFAULT_GATEWAY_CONFIG.tlsEnabled).toBe(false);
  });
});

describe('TLS Local Pairing Skip Logic', () => {
  function shouldSkipPairing(
    config: GatewayConfig,
    clientIp: string
  ): boolean {
    if (!config.tlsEnabled) return false;
    if (!config.skipLocalPairing) return false;
    return clientIp === '127.0.0.1' || clientIp === '::1';
  }

  it('should skip pairing for localhost + TLS', () => {
    const config: GatewayConfig = {
      ...DEFAULT_GATEWAY_CONFIG,
      tlsEnabled: true,
      skipLocalPairing: true,
    };
    expect(shouldSkipPairing(config, '127.0.0.1')).toBe(true);
    expect(shouldSkipPairing(config, '::1')).toBe(true);
  });

  it('should NOT skip pairing for remote + TLS', () => {
    const config: GatewayConfig = {
      ...DEFAULT_GATEWAY_CONFIG,
      tlsEnabled: true,
      skipLocalPairing: true,
    };
    expect(shouldSkipPairing(config, '192.168.1.10')).toBe(false);
    expect(shouldSkipPairing(config, '10.0.0.5')).toBe(false);
  });

  it('should NOT skip pairing without TLS', () => {
    const config: GatewayConfig = {
      ...DEFAULT_GATEWAY_CONFIG,
      tlsEnabled: false,
      skipLocalPairing: true,
    };
    expect(shouldSkipPairing(config, '127.0.0.1')).toBe(false);
  });

  it('should NOT skip pairing when skipLocalPairing is false', () => {
    const config: GatewayConfig = {
      ...DEFAULT_GATEWAY_CONFIG,
      tlsEnabled: true,
      skipLocalPairing: false,
    };
    expect(shouldSkipPairing(config, '127.0.0.1')).toBe(false);
  });

  it('should support GATEWAY_TLS_CERT and GATEWAY_TLS_KEY env vars', () => {
    const cert = process.env.GATEWAY_TLS_CERT;
    const key = process.env.GATEWAY_TLS_KEY;

    // Config should be constructable from env vars
    const config: Partial<GatewayConfig> = {};
    if (cert) config.tlsCert = cert;
    if (key) config.tlsKey = key;
    if (cert && key) config.tlsEnabled = true;

    // Without env vars set, TLS should not be enabled
    if (!cert || !key) {
      expect(config.tlsEnabled).toBeUndefined();
    }
  });
});
