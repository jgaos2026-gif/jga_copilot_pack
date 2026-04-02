/**
 * generate-public-proof.ts
 *
 * Generates a static `public/stitch-proof.json` artifact that can be:
 *   - Committed to this repository (safe — no secrets inside)
 *   - Served from GitHub Pages or a CDN
 *   - Verified by anyone with no credentials using `verifyPublicProof()`
 *
 * Run:
 *   npx ts-node scripts/generate-public-proof.ts
 *   # or
 *   npm run proof:generate
 *
 * Output:
 *   public/stitch-proof.json   ← the verifiable artifact
 *
 * Security:
 *   The ephemeral RSA key pair and HMAC key are discarded after the file is written.
 *   Only the public key is embedded in the output.
 *   No raw data, private keys, or HMAC keys appear in the output file.
 */

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import { generateKeyPair } from '../lib/sovereignStitch/signer.js';
import {
  SovereignStitchBrick,
  verifyPublicProof,
} from '../lib/sovereignStitch/stitchBrick.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');
const OUTPUT_DIR = join(ROOT, 'public');
const OUTPUT_FILE = join(OUTPUT_DIR, 'stitch-proof.json');

// ---------------------------------------------------------------------------
// Synthetic demo records — represent the *shape* of protected data only.
// No real customer data is committed here.
// ---------------------------------------------------------------------------
const DEMO_RECORDS = [
  { id: 'demo-entry-001', payload: { type: 'synthetic', index: 1 } },
  { id: 'demo-entry-002', payload: { type: 'synthetic', index: 2 } },
  { id: 'demo-entry-003', payload: { type: 'synthetic', index: 3 } },
  { id: 'demo-entry-004', payload: { type: 'synthetic', index: 4 } },
  { id: 'demo-entry-005', payload: { type: 'synthetic', index: 5 } },
];

async function main() {
  console.log('🔐 Generating sovereign stitch public proof...\n');

  // Generate ephemeral keys — discarded after this script exits
  const { publicKey, privateKey } = generateKeyPair();
  const hmacKey = `static-demo-hmac-${Date.now()}`;

  // Build the brick
  const brick = new SovereignStitchBrick(hmacKey, privateKey, publicKey);
  for (const record of DEMO_RECORDS) {
    brick.commit(record.id, record.payload);
  }

  // Export the proof
  const proof = brick.exportPublicProof();

  // Self-verify before writing
  const result = verifyPublicProof(proof);
  if (!result.valid) {
    console.error('❌ Self-verification failed:', result.errors);
    process.exit(1);
  }

  // Build the full public artifact (adds human-readable metadata)
  const artifact = {
    _meta: {
      description:
        'Publicly verifiable proof that the JGA Sovereign Stitch Brick is operational. ' +
        'No private keys, HMAC secrets, or raw data are contained in this file.',
      generatedAt: new Date(proof.timestamp).toISOString(),
      repo: 'https://github.com/jgaos2026-gif/jga_copilot_pack',
      verificationGuide: {
        step1: 'recompute Merkle root: merkleRoot(proof.entries.map(e => e.commitment))',
        step2: 'confirm recomputed root === proof.merkleRoot',
        step3: 'verify RSA signature: verify(proof.publicKey, canonicalPayload, proof.signature)',
        canonicalPayload:
          'JSON.stringify({ entries: proof.entries, merkleRoot: proof.merkleRoot, timestamp: proof.timestamp })',
      },
    },
    selfCheck: {
      passed: result.valid,
      entryCount: proof.entries.length,
      merkleRootPresent: proof.merkleRoot !== null,
      signatureAlgorithm: 'RSA-SHA256 (2048-bit)',
      commitmentAlgorithm: 'HMAC-SHA256',
    },
    proof,
  };

  // Write to public/
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(artifact, null, 2), 'utf8');

  console.log('✅ Proof generated and self-verified.\n');
  console.log(`📄 Output: ${OUTPUT_FILE}\n`);
  console.log(`   Entries committed : ${proof.entries.length}`);
  console.log(`   Merkle root       : ${proof.merkleRoot}`);
  console.log(`   Timestamp         : ${new Date(proof.timestamp).toISOString()}`);
  console.log(`   Signature present : ${proof.signature.length > 0}`);
  console.log(`   Public key length : ${proof.publicKey.length} chars`);
  console.log('\n🔒 Private key and HMAC key discarded — not written to disk.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
