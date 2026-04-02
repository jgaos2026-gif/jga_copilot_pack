# Sovereign Stitch Brick — Public Proof

> **JGA Enterprise OS** | Data-integrity layer

The **Sovereign Stitch Brick** protects every record in the system with
cryptographic commitments and a self-verifiable proof anyone can check —
without ever seeing the underlying data or any private keys.

---

## What can be verified publicly

Anyone can verify that the stitch brick is real and working using only the
information in the published proof artifact.  No account, no API key, and
no access to the system internals is required.

```
proof.entries      → opaque HMAC-SHA256 commitments (no raw data)
proof.merkleRoot   → Merkle root over all commitments
proof.signature    → RSA-SHA256 signature over the canonical payload
proof.publicKey    → RSA public key (embedded in the proof — safe to share)
proof.timestamp    → When the proof was produced
```

**Three-step verification** (copy-paste in any Node.js environment):

```js
import { createHash, createVerify } from 'crypto';

// 1. Recompute the Merkle root from the listed commitments
function merkleRoot(hashes) {
  let level = [...hashes];
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      const a = level[i];
      const b = i + 1 < level.length ? level[i + 1] : level[i];
      next.push(createHash('sha256').update(a + b).digest('hex'));
    }
    level = next;
  }
  return level[0] ?? null;
}

const proof = /* load from /api/stitch-proof or public/stitch-proof.json */;

// 2. Confirm Merkle root matches
const recomputed = merkleRoot(proof.entries.map(e => e.commitment));
console.assert(recomputed === proof.merkleRoot, 'Merkle root mismatch!');

// 3. Verify RSA signature
const canonical = JSON.stringify({
  entries: proof.entries,
  merkleRoot: proof.merkleRoot,
  timestamp: proof.timestamp,
});
const verifier = createVerify('sha256');
verifier.update(canonical);
const valid = verifier.verify(proof.publicKey, proof.signature, 'base64');
console.assert(valid, 'Signature invalid!');

console.log('✅ Proof is authentic and untampered.');
```

---

## What stays private

The proof deliberately reveals nothing about the underlying data or system:

| Item | Included in proof? |
|------|-------------------|
| Raw committed data | ❌ Never |
| HMAC secret key | ❌ Never |
| RSA private key | ❌ Never |
| Schema / field names | ❌ Never |
| Internal architecture | ❌ Never |
| Entry IDs | ✅ Yes (opaque identifiers only) |
| HMAC commitments | ✅ Yes (one-way hashes) |
| Merkle root | ✅ Yes |
| RSA signature | ✅ Yes |
| RSA public key | ✅ Yes |

Commitments are `HMAC-SHA256(data, secret)`.  Without the secret, the data
cannot be reconstructed from the commitment — even with unlimited computing
power.

---

## Live endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/stitch-proof` | Fresh ephemeral proof (keys discarded after request) |
| `GET /stitch-proof.json` | Static proof artifact (regenerated on deploy) |

---

## Run locally

```bash
# Generate the static proof artifact (writes to public/stitch-proof.json)
npm run proof:generate

# Run all stitch brick tests (15 tests covering all four properties)
npm run test:all

# Run just the stitch-brick property tests
npx vitest run tests/stitch-brick.test.ts
```

---

## Test results

The test suite covers all four security properties:

```
✓ NON-REVEALING         — public proof contains no raw data           (3 tests)
✓ CANNOT BE STOLEN      — private keys absent from all exports        (3 tests)
✓ PROVES IT'S REAL      — verifyPublicProof() confirms authenticity   (5 tests)
✓ SELF-HEALING          — brick restores from signed checkpoint       (3 tests)
✓ END-TO-END lifecycle  — commit → checkpoint → corrupt → heal → verify (1 test)
```

---

## Notes

- Demo keys are **ephemeral** — generated fresh per request or script run.
- The static `public/stitch-proof.json` artifact is regenerated on every deploy via `npm run proof:generate`.
- For production, replace ephemeral key generation with your KMS-managed keys (AWS KMS, GCP KMS, Azure Key Vault).
- The HMAC key must be stored in a secrets vault — never committed to the repository.
