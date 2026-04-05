/**
 * Public BRIC Unit Tests
 * Validates asset publishing, Law #1 boundary, and audit
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { PublicBric } from '@/brics/public/index';

const TMP_DIR = '/tmp/tests-brics-public';

async function cleanup() {
  try {
    await fs.rm(TMP_DIR, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

describe('PublicBric — asset publishing', () => {
  let bric: PublicBric;

  beforeEach(async () => {
    await cleanup();
    bric = new PublicBric({ baseDir: TMP_DIR, publicBaseUrl: 'https://example.com' });
  });

  afterEach(cleanup);

  it('publishes and retrieves an asset', async () => {
    await bric.publishAsset('home', '/index.html', '<h1>Hello</h1>', 'text/html');
    const asset = bric.getAsset('home');
    expect(asset).not.toBeNull();
    expect(asset!.content).toContain('Hello');
    expect(asset!.contentType).toBe('text/html');
  });

  it('listAssets returns all published assets', async () => {
    await bric.publishAsset('a', '/a.html', 'A', 'text/html');
    await bric.publishAsset('b', '/b.css', 'B', 'text/css');
    const list = bric.listAssets();
    expect(list.length).toBeGreaterThanOrEqual(2);
    const ids = list.map(a => a.id);
    expect(ids).toContain('a');
    expect(ids).toContain('b');
  });

  it('persists assets to disk', async () => {
    await bric.publishAsset('disk-test', '/disk.html', 'saved', 'text/html');
    const filePath = path.join(TMP_DIR, 'disk-test.json');
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    expect(parsed.content).toBe('saved');
  });

  it('createLandingPage creates a landing page asset', async () => {
    await bric.createLandingPage();
    const asset = bric.getAsset('landing-page');
    expect(asset).not.toBeNull();
    expect(asset!.contentType).toBe('text/html');
    expect(asset!.content).toContain('JGA');
  });

  it('createOwnersRoomEntry creates the admin entry point', async () => {
    await bric.createOwnersRoomEntry();
    const asset = bric.getAsset('owners-entry');
    expect(asset).not.toBeNull();
    expect(asset!.path).toBe('/admin.html');
  });
});

describe('PublicBric — Law #1 boundary audit', () => {
  let bric: PublicBric;

  beforeEach(async () => {
    await cleanup();
    bric = new PublicBric({ baseDir: TMP_DIR, publicBaseUrl: 'https://example.com' });
  });

  afterEach(cleanup);

  it('returns ok=true when no assets contain credentials', async () => {
    await bric.publishAsset('safe', '/safe.html', '<p>Welcome</p>', 'text/html');
    const audit = await bric.auditPublicBoundary();
    expect(audit.ok).toBe(true);
    expect(audit.violations).toHaveLength(0);
  });

  it('returns violations when asset content looks like credentials', async () => {
    // A 40-char base64-like string that looks like an API key
    const suspicious = 'A'.repeat(40);
    await bric.publishAsset('bad', '/bad.html', suspicious, 'text/html');
    const audit = await bric.auditPublicBoundary();
    expect(audit.violations.length).toBeGreaterThan(0);
  });
});
