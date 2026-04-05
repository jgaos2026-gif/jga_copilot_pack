/**
 * System Orchestrator Integration Tests
 * Validates boot sequence, subsystem wiring, and combined system status
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { SystemOrchestrator } from '@/lib/system/orchestrator';

const TMP_DIR = '/tmp/tests-orchestrator';

async function cleanup() {
  try {
    await fs.rm(TMP_DIR, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

function makeOrchestrator(skipAll = true): SystemOrchestrator {
  return new SystemOrchestrator({
    baseDir: TMP_DIR,
    publicBaseUrl: 'https://test.example.com',
    skipLandingPage: skipAll,
    skipComplianceTests: skipAll,
  });
}

describe('SystemOrchestrator — construction', () => {
  it('constructs without throwing', () => {
    expect(() => makeOrchestrator()).not.toThrow();
  });

  it('exposes all subsystem references', () => {
    const orch = makeOrchestrator();
    expect(orch.eventBus).toBeDefined();
    expect(orch.spine).toBeDefined();
    expect(orch.complianceAgent).toBeDefined();
    expect(orch.overseer).toBeDefined();
    expect(orch.publicBric).toBeDefined();
    expect(orch.systemB).toBeDefined();
  });

  it('getStatus reports all subsystems as pending before boot', () => {
    const orch = makeOrchestrator();
    const status = orch.getStatus();
    expect(status.ready).toBe(false);
    for (const s of status.subsystems) {
      expect(s.status).toBe('pending');
    }
  });
});

describe('SystemOrchestrator — boot sequence', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('boot() resolves and marks all subsystems ready', async () => {
    const orch = makeOrchestrator();
    const status = await orch.boot();
    expect(status.ready).toBe(true);
    for (const s of status.subsystems) {
      expect(s.status).toBe('ready');
    }
  });

  it('getStatus after boot returns ready=true', async () => {
    const orch = makeOrchestrator();
    await orch.boot();
    const status = orch.getStatus();
    expect(status.ready).toBe(true);
  });

  it('bootedAt is set after boot', async () => {
    const orch = makeOrchestrator();
    const before = Date.now();
    await orch.boot();
    const status = orch.getStatus();
    expect(status.bootedAt).toBeGreaterThanOrEqual(before);
  });

  it('compliance is not approved when skipComplianceTests=true', async () => {
    const orch = makeOrchestrator(true);
    await orch.boot();
    const status = orch.getStatus();
    // Compliance artifact was not generated in skip mode
    expect(status.complianceApproved).toBe(false);
  });

  it('compliance IS approved when skipComplianceTests=false', async () => {
    const orch = new SystemOrchestrator({
      baseDir: TMP_DIR,
      skipLandingPage: true,
      skipComplianceTests: false,
    });
    await orch.boot();
    const status = orch.getStatus();
    expect(status.complianceApproved).toBe(true);
  });
});

describe('SystemOrchestrator — subsystem wiring', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('event bus is live and delivers events after boot', async () => {
    const orch = makeOrchestrator();
    await orch.boot();

    const received: string[] = [];
    orch.eventBus.subscribe('wiring-test', async (e) => {
      received.push(e.id);
    });

    const { createEvent, EventTopics } = await import('@/lib/event-system/index');
    const event = createEvent('test.event', 'wiring-test', { x: 1 }, 'test');
    await orch.eventBus.publish(event);

    expect(received).toContain(event.id);
  });

  it('spine has all 8 system laws', async () => {
    const orch = makeOrchestrator();
    await orch.boot();
    expect(orch.spine.getAllSystemLaws()).toHaveLength(8);
  });

  it('overseer has telemetry recorded during boot', async () => {
    const orch = makeOrchestrator();
    await orch.boot();
    const health = orch.overseer.getHealthSummary();
    expect(health.telemetryPoints).toBeGreaterThan(0);
  });
});

describe('SystemOrchestrator — Overseer → Compliance wiring', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('publishing a critical overseer incident revokes compliance gate', async () => {
    const orch = new SystemOrchestrator({
      baseDir: TMP_DIR,
      skipLandingPage: true,
      skipComplianceTests: false,
    });
    await orch.boot();

    // Verify compliance was approved
    expect(orch.complianceAgent.getComplianceState().approved).toBe(true);

    // Simulate overseer detecting a critical incident via event
    const { createEvent } = await import('@/lib/event-system/index');
    const event = createEvent(
      'incident.critical',
      'overseer-incidents',
      { severity: 'critical', description: 'credential leak detected' },
      'overseer'
    );
    await orch.eventBus.publish(event);

    // Compliance gate should now be closed
    expect(orch.complianceAgent.getComplianceState().approved).toBe(false);
  });
});

describe('SystemOrchestrator — full system health check', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('returns riskLevel=0 on a fresh clean boot', async () => {
    const orch = makeOrchestrator();
    await orch.boot();
    const status = orch.getStatus();
    expect(status.riskLevel).toBe(0);
  });

  it('all subsystem names are present in status', async () => {
    const orch = makeOrchestrator();
    await orch.boot();
    const names = orch.getStatus().subsystems.map(s => s.name);
    expect(names).toContain('event-bus');
    expect(names).toContain('spine');
    expect(names).toContain('compliance-agent');
    expect(names).toContain('overseer');
    expect(names).toContain('public');
    expect(names).toContain('system-b');
  });
});
