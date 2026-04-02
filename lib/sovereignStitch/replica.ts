// Copyright (c) 2026 Jay's Graphic Arts LLC. All rights reserved.
// Proprietary and confidential. Unauthorized use, reproduction, or distribution
// of this software is strictly prohibited. See LICENSE for details.

import { MicroBrickStore } from './store'
import { generateKeyPair, verifyData } from './signer'
import { promises as fs } from 'fs'
import { join } from 'path'

export type ReplicaConfig = { id: string; dir: string }

export class ReplicaManager {
  replicas: Map<string, MicroBrickStore> = new Map()
  keys: { publicKey: string; privateKey: string }
  raftUrl?: string

  // constructor accepts optional external keys (e.g., from KMS) for signing
  constructor(_baseDir: string, keys?: { publicKey: string; privateKey: string }, raftUrl?: string) {
    if (keys) {
      this.keys = keys
    } else {
      this.keys = generateKeyPair()
    }
    if (raftUrl) this.raftUrl = raftUrl
  }

  addReplica(id: string, dir: string) {
    const s = new MicroBrickStore(dir)
    this.replicas.set(id, s)
    return s
  }

  // Commit a micro-brick to all replicas; success requires majority
  // Commit a micro-brick using an external Raft service when configured.
  // If no Raft service is configured or the Raft commit fails, fall back to
  // local replica writes and require majority success.
  async commitMicroBrick(bricId: string, schemaVersion: string, data: any) {
    // Prefer external Raft service if configured
    if (this.raftUrl) {
      const raftCommitUrl = this.raftUrl.endsWith('/commit') ? this.raftUrl : `${this.raftUrl.replace(/\/$/, '')}/commit`
      const ok = await this.commitToRaftService(raftCommitUrl, bricId, schemaVersion, data)
      if (ok) {
        // Optionally persist locally for local reads
        const localTasks: Promise<any>[] = []
        for (const [, r] of this.replicas) localTasks.push(r.writeMicroBrick(bricId, schemaVersion, data))
        // fire-and-forget local persistence; don't block raft durability
        void Promise.allSettled(localTasks)
        return true
      }
      // If raft commit failed, fall through to local majority commit
    }

    const tasks: Promise<any>[] = []
    for (const [, r] of this.replicas) {
      tasks.push(r.writeMicroBrick(bricId, schemaVersion, data))
    }
    const results = await Promise.allSettled(tasks)
    const success = results.filter(r => r.status === 'fulfilled').length
    return success >= Math.ceil(this.replicas.size / 2)
  }

  // Adapter: commit to an external Raft service (HTTP). Useful when
  // a Raft-backed service (Go/etcd) is responsible for durable consensus.
  // Returns true when the raft service accepted the commit (HTTP 2xx).
  async commitToRaftService(url: string, bricId: string, schemaVersion: string, data: any): Promise<boolean> {
    const payload = JSON.stringify({ bricId, schemaVersion, data })
    try {
      const res = await fetch(url, { method: 'POST', body: payload, headers: { 'Content-Type': 'application/json' } })
      return res.ok
    } catch (e) {
      return false
    }
  }

  // Create signed checkpoints on each replica
  async signedCheckpointAll(name = 'signed-latest') {
    const out: any[] = []
    for (const [id, r] of this.replicas) {
      await r.checkpoint(name)
      const path = join(r['baseDir'], `checkpoint-${name}.json`)
      const raw = await fs.readFile(path, 'utf8')
      const sig = await import('./signer')
      const signature = sig.signData(this.keys.privateKey, raw)
      await fs.writeFile(join(r['baseDir'], `checkpoint-${name}.sig`), JSON.stringify({ signature }), 'utf8')
      out.push({ id, path })
    }
    return out
  }

  // Verify majority of replicas have matching merkle root and valid signature
  async majorityHealthy(name = 'signed-latest') {
    const checks: { id: string; ok: boolean }[] = []
    for (const [id, r] of this.replicas) {
      try {
        const cpRaw = await fs.readFile(join(r['baseDir'], `checkpoint-${name}.json`), 'utf8')
        const metaRaw = await fs.readFile(join(r['baseDir'], `checkpoint-${name}.sig`), 'utf8')
        const meta = JSON.parse(metaRaw)
        const okSig = verifyData(this.keys.publicKey, cpRaw, meta.signature)
        const cp = JSON.parse(cpRaw)
        const merkle = r.getMerkleRoot()
        checks.push({ id, ok: okSig && merkle === cp.merkle })
      } catch (e) {
        checks.push({ id, ok: false })
      }
    }
    const healthy = checks.filter(c => c.ok).length
    return healthy >= Math.ceil(this.replicas.size / 2)
  }
}
