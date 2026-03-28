#!/usr/bin/env node
const path = require('path')
const { ReplicaManager } = require(path.join('..','lib','sovereignStitch','replica'))
const fs = require('fs').promises

async function runDemo() {
  const base = path.join(__dirname,'..','tests','demo-run')
  await fs.rm(base, { recursive: true, force: true })
  const m = new ReplicaManager(base)
  const r1 = m.addReplica('r1', path.join(base,'r1'))
  const r2 = m.addReplica('r2', path.join(base,'r2'))
  const r3 = m.addReplica('r3', path.join(base,'r3'))

  console.log('Committing micro-brick to replicas...')
  await m.commitMicroBrick('demo', 'v1', { demo: true })
  console.log('Creating signed checkpoints...')
  await m.signedCheckpointAll('demo')
  console.log('Verifying majority health...')
  const healthy = await m.majorityHealthy('demo')
  console.log('Majority healthy:', healthy)

  console.log('Corrupting replica r2 checkpoint to simulate failure...')
  const badPath = path.join(base,'r2','checkpoint-demo.json')
  const buf = await fs.readFile(badPath)
  const i = Math.floor(buf.length/3)
  buf[i] = (buf[i] + 7) & 0xff
  await fs.writeFile(badPath, buf)

  const healthyAfter = await m.majorityHealthy('demo')
  console.log('Majority healthy after corruption:', healthyAfter)
}

runDemo().catch(e=>{ console.error(e); process.exit(1) })
