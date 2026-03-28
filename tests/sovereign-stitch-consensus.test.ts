import { describe, it, expect } from 'vitest'
import { ReplicaManager } from '../lib/sovereignStitch/replica'
import { join } from 'path'
import { promises as fs } from 'fs'

describe('sovereign-stitch consensus', () => {
  it('commits and retains majority health when one replica is corrupted', async () => {
    const base = join(__dirname, 'tmp-replicas')
    await fs.rm(base, { recursive: true, force: true })
    const manager = new ReplicaManager(base)
    manager.addReplica('r1', join(base, 'r1'))
    const r2 = manager.addReplica('r2', join(base, 'r2'))
    manager.addReplica('r3', join(base, 'r3'))

    // commit a brick
    const ok = await manager.commitMicroBrick('s1', 'v1', { x: 1 })
    expect(ok).toBe(true)

    // create signed checkpoints across replicas
    await manager.signedCheckpointAll('demo')
    const healthyBefore = await manager.majorityHealthy('demo')
    expect(healthyBefore).toBe(true)

    // corrupt one replica's checkpoint file
    const badPath = join(r2['baseDir'], 'checkpoint-demo.json')
    const buf = await fs.readFile(badPath)
    buf[10] = (buf[10] + 5) & 0xff
    await fs.writeFile(badPath, buf)

    const healthyAfter = await manager.majorityHealthy('demo')
    expect(healthyAfter).toBe(true) // majority still healthy
  })
})
