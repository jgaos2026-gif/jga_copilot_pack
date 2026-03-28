Raft Service Scaffold
=====================

This is a minimal scaffold showing how to run a Raft-backed service for
committing micro-bricks. It is intentionally lightweight and not production
ready. Use it as a starting point to integrate a full HashiCorp Raft node
with persistent stores and snapshots.

Quick demo:

1. Install Go (1.20+).
2. From this folder run `go mod tidy` to fetch dependencies.
3. Build: `go build -o jga-raft ./main.go`.
4. Run one instance for demo: `./jga-raft` (it listens on :8700).

API (demo):
- `GET /health` -> returns 200 ok
- `POST /commit` -> accepts JSON body and appends to a local `data/commits.log`

Production notes:
- Use HashiCorp Raft transports and snapshot stores.
- Run multiple instances across hosts/k8s and use discovery (consul, k8s endpoints).
- Secure the HTTP API (mTLS, authentication) and ensure leader-only acceptance.
