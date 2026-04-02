/**
 * Sovereign Stitch Brick — proof tests
 *
 * These tests verify the four security properties of SovereignStitchBrick:
 *   1. NON-REVEALING  — the public proof contains no raw data
 *   2. CANNOT BE STOLEN — hmacKey is absent from every exported artifact
 *   3. PROVES IT'S REAL — verifyPublicProof() confirms authenticity without private keys
 *   4. SELF-HEALING   — heal() restores from a signed checkpoint after corruption
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { join } from 'path';
import { promises as fs } from 'fs';
import {
  SovereignStitchBrick,
  verifyPublicProof,
} from '../lib/sovereignStitch/stitchBrick';
import { generateKeyPair } from '../lib/sovereignStitch/signer';
import { ProofPublisher, loadAndVerify } from '../brics/public/stitch-proof';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const TMP_DIR = join(__dirname, 'tmp', 'stitch-brick-test');
const HMAC_KEY = 'super-secret-hmac-key-never-exported';
const SENSITIVE_DATA = { clientId: 'cust-001', nda_signed: true, payment: '$5,000' };

let keys: { publicKey: string; privateKey: string };

beforeEach(async () => {
  await fs.rm(TMP_DIR, { recursive: true, force: true });
  keys = generateKeyPair();
});

// ---------------------------------------------------------------------------
// 1. NON-REVEALING
// ---------------------------------------------------------------------------

describe('NON-REVEALING: public proof contains no raw data', () => {
  it('does not include the original data object in the exported proof', () => {
    const brick = new SovereignStitchBrick(HMAC_KEY, keys.privateKey, keys.publicKey);
    brick.commit('client-001', SENSITIVE_DATA);
    const proof = brick.exportPublicProof();

    const proofStr = JSON.stringify(proof);
    expect(proofStr).not.toContain('cust-001');
    expect(proofStr).not.toContain('nda_signed');
    expect(proofStr).not.toContain('5,000');
  });

  it('does not expose the hmacKey in the proof', () => {
    const brick = new SovereignStitchBrick(HMAC_KEY, keys.privateKey, keys.publicKey);
    brick.commit('client-001', SENSITIVE_DATA);
    const proof = brick.exportPublicProof();

    const proofStr = JSON.stringify(proof);
    expect(proofStr).not.toContain(HMAC_KEY);
    expect(proofStr).not.toContain('super-secret');
  });

  it('entries contain only id and commitment hash (no data field)', () => {
    const brick = new SovereignStitchBrick(HMAC_KEY, keys.privateKey, keys.publicKey);
    brick.commit('proj-42', { invoice: 9999, ssn: '000-00-0000' });
    const proof = brick.exportPublicProof();

    for (const entry of proof.entries) {
      expect(Object.keys(entry)).toEqual(['id', 'commitment']);
      expect(entry.commitment).toMatch(/^[a-f0-9]{64}$/); // hex SHA-256/HMAC length
    }
  });
});

// ---------------------------------------------------------------------------
// 2. CANNOT BE STOLEN
// ---------------------------------------------------------------------------

describe('CANNOT BE STOLEN: private keys absent from all exports', () => {
  it('does not include the RSA private key in the proof', () => {
    const brick = new SovereignStitchBrick(HMAC_KEY, keys.privateKey, keys.publicKey);
    brick.commit('tx-001', { amount: 100 });
    const proof = brick.exportPublicProof();

    // RSA private key PEM starts with -----BEGIN PRIVATE KEY-----
    expect(JSON.stringify(proof)).not.toContain('PRIVATE KEY');
  });

  it('does not include the RSA private key in the checkpoint file', async () => {
    const brick = new SovereignStitchBrick(HMAC_KEY, keys.privateKey, keys.publicKey, TMP_DIR);
    brick.commit('tx-001', { amount: 100 });
    await brick.checkpoint();

    const raw = await fs.readFile(join(TMP_DIR, 'stitch-checkpoint.json'), 'utf8');
    expect(raw).not.toContain('PRIVATE KEY');
    expect(raw).not.toContain(HMAC_KEY);
  });

  it('two proofs from the same data with different hmac keys produce different commitments', () => {
    const brick1 = new SovereignStitchBrick('key-one', keys.privateKey, keys.publicKey);
    const brick2 = new SovereignStitchBrick('key-two', keys.privateKey, keys.publicKey);
    brick1.commit('item', SENSITIVE_DATA);
    brick2.commit('item', SENSITIVE_DATA);

    const p1 = brick1.exportPublicProof();
    const p2 = brick2.exportPublicProof();
    // Same data, different hmac keys → different commitments (non-invertible without the key)
    expect(p1.entries[0].commitment).not.toBe(p2.entries[0].commitment);
  });
});

// ---------------------------------------------------------------------------
// 3. PROVES IT'S REAL
// ---------------------------------------------------------------------------

describe("PROVES IT'S REAL: verifyPublicProof() confirms authenticity", () => {
  it('valid proof passes verification with only the public key', () => {
    const brick = new SovereignStitchBrick(HMAC_KEY, keys.privateKey, keys.publicKey);
    brick.commit('client-001', SENSITIVE_DATA);
    brick.commit('client-002', { project: 'logo-redesign', paid: true });
    const proof = brick.exportPublicProof();

    // Anyone can call this — no private keys needed
    const result = verifyPublicProof(proof);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('tampered commitment list fails verification', () => {
    const brick = new SovereignStitchBrick(HMAC_KEY, keys.privateKey, keys.publicKey);
    brick.commit('client-001', SENSITIVE_DATA);
    const proof = brick.exportPublicProof();

    // Attacker flips one character in a commitment
    const tampered = {
      ...proof,
      entries: [{ ...proof.entries[0], commitment: proof.entries[0].commitment.replace('a', 'b') }],
    };
    const result = verifyPublicProof(tampered);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('merkle root mismatch'))).toBe(true);
  });

  it('tampered signature fails verification', () => {
    const brick = new SovereignStitchBrick(HMAC_KEY, keys.privateKey, keys.publicKey);
    brick.commit('client-001', SENSITIVE_DATA);
    const proof = brick.exportPublicProof();

    const tampered = { ...proof, signature: 'aGVsbG8=' }; // bogus base64
    const result = verifyPublicProof(tampered);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('signature is invalid'))).toBe(true);
  });

  it('proof signed by a different key fails verification', () => {
    const otherKeys = generateKeyPair();
    const brick = new SovereignStitchBrick(HMAC_KEY, otherKeys.privateKey, otherKeys.publicKey);
    brick.commit('client-001', SENSITIVE_DATA);
    const proof = brick.exportPublicProof();

    // Replace public key with the original keys' public key → signature mismatch
    const spoofed = { ...proof, publicKey: keys.publicKey };
    const result = verifyPublicProof(spoofed);
    expect(result.valid).toBe(false);
  });

  it('proof can be published and reloaded from disk, then verified', async () => {
    const brick = new SovereignStitchBrick(HMAC_KEY, keys.privateKey, keys.publicKey);
    brick.commit('proj-1', { status: 'complete' });
    const proof = brick.exportPublicProof();

    const publisher = new ProofPublisher({ outputDir: TMP_DIR });
    await publisher.publish(proof);

    const { valid, errors } = await loadAndVerify(TMP_DIR);
    expect(valid).toBe(true);
    expect(errors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 4. SELF-HEALING
// ---------------------------------------------------------------------------

describe('SELF-HEALING: brick restores from signed checkpoint on corruption', () => {
  it('heals in-memory state from a valid checkpoint', async () => {
    const brick = new SovereignStitchBrick(HMAC_KEY, keys.privateKey, keys.publicKey, TMP_DIR);
    brick.commit('item-1', { v: 'original' });
    brick.commit('item-2', { v: 'data' });
    await brick.checkpoint();

    const rootBefore = brick.getMerkleRoot();

    // Simulate in-memory corruption: add a rogue entry that was never properly signed
    (brick as any).entries.push({ id: 'rogue', commitment: 'deadbeef'.repeat(8) });

    const { ok: corruptOk } = brick.integrityCheck();
    expect(corruptOk).toBe(false);

    // Self-heal
    const { healed } = await brick.heal();
    expect(healed).toBe(true);

    // State is restored
    expect(brick.size).toBe(2);
    expect(brick.getMerkleRoot()).toBe(rootBefore);
    const { ok: healedOk } = brick.integrityCheck();
    expect(healedOk).toBe(true);
  });

  it('heal() rejects a tampered checkpoint file', async () => {
    const brick = new SovereignStitchBrick(HMAC_KEY, keys.privateKey, keys.publicKey, TMP_DIR);
    brick.commit('item-1', { v: 'original' });
    await brick.checkpoint();

    // Corrupt the checkpoint file on disk
    const cpPath = join(TMP_DIR, 'stitch-checkpoint.json');
    const raw = await fs.readFile(cpPath, 'utf8');
    const cp = JSON.parse(raw);
    cp.entries[0].commitment = 'tampered' + 'f'.repeat(57); // wrong hash
    await fs.writeFile(cpPath, JSON.stringify(cp, null, 2), 'utf8');

    // A fresh brick instance with no in-memory checkpoint must rely on disk
    const brick2 = new SovereignStitchBrick(HMAC_KEY, keys.privateKey, keys.publicKey, TMP_DIR);
    const { healed, reason } = await brick2.heal();
    expect(healed).toBe(false);
    expect(reason).toMatch(/signature|merkle/i);
  });

  it('integrityCheck() is clean after committing and taking a checkpoint', async () => {
    const brick = new SovereignStitchBrick(HMAC_KEY, keys.privateKey, keys.publicKey, TMP_DIR);
    brick.commit('x', { foo: 1 });
    brick.commit('y', { foo: 2 });
    await brick.checkpoint();
    const { ok, errors } = brick.integrityCheck();
    expect(ok).toBe(true);
    expect(errors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 5. PROVE IT WORKS END-TO-END (integration)
// ---------------------------------------------------------------------------

describe('END-TO-END: full stitch lifecycle', () => {
  it('commit → checkpoint → verify → corrupt → heal → verify again', async () => {
    const brick = new SovereignStitchBrick(HMAC_KEY, keys.privateKey, keys.publicKey, TMP_DIR);

    // 1. Commit private records
    const ids = ['c1', 'c2', 'c3'];
    const dataset: Record<string, unknown>[] = [
      { client: 'Alpha', paid: true },
      { client: 'Beta', paid: false },
      { client: 'Gamma', paid: true },
    ];
    ids.forEach((id, i) => brick.commit(id, dataset[i]));

    // 2. Checkpoint
    await brick.checkpoint();
    const rootAfterCheckpoint = brick.getMerkleRoot();

    // 3. Export public proof — verify it
    const proof = brick.exportPublicProof();
    expect(verifyPublicProof(proof).valid).toBe(true);

    // 4. Corrupt in-memory state
    (brick as any).entries = [];

    // 5. Heal
    const { healed } = await brick.heal();
    expect(healed).toBe(true);

    // 6. Verify clean after heal
    expect(brick.getMerkleRoot()).toBe(rootAfterCheckpoint);
    expect(brick.size).toBe(3);

    // 7. Confirm internal verify() still works with original data
    expect(brick.verify('c1', dataset[0])).toBe(true);
    expect(brick.verify('c2', dataset[1])).toBe(true);
    expect(brick.verify('c3', dataset[2])).toBe(true);
  });
});
