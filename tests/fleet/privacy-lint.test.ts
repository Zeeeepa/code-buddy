/**
 * Fleet P8 — privacy lint detection tests. Heuristic patterns; we
 * mostly check no false negatives on known secret shapes and that
 * obvious safe content stays clean.
 */
import { describe, expect, it } from 'vitest';
import { scanForSecrets } from '../../src/fleet/privacy-lint';

describe('scanForSecrets', () => {
  it('returns no matches for plain text', () => {
    const out = scanForSecrets('What is the weather like in Paris today?');
    expect(out.hasSecrets).toBe(false);
    expect(out.matches).toEqual([]);
  });

  it('detects an OpenAI sk- key (high confidence)', () => {
    const out = scanForSecrets('My key is sk-abcdef1234567890ABCDEF1234567890');
    expect(out.hasSecrets).toBe(true);
    expect(out.highConfidence).toBe(true);
    expect(out.matches[0].kind).toBe('env-key');
  });

  it('detects an Anthropic sk-ant- key', () => {
    const out = scanForSecrets('export ANTHROPIC_API_KEY=sk-ant-api03-abcdefghijklmnop1234567890qrstuvwx');
    expect(out.matches.some((m) => m.kind === 'env-key')).toBe(true);
  });

  it('detects an AWS access key id', () => {
    const out = scanForSecrets('AKIAIOSFODNN7EXAMPLE used in prod');
    expect(out.matches.some((m) => m.kind === 'env-key')).toBe(true);
  });

  it('detects a GitHub PAT', () => {
    const out = scanForSecrets(
      'token: ghp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    );
    expect(out.matches.some((m) => m.kind === 'env-key')).toBe(true);
  });

  it('detects a Google AIza key', () => {
    const out = scanForSecrets(
      'GEMINI_API_KEY=AIzaSyAbcdefghijklmnopqrstuvwxyz1234567A',
    );
    expect(out.matches.some((m) => m.kind === 'env-key')).toBe(true);
  });

  it('detects a JWT', () => {
    const jwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    const out = scanForSecrets(`auth: Bearer ${jwt}`);
    expect(out.matches.some((m) => m.kind === 'jwt')).toBe(true);
  });

  it('detects a PEM private key block', () => {
    const pem =
      '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEAxxx\n-----END RSA PRIVATE KEY-----';
    const out = scanForSecrets(`Here is a key: ${pem}`);
    expect(out.matches.some((m) => m.kind === 'private-key-pem')).toBe(true);
    expect(out.highConfidence).toBe(true);
  });

  it('detects multi-line dotenv blocks', () => {
    const env = `\nDATABASE_URL=postgres://user:pass@host\nAPI_KEY=secret\nDEBUG=1\n`;
    const out = scanForSecrets(env);
    expect(out.matches.some((m) => m.kind === 'dotenv-block')).toBe(true);
  });

  it('detects private home paths', () => {
    const out = scanForSecrets(
      'Help me debug this issue in /home/patrice/Documents/private',
    );
    expect(out.matches.some((m) => m.kind === 'private-path')).toBe(true);
  });

  it('preview redacts most of the matched secret', () => {
    const out = scanForSecrets('sk-anbcdefghijklmnopqrstuvwx12345');
    const preview = out.matches[0].preview;
    expect(preview).toContain('redacted');
    expect(preview).not.toContain('mnopqr');
  });

  it('avoids overlapping matches when several patterns hit the same range', () => {
    const out = scanForSecrets(
      'AIzaSyAbcdefghijklmnopqrstuvwxyz1234567A in /home/patrice/foo',
    );
    // env-key + private-path should both register as separate matches.
    expect(out.matches.length).toBeGreaterThanOrEqual(2);
    const ranges = out.matches.map((m) => `${m.start}-${m.end}`);
    expect(new Set(ranges).size).toBe(ranges.length);
  });
});
