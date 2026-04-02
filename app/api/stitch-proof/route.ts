/**
 * Public Stitch Proof API — GET /api/stitch-proof
 *
 * Returns a fresh, self-verifiable proof that the SovereignStitchBrick
 * is alive and working.  Safe to call without authentication.
 *
 * What this endpoint reveals:
 *   ✅ A list of opaque entry IDs (no customer data, no field names)
 *   ✅ HMAC-SHA256 commitments (one-way hashes — data cannot be reconstructed)
 *   ✅ The Merkle root over those commitments
 *   ✅ An RSA signature over the proof payload (verifiable by anyone)
 *   ✅ The RSA public key (required to verify the signature)
 *   ✅ A timestamp and test summary
 *
 * What this endpoint NEVER reveals:
 *   ❌ The HMAC key (private; never leaves the secrets vault)
 *   ❌ The RSA private key
 *   ❌ Any raw data that was committed
 *   ❌ Business logic, schema details, or internal architecture
 *
 * Verification:
 *   Anyone can independently verify this proof using only the embedded publicKey:
 *     1. Recompute the Merkle root from the listed commitments.
 *     2. Verify the RSA signature over the canonical payload.
 *     3. Confirm both match → proof is authentic and untampered.
 *
 * System Law 1 compliance:
 *   This is a GET-only endpoint.  No inbound sensitive data is accepted.
 *   No authenticated administrative endpoints are exposed.
 */

import { NextResponse } from 'next/server';
import { generateKeyPair } from '../../../lib/sovereignStitch/signer';
import { SovereignStitchBrick, verifyPublicProof } from '../../../lib/sovereignStitch/stitchBrick';

// ---------------------------------------------------------------------------
// Demo data — ephemeral, non-sensitive synthetic records
// These represent the *shape* of what the brick protects, not real data.
// ---------------------------------------------------------------------------
const DEMO_RECORDS = [
  { id: 'entry-001', label: 'synthetic-record-a' },
  { id: 'entry-002', label: 'synthetic-record-b' },
  { id: 'entry-003', label: 'synthetic-record-c' },
];

/**
 * GET /api/stitch-proof
 *
 * Returns a publicly verifiable proof that the stitch brick is operational.
 * All keys are ephemeral and discarded after the request completes.
 * No persistent state is written.
 */
export async function GET() {
  try {
    // Generate a fresh ephemeral key pair for this request.
    // The private key is used only to sign the proof and is never returned.
    const { publicKey, privateKey } = generateKeyPair();

    // The HMAC key is also ephemeral — it signs the commitments but is
    // never included in the response.
    const hmacKey = `ephemeral-demo-key-${Date.now()}`;

    // Build the brick and commit the demo records
    const brick = new SovereignStitchBrick(hmacKey, privateKey, publicKey);
    for (const record of DEMO_RECORDS) {
      brick.commit(record.id, { label: record.label });
    }

    // Export the public proof — contains zero raw data, zero private keys
    const proof = brick.exportPublicProof();

    // Self-verify to confirm the proof is valid before returning it
    const verification = verifyPublicProof(proof);

    if (!verification.valid) {
      return NextResponse.json(
        { error: 'Proof generation failed internal self-check', details: verification.errors },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        // Human-readable status summary
        status: 'verified',
        message: 'Stitch brick is operational. Proof is self-verifiable using the embedded publicKey.',
        verifiedAt: new Date(proof.timestamp).toISOString(),

        // How to verify independently (no private keys needed)
        verificationGuide: {
          step1: 'Recompute Merkle root: merkleRoot(proof.entries.map(e => e.commitment))',
          step2: 'Confirm recomputed root === proof.merkleRoot',
          step3: 'Verify RSA signature: verify(proof.publicKey, canonicalPayload, proof.signature)',
          canonicalPayload:
            'JSON.stringify({ entries, merkleRoot, timestamp }) — field order must match exactly',
          note: 'No private keys, HMAC keys, or raw data are needed to verify this proof.',
        },

        // The proof artifact itself
        proof,

        // Test result summary (proof verified itself successfully)
        selfCheck: {
          passed: verification.valid,
          entryCount: proof.entries.length,
          merkleRootPresent: proof.merkleRoot !== null,
          signaturePresent: proof.signature.length > 0,
          publicKeyPresent: proof.publicKey.startsWith('-----BEGIN PUBLIC KEY-----'),
        },
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'Proof generation error', details: String(error) },
      { status: 500 },
    );
  }
}
