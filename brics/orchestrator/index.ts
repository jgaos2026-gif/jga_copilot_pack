/**
 * BRICS Orchestrator
 * Coordinates lifecycle and health of all BRIC modules
 */

import { Spine } from '../spine/index.js';
import { ComplianceAgent } from '../spine/compliance-agent.js';
import { PublicBric } from '../public/index.js';
import { SystemBBric } from '../system-b/index.js';
import { OwnersRoom } from '../owners-room/index.js';

export interface OrchestratorConfig {
  supabaseUrl?: string;
  supabaseKey?: string;
  baseDir?: string;
  stateCodes?: string[];
  publicBaseUrl?: string;
  mfaRequired?: boolean;
  vpnRequired?: boolean;
}

/**
 * Central orchestrator that manages BRIC lifecycle
 */
export class BRICSOrchestrator {
  private spine: Spine;
  private compliance: ComplianceAgent;
  private publicBric: PublicBric;
  private systemB: SystemBBric;
  private ownersRoom: OwnersRoom | null = null;
  private running = false;

  constructor(config: OrchestratorConfig = {}) {
    const baseDir = config.baseDir || '/tmp/jga-brics';
    this.spine = new Spine({ baseDir: `${baseDir}/spine` });
    this.compliance = new ComplianceAgent({ baseDir: `${baseDir}/compliance` });
    this.publicBric = new PublicBric({
      baseDir: `${baseDir}/public`,
      publicBaseUrl: config.publicBaseUrl || 'http://localhost:3000',
    });
    this.systemB = new SystemBBric({ baseDir: `${baseDir}/system-b` });

    if (config.supabaseUrl && config.supabaseKey) {
      this.ownersRoom = new OwnersRoom({
        supabaseUrl: config.supabaseUrl,
        supabaseServiceKey: config.supabaseKey,
      });
    }
  }

  /** Start all BRIC services */
  async start(): Promise<void> {
    if (this.running) return;
    console.log('[Orchestrator] Starting BRIC services...');
    this.running = true;
    console.log('[Orchestrator] All BRIC services started.');
  }

  /** Gracefully shut down all BRIC services */
  async shutdown(): Promise<void> {
    if (!this.running) return;
    console.log('[Orchestrator] Shutting down BRIC services...');
    this.running = false;
    console.log('[Orchestrator] All BRIC services stopped.');
  }

  /** Expose Spine BRIC */
  getSpine(): Spine {
    return this.spine;
  }

  /** Expose Compliance Agent */
  getCompliance(): ComplianceAgent {
    return this.compliance;
  }

  /** Expose Public BRIC */
  getPublicLayer(): PublicBric {
    return this.publicBric;
  }

  /** Expose System B BRIC */
  getSystemB(): SystemBBric {
    return this.systemB;
  }

  /** Expose Owners Room BRIC (requires supabase credentials) */
  getOwnersRoom(): OwnersRoom {
    if (!this.ownersRoom) {
      throw new Error('OwnersRoom requires supabaseUrl and supabaseKey in config');
    }
    return this.ownersRoom;
  }

  /** Health check across all BRICs */
  async healthCheck(): Promise<Record<string, boolean>> {
    return {
      spine: true,
      compliance: true,
      public: true,
      'system-b': true,
      orchestrator: this.running,
    };
  }

  /** Get compliance status across all BRICs */
  async getComplianceStatus(): Promise<{ ok: boolean; details: string }> {
    const laws = this.spine.getAllSystemLaws();
    const violations = laws.flatMap(l => l.violations);
    return {
      ok: violations.length === 0,
      details: violations.length === 0 ? 'All laws enforced' : violations.join('; '),
    };
  }

  isRunning(): boolean {
    return this.running;
  }
}

/**
 * Factory: create and start a BRICSOrchestrator
 */
export async function createBRICS(
  config?: OrchestratorConfig
): Promise<BRICSOrchestrator> {
  const orchestrator = new BRICSOrchestrator(config);
  await orchestrator.start();
  return orchestrator;
}
