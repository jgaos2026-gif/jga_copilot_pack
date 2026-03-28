import { describe, it, expect } from 'vitest'
import { MicroBrickStore } from '../lib/sovereignStitch/store'
import { join } from 'path'
import { promises as fs } from 'fs'

const tmpDir = join(__dirname, 'tmp-stitch')

describe('sovereign-stitch', () => {
  it('writes, checkpoints, detects corruption, and restores', async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
    const s = new MicroBrickStore(tmpDir)
    await s.writeMicroBrick('state-1', 'v1', { foo: 'bar' })
    await s.writeMicroBrick('state-1', 'v1', { amount: 100 })
    const path = await s.checkpoint('latest')
    expect(path).toContain('checkpoint-latest.json')

    // verify healthy
    let v = s.verify()
    expect(v.ok).toBe(true)

    // corrupt the checkpoint file on disk
    await s.corruptCheckpoint('latest')

    // loading may throw or return a failed verification; accept either
    let restoreResultOk = true
    try {
      const res = await s.restoreFromCheckpoint('latest')
      restoreResultOk = res.ok === true
    } catch (e) {
      // treat thrown error as failed restore
      restoreResultOk = false
    }

    expect(restoreResultOk).toBe(false)

    // re-create a clean checkpoint and restore using a fresh store instance
    const s2 = new MicroBrickStore(tmpDir)
    await s2.writeMicroBrick('state-1', 'v1', { foo: 'bar' })
    await s2.writeMicroBrick('state-1', 'v1', { amount: 100 })
    await s2.checkpoint('latest-clean')
    const res = await s2.restoreFromCheckpoint('latest-clean')
    expect(res.ok).toBe(true)
  })
})
