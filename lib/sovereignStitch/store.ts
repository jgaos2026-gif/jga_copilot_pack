// Copyright (c) 2026 Jay's Graphic Arts LLC. All rights reserved.
// Proprietary and confidential. Unauthorized use, reproduction, or distribution
// of this software is strictly prohibited. See LICENSE for details.

import { promises as fs } from 'fs'
import { join } from 'path'
import { sha256, merkleRoot } from './merkle'

export type MicroBrick = {
  id: string
  bricId: string
  schemaVersion: string
  data: any
  digest: string
}

export class MicroBrickStore {
  private bricks: MicroBrick[] = []
  private log: string[] = []
  private baseDir: string

  constructor(baseDir: string) {
    this.baseDir = baseDir
  }

  async ensureDir() {
    await fs.mkdir(this.baseDir, { recursive: true })
  }

  async writeMicroBrick(bricId: string, schemaVersion: string, data: any): Promise<MicroBrick> {
    await this.ensureDir()
    const payload = JSON.stringify({ bricId, schemaVersion, data })
    const digest = sha256(payload)
    const brick: MicroBrick = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      bricId,
      schemaVersion,
      data,
      digest,
    }
    this.bricks.push(brick)
    this.log.push(digest)
    return brick
  }

  getMerkleRoot(): string | null {
    return merkleRoot(this.log)
  }

  async checkpoint(name = 'latest') {
    await this.ensureDir()
    const cp = {
      bricks: this.bricks,
      log: this.log,
      merkle: this.getMerkleRoot(),
      timestamp: Date.now(),
    }
    const path = join(this.baseDir, `checkpoint-${name}.json`)
    await fs.writeFile(path, JSON.stringify(cp, null, 2), 'utf8')
    return path
  }

  async loadCheckpoint(name = 'latest') {
    const path = join(this.baseDir, `checkpoint-${name}.json`)
    const raw = await fs.readFile(path, 'utf8')
    const cp = JSON.parse(raw)
    this.bricks = cp.bricks || []
    this.log = cp.log || []
    return cp
  }

  // Create a signed checkpoint. Caller provides a PEM private key to sign the JSON payload.
  async signedCheckpoint(privateKeyPem: string, name = 'signed-latest') {
    const path = await this.checkpoint(name)
    const raw = await fs.readFile(path, 'utf8')
    // lazy import to avoid top-level crypto in some environments
    const { signData } = await import('./signer')
    const signature = signData(privateKeyPem, raw)
    const metaPath = join(this.baseDir, `checkpoint-${name}.sig`)
    await fs.writeFile(metaPath, JSON.stringify({ signature }), 'utf8')
    return { path, metaPath }
  }

  // Simulate persistent storage corruption by modifying a stored checkpoint file
  async corruptCheckpoint(name = 'latest') {
    const path = join(this.baseDir, `checkpoint-${name}.json`)
    const buf = await fs.readFile(path)
    // flip a byte in the middle
    const i = Math.floor(buf.length / 2)
    buf[i] = (buf[i] + 1) & 0xff
    await fs.writeFile(path, buf)
  }

  // Verify in-memory bricks against log + merkle
  verify(): { ok: boolean; errors: string[] } {
    const errors: string[] = []
    const recomputedLog = this.bricks.map(b => sha256(JSON.stringify({ bricId: b.bricId, schemaVersion: b.schemaVersion, data: b.data })))
    if (recomputedLog.length !== this.log.length) {
      errors.push('log length mismatch')
    }
    for (let i = 0; i < Math.min(recomputedLog.length, this.log.length); i++) {
      if (recomputedLog[i] !== this.log[i]) {
        errors.push(`log entry mismatch at ${i}`)
      }
    }
    const merkle = merkleRoot(this.log)
    if (merkle !== this.getMerkleRoot()) {
      errors.push('merkle root mismatch')
    }
    return { ok: errors.length === 0, errors }
  }

  // Verify stored checkpoint file against its signature
  // Returns true if the checkpoint file on disk has not been tampered with
  async verifyCheckpointIntegrity(publicKeyPem: string, name = 'signed-latest'): Promise<{ ok: boolean; errors: string[] }> {
    const errors: string[] = []
    try {
      const checkpointPath = join(this.baseDir, `checkpoint-${name}.json`)
      const sigPath = join(this.baseDir, `checkpoint-${name}.sig`)
      
      // Read the stored checkpoint file
      const storedRaw = await fs.readFile(checkpointPath, 'utf8')
      
      // Read the signature
      const sigFile = await fs.readFile(sigPath, 'utf8')
      const { signature } = JSON.parse(sigFile)
      
      // Verify signature against the stored file
      const { verifyData } = await import('./signer')
      const isValid = verifyData(publicKeyPem, storedRaw, signature)
      
      if (!isValid) {
        errors.push('checkpoint signature verification failed (file may be corrupted)')
        return { ok: false, errors }
      }
      
      // Parse and verify merkle root
      const storedCp = JSON.parse(storedRaw)
      const recomputedMerkle = merkleRoot(storedCp.log || [])
      if (recomputedMerkle !== storedCp.merkle) {
        errors.push('merkle root mismatch in stored checkpoint')
        return { ok: false, errors }
      }
      
      return { ok: true, errors: [] }
    } catch (e) {
      errors.push(`checkpoint integrity check failed: ${e instanceof Error ? e.message : String(e)}`)
      return { ok: false, errors }
    }
  }

  // Restore from checkpoint file (rehydrate bricks and log)
  async restoreFromCheckpoint(name = 'latest') {
    const cp = await this.loadCheckpoint(name)
    // rebuild any internal structures
    this.bricks = cp.bricks || []
    this.log = cp.log || []
    return this.verify()
  }
}
