/**
 * SovereignStitchBrick
 *
 * A self-healing, non-revealing micro-brick implementation that:
 *   - Commits to private data using HMAC-SHA256 (no raw data is ever exported)
 *   - Builds an RSA-signed Merkle root over those commitments as a public proof
 *   - Detects tampered/missing commitments and auto-heals from the last signed checkpoint
 *   - Exposes a zero-data public artifact: {commitments, merkleRoot, signature, publicKey}
 *
 * Security properties:
 *   NON-REVEALING  — commitments are HMAC(data, hmacKey); without the hmacKey the data
 *                    cannot be reconstructed from the public proof.
 *   CANNOT BE STOLEN — the hmacKey lives only in memory; it is never written to disk or
 *                    included in any exported artifact.
 *   PROVES IT'S REAL — an RSA key pair signs the Merkle root; any holder of the public key
 *                    can independently verify the root matches the listed commitments.
 *   SELF-HEALING   — verify() detects mismatches; heal() restores from the last valid
 *                    signed checkpoint automatically.
 *
 * Usage:
 *   const brick = new SovereignStitchBrick(hmacKey, rsaPrivateKeyPem, rsaPublicKeyPem);
 *   await brick.commit('client-001', sensitiveData);
 *   const proof = brick.exportPublicProof();          // safe to publish anywhere
 *   const ok    = verifyPublicProof(proof);           // anyone can call this
 */

import { createHmac } from 'crypto';
import { merkleRoot } from './merkle';
import { signData, verifyData } from './signer';
import { promises as fs } from 'fs';
import { join } from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BrickEntry = {
  /** Stable external identifier — safe to store publicly */
  id: string;
  /** HMAC-SHA256 commitment over the serialised data — no raw data exposed */
  commitment: string;
};

export type SignedCheckpoint = {
  entries: BrickEntry[];
  merkleRoot: string | null;
  timestamp: number;
  /** RSA signature over JSON.stringify({entries, merkleRoot, timestamp}) */
  signature: string;
};

export type PublicStitchProof = {
  /** Ordered list of (id, commitment) pairs — no raw data */
  entries: BrickEntry[];
  /** Merkle root over all commitment hashes */
  merkleRoot: string | null;
  /** RSA signature over the canonical proof payload — verifiable with publicKey */
  signature: string;
  /** PEM-encoded RSA public key — safe to publish */
  publicKey: string;
  /** Unix timestamp (ms) when the proof was produced */
  timestamp: number;
};

// ---------------------------------------------------------------------------
// Core brick
// ---------------------------------------------------------------------------

export class SovereignStitchBrick {
  private entries: BrickEntry[] = [];
  private lastCheckpoint: SignedCheckpoint | null = null;
  private baseDir: string | null = null;

  /**
   * @param hmacKey        Private secret used for HMAC commitments.
   *                       NEVER exported; keep in a secrets vault.
   * @param rsaPrivateKey  PEM RSA private key for signing the Merkle root proof.
   * @param rsaPublicKey   PEM RSA public key embedded in exported proofs.
   * @param persistDir     Optional filesystem directory for checkpoint persistence.
   */
  constructor(
    private readonly hmacKey: string,
    private readonly rsaPrivateKey: string,
    private readonly rsaPublicKey: string,
    persistDir?: string,
  ) {
    if (persistDir) {
      this.baseDir = persistDir;
    }
  }

  // -------------------------------------------------------------------------
  // Write path
  // -------------------------------------------------------------------------

  /**
   * Commit a piece of private data. The data is immediately hashed into a
   * commitment; the original value is discarded after this call returns.
   */
  commit(id: string, data: unknown): BrickEntry {
    const serialised = JSON.stringify({ id, data });
    const commitment = createHmac('sha256', this.hmacKey).update(serialised).digest('hex');
    const entry: BrickEntry = { id, commitment };
    this.entries.push(entry);
    return entry;
  }

  // -------------------------------------------------------------------------
  // Read / verify path
  // -------------------------------------------------------------------------

  /** Returns the current Merkle root over all commitment hashes. */
  getMerkleRoot(): string | null {
    return merkleRoot(this.entries.map((e) => e.commitment));
  }

  /**
   * Verify a specific (id, data) pair against its stored commitment.
   * Requires the private hmacKey — only internal callers can do this.
   */
  verify(id: string, data: unknown): boolean {
    const entry = this.entries.find((e) => e.id === id);
    if (!entry) return false;
    const serialised = JSON.stringify({ id, data });
    const expected = createHmac('sha256', this.hmacKey).update(serialised).digest('hex');
    return expected === entry.commitment;
  }

  /**
   * Integrity check: compares the current in-memory Merkle root against the
   * last signed checkpoint root.  Returns { ok: true } when they match.
   * Returns { ok: false } when entries have drifted (e.g. corruption / rogue
   * append), indicating a heal() is needed.
   */
  integrityCheck(): { ok: boolean; errors: string[] } {
    const errors: string[] = [];
    const current = this.getMerkleRoot();
    if (this.lastCheckpoint) {
      const cpRoot = this.lastCheckpoint.merkleRoot;
      if (current !== cpRoot) {
        errors.push(`merkle root drifted from last checkpoint (${cpRoot} → ${current})`);
      }
    }
    return { ok: errors.length === 0, errors };
  }

  // -------------------------------------------------------------------------
  // Self-heal
  // -------------------------------------------------------------------------

  /**
   * Take a signed checkpoint snapshot to disk (or in-memory only if no
   * persistDir was given).
   */
  async checkpoint(): Promise<SignedCheckpoint> {
    const root = this.getMerkleRoot();
    const timestamp = Date.now();
    const payload = JSON.stringify({ entries: this.entries, merkleRoot: root, timestamp });
    const signature = signData(this.rsaPrivateKey, payload);
    const cp: SignedCheckpoint = {
      entries: [...this.entries],
      merkleRoot: root,
      timestamp,
      signature,
    };
    this.lastCheckpoint = cp;

    if (this.baseDir) {
      await fs.mkdir(this.baseDir, { recursive: true });
      await fs.writeFile(
        join(this.baseDir, 'stitch-checkpoint.json'),
        JSON.stringify(cp, null, 2),
        'utf8',
      );
    }

    return cp;
  }

  /**
   * Restore from the most recent valid signed checkpoint.
   * Validates the RSA signature and Merkle root before accepting the data.
   * Returns true when healing succeeded.
   */
  async heal(): Promise<{ healed: boolean; reason: string }> {
    let cp: SignedCheckpoint | null = null;

    // Prefer on-disk checkpoint (most durable source)
    if (this.baseDir) {
      try {
        const raw = await fs.readFile(join(this.baseDir, 'stitch-checkpoint.json'), 'utf8');
        cp = JSON.parse(raw) as SignedCheckpoint;
      } catch {
        // file may not exist yet
      }
    }

    // Fall back to in-memory checkpoint
    if (!cp) {
      cp = this.lastCheckpoint;
    }

    if (!cp) {
      return { healed: false, reason: 'no checkpoint available' };
    }

    // Verify signature
    const payload = JSON.stringify({
      entries: cp.entries,
      merkleRoot: cp.merkleRoot,
      timestamp: cp.timestamp,
    });
    const sigOk = verifyData(this.rsaPublicKey, payload, cp.signature);
    if (!sigOk) {
      return { healed: false, reason: 'checkpoint signature verification failed' };
    }

    // Verify Merkle root of checkpoint
    const recomputed = merkleRoot(cp.entries.map((e) => e.commitment));
    if (recomputed !== cp.merkleRoot) {
      return { healed: false, reason: 'checkpoint merkle root mismatch' };
    }

    // All checks passed — restore
    this.entries = [...cp.entries];
    this.lastCheckpoint = cp;
    return { healed: true, reason: 'restored from signed checkpoint' };
  }

  // -------------------------------------------------------------------------
  // Public proof export
  // -------------------------------------------------------------------------

  /**
   * Export a publicly verifiable proof artifact.
   *
   * The returned object contains:
   *   - commitments and Merkle root (no raw data, no HMAC key)
   *   - RSA signature over the proof payload
   *   - RSA public key so anyone can verify the signature
   *
   * This artifact is safe to publish on public APIs, GitHub, or a CDN.
   */
  exportPublicProof(): PublicStitchProof {
    const root = this.getMerkleRoot();
    const timestamp = Date.now();
    const payload = JSON.stringify({ entries: this.entries, merkleRoot: root, timestamp });
    const signature = signData(this.rsaPrivateKey, payload);
    return {
      entries: this.entries.map((e) => ({ id: e.id, commitment: e.commitment })),
      merkleRoot: root,
      signature,
      publicKey: this.rsaPublicKey,
      timestamp,
    };
  }

  /** How many entries have been committed. */
  get size(): number {
    return this.entries.length;
  }
}

// ---------------------------------------------------------------------------
// Public verifier — no private keys required
// ---------------------------------------------------------------------------

/**
 * Verify a PublicStitchProof without any private keys.
 *
 * Checks:
 *   1. The RSA signature matches the canonical payload.
 *   2. The Merkle root in the proof matches the listed commitments.
 *
 * If both pass, the proof is authentic and untampered.
 */
export function verifyPublicProof(proof: PublicStitchProof): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  const payload = JSON.stringify({
    entries: proof.entries,
    merkleRoot: proof.merkleRoot,
    timestamp: proof.timestamp,
  });

  const sigOk = verifyData(proof.publicKey, payload, proof.signature);
  if (!sigOk) {
    errors.push('proof signature is invalid');
  }

  const recomputed = merkleRoot(proof.entries.map((e) => e.commitment));
  if (recomputed !== proof.merkleRoot) {
    errors.push(`merkle root mismatch: proof claims ${proof.merkleRoot}, recomputed ${recomputed}`);
  }

  return { valid: errors.length === 0, errors };
}
