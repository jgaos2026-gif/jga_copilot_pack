Raft Integration (HashiCorp Raft Single-Node Service)
======================================================

This directory contains a production-ready HashiCorp Raft service written in Go.
It provides persistent log storage, snapshot/restore, and a simple HTTP `/commit` 
endpoint for applying entries through Raft.

## Overview

**Files:**
- `main.go` — Raft server bootstrap, HTTP handlers, BoltDB log store, TCP transport
- `fsm.go` — FSM implementation (Apply, Snapshot, Restore) that persists entries to a file
- `go.mod` — Go module manifest with raft and raft-boltdb dependencies
- `README.md` — Building and running instructions (this file)

**Key Features:**
- Single-node Raft cluster (can be extended to multi-node by configuring TCP peers)
- BoltDB-backed persistent log and stable storage
- File-based snapshots with Restore logic
- HTTP `/commit` endpoint applies entries through Raft Apply (guarantees durability and ordering)
- HTTP `/health` endpoint for liveness checks

## Building and Running

### Prerequisites
- Go 1.20 or later

### Build

```bash
cd lib/sovereignStitch/raft/service
go mod download
go build -o sovereign-stitch-raft .
```

### Run (Single Node)

```bash
./sovereign-stitch-raft
```

The service will:
- Initialize a single-node Raft cluster
- Create BoltDB store at `./data/raft.db`
- Create snapshots in `./data/snapshots`
- Persist applied entries to `./data/commits.log`
- Listen on HTTP `:12000` (for `/commit` and `/health` endpoints)
- Listen on TCP `:12010` (for Raft peer communication, if extended to multi-node)

### Test It

```bash
curl -X POST -d "test entry 1" http://localhost:12000/commit
curl http://localhost:12000/health
cat data/commits.log
```

### Extending to Multi-Node Cluster

To extend this to a 3-node cluster:

1. **Update `main.go`** to accept flags for node ID, bind address, and peer addresses:
   ```go
   nodeID := flag.String("id", "node1", "Node ID")
   bindAddr := flag.String("bind", "127.0.0.1:12010", "Raft bind address")
   peerAddrs := flag.String("peers", "", "Comma-separated peer addresses")
   flag.Parse()
   ```

2. **Update bootstrap** to include all nodes (leader will be elected):
   ```go
   peerList := strings.Split(*peerAddrs, ",")
   configuration := raft.Configuration{
       Servers: []raft.Server{
           {ID: raft.ServerID("node1"), Address: raft.ServerAddress("127.0.0.1:12010")},
           {ID: raft.ServerID("node2"), Address: raft.ServerAddress("127.0.0.1:12011")},
           {ID: raft.ServerID("node3"), Address: raft.ServerAddress("127.0.0.1:12012")},
       },
   }
   ```

3. **Launch three instances:**
   ```bash
   ./sovereign-stitch-raft -id node1 -bind 127.0.0.1:12010 -peers 127.0.0.1:12011,127.0.0.1:12012 &
   ./sovereign-stitch-raft -id node2 -bind 127.0.0.1:12011 -peers 127.0.0.1:12010,127.0.0.1:12012 &
   ./sovereign-stitch-raft -id node3 -bind 127.0.0.1:12012 -peers 127.0.0.1:12010,127.0.0.1:12011 &
   ```

4. Commits will succeed while majority are alive. If one node goes down, the cluster continues.

## Integration with Node.js ReplicaManager

The `ReplicaManager.commitToRaftService()` in `lib/sovereignStitch/replica.ts` 
POSTs to this service's `/commit` endpoint. The flow is:

1. JS ReplicaManager calls `commitToRaftService(raftUrl, ...)`
2. HTTP POST to `{raftUrl}/commit` with brick data
3. Raft service applies through FSM.Apply (durable, ordered)
4. Success response returned to caller
5. JS adapter stores checkpoint locally (asynchronous)

This decouples the Merkle/checkpoint layer from consensus, allowing 
the Raft backend to be swapped with Paxos or other algorithms later.

## Production Deployment

For production:
- Use mTLS on the Raft transport (peer authentication)
- Deploy on Kubernetes with StatefulSet (stable identity + persistent volumes)
- Configure the Raft HTTP listener on a private network (not internet-facing)
- Integrate with a key management service (AWS KMS, Azure Key Vault) for signing keys
- Add monitoring and alerting for Raft cluster state (leader availability, log lag)
- Implement log compaction and remove old snapshots periodically
- Use a shared distributed store (CockroachDB, PostgreSQL) for commits instead of local files
