/**
 * Merkle + Signer unit tests
 * Tests for sha256, merkleRoot, generateKeyPair, signData, and verifyData.
 * These are the cryptographic primitives underpinning the SovereignStitch layer.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { sha256, merkleRoot } from '../lib/sovereignStitch/merkle';
import { generateKeyPair, signData, verifyData } from '../lib/sovereignStitch/signer';

// ---------------------------------------------------------------------------
// sha256
// ---------------------------------------------------------------------------

describe('sha256', () => {
  it('returns a 64-character lowercase hex string', () => {
    const hash = sha256('hello world');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it('is deterministic for the same string input', () => {
    expect(sha256('deterministic')).toBe(sha256('deterministic'));
  });

  it('is deterministic for the same Buffer input', () => {
    const buf = Buffer.from('buffer input');
    expect(sha256(buf)).toBe(sha256(buf));
  });

  it('produces different hashes for different inputs', () => {
    expect(sha256('foo')).not.toBe(sha256('bar'));
    expect(sha256('a')).not.toBe(sha256('b'));
  });

  it('string and equivalent Buffer produce the same hash', () => {
    const str = 'same content';
    const buf = Buffer.from(str, 'utf8');
    expect(sha256(str)).toBe(sha256(buf));
  });

  it('produces a non-empty hash for an empty string', () => {
    const hash = sha256('');
    expect(hash).toHaveLength(64);
  });

  it('produces the same hash as Node crypto createHash for "abc"', () => {
    // Cross-check against Node.js crypto to verify our sha256 wrapper is correct
    const { createHash } = require('crypto');
    const expected = createHash('sha256').update('abc').digest('hex');
    expect(sha256('abc')).toBe(expected);
    expect(expected).toHaveLength(64);
  });
});

// ---------------------------------------------------------------------------
// merkleRoot
// ---------------------------------------------------------------------------

describe('merkleRoot', () => {
  it('returns null for an empty array', () => {
    expect(merkleRoot([])).toBeNull();
  });

  it('returns null for a null/undefined-like falsy input', () => {
    // The implementation guards: if (!hashes || hashes.length === 0) return null
    expect(merkleRoot(null as unknown as string[])).toBeNull();
  });

  it('returns the single element unchanged for a one-element array', () => {
    const h = sha256('only');
    expect(merkleRoot([h])).toBe(h);
  });

  it('combines two hashes correctly', () => {
    const h1 = sha256('left');
    const h2 = sha256('right');
    const expected = sha256(h1 + h2);
    expect(merkleRoot([h1, h2])).toBe(expected);
  });

  it('duplicates the last element for an odd-length array (3 leaves)', () => {
    const h1 = sha256('a');
    const h2 = sha256('b');
    const h3 = sha256('c');

    // Level 1: sha256(h1+h2) and sha256(h3+h3)
    const pair1 = sha256(h1 + h2);
    const pair2 = sha256(h3 + h3);
    const expected = sha256(pair1 + pair2);

    expect(merkleRoot([h1, h2, h3])).toBe(expected);
  });

  it('handles four leaves (even tree) correctly', () => {
    const [h1, h2, h3, h4] = ['a', 'b', 'c', 'd'].map(sha256);

    const left = sha256(h1 + h2);
    const right = sha256(h3 + h4);
    const expected = sha256(left + right);

    expect(merkleRoot([h1, h2, h3, h4])).toBe(expected);
  });

  it('is deterministic – same leaves always produce the same root', () => {
    const hashes = ['x', 'y', 'z'].map(sha256);
    expect(merkleRoot(hashes)).toBe(merkleRoot(hashes));
  });

  it('produces different roots for different leaf sets', () => {
    const setA = ['a', 'b'].map(sha256);
    const setB = ['c', 'd'].map(sha256);
    expect(merkleRoot(setA)).not.toBe(merkleRoot(setB));
  });

  it('handles a single-element array that is a pre-computed hash', () => {
    const hash = sha256('pre-computed');
    expect(merkleRoot([hash])).toBe(hash);
  });
});

// ---------------------------------------------------------------------------
// generateKeyPair
// ---------------------------------------------------------------------------

describe('generateKeyPair', () => {
  it('returns an object with publicKey and privateKey strings', () => {
    const kp = generateKeyPair();
    expect(typeof kp.publicKey).toBe('string');
    expect(typeof kp.privateKey).toBe('string');
  });

  it('publicKey is in PEM SPKI format', () => {
    const { publicKey } = generateKeyPair();
    expect(publicKey).toContain('-----BEGIN PUBLIC KEY-----');
    expect(publicKey).toContain('-----END PUBLIC KEY-----');
  });

  it('privateKey is in PEM PKCS8 format', () => {
    const { privateKey } = generateKeyPair();
    expect(privateKey).toContain('-----BEGIN PRIVATE KEY-----');
    expect(privateKey).toContain('-----END PRIVATE KEY-----');
  });

  it('generates distinct key pairs on each call', () => {
    const kp1 = generateKeyPair();
    const kp2 = generateKeyPair();
    expect(kp1.publicKey).not.toBe(kp2.publicKey);
    expect(kp1.privateKey).not.toBe(kp2.privateKey);
  });
});

// ---------------------------------------------------------------------------
// signData / verifyData
// ---------------------------------------------------------------------------

describe('signData and verifyData', () => {
  let publicKey: string;
  let privateKey: string;

  beforeAll(() => {
    ({ publicKey, privateKey } = generateKeyPair());
  });

  it('verifies a valid signature for a string payload', () => {
    const data = 'checkpoint-payload-string';
    const sig = signData(privateKey, data);
    expect(verifyData(publicKey, data, sig)).toBe(true);
  });

  it('verifies a valid signature for a Buffer payload', () => {
    const data = Buffer.from('checkpoint-payload-buffer');
    const sig = signData(privateKey, data);
    expect(verifyData(publicKey, data, sig)).toBe(true);
  });

  it('rejects a signature when the data is tampered', () => {
    const original = 'authentic data';
    const sig = signData(privateKey, original);
    expect(verifyData(publicKey, 'tampered data', sig)).toBe(false);
  });

  it('rejects a signature produced by a different private key', () => {
    const { privateKey: otherPrivateKey } = generateKeyPair();
    const sig = signData(otherPrivateKey, 'some data');
    expect(verifyData(publicKey, 'some data', sig)).toBe(false);
  });

  it('signature is a non-empty base64 string', () => {
    const sig = signData(privateKey, 'test');
    expect(sig.length).toBeGreaterThan(0);
    expect(sig).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  it('round-trips JSON checkpoint data correctly', () => {
    const checkpoint = JSON.stringify({ bricks: [{ id: '1', data: 'x' }], merkle: sha256('x') });
    const sig = signData(privateKey, checkpoint);
    expect(verifyData(publicKey, checkpoint, sig)).toBe(true);
  });

  it('different data produces different signatures', () => {
    const sig1 = signData(privateKey, 'payload-one');
    const sig2 = signData(privateKey, 'payload-two');
    expect(sig1).not.toBe(sig2);
  });
});
