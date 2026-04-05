/**
 * JGA Enterprise OS — System Orchestrator
 *
 * Boots all subsystems in the correct constitutional order and wires them
 * together through the shared EventBus.
 *
 * Boot order (mandated by SYSTEM_CONSTITUTION.md):
 *   1. EventBus           — nervous system (no dependencies)
 *   2. Spine              — policy / law repository
 *   3. ComplianceAgent    — must produce a valid artifact before business ops
 *   4. Overseer           — monitoring and incident detection
 *   5. PublicBric         — static content layer
 *   6. SystemBBric        — contractor onboarding / work routing
 *   (StateBric and OwnersRoom require live Supabase and are not booted here)
 *
 * The orchestrator does NOT hold references to Supabase-dependent BRICs
 * so it can be exercised in tests and local dev without credentials.
 */

import { EventBus, createEvent, EventTopics } from '../event-system/index.js';
import { Spine } from '../../brics/spine/index.js';
import { ComplianceAgent } from '../../brics/spine/compliance-agent.js';
import { Overseer } from '../../brics/spine/overseer.js';
import { PublicBric } from '../../brics/public/index.js';
import { SystemBBric } from '../../brics/system-b/index.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SubsystemStatus = 'pending' | 'booting' | 'ready' | 'error';

export interface SubsystemState {
  name: string;
  status: SubsystemStatus;
  bootedAt?: number;
  error?: string;
}

export interface SystemStatus {
  ready: boolean;
  subsystems: SubsystemState[];
  complianceApproved: boolean;
  riskLevel: number;
  bootedAt?: number;
}

export interface OrchestratorConfig {
  baseDir: string;
  publicBaseUrl?: string;
  cdnUrl?: string;
  /** Skip publishing the default landing page during boot (useful in tests) */
  skipLandingPage?: boolean;
  /** Skip running compliance tests during boot (useful in tests) */
  skipComplianceTests?: boolean;
}

// ---------------------------------------------------------------------------
// SystemOrchestrator
// ---------------------------------------------------------------------------

export class SystemOrchestrator {
  // Public surfaces for external wiring
  readonly eventBus: EventBus;
  readonly spine: Spine;
  readonly complianceAgent: ComplianceAgent;
  readonly overseer: Overseer;
  readonly publicBric: PublicBric;
  readonly systemB: SystemBBric;

  private subsystems: Map<string, SubsystemState> = new Map();
  private bootedAt?: number;

  constructor(private config: OrchestratorConfig) {
    // 1. EventBus first — all others depend on it
    this.eventBus = new EventBus();

    // 2. Spine — policy/law repository
    this.spine = new Spine({ baseDir: `${config.baseDir}/spine` });

    // 3. ComplianceAgent — controls the business-call gate
    this.complianceAgent = new ComplianceAgent({
      baseDir: `${config.baseDir}/compliance`,
    });

    // 4. Overseer — monitoring
    this.overseer = new Overseer({ baseDir: `${config.baseDir}/overseer` });

    // 5. PublicBric — static content
    this.publicBric = new PublicBric({
      baseDir: `${config.baseDir}/public`,
      publicBaseUrl: config.publicBaseUrl ?? 'https://jgaos.example.com',
      cdnUrl: config.cdnUrl,
    });

    // 6. SystemBBric — contractor routing
    this.systemB = new SystemBBric({ baseDir: `${config.baseDir}/system-b` });

    // Register every subsystem as pending
    for (const name of ['event-bus', 'spine', 'compliance-agent', 'overseer', 'public', 'system-b']) {
      this.subsystems.set(name, { name, status: 'pending' });
    }
  }

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------

  /**
   * Boot the system in constitutional order.
   * Returns when all subsystems are ready (or have failed).
   */
  async boot(): Promise<SystemStatus> {
    this.bootedAt = Date.now();

    // Step 1 — EventBus (no async init required)
    this.setStatus('event-bus', 'ready');
    this.emitSystemEvent('system.bus_ready', 'event-bus', {});

    // Step 2 — Spine
    await this.bootSubsystem('spine', async () => {
      await this.spine.ensureDir();
      const audit = await this.spine.auditLawEnforcement();
      if (!audit.ok) {
        throw new Error(`Spine law enforcement incomplete: ${audit.unenforced.join(', ')}`);
      }
    });

    // Step 3 — Compliance Agent (MUST succeed before business ops)
    await this.bootSubsystem('compliance-agent', async () => {
      await this.complianceAgent.ensureDir();

      if (!this.config.skipComplianceTests) {
        // Ingest baseline regulation and generate artifact
        await this.complianceAgent.ingestRegulation(
          'JGA System Constitution',
          'custom',
          'Baseline compliance requirements from SYSTEM_CONSTITUTION.md',
          '1.0'
        );
        await this.complianceAgent.generateComplianceArtifact();
      }

      this.emitSystemEvent('compliance.agent_ready', 'compliance-agent', {
        approved: this.complianceAgent.getComplianceState().approved,
      });
    });

    // Wire Overseer → Compliance gate (auto-close on critical incident)
    this.wireOverseerToCompliance();

    // Step 4 — Overseer
    await this.bootSubsystem('overseer', async () => {
      await this.overseer.ensureDir();
      await this.overseer.recordTelemetry('system', 'boot_started', this.bootedAt!);
    });

    // Step 5 — Public BRIC
    await this.bootSubsystem('public', async () => {
      await this.publicBric.ensureDir();
      if (!this.config.skipLandingPage) {
        await this.publicBric.createLandingPage();
        await this.publicBric.createOwnersRoomEntry();
      }
    });

    // Step 6 — System B
    await this.bootSubsystem('system-b', async () => {
      await this.systemB.ensureDir();
    });

    // Wire the event bus between systems
    this.wireEventBus();

    // Record successful boot telemetry
    await this.overseer.recordTelemetry('system', 'boot_complete', Date.now());
    this.emitSystemEvent('system.ready', 'orchestrator', { uptime: 0 });

    return this.getStatus();
  }

  // ---------------------------------------------------------------------------
  // Status
  // ---------------------------------------------------------------------------

  getStatus(): SystemStatus {
    const allReady = [...this.subsystems.values()].every(s => s.status === 'ready');
    const complianceState = this.complianceAgent.getComplianceState();
    const health = this.overseer.getHealthSummary();

    return {
      ready: allReady,
      subsystems: [...this.subsystems.values()],
      complianceApproved: complianceState.approved,
      riskLevel: health.riskLevel,
      bootedAt: this.bootedAt,
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async bootSubsystem(name: string, init: () => Promise<void>): Promise<void> {
    const state = this.subsystems.get(name)!;
    state.status = 'booting';

    try {
      await init();
      state.status = 'ready';
      state.bootedAt = Date.now();
    } catch (err) {
      state.status = 'error';
      state.error = err instanceof Error ? err.message : String(err);
      // Log but continue booting other subsystems
      console.error(`[Orchestrator] Subsystem "${name}" failed to boot:`, state.error);
      this.emitSystemEvent('system.subsystem_error', 'orchestrator', { subsystem: name, error: state.error });
    }
  }

  private setStatus(name: string, status: SubsystemStatus): void {
    const state = this.subsystems.get(name)!;
    state.status = status;
    if (status === 'ready') {
      state.bootedAt = Date.now();
    }
  }

  /**
   * Wire Overseer → ComplianceAgent
   * If Overseer detects a critical incident it auto-revokes the compliance gate.
   */
  private wireOverseerToCompliance(): void {
    this.eventBus.subscribe('overseer-incidents', async (event) => {
      if (event.data.severity === 'critical') {
        await this.complianceAgent.revokeCompliance(
          `Critical incident detected by Overseer: ${event.data.description}`
        );
        this.emitSystemEvent('compliance.gate_closed', 'overseer', {
          reason: event.data.description,
        });
      }
    });
  }

  /**
   * Wire EventBus topics to cross-subsystem handlers.
   *
   * Current wiring:
   *   intake_created → SystemB captures contractor lead (if applicable)
   *   audit_log      → Overseer telemetry
   */
  private wireEventBus(): void {
    // Intake events → overseer telemetry
    this.eventBus.subscribe(EventTopics.INTAKE_CREATED, async (event) => {
      await this.overseer.recordTelemetry('public', 'intake_created', event.id);
    });

    // Audit log → overseer telemetry
    this.eventBus.subscribe(EventTopics.AUDIT_LOG, async (event) => {
      await this.overseer.recordTelemetry(event.sourceId, 'audit_event', event.type);
    });

    // Compliance events → update overseer
    this.eventBus.subscribe(EventTopics.COMPLIANCE_APPROVED, async (event) => {
      await this.overseer.recordTelemetry('compliance-agent', 'gate_status', event.data.approved ?? true);
    });
  }

  private emitSystemEvent(type: string, source: string, data: Record<string, unknown>): void {
    const event = createEvent(type, EventTopics.AUDIT_LOG, data, source);
    // Fire-and-forget: boot sequence must not block on event delivery.
    // Delivery failures are logged internally by the EventBus (DLQ) and are
    // non-fatal during startup.
    void this.eventBus.publish(event);
  }
}
