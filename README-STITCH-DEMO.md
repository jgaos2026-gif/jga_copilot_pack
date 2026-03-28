Sovereign Stitch Demo
=====================

This demo shows the stitch micro-brick flow with signed checkpoints and a simple replica majority health check.

Run the demo (node required):

```bash
node scripts/demo-stitch.js
```

Run unit tests:

```bash
npm run test:stitch
npm run test:consensus
```

Notes:
- The demo and tests are sandboxed under `tests/tmp-*` and `tests/demo-run`.
- No real keys or production secrets are used. Replace `signer` key generation with your KMS-managed keys in production.
