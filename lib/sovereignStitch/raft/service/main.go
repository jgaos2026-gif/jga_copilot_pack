package main

// Minimal scaffold for a Raft-backed service using HashiCorp Raft.
// This is a starting point. For production, follow HashiCorp Raft examples
// and run multiple instances behind discovery/consul/k8s for leader election.

import (
    "log"
    "net/http"
    "os"
    "path/filepath"
    "time"
)

func main() {
    // Basic working directory setup
    dir := "./data"
    os.MkdirAll(dir, 0o755)

    // TODO: initialize raft.Config, transports, stable store, log store, snapshot store
    // See: https://pkg.go.dev/github.com/hashicorp/raft

    // Expose a small HTTP API for demo/adapter integration.
    http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
        w.WriteHeader(200)
        _, _ = w.Write([]byte("ok"))
    })

    http.HandleFunc("/commit", func(w http.ResponseWriter, r *http.Request) {
        // Expected: POST JSON payload representing micro-brick commit
        // In a full implementation: leader applies entry to raft via raft.Apply()
        // Here we accept and persist to a file as a simple demo.
        fpath := filepath.Join(dir, "commits.log")
        f, err := os.OpenFile(fpath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
        if err != nil {
            http.Error(w, "failed to open commit log", 500)
            return
        }
        defer f.Close()
        body := make([]byte, r.ContentLength)
        _, _ = r.Body.Read(body)
        body = append(body, '\n')
        _, _ = f.Write(body)
        w.WriteHeader(202)
    })

    srv := &http.Server{Addr: ":8700", ReadTimeout: 5 * time.Second, WriteTimeout: 10 * time.Second}
    log.Println("raft scaffold service listening :8700 (demo only)")
    if err := srv.ListenAndServe(); err != nil {
        package main

        import (
            "fmt"
            "io"
            "log"
            "net"
            "net/http"
            "os"
            "path/filepath"
            "time"

            bolt "github.com/hashicorp/raft-boltdb"
            raft "github.com/hashicorp/raft"
        )

        func setupRaft(dataDir string) (*raft.Raft, *FSM, error) {
            os.MkdirAll(dataDir, 0o755)

            // Raft config
            config := raft.DefaultConfig()
            config.LocalID = raft.ServerID("node1")

            // BoltDB store for logs
            boltPath := filepath.Join(dataDir, "raft.db")
            boltStore, err := bolt.NewBoltStore(boltPath)
            if err != nil {
                return nil, nil, err
            }

            // Stable store and log store
            logStore := boltStore
            stableStore := boltStore

            // Snapshot store
            snapDir := filepath.Join(dataDir, "snapshots")
            os.MkdirAll(snapDir, 0o755)
            snapshotStore, err := raft.NewFileSnapshotStore(snapDir, 2, os.Stderr)
            if err != nil {
                return nil, nil, err
            }

            // Transport - single node via inmem TCP listener for demo
            addr := "127.0.0.1:12010"
            transport, err := raft.NewTCPTransport(addr, nil, 3, 10*time.Second, os.Stderr)
            if err != nil {
                return nil, nil, err
            }

            fsm := NewFSM(filepath.Join(dataDir, "commits.log"))

            r, err := raft.NewRaft(config, fsm, logStore, stableStore, snapshotStore, transport)
            if err != nil {
                return nil, nil, err
            }

            // bootstrap single-node cluster
            configuration := raft.Configuration{
                Servers: []raft.Server{
                    {
                        ID:      config.LocalID,
                        Address: transport.LocalAddr(),
                    },
                },
            }
            r.BootstrapCluster(configuration)

            return r, fsm, nil
        }

        func main() {
            dataDir := "./data"
            raftNode, fsm, err := setupRaft(dataDir)
            if err != nil {
                log.Fatalf("failed to setup raft: %v", err)
            }
            defer raftNode.Shutdown().Error()

            http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
                fmt.Fprintf(w, "ok")
            })

            http.HandleFunc("/commit", func(w http.ResponseWriter, r *http.Request) {
                if r.Method != "POST" {
                    http.Error(w, "only POST", http.StatusMethodNotAllowed)
                    return
                }
                body, err := io.ReadAll(r.Body)
                if err != nil {
                    http.Error(w, "bad body", http.StatusBadRequest)
                    return
                }

                // Apply through raft
                applyFuture := raftNode.Apply(body, 5*time.Second)
                if err := applyFuture.Error(); err != nil {
                    http.Error(w, fmt.Sprintf("apply failed: %v", err), http.StatusInternalServerError)
                    return
                }

                fmt.Fprintf(w, "committed")
                _ = fsm // keep reference if needed for debugging
            })

            ln, _ := net.Listen("tcp", ":12000")
            log.Println("Raft service running on :12000 (commit -> forwarded to raft node)")
            log.Fatal(http.Serve(ln, nil))
        }
