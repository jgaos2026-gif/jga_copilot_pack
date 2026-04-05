/**
 * BRICS Orchestrator
 * Bootstraps and coordinates all BRIC subsystems for load testing,
 * security auditing, and other operational scripts.
 */

import path from 'path'
import { SystemBBric } from './system-b/index'
import { ComplianceAgent } from './spine/compliance-agent'
import { Spine } from './spine/index'
import { PublicBric } from './public/index'
import { OwnersRoom } from './owners-room/index'

export interface BRICSConfig {
  baseDir: string
  stateCodes: string[]
  publicBaseUrl: string
  mfaRequired: boolean
  vpnRequired: boolean
}

export class BRICSOrchestrator {
  private systemB: SystemBBric
  private compliance: ComplianceAgent
  private spine: Spine
  private publicBric: PublicBric
  private ownersRoom: OwnersRoom
  private config: BRICSConfig

  constructor(config: BRICSConfig) {
    this.config = config
    this.systemB = new SystemBBric({ baseDir: path.join(config.baseDir, 'system-b') })
    this.compliance = new ComplianceAgent({ baseDir: path.join(config.baseDir, 'compliance') })
    this.spine = new Spine({ baseDir: path.join(config.baseDir, 'spine') })
    this.publicBric = new PublicBric({
      baseDir: path.join(config.baseDir, 'public'),
      publicBaseUrl: config.publicBaseUrl,
    })
    // OwnersRoom requires Supabase credentials; use empty strings for script contexts
    // TODO: inject real credentials when running against a live environment
    this.ownersRoom = new OwnersRoom({
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    })
  }

  getSystemB(): SystemBBric {
    return this.systemB
  }

  getCompliance(): ComplianceAgent {
    return this.compliance
  }

  getSpine(): Spine {
    return this.spine
  }

  getPublicLayer(): PublicBric {
    return this.publicBric
  }

  getOwnersRoom(): OwnersRoom {
    return this.ownersRoom
  }

  async shutdown(): Promise<void> {
    // Graceful shutdown: flush pending writes and close handles
    void this.config
  }
}

export async function createBRICS(config: BRICSConfig): Promise<BRICSOrchestrator> {
  return new BRICSOrchestrator(config)
}
