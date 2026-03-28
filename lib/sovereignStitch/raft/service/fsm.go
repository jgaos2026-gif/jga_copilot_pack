package main

import (
    "bufio"
    "fmt"
    "io"
    "os"
    "sync"

    raft "github.com/hashicorp/raft"
)

// FSM implements the raft.FSM interface and persists committed entries to a file.
type FSM struct {
    mu      sync.Mutex
    outPath string
    // in-memory view (optional)
    entries []string
}

func NewFSM(outPath string) *FSM {
    f := &FSM{outPath: outPath}
    f.loadFromFile()
    return f
}

func (f *FSM) loadFromFile() {
    f.mu.Lock()
    defer f.mu.Unlock()
    f.entries = nil
    file, err := os.Open(f.outPath)
    if err != nil {
        return
    }
    defer file.Close()
    scanner := bufio.NewScanner(file)
    for scanner.Scan() {
        f.entries = append(f.entries, scanner.Text())
    }
}

func (f *FSM) Apply(l *raft.Log) interface{} {
    f.mu.Lock()
    defer f.mu.Unlock()
    data := string(l.Data)
    // append to file
    file, err := os.OpenFile(f.outPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
    if err != nil {
        return fmt.Errorf("failed to open commits file: %w", err)
    }
    defer file.Close()
    if _, err := io.WriteString(file, data+"\n"); err != nil {
        return fmt.Errorf("failed to write commit: %w", err)
    }
    f.entries = append(f.entries, data)
    return nil
}

func (f *FSM) Snapshot() (raft.FSMSnapshot, error) {
    f.mu.Lock()
    defer f.mu.Unlock()
    // create a snapshot copy of entries
    entriesCopy := append([]string(nil), f.entries...)
    return &fileSnapshot{entries: entriesCopy}, nil
}

func (f *FSM) Restore(rc io.ReadCloser) error {
    f.mu.Lock()
    defer f.mu.Unlock()
    defer rc.Close()
    // overwrite the file with snapshot contents
    file, err := os.Create(f.outPath)
    if err != nil {
        return err
    }
    defer file.Close()
    if _, err := io.Copy(file, rc); err != nil {
        return err
    }
    // reload in-memory view
    f.entries = nil
    scanner := bufio.NewScanner(file)
    file.Seek(0, io.SeekStart)
    for scanner.Scan() {
        f.entries = append(f.entries, scanner.Text())
    }
    return nil
}

type fileSnapshot struct{
    entries []string
}

func (s *fileSnapshot) Persist(sink raft.SnapshotSink) error {
    for _, e := range s.entries {
        if _, err := sink.Write([]byte(e + "\n")); err != nil {
            sink.Cancel()
            return err
        }
    }
    if err := sink.Close(); err != nil {
        sink.Cancel()
        return err
    }
    return nil
}

func (s *fileSnapshot) Release() {}
