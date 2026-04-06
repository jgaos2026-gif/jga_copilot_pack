/**
 * BRICS Orchestrator: Unified initialization and lifecycle management
 *
 * Wires together all BRIC layers and provides a single entry point
 * for scripts, tests, and deployment tooling.
 */

import { join } from 'path'
import { Spine } from './spine'
import { ComplianceAgent } from './spine/compliance-agent'
import { PublicBric } from './public'
import { SystemBBric } from './system-b'
import { OwnersRoom } from './owners-room'

export interface BRICSConfig {
  baseDir: string
  stateCodes: string[]
  publicBaseUrl: string
  mfaRequired?: boolean
  vpnRequired?: boolean
}

export interface BRICSOrchestrator {
  getSpine(): Spine
  getPublicLayer(): PublicBric
  getSystemB(): SystemBBric
  getOwnersRoom(): OwnersRoom
  getCompliance(): ComplianceAgent
  shutdown(): Promise<void>
}

export async function createBRICS(config: BRICSConfig): Promise<BRICSOrchestrator> {
  const spine = new Spine({ baseDir: join(config.baseDir, 'spine') })
  const compliance = new ComplianceAgent({ baseDir: join(config.baseDir, 'compliance') })
  const publicBric = new PublicBric({
    baseDir: join(config.baseDir, 'public'),
    publicBaseUrl: config.publicBaseUrl,
  })
  const systemB = new SystemBBric({ baseDir: join(config.baseDir, 'system-b') })

  // OwnersRoom requires Supabase credentials; audit scripts use env vars or stubs
  const ownersRoom = new OwnersRoom({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://stub.supabase.co',
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'stub-key',
  })

  return {
    getSpine: () => spine,
    getPublicLayer: () => publicBric,
    getSystemB: () => systemB,
    getOwnersRoom: () => ownersRoom,
    getCompliance: () => compliance,
    async shutdown() {
      // Flush in-memory state on graceful shutdown
    },
  }
}
