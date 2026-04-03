/**
 * KMS Adapter Tests
 * Tests for LocalKMS – put, get, has, overwrite, and error handling.
 * The LocalKMS is the test-safe stand-in for production KMS (AWS/GCP/Azure).
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { LocalKMS } from '../lib/sovereignStitch/kmsAdapter';

const TMP_BASE = join('/tmp', `kms-test-${Date.now()}`);

describe('LocalKMS', () => {
  let kms: LocalKMS;
  let testDir: string;

  beforeEach(async () => {
    // Each test gets its own isolated directory
    testDir = join(TMP_BASE, `run-${Math.random().toString(36).slice(2, 9)}`);
    await fs.rm(testDir, { recursive: true, force: true });
    kms = new LocalKMS(testDir);
  });

  afterAll(async () => {
    await fs.rm(TMP_BASE, { recursive: true, force: true });
  });

  // ---------------------------------------------------------------------------
  // putKey / getKey round-trip
  // ---------------------------------------------------------------------------

  it('stores and retrieves a key by ID', async () => {
    await kms.putKey('state-ca', '-----BEGIN PRIVATE KEY-----\nFAKE\n-----END PRIVATE KEY-----');
    const retrieved = await kms.getKey('state-ca');
    expect(retrieved).toContain('BEGIN PRIVATE KEY');
  });

  it('round-trips arbitrary PEM content unchanged', async () => {
    const pem = '-----BEGIN PUBLIC KEY-----\nABCDEFGH\n-----END PUBLIC KEY-----\n';
    await kms.putKey('state-il', pem);
    expect(await kms.getKey('state-il')).toBe(pem);
  });

  it('stores multiple keys independently', async () => {
    await kms.putKey('key-ca', 'pem-ca-content');
    await kms.putKey('key-tx', 'pem-tx-content');

    expect(await kms.getKey('key-ca')).toBe('pem-ca-content');
    expect(await kms.getKey('key-tx')).toBe('pem-tx-content');
  });

  it('creates the base directory automatically on first putKey', async () => {
    // Directory does not exist yet
    const dirExists = await fs.access(testDir).then(() => true).catch(() => false);
    expect(dirExists).toBe(false);

    await kms.putKey('auto-dir-key', 'value');

    const stat = await fs.stat(testDir);
    expect(stat.isDirectory()).toBe(true);
  });

  it('overwrites an existing key', async () => {
    await kms.putKey('mutable-key', 'original-value');
    await kms.putKey('mutable-key', 'updated-value');

    expect(await kms.getKey('mutable-key')).toBe('updated-value');
  });

  // ---------------------------------------------------------------------------
  // hasKey
  // ---------------------------------------------------------------------------

  it('hasKey returns true for an existing key', async () => {
    await kms.putKey('present-key', 'some-pem');
    expect(await kms.hasKey('present-key')).toBe(true);
  });

  it('hasKey returns false for a key that was never stored', async () => {
    expect(await kms.hasKey('absent-key')).toBe(false);
  });

  it('hasKey returns false after directory creation but before any key is stored', async () => {
    await fs.mkdir(testDir, { recursive: true });
    expect(await kms.hasKey('nothing-yet')).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // getKey error handling
  // ---------------------------------------------------------------------------

  it('throws when getKey is called for a missing key', async () => {
    await expect(kms.getKey('nonexistent')).rejects.toThrow();
  });

  it('getKey throws for a key that was never stored even if directory exists', async () => {
    await fs.mkdir(testDir, { recursive: true });
    await expect(kms.getKey('ghost-key')).rejects.toThrow();
  });

  // ---------------------------------------------------------------------------
  // putKey return value
  // ---------------------------------------------------------------------------

  it('putKey returns the path of the stored file', async () => {
    const path = await kms.putKey('path-check', 'value');
    expect(path).toContain('path-check.pem');
    expect(path).toContain(testDir);
  });
});
