/**
 * Public Stitch Proof — the publicly accessible side of the sovereign stitch brick.
 *
 * This module is the ONLY stitch-brick surface that is safe to expose to the
 * public internet.  It contains:
 *   - Zero private keys (hmacKey is never present)
 *   - Zero raw customer data (only HMAC commitments)
 *   - A self-contained verifier so anyone can confirm authenticity
 *
 * Publish the `ProofPublisher.publish()` output to a CDN, a public API route,
 * or a GitHub-hosted JSON file.  Consumers call `verifyPublicProof()` with no
 * special credentials to confirm the proof is real and untampered.
 *
 * System Law 1 compliance:
 *   This module is read-only output from an approved source (the SovereignStitchBrick).
 *   It accepts no inbound sensitive data and exposes no internal state.
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { verifyPublicProof } from '../../lib/sovereignStitch/stitchBrick';
import type { PublicStitchProof } from '../../lib/sovereignStitch/stitchBrick';

export type { PublicStitchProof };

// ---------------------------------------------------------------------------
// ProofPublisher
// ---------------------------------------------------------------------------

export interface PublisherConfig {
  /** Directory where the proof file is written (serve this path from your CDN). */
  outputDir: string;
  /** Filename for the published proof artifact. */
  filename?: string;
}

/**
 * Writes a PublicStitchProof to disk so it can be served as a static asset.
 * The written file contains no private data and is safe to publish publicly.
 */
export class ProofPublisher {
  private readonly filename: string;

  constructor(private readonly config: PublisherConfig) {
    this.filename = config.filename ?? 'stitch-proof.json';
  }

  async publish(proof: PublicStitchProof): Promise<string> {
    await fs.mkdir(this.config.outputDir, { recursive: true });
    const filePath = join(this.config.outputDir, this.filename);
    await fs.writeFile(filePath, JSON.stringify(proof, null, 2), 'utf8');
    return filePath;
  }

  async load(): Promise<PublicStitchProof | null> {
    try {
      const raw = await fs.readFile(join(this.config.outputDir, this.filename), 'utf8');
      return JSON.parse(raw) as PublicStitchProof;
    } catch {
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// Public verifier (re-exported for convenience)
// ---------------------------------------------------------------------------

export { verifyPublicProof };

/**
 * Convenience wrapper: load a proof from disk and verify it in one call.
 *
 * @returns { valid, errors, proof } where `valid` is true when the file exists
 *          and passes both the signature check and Merkle consistency check.
 */
export async function loadAndVerify(
  outputDir: string,
  filename = 'stitch-proof.json',
): Promise<{ valid: boolean; errors: string[]; proof: PublicStitchProof | null }> {
  const publisher = new ProofPublisher({ outputDir, filename });
  const proof = await publisher.load();
  if (!proof) {
    return { valid: false, errors: ['proof file not found'], proof: null };
  }
  const result = verifyPublicProof(proof);
  return { ...result, proof };
}
